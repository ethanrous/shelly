type Context = "top" | "paren" | "dquote" | "backtick";

/**
 * Puts each top-level command of a shell command on its own line. `;` becomes a line break, and
 * `&&` and `||` stay at the end of their line. Quotes, `$(...)`, subshells, backticks, comments,
 * and `case` terminators (`;;`) are kept intact, and everything from a heredoc onward is unchanged.
 * Unterminated input, such as a command still streaming, is split up to the open construct.
 */
export function commandLines(command: string): string {
	const stack: Context[] = ["top"];
	let out = "";
	let i = 0;

	const breakLine = (suffix: string, skip: number) => {
		out = out.replace(/[ \t]+$/, "") + suffix + "\n";
		i += skip;
		while (command[i] === " " || command[i] === "\t") i++;
		if (command[i] === "\n") i++;
	};

	while (i < command.length) {
		const c = command[i];
		const next = command[i + 1];
		const ctx = stack[stack.length - 1];

		if (c === "\\") {
			out += command.slice(i, i + 2);
			i += 2;
			continue;
		}

		if (ctx === "backtick") {
			if (c === "`") stack.pop();
			out += c;
			i++;
			continue;
		}

		if (ctx === "dquote") {
			if (c === '"') stack.pop();
			else if (c === "`") stack.push("backtick");
			else if (c === "$" && next === "(") {
				stack.push("paren");
				out += c + next;
				i += 2;
				continue;
			}
			out += c;
			i++;
			continue;
		}

		// "top" or "paren"
		if (c === "'") {
			const ansi = out.endsWith("$");
			let end = i + 1;
			while (end < command.length && command[end] !== "'") end += ansi && command[end] === "\\" ? 2 : 1;
			if (end >= command.length) return out + command.slice(i);
			out += command.slice(i, end + 1);
			i = end + 1;
			continue;
		}
		if (c === '"') stack.push("dquote");
		else if (c === "`") stack.push("backtick");
		else if (c === "(") stack.push("paren");
		else if (c === ")" && stack.length > 1) stack.pop();
		else if (c === "#" && (out === "" || /[\s;&|()]$/.test(out))) {
			const end = command.indexOf("\n", i);
			if (end === -1) return out + command.slice(i);
			out += command.slice(i, end);
			i = end;
			continue;
		} else if (c === "<" && next === "<" && command[i + 2] !== "<" && !out.endsWith("<")) {
			return out + command.slice(i);
		} else if (stack.length === 1) {
			if (c === ";" && next !== ";" && next !== "&") {
				breakLine("", 1);
				continue;
			}
			if (c === ";" && next === ";") {
				out += ";;";
				i += 2;
				continue;
			}
			if ((c === "&" && next === "&") || (c === "|" && next === "|")) {
				breakLine(` ${c}${next}`, 2);
				continue;
			}
		}

		out += c;
		i++;
	}

	return out.replace(/\s+$/, "");
}

/** `commandLines`, with continuation lines indented to sit under the first command. */
export function displayCommand(command: string, indent = "  "): string {
	return commandLines(command).split("\n").join(`\n${indent}`);
}

/** A copy of bash tool arguments with the command laid out for display, or `args` when unchanged. */
export function displayArgs<T>(args: T): T {
	const command = (args as { command?: unknown } | undefined)?.command;
	if (typeof command !== "string") return args;
	const display = displayCommand(command);
	return display === command ? args : { ...args, command: display };
}
