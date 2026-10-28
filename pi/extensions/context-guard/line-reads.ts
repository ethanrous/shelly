import { homedir } from "node:os";
import { resolve } from "node:path";
import { toolCall } from "./calls.ts";
import { READ_TOOL_MAX_LINES } from "./config.ts";
import { buildTree, definitionRow, displayPath } from "./format.ts";
import { invocations, isAssignment, isOption, NL_VALUE_FLAGS } from "./invocations.ts";
import { isOutlinable } from "./languages.ts";
import { toolProblem } from "./proc.ts";
import { type BlockPart, blockMessage } from "./steering.ts";
import { BODY_KINDS, type Definition, fileDefinitions, readSource } from "./symbols.ts";
import { rangeTargets, searchOptions, type ToolContext } from "./tools.ts";

// Inclusive 1-based lines. A span without an end runs to the end of the file; last counts back from it.
export type LineSpan = { start: number; end?: number } | { last: number };

export interface LineRead {
	command: string;
	file: string;
	spans: LineSpan[];
}

interface RangeArgs {
	spans: LineSpan[];
	files: string[];
}

const COUNT = /^\d+$/;

const span = (start: number, end: number | undefined): LineSpan => (end === undefined ? { start } : { start, end });

// Accepts only numeric print addresses (10,20p 5p 10,$p 10,+5p $p) and quit commands under -n.
function sedRange(args: readonly string[]): RangeArgs | undefined {
	let quiet = false;
	let explicitScript = false;
	const scripts: string[] = [];
	const operands: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--") {
			operands.push(...args.slice(i + 1));
			break;
		}
		if (arg === "-n" || arg === "--quiet" || arg === "--silent") {
			quiet = true;
		} else if (arg === "-e" || arg === "--expression") {
			scripts.push(args[++i] ?? "");
			explicitScript = true;
		} else if (arg.startsWith("--expression=")) {
			scripts.push(arg.slice("--expression=".length));
			explicitScript = true;
		} else if (arg.startsWith("--in-place") || arg.startsWith("--file")) {
			return undefined;
		} else if (/^-[A-Za-z]+$/.test(arg)) {
			if (arg.includes("i") || arg.includes("f")) return undefined;
			if (arg.includes("n")) quiet = true;
			if (arg.endsWith("e")) {
				scripts.push(args[++i] ?? "");
				explicitScript = true;
			}
		} else if (!isOption(arg)) {
			operands.push(arg);
		}
	}
	if (!quiet) return undefined;
	if (!explicitScript) {
		const script = operands.shift();
		if (script === undefined) return undefined;
		scripts.push(script);
	}
	const spans: LineSpan[] = [];
	for (const command of scripts.join("\n").split(/[;\n]/).map((part) => part.trim()).filter(Boolean)) {
		if (/^\d*q$/.test(command)) continue;
		if (command === "$p") {
			spans.push({ last: 1 });
			continue;
		}
		const match = /^(\d+)(?:,(\d+|\$|\+\d+))?p$/.exec(command);
		if (!match) return undefined;
		const start = Number(match[1]);
		const to = match[2];
		if (to === "$") spans.push(span(start, undefined));
		else if (to?.startsWith("+")) spans.push(span(start, start + Number(to.slice(1))));
		else spans.push(span(start, Math.max(start, to === undefined ? start : Number(to))));
	}
	return spans.length > 0 ? { spans, files: operands } : undefined;
}

// The value of -n N, -nN, --lines N, --lines=N, or -N, and the index of the last argument it used.
function lineCountArg(args: readonly string[], i: number): { value: string; next: number } | undefined {
	const arg = args[i];
	if (arg === "-n" || arg === "--lines") return { value: args[i + 1] ?? "", next: i + 1 };
	if (arg.startsWith("--lines=")) return { value: arg.slice("--lines=".length), next: i };
	if (/^-n./.test(arg)) return { value: arg.slice(2), next: i };
	if (/^-\d+$/.test(arg)) return { value: arg.slice(1), next: i };
	return undefined;
}

function headRange(args: readonly string[]): RangeArgs | undefined {
	let count = 10;
	const files: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const counted = lineCountArg(args, i);
		if (counted) {
			if (!COUNT.test(counted.value)) return undefined;
			count = Number(counted.value);
			i = counted.next;
		} else if (arg.startsWith("-c") || arg.startsWith("--bytes")) {
			return undefined;
		} else if (!isOption(arg)) {
			files.push(arg);
		}
	}
	return count > 0 ? { spans: [{ start: 1, end: count }], files } : undefined;
}

function tailRange(args: readonly string[]): RangeArgs | undefined {
	let result: LineSpan = { last: 10 };
	const files: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const counted = /^\+\d+$/.test(arg) ? { value: arg, next: i } : lineCountArg(args, i);
		if (counted) {
			const match = /^(\+)?(\d+)$/.exec(counted.value);
			if (!match) return undefined;
			result = match[1] ? { start: Number(match[2]) } : { last: Number(match[2]) };
			i = counted.next;
		} else if (/^-[A-Za-z]*[fFc]/.test(arg) || arg.startsWith("--follow") || arg.startsWith("--bytes")) {
			return undefined;
		} else if (!isOption(arg)) {
			files.push(arg);
		}
	}
	if ("last" in result && result.last === 0) return undefined;
	return { spans: [result], files };
}

const FLIPPED: Record<string, string> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=", "==": "==" };

// Bounds from NR comparisons, such as NR>=5 && NR<=9, 10<NR, or the range pattern NR==3,NR==8.
function nrSpan(script: string): LineSpan | undefined {
	const range = /\bF?NR\s*==\s*(\d+)\s*,\s*F?NR\s*==\s*(\d+)/.exec(script);
	if (range) return span(Number(range[1]), Number(range[2]));
	let start = 1;
	let end: number | undefined;
	let found = false;
	const apply = (op: string, n: number) => {
		found = true;
		if (op === "==" || op === ">=") start = Math.max(start, n);
		if (op === ">") start = Math.max(start, n + 1);
		if (op === "==" || op === "<=") end = Math.min(end ?? n, n);
		if (op === "<") end = Math.min(end ?? n - 1, n - 1);
	};
	for (const match of script.matchAll(/\bF?NR\s*(==|>=|<=|>|<)\s*(\d+)/g)) apply(match[1], Number(match[2]));
	for (const match of script.matchAll(/(\d+)\s*(==|>=|<=|>|<)\s*F?NR\b/g)) apply(FLIPPED[match[2]], Number(match[1]));
	if (!found || (end !== undefined && end < start)) return undefined;
	return span(start, end);
}

function awkRange(args: readonly string[]): RangeArgs | undefined {
	let script: string | undefined;
	const files: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith("-f")) return undefined;
		if (arg === "-F" || arg === "-v") i++;
		else if (isOption(arg)) continue;
		else if (script === undefined) script = arg;
		else if (!isAssignment(arg)) files.push(arg);
	}
	const lines = script === undefined ? undefined : nrSpan(script);
	return lines ? { spans: [lines], files } : undefined;
}

// Line-range reads of Python, Java, C/C++, and Markdown files, from file arguments, a < redirection, or a cat or nl pipe.
export function findLineReads(command: string, cwd: string, home = homedir()): LineRead[] {
	const reads: LineRead[] = [];
	for (const { text, exe, args, dir, stdin, piped } of invocations(command, cwd, home)) {
		const parsed = exe === "sed" ? sedRange(args) : exe === "head" ? headRange(args) : exe === "tail" ? tailRange(args) : exe === "awk" || exe === "gawk" ? awkRange(args) : undefined;
		if (!parsed) continue;
		const inputs = parsed.files.length > 0 ? parsed.files.map((file) => resolve(dir, file)) : stdin !== undefined ? [stdin] : piped ? [piped] : [];
		for (const file of inputs) {
			if (isOutlinable(file)) reads.push({ command: text, file, spans: parsed.spans });
		}
	}
	return reads;
}

const WHOLE_FILE_READERS = new Set(["cat", "less", "more", "nl", "bat", "batcat"]);

export interface WholeRead {
	command: string;
	file: string;
}

// Whole-file reads of Python, Java, C/C++, and Markdown files by cat, less, more, nl, or bat, from file arguments or a < redirection.
export function findWholeReads(command: string, cwd: string, home = homedir()): WholeRead[] {
	const reads: WholeRead[] = [];
	for (const { text, exe, args, dir, stdin, redirected } of invocations(command, cwd, home)) {
		if (!WHOLE_FILE_READERS.has(exe) || redirected) continue;
		const files: string[] = [];
		for (let i = 0; i < args.length; i++) {
			if (exe === "nl" && NL_VALUE_FLAGS.has(args[i])) i++;
			else if (!isOption(args[i])) files.push(resolve(dir, args[i]));
		}
		if (stdin !== undefined) files.push(stdin);
		for (const file of files) if (isOutlinable(file)) reads.push({ command: text, file });
	}
	return reads;
}

function spanLines(lines: LineSpan, lineCount: number): [number, number] {
	if ("last" in lines) return [Math.max(1, lineCount - lines.last + 1), lineCount];
	return [lines.start, Math.min(lines.end ?? lineCount, lineCount)];
}

// True when a non-blank line of the range sits outside every top-level function, class, or section.
function readsModuleLevel(defs: readonly Definition[], lines: readonly string[], start: number, end: number): boolean {
	const roots = buildTree(defs.filter((def) => BODY_KINDS.has(def.kind))).map((node) => node.def);
	for (let n = start; n <= end; n++) {
		if ((lines[n - 1] ?? "").trim() !== "" && !roots.some((def) => def.startLine <= n && n <= def.endLine)) return true;
	}
	return false;
}

// The calls that read a file's line ranges: the widened range, each definition it touches, and the module view when it holds module-level code.
async function lineRangeCalls(file: string, spans: readonly LineSpan[], ctx: ToolContext): Promise<string[] | undefined> {
	let source;
	try {
		source = await readSource(file);
	} catch {
		return undefined;
	}
	const shown = displayPath(file, ctx.cwd);
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	const ranges = spans.map((readSpan) => spanLines(readSpan, source.lineCount)).filter(([start, end]) => start <= end);
	const rangeCalls = ranges.map(([start, end]) =>
		start === end ? toolCall("read_symbol", { path: shown, line: start }) : toolCall("read_symbol", { path: shown, line: start, end_line: end }),
	);
	const touched = ranges.flatMap(([start, end]) => {
		const { whole, covered } = rangeTargets(defs, start, end);
		return whole ? [whole] : covered;
	});
	const rows = [...new Map(touched.map((def) => [def.startByte, definitionRow(shown, def.nodeStartLine, def)])).values()];
	const module = ranges.some(([start, end]) => readsModuleLevel(defs, source.lines, start, end)) ? [toolCall("read_symbol", { path: shown, module: true })] : [];
	const calls = [...new Set([...rangeCalls, ...rows, ...module])];
	return calls.length > 0 ? calls : [toolCall("outline", { path: shown })];
}

// The reasons to block a bash command that reads Python, Java, C/C++, or Markdown files by line number or whole.
export async function lineReadParts(command: string, ctx: ToolContext): Promise<BlockPart[]> {
	const reads = findLineReads(command, ctx.cwd);
	const wholes = findWholeReads(command, ctx.cwd);
	if ((reads.length === 0 && wholes.length === 0) || (await toolProblem())) return [];
	const parts: BlockPart[] = [];
	const byFile = new Map<string, LineRead[]>();
	for (const read of reads) byFile.set(read.file, [...(byFile.get(read.file) ?? []), read]);
	const subjects: string[] = [];
	const calls: string[] = [];
	for (const [file, fileReads] of byFile) {
		const found = await lineRangeCalls(file, fileReads.flatMap((read) => read.spans), ctx);
		if (!found) continue;
		subjects.push(...fileReads.map((read) => read.command));
		calls.push(...found);
	}
	if (subjects.length > 0) parts.push({ subjects, reason: "reads code by line number", calls });
	const wholeSubjects: string[] = [];
	const wholeCalls: string[] = [];
	for (const whole of wholes) {
		const shown = displayPath(whole.file, ctx.cwd);
		wholeSubjects.push(whole.command);
		wholeCalls.push(toolCall("outline", { path: shown }), toolCall("read_symbol", { path: shown, module: true }));
	}
	if (wholeSubjects.length > 0) parts.push({ subjects: wholeSubjects, reason: "reads a whole code file", calls: wholeCalls });
	return parts;
}

// The reason to block a bash command that reads code by line number or reads a whole code file; undefined lets it run.
export async function lineReadBlock(command: string, ctx: ToolContext): Promise<string | undefined> {
	const parts = await lineReadParts(command, ctx);
	return parts.length === 0 ? undefined : blockMessage(parts, true);
}

// The line span of a read tool call with offset or limit; undefined for a whole-file read.
export function readToolSpan(input: Record<string, unknown>): LineSpan | undefined {
	const { offset, limit } = input;
	if (offset === undefined && limit === undefined) return undefined;
	const start = typeof offset === "number" && offset > 1 ? Math.floor(offset) : 1;
	if (typeof limit === "number" && limit > 0) return { start, end: start + Math.floor(limit) - 1 };
	return { start, end: start + READ_TOOL_MAX_LINES - 1 };
}

// The reason to block a read tool call with offset or limit; undefined lets it run.
export async function readRangeBlock(path: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string | undefined> {
	const readSpan = readToolSpan(input);
	if (!readSpan || (await toolProblem())) return undefined;
	const file = resolve(ctx.cwd, path);
	const calls = await lineRangeCalls(file, [readSpan], ctx);
	if (!calls) return undefined;
	const options = [input.offset === undefined ? undefined : `offset ${input.offset}`, input.limit === undefined ? undefined : `limit ${input.limit}`].filter(Boolean);
	return blockMessage([{ subjects: [`read of ${displayPath(file, ctx.cwd)} with ${options.join(" and ")}`], reason: "reads code by line number", calls }], false);
}
