import { CHECK_TIMEOUT_MS, CONCURRENCY } from "./config.ts";
import { planPython } from "./checkers/python.ts";
import { planRust } from "./checkers/rust.ts";
import { planTypescript } from "./checkers/typescript.ts";
import { formatReport, noCheckerLine, displayPath } from "./format.ts";
import { changedFiles, realPath, resolveTargets } from "./targets.ts";
import type { Job, JobResult } from "./types.ts";

export interface RunContext {
	cwd: string;
	signal?: AbortSignal;
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
}

async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		for (let i = next++; i < items.length; i = next++) results[i] = await work(items[i]);
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

export async function runDiagnostics(params: { paths?: string[] }, ctx: RunContext): Promise<string> {
	const cwd = realPath(ctx.cwd);
	const env = ctx.env ?? process.env;
	let requested = (params.paths ?? []).filter((path) => path.trim());
	const extra: string[] = [];
	if (requested.length === 0) {
		const changed = await changedFiles(cwd, ctx.signal);
		if ("error" in changed) return `No paths given and ${changed.error}; pass paths to check.`;
		if (changed.files.length === 0) return "No changed files to check.";
		requested = changed.files;
	}
	const { targets, missing } = resolveTargets(requested, cwd);
	if (missing.length) extra.push(`not found: ${missing.join(", ")}`);
	const jobs: Job[] = [...planPython(targets, env), ...planTypescript(targets, env), ...planRust(targets, env)];
	const covered = new Set(jobs.flatMap((job) => job.covers));
	const unsupported = targets.filter((target) => !covered.has(target.path)).map((target) => displayPath(target.path, cwd));
	if (unsupported.length) extra.unshift(noCheckerLine(unsupported));
	const results = await pool(jobs, CONCURRENCY, async (job): Promise<JobResult> => ({ label: job.label, root: job.root, outcome: await job.run({ signal: ctx.signal, timeoutMs: ctx.timeoutMs ?? CHECK_TIMEOUT_MS }) }));
	return formatReport(results, extra, cwd);
}
