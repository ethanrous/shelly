import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { displayPath, qualifiedName, rangeLabel } from "./format.ts";
import { isSupportedSource } from "./languages.ts";
import { toolProblem } from "./proc.ts";
import { shellCommands } from "./steering.ts";
import { BODY_KINDS, definitionAt, fileDefinitions, readSource } from "./symbols.ts";
import { searchOptions, type ToolContext } from "./tools.ts";

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

const LISTED_DEFINITIONS = 5;
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
const COUNT = /^\d+$/;
const NL_VALUE_FLAGS = new Set(["-b", "-d", "-f", "-h", "-i", "-l", "-n", "-s", "-v", "-w"]);

const span = (start: number, end: number | undefined): LineSpan => (end === undefined ? { start } : { start, end });
const isOption = (arg: string) => arg.startsWith("-") && arg !== "-";

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
		else if (!ASSIGNMENT.test(arg)) files.push(arg);
	}
	const lines = script === undefined ? undefined : nrSpan(script);
	return lines ? { spans: [lines], files } : undefined;
}

// The one file cat or nl reads, which a following piped command then sees with the same line numbers.
function pipeSource(exe: string, args: readonly string[]): string | undefined {
	if (exe !== "cat" && exe !== "nl") return undefined;
	const files: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (exe === "nl" && NL_VALUE_FLAGS.has(args[i])) i++;
		else if (!isOption(args[i])) files.push(args[i]);
	}
	return files.length === 1 ? files[0] : undefined;
}

function expand(token: string, vars: ReadonlyMap<string, string>, home: string): string {
	const expanded = token.replace(VARIABLE, (whole, braced: string | undefined, bare: string | undefined) => {
		const name = braced ?? bare ?? "";
		return vars.get(name) ?? (name === "HOME" ? home : whole);
	});
	return expanded === "~" || expanded.startsWith("~/") ? home + expanded.slice(1) : expanded;
}

// Words that run the command after them, so the reader is the next word.
const PREFIXES = new Set(["!", "{", "if", "then", "elif", "else", "while", "until", "do", "time", "command", "builtin", "exec", "nice", "nohup", "sudo", "env"]);
// File descriptors above 2 are left out, so a quoted awk test such as 10<NR is not taken for a redirection.
const REDIRECTION = /^([0-2]?>>?|&>>?|<<<|<<-?|<>?)(.*)$/s;

// Drops redirections, returning the remaining words and the file a < redirection reads.
function withoutRedirections(words: readonly string[]): { args: string[]; stdin: string | undefined } {
	const args: string[] = [];
	let stdin: string | undefined;
	for (let i = 0; i < words.length; i++) {
		const match = REDIRECTION.exec(words[i]);
		if (!match) {
			args.push(words[i]);
			continue;
		}
		const [, operator, rest] = match;
		if (rest.startsWith("&")) continue;
		const target = rest || words[++i];
		if (operator === "<" && target !== undefined) stdin = target;
	}
	return { args, stdin };
}

// Line-range reads of Python, Java, and C/C++ files, following cd, simple variable assignments, < redirections, and cat or nl pipes.
export function findLineReads(command: string, cwd: string, home = homedir()): LineRead[] {
	const reads: LineRead[] = [];
	const vars = new Map<string, string>();
	const dirs = [cwd];
	let source: string | undefined;
	for (const { tokens, piped, depth } of shellCommands(command)) {
		dirs.length = Math.min(dirs.length, depth + 1);
		while (dirs.length <= depth) dirs.push(dirs[dirs.length - 1]);
		const dir = dirs[depth];
		const fromPipe = piped ? source : undefined;
		source = undefined;
		let first = 0;
		while (first < tokens.length && ASSIGNMENT.test(tokens[first])) first++;
		if (first === tokens.length || tokens[first] === "export") {
			for (const token of tokens) {
				const match = ASSIGNMENT.exec(token);
				if (match) vars.set(match[1], expand(match[2], vars, home));
			}
			continue;
		}
		while (first < tokens.length && (PREFIXES.has(tokens[first]) || ASSIGNMENT.test(tokens[first]))) first++;
		if (first === tokens.length) continue;
		const words = tokens.slice(first).map((token) => expand(token, vars, home));
		const exe = basename(words[0]);
		const { args, stdin } = withoutRedirections(words.slice(1));
		if (exe === "cd" || exe === "pushd") {
			const target = args.find((arg) => !isOption(arg));
			if (target !== "-") dirs[depth] = target === undefined ? home : resolve(dir, target);
			continue;
		}
		const catFile = pipeSource(exe, args) ?? (exe === "cat" || exe === "nl" ? stdin : undefined);
		source = catFile === undefined ? undefined : resolve(dir, catFile);
		const parsed =
			exe === "sed" ? sedRange(args) : exe === "head" ? headRange(args) : exe === "tail" ? tailRange(args) : exe === "awk" || exe === "gawk" ? awkRange(args) : undefined;
		if (!parsed) continue;
		const inputs = parsed.files.length > 0 ? parsed.files.map((file) => resolve(dir, file)) : stdin !== undefined ? [resolve(dir, stdin)] : fromPipe ? [fromPipe] : [];
		for (const file of inputs) {
			if (isSupportedSource(file)) reads.push({ command: tokens.slice(first).join(" "), file, spans: parsed.spans });
		}
	}
	return reads;
}

function spanLines(lines: LineSpan, lineCount: number): [number, number] {
	if ("last" in lines) return [Math.max(1, lineCount - lines.last + 1), lineCount];
	return [lines.start, Math.min(lines.end ?? lineCount, lineCount)];
}

// The reason to block a bash command that reads functions or classes by line number; undefined lets it run.
export async function lineReadBlock(command: string, ctx: ToolContext): Promise<string | undefined> {
	const reads = findLineReads(command, ctx.cwd);
	if (reads.length === 0 || (await toolProblem())) return undefined;
	const byFile = new Map<string, LineRead[]>();
	for (const read of reads) byFile.set(read.file, [...(byFile.get(read.file) ?? []), read]);
	const commands = new Set<string>();
	const rows: string[] = [];
	for (const [file, fileReads] of byFile) {
		let lineCount: number;
		try {
			lineCount = (await readSource(file)).lineCount;
		} catch {
			continue;
		}
		const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
		const bodies = defs.filter((def) => BODY_KINDS.has(def.kind));
		const lines = new Set<number>();
		for (const read of fileReads) {
			const ranges = read.spans.map((readSpan) => spanLines(readSpan, lineCount));
			const hits = bodies.filter((def) => ranges.some(([start, end]) => def.startLine <= end && def.endLine >= start));
			if (hits.length > 0) commands.add(read.command);
			for (const def of hits) lines.add(def.nodeStartLine);
		}
		if (lines.size === 0) continue;
		const shown = displayPath(file, ctx.cwd);
		const sorted = [...lines].sort((a, b) => a - b);
		for (const line of sorted.slice(0, LISTED_DEFINITIONS)) {
			const def = definitionAt(defs, line);
			if (def) rows.push(`  read_symbol "${shown}:${line}"  ${def.kind} ${qualifiedName(def)} (${rangeLabel(def)})`);
		}
		if (sorted.length > LISTED_DEFINITIONS) rows.push(`  and ${sorted.length - LISTED_DEFINITIONS} more; outline ${shown} lists them all`);
	}
	if (rows.length === 0) return undefined;
	return [
		`Blocked: ${[...commands].join("; ")} reads source code by line number, so nothing in this command ran. Read the code in that range by name or location instead:`,
		...rows,
		"read_symbol takes a name or a file:line and returns the whole function or class, and outline shows a file's structure. Read lines outside them with read and offset/limit. Rerun the rest of the command without the line-range read.",
	].join("\n");
}
