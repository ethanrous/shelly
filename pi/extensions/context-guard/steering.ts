import { HINT_INTERVAL_CALLS, OUTLINE_FIRST_MIN_LINES } from "./config.ts";

export const HINT_TEXT =
	"Hint: read_symbol takes a name or a file:line from rg -n and returns the whole function or class; find_symbol and find_references find definitions and usages.";

export const GUIDELINES: readonly string[] = [
	"For Python, Java, and C/C++ code, read by name or location instead of line ranges: read_symbol takes a name (Class.method) or a file:line such as a match from rg -n, and returns the whole function or class. Use outline for a file's structure, find_symbol for definitions, and find_references for usages. bash line-range reads of these files (sed -n, head, tail, awk NR) that cover a function or class are blocked. Use rg for text patterns, strings, config, and non-code files.",
	"Oversized tool output is saved to a file and not shown. Search that file with rg or view a slice with head/tail instead of paging through it.",
];

const READERS = new Set(["grep", "rg", "sed", "cat", "head", "tail", "awk", "less"]);
const IDENTIFIER_PATTERN = /^(?:def |class |function )?[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// rg/grep flags whose value is the next argument, so it is not mistaken for the pattern.
const VALUE_FLAGS = new Set([
	"-e", "--regexp", "-f", "--file", "-g", "--glob", "--iglob", "-t", "--type", "-T", "--type-not",
	"-A", "-B", "-C", "--after-context", "--before-context", "--context", "-m", "--max-count",
	"-j", "--threads", "-r", "--replace", "-M", "--max-columns", "--sort", "--sortr",
	"--include", "--exclude", "--exclude-dir", "--color", "--colour",
]);

export function wantsOutlineFirst(input: Record<string, unknown>, fileLines: number, supported: boolean): boolean {
	return supported && input.offset === undefined && input.limit === undefined && fileLines > OUTLINE_FIRST_MIN_LINES;
}

export function outlineFirstNote(displayPath: string, lines: number): string {
	return `${displayPath} is ${lines.toLocaleString("en-US")} lines; outline shown. Use read_symbol for a symbol, or read with offset/limit for a range.`;
}

export interface ShellCommand {
	tokens: string[];
	// True when stdin comes from the previous command through a single |.
	piped: boolean;
	// Parenthesis nesting, so a subshell's cd does not apply after it closes.
	depth: number;
}

// Drops here-document bodies, which are data rather than commands.
function stripHeredocs(command: string): string {
	const kept: string[] = [];
	const pending: string[] = [];
	for (const line of command.split("\n")) {
		if (pending.length > 0) {
			if (line.replace(/^\t+/, "").trimEnd() === pending[0]) pending.shift();
			continue;
		}
		kept.push(line);
		for (const match of line.matchAll(/(?<!<)<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)) pending.push(match[2]);
	}
	return kept.join("\n");
}

export function shellCommands(command: string): ShellCommand[] {
	const text = stripHeredocs(command);
	const commands: ShellCommand[] = [{ tokens: [], piped: false, depth: 0 }];
	let token = "";
	let inToken = false;
	let quote: "'" | '"' | null = null;
	let depth = 0;
	const flush = () => {
		if (inToken) commands[commands.length - 1].tokens.push(token);
		token = "";
		inToken = false;
	};
	const split = (piped: boolean) => {
		flush();
		commands.push({ tokens: [], piped, depth });
	};
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quote) {
			if (c === quote) quote = null;
			else if (c === "\\" && quote === '"' && i + 1 < text.length) token += text[++i];
			else token += c;
			continue;
		}
		const redirect = c === "&" && (text[i - 1] === ">" || text[i - 1] === "<" || text[i + 1] === ">");
		if (c === "'" || c === '"') {
			quote = c;
			inToken = true;
		} else if (c === "\\" && text[i + 1] === "\n") {
			i++;
		} else if (c === "\\" && i + 1 < text.length) {
			token += text[++i];
			inToken = true;
		} else if (c === " " || c === "\t") {
			flush();
		} else if (c === "#" && !inToken) {
			while (i + 1 < text.length && text[i + 1] !== "\n") i++;
		} else if (c === "\n" && !inToken && commands[commands.length - 1].tokens.length === 0) {
			continue;
		} else if (c === "\n" || c === ";") {
			split(false);
		} else if (c === "(" || c === ")") {
			depth = c === "(" ? depth + 1 : Math.max(0, depth - 1);
			split(false);
		} else if (c === "|" || (c === "&" && !redirect)) {
			const doubled = text[i + 1] === c;
			if (doubled) i++;
			split(c === "|" && !doubled);
		} else {
			token += c;
			inToken = true;
		}
	}
	flush();
	return commands.filter((cmd) => cmd.tokens.length > 0);
}

export function shellSegments(command: string): string[][] {
	return shellCommands(command).map((cmd) => cmd.tokens);
}

function searchPattern(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-e" || arg === "--regexp" || arg === "--") return args[i + 1];
		if (arg.startsWith("--regexp=")) return arg.slice("--regexp=".length);
		if (arg.startsWith("-")) {
			if (VALUE_FLAGS.has(arg)) i++;
			continue;
		}
		return arg;
	}
	return undefined;
}

export function bashWantsHint(command: string, isSupportedSource: (path: string) => boolean): boolean {
	for (const tokens of shellSegments(command)) {
		let start = 0;
		while (start < tokens.length && ENV_ASSIGNMENT.test(tokens[start])) start++;
		const exe = tokens[start]?.split("/").pop();
		if (!exe || !READERS.has(exe)) continue;
		const args = tokens.slice(start + 1);
		if (args.some((arg) => !arg.startsWith("-") && isSupportedSource(arg))) return true;
		if (exe === "rg" || exe === "grep") {
			const pattern = searchPattern(args)?.replace(/^\\b/, "").replace(/\\b$/, "");
			if (pattern !== undefined && IDENTIFIER_PATTERN.test(pattern)) return true;
		}
	}
	return false;
}

export class HintThrottle {
	private sinceLast = HINT_INTERVAL_CALLS;

	recordCall(): void {
		this.sinceLast++;
	}

	take(): boolean {
		if (this.sinceLast < HINT_INTERVAL_CALLS) return false;
		this.sinceLast = 0;
		return true;
	}

	reset(): void {
		this.sinceLast = HINT_INTERVAL_CALLS;
	}
}
