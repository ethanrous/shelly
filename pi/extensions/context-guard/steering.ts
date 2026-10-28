import { toolCall } from "./calls.ts";
import { HINT_INTERVAL_CALLS } from "./config.ts";

const call = toolCall;

export const HINT_TEXT = `Hint: Python, Java, C/C++, and Markdown files are read and searched only with these tools, never with line-range reads, cat, grep, or rg. ${call("search", { pattern: "foo", path: "src", glob: ["*.py"] })} finds text; ${call("outline", { path: "a.py" })} lists a file's functions and classes; ${call("read_symbol", { path: "a.py", line: 12 })} reads the function or class containing a line, ${call("read_symbol", { path: "a.py", line: 12, end_line: 40 })} reads a line range widened to whole definitions, and ${call("read_symbol", { path: "a.py", module: true })} shows imports and other module-level code; find_symbol and find_references find definitions and usages.`;

export const GUIDELINES: readonly string[] = [
	`Read and search Python, Java, C/C++, and Markdown files only with read_symbol, outline, search, find_symbol, and find_references. Line-range reads (read offset/limit, sed -n, head, tail, awk NR), whole-file reads in bash (cat, less, more, nl, bat), and grep or rg on these files are always blocked, whatever their size; the block message names the tool call to make instead. Reading one of these files with read returns its outline.`,
	`read_symbol takes separate fields, never a colon form: symbol is only a name (func, Class.method, or a Markdown heading); path with line, such as ${call("read_symbol", { path: "src/app.py", line: 302 })}, reads the function or class containing that line; line with end_line, such as ${call("read_symbol", { path: "src/app.py", line: 280, end_line: 340 })}, reads everything the range covers widened to whole definitions; ${call("read_symbol", { path: "src/app.py", module: true })} returns imports, constants, and other module-level code in full with each top-level definition collapsed to its first line and line range. after: N or before: N adds the neighboring definitions, such as a run of related helpers or tests.`,
	"To find code in these files, use outline for a file's structure, find_symbol for a definition, and find_references for usages, not search, rg, or grep for def or class lines.",
	`To search for text, such as strings, config keys, log messages, or anything in non-code files, use search, not rg or grep in bash. pattern is one string or a list of strings to match any of; it matches literally unless regex: true. path is a file or directory or a list of them. glob is a glob or a list that keeps (*.py) or, with a leading !, excludes (!**/tests/**) files, in place of grep --include and grep -v. Its header counts the matching lines and files, and each match in a Python, Java, or C/C++ file names its enclosing function or class.`,
	`To change the same text in many files or many places in one file, use replace, not repeated edit calls, sed -i, or perl -pi. It takes pattern, with, and the same path, glob, regex, and ignore_case as search, for example ${call("replace", { pattern: "pkg.old_mod", with: "pkg.new_mod", path: "tests", expect: 9 })}; pass expect with the count search reported so nothing changes if it differs.`,
	"Oversized tool output is saved to a file and not shown. Find text in that file with search, instead of paging through it.",
];

export const BLOCK_RULE =
	"Read and search Python, Java, C/C++, and Markdown files only with read_symbol, outline, search, find_symbol, and find_references; line-range reads, cat, grep, and rg on these files are always blocked, in bash and with read offset/limit.";

// One reason to block: what offended, why, the calls to make instead, and any notes on them.
export interface BlockPart {
	subjects: string[];
	reason: string;
	calls: string[];
	notes?: string[];
}

// The message for blocked tool calls. A bash command ran nothing; any other tool call did not run.
export function blockMessage(parts: readonly BlockPart[], bash: boolean): string {
	const what = parts.map((part) => `${[...new Set(part.subjects)].join("; ")} ${part.reason}`).join("; ");
	return [
		`Blocked: ${what}, so ${bash ? "nothing in this command ran" : "it did not run"}.`,
		BLOCK_RULE,
		...new Set(parts.flatMap((part) => part.calls)),
		...new Set(parts.flatMap((part) => part.notes ?? [])),
		...(bash ? ["Rerun the rest of the command without it."] : []),
	].join("\n");
}

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

// The note placed above the outline that a read of a source or Markdown file returns.
export function outlineFirstNote(displayPath: string, lines: number, markdown = false): string {
	const module = call("read_symbol", { path: displayPath, module: true });
	const part = markdown ? "the text before the first heading" : "imports and other module-level code";
	const unit = markdown ? "a section" : "a function or class";
	return `${displayPath} is ${lines.toLocaleString("en-US")} lines; its outline is shown instead of the file. Read ${part} with ${module}, and ${unit} with read_symbol, passing path and a line from an outline row's range.`;
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
			else if (c === "\\" && quote === '"' && i + 1 < text.length && '$`"\\\n'.includes(text[i + 1])) token += text[++i] === "\n" ? "" : text[i];
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
