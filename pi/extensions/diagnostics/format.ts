import { relative } from "node:path";
import { MAX_DIAGNOSTICS, MAX_LISTED_PATHS, MAX_MESSAGE_CHARS, MAX_OUTPUT_BYTES } from "./config.ts";
import { flatten } from "./job.ts";
import type { Diagnostic, JobResult } from "./types.ts";

const FOOTER_RESERVE = 200;

export function displayPath(path: string, cwd: string): string {
	const rel = relative(cwd, path);
	return rel === "" ? "." : rel.startsWith("..") ? path : rel;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function counts(diagnostics: Diagnostic[]): string {
	const parts: string[] = [];
	for (const [severity, word] of [["error", "error"], ["warning", "warning"], ["info", "info"]] as const) {
		const n = diagnostics.filter((d) => d.severity === severity).length;
		if (n) parts.push(severity === "info" ? `${n} info` : plural(n, word));
	}
	return parts.join(", ");
}

function summary(result: JobResult): string {
	const { outcome } = result;
	switch (outcome.kind) {
		case "failed":
			return outcome.reason;
		case "timeout":
			return `timed out after ${outcome.seconds} s`;
		case "not-found":
			return `not found (looked in ${outcome.looked.join(", ")})`;
		case "ok": {
			const elsewhere = outcome.dropped ? ` (${outcome.dropped} elsewhere in the project)` : "";
			if (outcome.diagnostics.length) return `${counts(outcome.diagnostics)}${elsewhere}`;
			return outcome.dropped ? `no issues in the requested paths${elsewhere}` : "no issues";
		}
	}
}

const byLocation = (cwd: string) => (a: Diagnostic, b: Diagnostic) => {
	const left = displayPath(a.file, cwd);
	const right = displayPath(b.file, cwd);
	return left < right ? -1 : left > right ? 1 : a.line - b.line || a.column - b.column;
};

export function noCheckerLine(paths: string[]): string {
	const shown = paths.slice(0, MAX_LISTED_PATHS).join(", ");
	return `no checker for: ${shown}${paths.length > MAX_LISTED_PATHS ? `, +${paths.length - MAX_LISTED_PATHS} more` : ""}`;
}

export function formatReport(results: JobResult[], extra: string[], cwd: string): string {
	const lines: string[] = [];
	let bytes = 0;
	let shown = 0;
	let hidden = 0;
	const push = (line: string) => {
		lines.push(line);
		bytes += Buffer.byteLength(line) + 1;
	};
	const rootsPerLabel = new Map<string, Set<string>>();
	for (const { label, root } of results) rootsPerLabel.set(label, (rootsPerLabel.get(label) ?? new Set()).add(root));
	for (const result of results) {
		const where = (rootsPerLabel.get(result.label)?.size ?? 0) > 1 ? ` (${displayPath(result.root, cwd)})` : "";
		push(`${result.label}${where}: ${summary(result)}`);
		if (result.outcome.kind !== "ok") continue;
		let file: string | undefined;
		for (const d of [...result.outcome.diagnostics].sort(byLocation(cwd))) {
			const name = displayPath(d.file, cwd);
			const code = d.code ? `  ${d.code}` : "";
			const line = `  ${d.line}:${d.column}  ${d.severity}${code}  ${flatten(d.message, MAX_MESSAGE_CHARS)}`;
			const cost = Buffer.byteLength(line) + (name === file ? 0 : Buffer.byteLength(name) + 1);
			if (shown >= MAX_DIAGNOSTICS || bytes + cost + FOOTER_RESERVE > MAX_OUTPUT_BYTES) {
				hidden++;
				continue;
			}
			if (name !== file) push(name);
			file = name;
			push(line);
			shown++;
		}
	}
	if (hidden) push(`${plural(hidden, "more diagnostic")} not shown; narrow paths to see them`);
	for (const line of extra) push(line);
	return lines.join("\n");
}
