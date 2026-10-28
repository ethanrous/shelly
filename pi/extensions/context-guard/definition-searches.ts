import { globSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { toolCall } from "./calls.ts";
import { DEFINITION_SEARCH_TIMEOUT_MS } from "./config.ts";
import { definitionRow, displayPath } from "./format.ts";
import { invocations, isOption } from "./invocations.ts";
import { isSupportedSource } from "./languages.ts";
import { requireTools, resolveBinary, run, toolProblem } from "./proc.ts";
import { BODY_KINDS, type Definition, type FileSource, fileDefinitions, readSource } from "./symbols.ts";
import { type BlockPart, blockMessage } from "./steering.ts";
import { searchOptions, type ToolContext } from "./tools.ts";

export interface DefinitionSearch {
	command: string;
	tool: "rg" | "grep";
	// The options and patterns that decide which lines match, without the ones that only change the output.
	args: string[];
	files: string[];
}

type Slot = "case" | "syntax" | "word" | "line";

export interface Grammar {
	// Short options whose value is the rest of the word or the next word.
	values: string;
	longValues: ReadonlySet<string>;
	// Options that print something other than the matching lines, or read patterns from a file.
	rejects: string;
	longRejects: ReadonlySet<string>;
	// Options that change which lines match, by short letter or long name, and the argument that reproduces each.
	matching: Readonly<Record<string, readonly [Slot, string]>>;
}

const LONG_REJECTS = ["--file", "--invert-match", "--count", "--files-with-matches", "--files-without-match", "--only-matching", "--quiet", "--null-data"];
const LONG_VALUES = ["--regexp", "--after-context", "--before-context", "--context", "--max-count"];
const SHARED_MATCHING = { w: ["word", "-w"], "word-regexp": ["word", "-w"], x: ["line", "-x"], "line-regexp": ["line", "-x"], F: ["syntax", "-F"], "fixed-strings": ["syntax", "-F"] } as const;

export const GRAMMARS: Readonly<Record<"rg" | "grep", Grammar>> = {
	rg: {
		values: "ABCEMTdefgjmrt",
		longValues: new Set([
			...LONG_VALUES,
			"--glob", "--iglob", "--type", "--type-not", "--type-add", "--type-clear", "--threads", "--replace", "--max-columns",
			"--sort", "--sortr", "--max-depth", "--maxdepth", "--encoding", "--engine", "--color", "--colors", "--context-separator",
			"--field-context-separator", "--field-match-separator", "--path-separator", "--max-filesize", "--pre", "--pre-glob",
			"--ignore-file", "--dfa-size-limit", "--regex-size-limit", "--hyperlink-format",
		]),
		rejects: "cflorvqUz",
		longRejects: new Set([...LONG_REJECTS, "--count-matches", "--replace", "--json", "--multiline", "--files", "--passthru", "--type-list"]),
		matching: {
			...SHARED_MATCHING,
			i: ["case", "-i"], "ignore-case": ["case", "-i"], S: ["case", "-S"], "smart-case": ["case", "-S"], s: ["case", "-s"], "case-sensitive": ["case", "-s"],
			P: ["syntax", "-P"], pcre2: ["syntax", "-P"], "no-pcre2": ["syntax", ""], "no-fixed-strings": ["syntax", ""],
		},
	},
	grep: {
		values: "ABCDdefm",
		longValues: new Set([...LONG_VALUES, "--include", "--exclude", "--exclude-dir", "--exclude-from", "--directories", "--devices", "--label", "--binary-files", "--group-separator"]),
		rejects: "cflLoqvzZ",
		longRejects: new Set(LONG_REJECTS),
		matching: {
			...SHARED_MATCHING,
			i: ["case", "-i"], y: ["case", "-i"], "ignore-case": ["case", "-i"], "no-ignore-case": ["case", ""],
			E: ["syntax", "-E"], "extended-regexp": ["syntax", "-E"], G: ["syntax", "-G"], "basic-regexp": ["syntax", "-G"], P: ["syntax", "-P"], "perl-regexp": ["syntax", "-P"],
		},
	},
};

export interface ParsedSearch {
	// Each option given, as its flag (-i, --glob) with its value when it takes one.
	options: { flag: string; value?: string }[];
	// Patterns from -e and --regexp, or the first operand when there are none and no pattern file is named.
	patterns: string[];
	// The operands after the pattern.
	paths: string[];
	// How many operands came before a bare --, when there was one.
	separator: number | undefined;
}

// Splits an rg or grep call into its options, patterns, and file operands.
export function parseSearch(grammar: Grammar, args: readonly string[]): ParsedSearch {
	const options: ParsedSearch["options"] = [];
	const patterns: string[] = [];
	const positional: string[] = [];
	let separator: number | undefined;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--") {
			separator = positional.length;
			positional.push(...args.slice(i + 1));
			break;
		}
		if (arg.startsWith("--")) {
			const eq = arg.indexOf("=");
			const name = eq === -1 ? arg : arg.slice(0, eq);
			const value = eq === -1 ? (grammar.longValues.has(name) ? args[++i] : undefined) : arg.slice(eq + 1);
			options.push({ flag: name, value });
			if (name === "--regexp") patterns.push(value ?? "");
			continue;
		}
		if (!isOption(arg)) {
			positional.push(arg);
			continue;
		}
		for (let j = 1; j < arg.length; j++) {
			const name = arg[j];
			if (grammar.values.includes(name)) {
				const value = j + 1 < arg.length ? arg.slice(j + 1) : args[++i];
				options.push({ flag: `-${name}`, value });
				if (name === "e") patterns.push(value ?? "");
				break;
			}
			options.push({ flag: `-${name}` });
		}
	}
	const fromFile = options.some((option) => option.flag === "-f" || option.flag === "--file");
	if (patterns.length === 0 && !fromFile) {
		const pattern = positional.shift();
		if (pattern !== undefined) {
			patterns.push(pattern);
			if (separator !== undefined && separator > 0) separator--;
		}
	}
	return { options, patterns, paths: positional, separator };
}

// The matching arguments and file operands of an rg or grep call, or undefined when its output is not the matching lines.
function searchArgs(grammar: Grammar, args: readonly string[]): { args: string[]; paths: string[] } | undefined {
	const parsed = parseSearch(grammar, args);
	if (parsed.patterns.length === 0) return undefined;
	const slots = new Map<Slot, string>();
	for (const { flag } of parsed.options) {
		if (flag.startsWith("--") ? grammar.longRejects.has(flag) : grammar.rejects.includes(flag[1])) return undefined;
		const found = grammar.matching[flag.replace(/^-+/, "")];
		if (found) slots.set(found[0], found[1]);
	}
	const matching = [...slots.values()].filter(Boolean);
	return { args: [...matching, ...parsed.patterns.flatMap((pattern) => ["-e", pattern])], paths: parsed.paths };
}

// The files a shell glob operand names, or the operand itself when it has no glob characters or matches nothing.
export function expandGlob(path: string, dir: string): string[] {
	if (!/[*?[]/.test(path)) return [resolve(dir, path)];
	const matches = globSync(path, { cwd: dir }).map((match) => resolve(dir, match));
	return matches.length > 0 ? matches.sort() : [resolve(dir, path)];
}

// rg and grep calls that print their matching lines from named Python, Java, and C/C++ files.
export function findDefinitionSearches(command: string, cwd: string, home = homedir()): DefinitionSearch[] {
	const searches: DefinitionSearch[] = [];
	for (const { text, exe, args, dir, redirected } of invocations(command, cwd, home)) {
		if ((exe !== "rg" && exe !== "grep") || redirected) continue;
		const parsed = searchArgs(GRAMMARS[exe], args);
		if (!parsed || parsed.paths.length === 0) continue;
		const files = parsed.paths.flatMap((path) => expandGlob(path, dir));
		if (files.every(isSupportedSource)) searches.push({ command: text, tool: exe, args: parsed.args, files });
	}
	return searches;
}

// The line numbers a search matches in one file, from running rg or grep itself; undefined when it fails.
async function matchingLines(search: DefinitionSearch, file: string, ctx: ToolContext): Promise<number[] | undefined> {
	const binary = search.tool === "rg" ? (await requireTools()).rg : resolveBinary("grep");
	if (!binary) return undefined;
	const args = search.tool === "rg" ? ["--json", ...search.args, "--", file] : ["-n", ...search.args, "--", file];
	const result = await run(binary, args, { cwd: ctx.cwd, signal: ctx.signal, timeoutMs: DEFINITION_SEARCH_TIMEOUT_MS }).catch(() => undefined);
	if (result?.code === 1) return [];
	if (result?.code !== 0) return undefined;
	const lines: number[] = [];
	for (const line of result.stdout.split("\n").filter(Boolean)) {
		if (search.tool === "grep") {
			const match = /^(\d+):/.exec(line);
			if (!match) return undefined;
			lines.push(Number(match[1]));
		} else {
			const event = JSON.parse(line) as { type: string; data?: { line_number?: number } };
			if (event.type !== "match") continue;
			if (event.data?.line_number === undefined) return undefined;
			lines.push(event.data.line_number);
		}
	}
	return lines;
}

// Byte offsets where each line starts; index i is line i + 1.
function lineStarts(buffer: Buffer): number[] {
	const starts = [0];
	for (let i = buffer.indexOf(10); i !== -1; i = buffer.indexOf(10, i + 1)) starts.push(i + 1);
	return starts;
}

// True when the line names the definition and holds no body besides a brace, an empty body, ..., pass, or a comment.
function isHeaderLine(def: Definition, line: number, source: FileSource, starts: readonly number[]): boolean {
	if (def.nameLine !== line || def.bodyStartByte === undefined) return false;
	const lineEnd = starts[line] ?? source.buffer.length;
	if (def.bodyStartByte >= lineEnd) return true;
	return /^(?:\{\s*\}?|\.\.\.|pass)?\s*(?:\/\/.*|\/\*.*|#.*)?$/.test(source.buffer.subarray(def.bodyStartByte, lineEnd).toString("utf8").trim());
}

// The definitions whose header lines a search matches in each file, or undefined when it matches any other line or fails.
async function matchedDefinitions(search: DefinitionSearch, ctx: ToolContext): Promise<Map<string, Definition[]> | undefined> {
	const hits = new Map<string, number[]>();
	for (const file of search.files) {
		const lines = await matchingLines(search, file, ctx);
		if (!lines) return undefined;
		if (lines.length > 0) hits.set(file, lines);
	}
	if (hits.size === 0) return undefined;
	const defsByFile = await fileDefinitions([...hits.keys()], searchOptions(ctx, ctx.cwd));
	const matched = new Map<string, Definition[]>();
	for (const [file, lines] of hits) {
		const source = await readSource(file);
		const starts = lineStarts(source.buffer);
		const bodies = (defsByFile.get(file) ?? []).filter((def) => BODY_KINDS.has(def.kind));
		const defs: Definition[] = [];
		for (const line of lines) {
			const headers = bodies.filter((def) => isHeaderLine(def, line, source, starts));
			if (headers.length === 0) return undefined;
			defs.push(headers.reduce((a, b) => (b.endByte - b.startByte < a.endByte - a.startByte ? b : a)));
		}
		matched.set(file, defs);
	}
	return matched;
}

// The reasons to block rg and grep calls of source files that match only function and class definitions.
export async function definitionSearchParts(command: string, ctx: ToolContext): Promise<BlockPart[]> {
	const searches = findDefinitionSearches(command, ctx.cwd);
	if (searches.length === 0 || (await toolProblem())) return [];
	const subjects: string[] = [];
	const calls: string[] = [];
	for (const search of searches) {
		const matched = await matchedDefinitions(search, ctx);
		if (!matched) continue;
		subjects.push(search.command);
		for (const [file, defs] of matched) {
			const shown = displayPath(file, ctx.cwd);
			calls.push(...defs.map((def) => definitionRow(shown, def.nodeStartLine, def)), toolCall("outline", { path: shown }));
		}
	}
	return subjects.length === 0 ? [] : [{ subjects, reason: "matches only function and class definitions", calls }];
}

// The reason to block an rg or grep of source files that matches only function and class definitions; undefined lets it run.
export async function definitionSearchBlock(command: string, ctx: ToolContext): Promise<string | undefined> {
	const parts = await definitionSearchParts(command, ctx);
	return parts.length === 0 ? undefined : blockMessage(parts, true);
}
