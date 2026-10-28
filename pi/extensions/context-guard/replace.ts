import { readFile, writeFile } from "node:fs/promises";
import { displayPath } from "./format.ts";
import { isSupportedSource } from "./languages.ts";
import { rgReplace } from "./proc.ts";
import { enclosingName } from "./references.ts";
import { fileDefinitions } from "./symbols.ts";
import { resolvePath, searchOptions, type ToolContext } from "./tools.ts";

export interface ReplaceParams {
	pattern: string;
	with: string;
	path?: string | readonly string[];
	glob?: string | readonly string[];
	regex?: boolean;
	ignore_case?: boolean;
	expect?: number;
}

export interface ReplaceContext extends ToolContext {
	// Wraps each file write; defaults to running fn directly.
	mutate?: <T>(file: string, fn: () => Promise<T>) => Promise<T>;
}

interface Edit {
	offset: number;
	match: Buffer;
	replacement: Buffer;
}

interface Planned {
	file: string;
	original: Buffer;
	edits: Edit[];
	updated: Buffer;
	// Ranges in the updated content, as byte offsets.
	spans: { start: number; end: number }[];
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

const list = (value: string | readonly string[] | undefined): string[] => (value === undefined ? [] : typeof value === "string" ? [value] : [...value]).filter((v) => v !== "");

const spansLines = (pattern: string, regex: boolean) => pattern.includes("\n") || (regex && /\\[nr]|\(\?[a-z]*s/.test(pattern));

function lineStarts(buf: Buffer): number[] {
	const starts = [0];
	for (let i = buf.indexOf(10); i !== -1; i = buf.indexOf(10, i + 1)) starts.push(i + 1);
	return starts;
}

// Zero-based index of the last start at or before offset.
function lineIndex(starts: readonly number[], offset: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

function plan(file: string, original: Buffer, edits: Edit[]): Planned | undefined {
	edits.sort((a, b) => a.offset - b.offset);
	const parts: Buffer[] = [];
	const spans: { start: number; end: number }[] = [];
	let cursor = 0;
	let length = 0;
	for (const edit of edits) {
		const end = edit.offset + edit.match.length;
		if (edit.offset < cursor || !original.subarray(edit.offset, end).equals(edit.match)) return undefined;
		const keep = original.subarray(cursor, edit.offset);
		parts.push(keep, edit.replacement);
		length += keep.length;
		spans.push({ start: length, end: length + edit.replacement.length });
		length += edit.replacement.length;
		cursor = end;
	}
	parts.push(original.subarray(cursor));
	return { file, original, edits, updated: Buffer.concat(parts), spans };
}

interface ShownLine {
	line: number;
	text: string;
	enclosing?: string;
}

function changedLines(content: Buffer, spans: readonly { start: number; end: number }[]): ShownLine[] {
	const starts = lineStarts(content);
	const lines = new Set<number>();
	for (const { start, end } of spans) {
		for (let i = lineIndex(starts, start); i <= lineIndex(starts, Math.max(start, end - 1)); i++) lines.add(i);
	}
	return [...lines]
		.sort((a, b) => a - b)
		.map((i) => ({ line: i + 1, text: content.toString("utf8", starts[i], i + 1 < starts.length ? starts[i + 1] : content.length).trim() }));
}

async function render(plans: readonly Planned[], shown: (p: Planned) => { content: Buffer; spans: { start: number; end: number }[] }, ctx: ReplaceContext): Promise<string[]> {
	const supported = plans.map((p) => p.file).filter(isSupportedSource);
	const defs = supported.length > 0 ? await fileDefinitions(supported, searchOptions(ctx, ctx.cwd)).catch(() => undefined) : undefined;
	const out: string[] = [];
	for (const p of [...plans].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
		out.push(displayPath(p.file, ctx.cwd));
		const { content, spans } = shown(p);
		for (const line of changedLines(content, spans)) {
			const name = defs ? enclosingName(defs.get(p.file) ?? [], line.line) : undefined;
			out.push(`  ${line.line}${name ? ` (in ${name})` : ""}  ${line.text}`);
		}
	}
	return out;
}

export async function runReplace(params: ReplaceParams, ctx: ReplaceContext): Promise<string> {
	if (typeof params.pattern !== "string" || params.pattern === "") throw new Error("pattern must be a non-empty string.");
	if (typeof params.with !== "string") throw new Error("with must be a string.");
	if (params.expect !== undefined && (!Number.isInteger(params.expect) || params.expect < 0)) throw new Error("expect must be an integer >= 0.");
	const paths = list(params.path);
	const roots = [...new Set(await Promise.all(paths.length > 0 ? paths.map((p) => resolvePath(p, ctx)) : [resolvePath(undefined, ctx)]))];
	const globs = list(params.glob);
	const regex = params.regex === true;
	const ignoreCase = params.ignore_case === true;
	const byFile = new Map<string, Map<number, Edit>>();
	await rgReplace(
		{ pattern: params.pattern, replacement: params.with, roots, regex, ignoreCase, globs, multiline: spansLines(params.pattern, regex) },
		{ cwd: ctx.cwd, signal: ctx.signal },
		(file, offset, match, replacement) => {
			const edits = byFile.get(file) ?? new Map<number, Edit>();
			byFile.set(file, edits);
			// Overlapping roots report the same match more than once.
			edits.set(offset, { offset, match, replacement });
		},
	);
	const modes = [...(regex ? ["regex"] : []), ...(ignoreCase ? ["ignore case"] : []), ...(globs.length > 0 ? [`glob ${globs.join(" ")}`] : [])];
	const modeText = modes.length > 0 ? ` (${modes.join(", ")})` : "";
	const quoted = `"${params.pattern}"`;
	if (byFile.size === 0) return `No matches for ${quoted}${paths.length > 0 ? ` in ${paths.join(", ")}` : ""}${modeText}; nothing was changed.`;

	const plans: Planned[] = [];
	const problems: string[] = [];
	for (const [file, edits] of byFile) {
		const planned = plan(file, await readFile(file), [...edits.values()]);
		if (planned) plans.push(planned);
		else problems.push(`${displayPath(file, ctx.cwd)}: changed while it was being read; left unchanged.`);
	}
	const total = plans.reduce((sum, p) => sum + p.edits.length, 0);
	if (params.expect !== undefined && params.expect !== total) {
		const head = `Found ${plural(total, "occurrence")} of ${quoted} in ${plural(plans.length, "file")}, expected ${params.expect.toLocaleString("en-US")}; nothing was changed.`;
		const current = await render(
			plans,
			(p) => ({ content: p.original, spans: p.edits.map((e) => ({ start: e.offset, end: e.offset + e.match.length })) }),
			ctx,
		);
		return [head, ...current, ...problems].join("\n");
	}

	const written: Planned[] = [];
	for (const p of plans) {
		try {
			await (ctx.mutate ?? ((_file, fn) => fn()))(p.file, async () => {
				if (!(await readFile(p.file)).equals(p.original)) throw new Error("changed since it was searched");
				await writeFile(p.file, p.updated);
			});
			written.push(p);
		} catch (error) {
			problems.push(`${displayPath(p.file, ctx.cwd)}: ${(error as Error).message}; left unchanged.`);
		}
	}
	const done = written.reduce((sum, p) => sum + p.edits.length, 0);
	const lines: string[] = [];
	if (written.length > 0) {
		lines.push(`Replaced ${plural(done, "occurrence")} of ${quoted} with "${params.with}" in ${plural(written.length, "file")}${modeText}`);
		lines.push(...(await render(written, (p) => ({ content: p.updated, spans: p.spans }), ctx)));
	}
	return [...lines, ...problems].join("\n");
}
