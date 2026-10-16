import { HINT_INTERVAL_CALLS, OUTLINE_FIRST_MIN_LINES } from "./config.ts";

export const HINT_TEXT = "Hint: find_symbol / read_symbol / find_references return code by name with less output.";

export const GUIDELINES: readonly string[] = [
	"For Python, Java, and C/C++ code: use outline to see a file's structure, read_symbol to read a function, method, or class by name, find_symbol to locate definitions, and find_references for usages. Use rg for strings, config, and non-code files.",
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

export function shellSegments(command: string): string[][] {
	const segments: string[][] = [[]];
	let token = "";
	let inToken = false;
	let quote: "'" | '"' | null = null;
	const flush = () => {
		if (inToken) segments[segments.length - 1].push(token);
		token = "";
		inToken = false;
	};
	for (let i = 0; i < command.length; i++) {
		const c = command[i];
		if (quote) {
			if (c === quote) quote = null;
			else if (c === "\\" && quote === '"' && i + 1 < command.length) token += command[++i];
			else token += c;
			continue;
		}
		if (c === "'" || c === '"') {
			quote = c;
			inToken = true;
		} else if (c === "\\" && i + 1 < command.length) {
			token += command[++i];
			inToken = true;
		} else if (c === " " || c === "\t" || c === "\n") {
			flush();
		} else if (c === "|" || c === ";" || c === "&") {
			flush();
			if (command[i + 1] === c) i++;
			segments.push([]);
		} else {
			token += c;
			inToken = true;
		}
	}
	flush();
	return segments.filter((segment) => segment.length > 0);
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
