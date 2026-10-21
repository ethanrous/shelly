import { MAX_ERROR_LINES, MAX_MESSAGE_CHARS } from "./config.ts";
import { run, type RunResult } from "./proc.ts";
import { type Resolved } from "./resolve.ts";
import { sep } from "node:path";
import type { Diagnostic, Job, JobContext, Outcome } from "./types.ts";

export const flatten = (text: string, max = MAX_MESSAGE_CHARS) => {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
};

// Parsers return diagnostics, or a failure reason (empty to use the stderr tail).
export type Parsed = Diagnostic[] | { failed: string };

export interface ToolSpec {
	label: string;
	root: string;
	covers: string[];
	bin: Resolved;
	args: string[];
	cwd: string;
	parse(result: RunResult, ctx: JobContext): Promise<Parsed> | Parsed;
}

export function tail(result: RunResult): string {
	const lines = (result.stderr.trim() || result.stdout.trim()).split("\n").map((line) => flatten(line)).filter((line) => line && !/^(at |Node\.js v)/.test(line));
	return lines.slice(-MAX_ERROR_LINES).join(" | ");
}

const within = (file: string, target: string) => file === target || file.startsWith(target + sep);

export function finish(diagnostics: Diagnostic[], covers: string[]): Outcome {
	const seen = new Set<string>();
	const kept: Diagnostic[] = [];
	let dropped = 0;
	for (const d of diagnostics) {
		const key = [d.file, d.line, d.column, d.code, d.message].join("\0");
		if (seen.has(key)) continue;
		seen.add(key);
		if (covers.some((target) => within(d.file, target))) kept.push(d);
		else dropped++;
	}
	return { kind: "ok", diagnostics: kept, dropped };
}

export function toolJob(spec: ToolSpec): Job {
	const { label, root, covers } = spec;
	return {
		label,
		root,
		covers,
		async run(ctx) {
			if ("looked" in spec.bin) return { kind: "not-found", looked: spec.bin.looked };
			let result: RunResult;
			try {
				result = await run(spec.bin.path, spec.args, { cwd: spec.cwd, signal: ctx.signal, timeoutMs: ctx.timeoutMs });
			} catch (error) {
				if ((error as Error).message === "aborted") throw error;
				return { kind: "failed", reason: `failed: ${flatten((error as Error).message)}` };
			}
			if (result.timedOut) return { kind: "timeout", seconds: ctx.timeoutMs / 1000 };
			const parsed = await spec.parse(result, ctx);
			if (Array.isArray(parsed)) return finish(parsed, covers);
			return { kind: "failed", reason: `failed (exit ${result.code}): ${parsed.failed || tail(result)}` };
		},
	};
}
