import { dirname, isAbsolute, join, resolve } from "node:path";
import { run } from "../proc.ts";
import { flatten, type Parsed, toolJob } from "../job.ts";
import { findUp, resolveBinary } from "../resolve.ts";
import type { Diagnostic, Job, JobContext, Target } from "../types.ts";
import { groupByRoot, paths } from "./common.ts";
import { homedir } from "node:os";

const SUMMARY = /^(aborting due to|\d+ (warnings?|errors?) emitted|could not compile)/;

interface CargoMessage {
	reason?: string;
	manifest_path?: string;
	message?: {
		level?: string;
		code?: { code?: string } | null;
		message?: string;
		spans?: Array<{ is_primary?: boolean; file_name: string; line_start: number; column_start: number }>;
	};
}

export function parseCargo(stdout: string, workspaceRoot: string | undefined, root: string): Parsed {
	const diagnostics: Diagnostic[] = [];
	let finished = false;
	for (const line of stdout.split("\n")) {
		if (!line.startsWith("{")) continue;
		let entry: CargoMessage;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		if (entry.reason === "build-finished") finished = true;
		const message = entry.message;
		if (entry.reason !== "compiler-message" || !message) continue;
		const span = message.spans?.find((candidate) => candidate.is_primary);
		const level = message.level;
		if (!span || (level !== "error" && level !== "warning") || SUMMARY.test(message.message ?? "")) continue;
		const base = workspaceRoot ?? (entry.manifest_path ? dirname(entry.manifest_path) : root);
		diagnostics.push({
			file: isAbsolute(span.file_name) ? span.file_name : resolve(base, span.file_name),
			line: span.line_start,
			column: span.column_start,
			severity: level,
			code: message.code?.code ?? "",
			message: message.message ?? "",
		});
	}
	return finished ? diagnostics : { failed: "" };
}

async function workspaceRoot(cargo: string, root: string, ctx: JobContext): Promise<string | undefined> {
	try {
		const result = await run(cargo, ["metadata", "--no-deps", "--format-version", "1"], { cwd: root, signal: ctx.signal, timeoutMs: ctx.timeoutMs });
		return result.code === 0 ? JSON.parse(result.stdout).workspace_root : undefined;
	} catch (error) {
		if ((error as Error).message === "aborted") throw error;
		return undefined;
	}
}

export function planRust(targets: Target[], env: NodeJS.ProcessEnv): Job[] {
	const cargoBin = join(env.CARGO_HOME ?? join(homedir(), ".cargo"), "bin");
	const options = { extraDirs: [cargoBin], env };
	const jobs: Job[] = [];
	for (const [root, group] of groupByRoot(targets, "rust", (dir) => findUp(dir, ["Cargo.toml"]))) {
		const bin = resolveBinary("cargo", root, options);
		const clippy = "path" in bin && resolveBinary("cargo-clippy", root, { env, extraDirs: [dirname(bin.path), cargoBin] });
		const useClippy = !!clippy && "path" in clippy;
		const sub = useClippy ? "clippy" : "check";
		jobs.push(
			toolJob({
				label: `cargo ${sub}`,
				root,
				covers: paths(group),
				bin,
				cwd: root,
				args: [sub, "--message-format=json", "--quiet"],
				parse: async (r, ctx) => parseCargo(r.stdout, "path" in bin ? await workspaceRoot(bin.path, root, ctx) : undefined, root),
			}),
		);
	}
	return jobs;
}
