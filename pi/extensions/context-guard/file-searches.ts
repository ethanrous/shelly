import { statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { toolCall } from "./calls.ts";
import { displayPath } from "./format.ts";
import { type Grammar, GRAMMARS, expandGlob, type ParsedSearch, parseSearch } from "./definition-searches.ts";
import { invocations, isOption } from "./invocations.ts";
import { escapeRegex, isOutlinable } from "./languages.ts";
import { toolProblem } from "./proc.ts";
import { type BlockPart, blockMessage } from "./steering.ts";
import type { ToolContext } from "./tools.ts";

export interface FileSearch {
	command: string;
	tool: "rg" | "grep";
	parsed: ParsedSearch;
	dir: string;
	// True for git grep, which searches tracked files even without operands.
	git: boolean;
	// True when xargs supplies the file operands.
	xargs: boolean;
	// True when stdin is a pipe or a < redirection.
	stdin: boolean;
	// Short options added by the program name, such as -E for egrep.
	implied: string[];
}

const XARGS_VALUE_FLAGS = new Set(["-I", "-J", "-L", "-n", "-P", "-s", "-d", "-E", "-R", "-S", "-a"]);
const GIT_VALUE_FLAGS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
const INFO_FLAGS = new Set(["--help", "--version", "-V", "--type-list", "--files"]);
const CONTEXT_FLAGS = new Set(["-A", "-B", "-C", "--after-context", "--before-context", "--context"]);
const LIST_FLAGS = new Set(["-l", "-c", "-L", "--files-with-matches", "--files-without-match", "--count", "--count-matches"]);
const UNTRANSLATABLE_FLAGS = new Set(["-v", "--invert-match", "-f", "--file", "-U", "--multiline"]);
const INCLUDE_FLAGS = new Set(["--include", "-g", "--glob", "--iglob"]);
const RECURSIVE_FLAGS = new Set(["-r", "-R", "--recursive", "--dereference-recursive"]);
const PROGRAMS: Readonly<Record<string, { tool: "rg" | "grep"; implied: string[] }>> = {
	rg: { tool: "rg", implied: [] },
	grep: { tool: "grep", implied: [] },
	egrep: { tool: "grep", implied: ["-E"] },
	fgrep: { tool: "grep", implied: ["-F"] },
};

// The program a git or xargs command runs, with its arguments, and the directory it runs in.
function wrapped(exe: string, args: readonly string[], dir: string): { exe: string; args: string[]; dir: string; git: boolean; xargs: boolean } | undefined {
	if (exe === "git") {
		let at = dir;
		for (let i = 0; i < args.length; i++) {
			if (GIT_VALUE_FLAGS.has(args[i])) {
				if (args[i] === "-C" && args[i + 1] !== undefined) at = resolve(at, args[i + 1]);
				i++;
			} else if (!isOption(args[i])) {
				return args[i] === "grep" ? { exe: "grep", args: args.slice(i + 1), dir: at, git: true, xargs: false } : undefined;
			}
		}
		return undefined;
	}
	if (exe === "xargs") {
		for (let i = 0; i < args.length; i++) {
			if (XARGS_VALUE_FLAGS.has(args[i])) i++;
			else if (!isOption(args[i])) return basename(args[i]) in PROGRAMS ? { exe: basename(args[i]), args: args.slice(i + 1), dir, git: false, xargs: true } : undefined;
		}
	}
	return undefined;
}

// rg, grep, egrep, fgrep, git grep, and xargs of them, in a shell command.
export function findFileSearches(command: string, cwd: string, home = homedir()): FileSearch[] {
	const searches: FileSearch[] = [];
	for (const { text, exe, args, dir, stdin, fromPipe } of invocations(command, cwd, home)) {
		const inner = PROGRAMS[exe] ? { exe, args, dir, git: false, xargs: false } : wrapped(exe, args, dir);
		const program = inner && PROGRAMS[inner.exe];
		if (!inner || !program) continue;
		const grammar: Grammar = GRAMMARS[program.tool];
		const parsed = parseSearch(grammar, inner.args);
		searches.push({ command: text, tool: program.tool, parsed, dir: inner.dir, git: inner.git, xargs: inner.xargs, stdin: fromPipe || stdin !== undefined, implied: program.implied });
	}
	return searches;
}

const flagsOf = (parsed: ParsedSearch) => parsed.options.map((option) => option.flag);
const hasFlag = (search: FileSearch, ...flags: string[]) => flagsOf(search.parsed).some((flag) => flags.includes(flag)) || flags.some((flag) => search.implied.includes(flag));
const valuesOf = (parsed: ParsedSearch, flags: ReadonlySet<string>) => parsed.options.filter((option) => flags.has(option.flag) && option.value !== undefined).map((option) => option.value as string);

// Extensions a glob names, such as .py for *.py or .json and .yaml for **/*.{json,yaml}; undefined when it names none.
function globExtensions(glob: string): string[] | undefined {
	const last = glob.split("/").pop() ?? "";
	const braced = /\.\{([^{}]+)\}$/.exec(last);
	if (braced) return braced[1].split(",").map((ext) => `.${ext.trim()}`);
	const plain = /(\.[A-Za-z0-9]+)$/.exec(last);
	return plain ? [plain[1]] : undefined;
}

// True when every glob names only extensions that are not Python, Java, C/C++, or Markdown, and at least one is given.
function namesOtherFiles(globs: readonly string[]): boolean {
	return globs.length > 0 && globs.every((glob) => globExtensions(glob)?.every((ext) => !isOutlinable(`x${ext}`)) === true);
}

function pathspecGlobs(search: FileSearch): string[] {
	const { parsed } = search;
	return parsed.separator === undefined ? [] : parsed.paths.slice(parsed.separator);
}

// The positive include globs of a search, from --include, -g, --glob, and --iglob, or git grep pathspecs.
function includeGlobs(search: FileSearch): string[] {
	const globs = search.git ? pathspecGlobs(search).filter((glob) => !glob.startsWith(":")) : valuesOf(search.parsed, INCLUDE_FLAGS);
	return globs.filter((glob) => !glob.startsWith("!"));
}

interface Operands {
	files: string[];
	directories: string[];
	// Every operand, in the order given.
	all: string[];
}

function operandsOf(search: FileSearch): Operands {
	const { parsed } = search;
	const named = search.git ? parsed.paths.slice(0, parsed.separator ?? 0) : parsed.paths;
	const operands: Operands = { files: [], directories: [], all: [] };
	for (const path of named.filter((path) => path !== "-")) {
		for (const file of expandGlob(path, search.dir)) {
			let directory = false;
			try {
				directory = statSync(file).isDirectory();
			} catch {
				// A missing operand is judged by its extension.
			}
			(directory ? operands.directories : operands.files).push(file);
			operands.all.push(file);
		}
	}
	return operands;
}

// True when the call searches files rather than stdin or only files that are not Python, Java, C/C++, or Markdown.
export function searchesCodeFiles(search: FileSearch): boolean {
	if (hasFlag(search, ...INFO_FLAGS)) return false;
	if (search.xargs) return true;
	const { files, directories } = operandsOf(search);
	if (files.some(isOutlinable)) return true;
	const recursive = search.tool === "rg" || search.git || hasFlag(search, ...RECURSIVE_FLAGS);
	const directory = directories.length > 0 || (files.length === 0 && recursive && (search.git || !search.stdin));
	if (!directory) return false;
	return !namesOtherFiles(includeGlobs(search));
}

const BASIC_METACHARACTERS = /[.*[\]^$\\]/;
const EXTENDED_METACHARACTERS = /[.*+?()[\]{}|^$\\]/;

// The search call that does what an rg or grep call does, with the notes that explain what differs.
export function translateSearch(search: FileSearch, cwd: string): { call: string; notes: string[] } {
	const { parsed } = search;
	const literal = hasFlag(search, "-F", "--fixed-strings");
	const extended = hasFlag(search, "-E", "-P", "--extended-regexp", "--perl-regexp");
	const word = hasFlag(search, "-w", "--word-regexp");
	const line = hasFlag(search, "-x", "--line-regexp");
	const texts = parsed.patterns.length > 0 ? parsed.patterns : ["<text to find>"];
	const metacharacters = search.tool === "rg" || extended ? EXTENDED_METACHARACTERS : BASIC_METACHARACTERS;
	let regex = !literal && texts.some((text) => metacharacters.test(text));
	let patterns = texts;
	if (word || line) {
		patterns = texts.map((text) => {
			const body = regex ? text : escapeRegex(text);
			return line ? `^(?:${body})$` : `\\b(?:${body})\\b`;
		});
		regex = true;
	}
	const operands = operandsOf(search);
	// The working directory is search's default path, so it is left out.
	const paths = search.git ? [] : operands.all.filter((file) => resolve(cwd, file) !== resolve(cwd)).map((file) => displayPath(file, cwd));
	const globs: string[] = [];
	if (search.git) {
		for (const glob of pathspecGlobs(search)) {
			const exclude = /^:(?:!|\^|\(exclude\))/.exec(glob);
			globs.push(exclude ? `!${glob.slice(exclude[0].length)}` : glob);
		}
	}
	for (const { flag, value } of parsed.options) {
		if (value === undefined) continue;
		if (INCLUDE_FLAGS.has(flag)) globs.push(value);
		else if (flag === "--exclude") globs.push(`!${value}`);
		else if (flag === "--exclude-dir") globs.push(`!**/${value}/**`);
	}
	const call = toolCall("search", {
		pattern: patterns.length === 1 ? patterns[0] : patterns,
		path: paths.length === 0 ? undefined : paths.length === 1 ? paths[0] : paths,
		regex: regex ? true : undefined,
		ignore_case: hasFlag(search, "-i", "-y", "--ignore-case") ? true : undefined,
		glob: globs.length > 0 ? globs : undefined,
	});
	const notes: string[] = [];
	const flags = flagsOf(parsed);
	if (flags.some((flag) => CONTEXT_FLAGS.has(flag) || /^-\d$/.test(flag))) {
		notes.push("search names each match's enclosing function or class, and read_symbol with that path and the match's line reads it.");
	}
	if (flags.some((flag) => LIST_FLAGS.has(flag))) notes.push("search's header counts the matching lines and files, and the matches are grouped by file.");
	if (flags.some((flag) => UNTRANSLATABLE_FLAGS.has(flag))) notes.push("search has no inverted match, pattern file, or multiline mode; search for the text itself and read the matches.");
	return { call, notes };
}

// The reasons to block rg, grep, and git grep calls that search Python, Java, C/C++, or Markdown files; skip names commands another check already blocks.
export async function fileSearchParts(command: string, ctx: ToolContext, skip: ReadonlySet<string> = new Set()): Promise<BlockPart[]> {
	const found = findFileSearches(command, ctx.cwd).filter((search) => !skip.has(search.command) && searchesCodeFiles(search));
	if (found.length === 0 || (await toolProblem())) return [];
	const translated = found.map((search) => translateSearch(search, ctx.cwd));
	return [
		{
			subjects: found.map((search) => search.command),
			reason: "searches code files",
			calls: translated.map((item) => item.call),
			notes: translated.flatMap((item) => item.notes),
		},
	];
}

// The reason to block a search of Python, Java, C/C++, or Markdown files in bash; undefined lets it run.
export async function fileSearchBlock(command: string, ctx: ToolContext): Promise<string | undefined> {
	const parts = await fileSearchParts(command, ctx);
	return parts.length === 0 ? undefined : blockMessage(parts, true);
}
