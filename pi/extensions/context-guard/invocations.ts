import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { shellCommands } from "./steering.ts";

export interface Invocation {
	// The words as written, from the program name on, quoted for display.
	text: string;
	exe: string;
	// Expanded arguments without redirections.
	args: string[];
	dir: string;
	// The file a < redirection reads.
	stdin: string | undefined;
	// True when stdout goes to a file instead of the model.
	redirected: boolean;
	// The file cat or nl passes unchanged into this command through a pipe.
	piped: string | undefined;
	// True when stdin comes from the previous command through a pipe.
	fromPipe: boolean;
}

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
export const NL_VALUE_FLAGS = new Set(["-b", "-d", "-f", "-h", "-i", "-l", "-n", "-s", "-v", "-w"]);
// Words that run the command after them, so the program is the next word.
const PREFIXES = new Set(["!", "{", "if", "then", "elif", "else", "while", "until", "do", "time", "command", "builtin", "exec", "nice", "nohup", "sudo", "env"]);
// File descriptors above 2 are left out, so a quoted awk test such as 10<NR is not taken for a redirection.
const REDIRECTION = /^([0-2]?>>?|&>>?|<<<|<<-?|<>?)(.*)$/s;

export const isOption = (arg: string) => arg.startsWith("-") && arg !== "-";
export const isAssignment = (arg: string) => ASSIGNMENT.test(arg);
const quoted = (token: string) => (/^[\w\-+=.,/:@%~$]+$/.test(token) || REDIRECTION.test(token) ? token : `'${token.replace(/'/g, `'\\''`)}'`);

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

// Drops redirections, returning the remaining words, the file a < redirection reads, and whether stdout goes to a file.
function withoutRedirections(words: readonly string[]): { args: string[]; stdin: string | undefined; redirected: boolean } {
	const args: string[] = [];
	let stdin: string | undefined;
	let redirected = false;
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
		if (/^(1?>|&>)/.test(operator)) redirected = true;
	}
	return { args, stdin, redirected };
}

// The programs a shell command runs, following cd, simple variable assignments, < redirections, and cat or nl pipes.
export function invocations(command: string, cwd: string, home = homedir()): Invocation[] {
	const found: Invocation[] = [];
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
		while (first < tokens.length && isAssignment(tokens[first])) first++;
		if (first === tokens.length || tokens[first] === "export") {
			for (const token of tokens) {
				const match = ASSIGNMENT.exec(token);
				if (match) vars.set(match[1], expand(match[2], vars, home));
			}
			continue;
		}
		while (first < tokens.length && (PREFIXES.has(tokens[first]) || isAssignment(tokens[first]))) first++;
		if (first === tokens.length) continue;
		const words = tokens.slice(first).map((token) => expand(token, vars, home));
		const exe = basename(words[0]);
		const { args, stdin, redirected } = withoutRedirections(words.slice(1));
		if (exe === "cd" || exe === "pushd") {
			const target = args.find((arg) => !isOption(arg));
			if (target !== "-") dirs[depth] = target === undefined ? home : resolve(dir, target);
			continue;
		}
		const catFile = pipeSource(exe, args) ?? (exe === "cat" || exe === "nl" ? stdin : undefined);
		source = catFile === undefined ? undefined : resolve(dir, catFile);
		const text = tokens.slice(first).map(quoted).join(" ");
		found.push({ text, exe, args, dir, stdin: stdin === undefined ? undefined : resolve(dir, stdin), redirected, piped: fromPipe, fromPipe: piped });
	}
	return found;
}
