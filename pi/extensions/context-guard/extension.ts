import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bashBlock } from "./bash-blocks.ts";
import { toolCall } from "./calls.ts";
import { isMarkdown, isOutlinable } from "./languages.ts";
import { readRangeBlock } from "./line-reads.ts";
import { LspManager } from "./lsp/manager.ts";
import { applyCap, cleanupSpillDirs, expandHome, isSkillPath } from "./output-cap.ts";
import { type ReplaceContext, type ReplaceParams, runReplace } from "./replace.ts";
import { runSearch } from "./search.ts";
import { readSource } from "./symbols.ts";
import { bashWantsHint, GUIDELINES, HINT_TEXT, HintThrottle, outlineFirstNote } from "./steering.ts";
import { outlineText, type PreciseBackend, type ReadSymbolParams, runFindReferences, runFindSymbol, runOutline, runReadSymbol, type ToolContext } from "./tools.ts";

export interface SchemaBuilder {
	Object(properties: Record<string, unknown>): unknown;
	String(options?: { description?: string }): unknown;
	Boolean(options?: { description?: string }): unknown;
	Integer(options?: { description?: string; minimum?: number }): unknown;
	Array(items: unknown, options?: { description?: string; minItems?: number }): unknown;
	Union(schemas: unknown[], options?: { description?: string }): unknown;
	Optional(schema: unknown): unknown;
}

export interface ExtensionOptions {
	lsp?: PreciseBackend & { shutdownAll(): Promise<void> };
	tmpRoot?: string;
	mutate?: ReplaceContext["mutate"];
}

interface TextBlock {
	type: "text";
	text: string;
}

interface ResultEvent {
	toolName: string;
	toolCallId: string;
	parentToolCallId?: string;
	input: Record<string, unknown>;
	content: Array<{ type: string }>;
	details: unknown;
	structuredContent?: unknown;
	isError: boolean;
}

interface CallEvent {
	toolName: string;
	parentToolCallId?: string;
	input?: Record<string, unknown>;
}

interface EventContext {
	cwd: string;
	signal?: AbortSignal;
	sessionManager: { getSessionId(): string };
}

const SYMBOL_DESCRIPTION =
	"Symbol name, optionally qualified: getDocumentId, DocumentService.getDocumentId, pkg.module.func, or ns::Class::method. A * in the last segment is a wildcard (*Service).";
const READ_SYMBOL_DESCRIPTION =
	"Only a name, optionally qualified (getDocumentId, DocumentService.getDocumentId, pkg.module.func, or ns::Class::method; a * in the last segment is a wildcard); in Markdown, heading text (Setup > Install to qualify). Never a file:line or file:name; give those as path with line or symbol. Omit when using line or module.";
const READ_PATH_DESCRIPTION = "File or directory to look for the symbol in; defaults to the working directory. Must be the file when line or module is given.";
const READ_SYMBOL_TOOL_DESCRIPTION = `Read whole functions, methods, and classes in Python, Java, or C/C++ code, and sections of Markdown files. Reading these files by line range, cat, or grep is always blocked, so use this. Pass exactly one of: symbol, a name (func, Class.method); line with path, a line from a search match, find_symbol row, or outline row, which reads the function or class containing it, e.g. ${toolCall("read_symbol", { path: "src/app.py", line: 302 })}; line and end_line with path, which reads everything the range covers widened to whole definitions, e.g. ${toolCall("read_symbol", { path: "src/app.py", line: 280, end_line: 340 })}; or module: true with path, which returns the file's imports, constants, and other module-level code in full, with each top-level definition collapsed to its first line and line range, e.g. ${toolCall("read_symbol", { path: "src/app.py", module: true })}. Each definition comes back whole with its doc comment and annotations or decorators. full: false returns a class's members with line ranges instead of its source. after: N or before: N adds the N neighboring definitions at the same level. The result ends with the next non-blank line after the symbol, for choosing an insertion point. An ambiguous name returns the candidates, each as a call; narrow it with path or a qualified name. In Markdown (.md, .markdown, .mdx), a name is heading text (Setup > Install to qualify) and the result is that section with its subsections.`;
const PATH_DESCRIPTION = "File or directory to search. Defaults to the working directory.";
const CONSTRAINED_SAMPLING = { type: "json_schema", strict: "prefer" };

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }], details: undefined });
const toolContext = (ctx: { cwd: string }, signal: AbortSignal | undefined): ToolContext => ({ cwd: ctx.cwd, signal });

export function registerContextGuard(pi: ExtensionAPI, Type: SchemaBuilder, options: ExtensionOptions = {}): void {
	const lsp = options.lsp ?? new LspManager();
	const tmpRoot = options.tmpRoot ?? tmpdir();
	const throttle = new HintThrottle();
	const register = (tool: Record<string, unknown>) => pi.registerTool(tool as never);

	register({
		name: "find_symbol",
		label: "Find symbol",
		description:
			"Find where a symbol is defined in Python, Java, or C/C++ code. Returns each definition's file and line, kind, and signature, without bodies. Use it instead of search, rg, or grep to locate a definition, then read it with read_symbol using its path and line. When no code definition matches, it finds Markdown headings (kind section) by their text.",
		promptSnippet: "Find where a function, method, class, or field is defined (Python, Java, C/C++)",
		parameters: Type.Object({
			name: Type.String({ description: SYMBOL_DESCRIPTION }),
			path: Type.Optional(Type.String({ description: PATH_DESCRIPTION })),
			kind: Type.Optional(
				Type.String({
					description:
						"Only this kind: class, function, method, constructor, field, variable, type, namespace, or any (default). class also matches interfaces, enums, records, structs, and unions.",
				}),
			),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: { name: string; path?: string; kind?: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return textResult(await runFindSymbol(params, toolContext(ctx, signal)));
		},
	});

	register({
		name: "read_symbol",
		label: "Read symbol",
		description:
			READ_SYMBOL_TOOL_DESCRIPTION,
			promptSnippet: "Read whole functions, classes, or Markdown sections by name, by path and line, or by path and line range; module: true reads imports and module-level code (Python, Java, C/C++)",
		parameters: Type.Object({
			symbol: Type.Optional(Type.String({ description: READ_SYMBOL_DESCRIPTION })),
			path: Type.Optional(Type.String({ description: READ_PATH_DESCRIPTION })),
			line: Type.Optional(Type.Integer({ description: "Reads the function, class, or section containing this 1-based line. Needs path to be a file.", minimum: 1 })),
			end_line: Type.Optional(Type.Integer({ description: "With line, reads everything from line to end_line, widened to whole definitions. Module-level code in the range comes back as written.", minimum: 1 })),
			module: Type.Optional(Type.Boolean({ description: "Reads the file's module-level code (imports, constants, __all__, includes, macros) in full, with each top-level definition collapsed to its first line and line range. Needs path to be a file; full, before, and after do not apply." })),
			full: Type.Optional(Type.Boolean({ description: "Defaults to true. Pass false to get a class's skeleton: its members with line ranges, not source text." })),
			before: Type.Optional(Type.Integer({ description: "Also return the previous N functions or classes at the same level.", minimum: 0 })),
			after: Type.Optional(Type.Integer({ description: "Also return the next N functions or classes at the same level.", minimum: 0 })),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: ReadSymbolParams, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return textResult(await runReadSymbol(params, toolContext(ctx, signal)));
		},
	});

	register({
		name: "outline",
		label: "Outline",
		description:
			"List the functions, classes, and members of one Python, Java, or C/C++ file, or the headings of a Markdown file, with line ranges and signatures, without bodies. Use it instead of searching for '^def |^class ' or reading the file to find the part you need, then read that part with read_symbol using its path and a line from the row's range, or the file's imports and module-level code with module: true.",
		promptSnippet: "List a source file's functions, classes, and members, or a Markdown file's headings, with line ranges",
		parameters: Type.Object({ path: Type.String({ description: "File to outline." }) }),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: { path: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return textResult(await runOutline(params, toolContext(ctx, signal)));
		},
	});

	register({
		name: "find_references",
		label: "Find references",
		description:
			"Find usages of a symbol in Python, Java, or C/C++ code, grouped by file, with the enclosing function for each usage. Use it instead of search or rg to find where a function, class, or field is used. By default it matches by name, which is fast but can include same-named symbols elsewhere. precise: true asks a language server for exact references (Python and Java only); the first precise call in a project can take a while.",
		promptSnippet: "Find where a symbol is used (Python, Java, C/C++)",
		parameters: Type.Object({
			symbol: Type.String({ description: SYMBOL_DESCRIPTION }),
			path: Type.Optional(Type.String({ description: PATH_DESCRIPTION })),
			precise: Type.Optional(Type.Boolean({ description: "Use a language server for exact references (Python and Java)." })),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: { symbol: string; path?: string; precise?: boolean }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return textResult(await runFindReferences(params, toolContext(ctx, signal), lsp));
		},
	});

	register({
		name: "search",
		label: "Search",
		description:
			"Search files for text and list the matching lines, grouped by file, with line numbers. Use it instead of rg or grep in bash, including grep --include and grep -v on paths. pattern is one string, or a list of strings to match any of them; each is matched literally unless regex: true, which takes ripgrep regex syntax. path is a file or directory, or a list of them, and defaults to the working directory. glob is one glob or a list: plain entries keep only matching files, entries starting with ! exclude, and globs containing / match paths relative to the working directory, for example glob: [\"*.py\", \"*.md\", \"!**/tests/**\", \"!src/legacy.py\"]. .gitignored and binary files are skipped, hidden files are not. In Python, Java, and C/C++ files each match names its enclosing function or class; read it with read_symbol using that path and the match's line. To find a definition or its usages, use find_symbol or find_references instead.",
		promptSnippet: "Search files for literal strings or regexes and list matching lines by file",
		parameters: Type.Object({
			pattern: Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1 })], {
				description: "Text to find, or a list of texts; a line matches if it contains any of them.",
			}),
			path: Type.Optional(
				Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1 })], {
					description: "File or directory to search, or a list of them. Defaults to the working directory.",
				}),
			),
			regex: Type.Optional(Type.Boolean({ description: "Treat each pattern as a ripgrep regex instead of literal text. Defaults to false." })),
			ignore_case: Type.Optional(Type.Boolean({ description: "Match without regard to case. Defaults to false." })),
			glob: Type.Optional(
				Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1 })], {
					description:
						"A glob or list of globs on file paths. Plain entries keep only matching files (*.py, src/**/*.ts); entries starting with ! exclude (!**/tests/**). Globs with / match paths relative to the working directory.",
				}),
			),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(
			_id: string,
			params: { pattern: string | string[]; path?: string | string[]; regex?: boolean; ignore_case?: boolean; glob?: string | string[] },
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: { cwd: string },
		) {
			return textResult(await runSearch(params, toolContext(ctx, signal)));
		},
	});

	register({
		name: "replace",
		label: "Replace",
		description:
			"Replace every occurrence of a text or regex across files in one call, and list each changed line with its new line number and enclosing function or class. Use it instead of sed -i, perl -pi, or repeated edit calls when the same text changes in many places, such as a renamed module path in patch strings or imports. path and glob select files exactly as in search. Pass expect with the count search reported; if the count differs, nothing changes and the occurrences are listed.",
		promptSnippet: "Replace a literal string or regex in every matching file",
		parameters: Type.Object({
			pattern: Type.String({ description: "Text to find. Literal unless regex: true, which takes ripgrep regex syntax. May contain newlines." }),
			with: Type.String({ description: "Replacement text; empty deletes the match. Literal, including $, unless regex: true, where $1 and ${name} insert capture groups." }),
			path: Type.Optional(
				Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1 })], {
					description: "File or directory to change, or a list of them. Defaults to the working directory.",
				}),
			),
			regex: Type.Optional(Type.Boolean({ description: "Treat pattern as a ripgrep regex instead of literal text. Defaults to false." })),
			ignore_case: Type.Optional(Type.Boolean({ description: "Match without regard to case. Defaults to false." })),
			glob: Type.Optional(
				Type.Union([Type.String(), Type.Array(Type.String(), { minItems: 1 })], {
					description:
						"A glob or list of globs on file paths. Plain entries keep only matching files (*.py); entries starting with ! exclude (!**/tests/**). Globs with / match paths relative to the working directory.",
				}),
			),
			expect: Type.Optional(Type.Integer({ description: "The number of occurrences you expect. If the count differs, nothing is changed.", minimum: 0 })),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: ReplaceParams, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			const files: string[] = [];
			const write = options.mutate ?? ((_file: string, fn: () => Promise<unknown>) => fn());
			const mutate = async <T>(file: string, fn: () => Promise<T>): Promise<T> => {
				const result = (await write(file, fn)) as T;
				files.push(file);
				return result;
			};
			const text = await runReplace(params, { ...toolContext(ctx, signal), mutate });
			return { ...textResult(text), details: { files } };
		},
	});

	pi.on("session_start", async () => {
		throttle.reset();
		void cleanupSpillDirs(tmpRoot, Date.now());
	});

	pi.on("session_shutdown", async () => {
		await lsp.shutdownAll();
	});

	pi.on("before_agent_start", async (event) => {
		const guidelines = event.systemPromptOptions.promptGuidelines;
		for (const line of GUIDELINES) if (!guidelines.includes(line)) guidelines.push(line);
	});

	pi.on("tool_call", async (rawEvent, rawCtx) => {
		const event = rawEvent as unknown as CallEvent;
		const ctx = rawCtx as unknown as EventContext;
		if (event.parentToolCallId) return undefined;
		const command = event.input?.command;
		const path = event.input?.path;
		const isRead = event.toolName === "read" && typeof path === "string" && isOutlinable(path) && !isSkillPath(path);
		if (!isRead && (event.toolName !== "bash" || typeof command !== "string")) return undefined;
		// pi blocks a call whose tool_call handler throws, so a failed check lets the command run.
		try {
			if (!pi.getActiveTools().includes("read_symbol")) return undefined;
			const toolCtx = { cwd: ctx.cwd, signal: ctx.signal };
			if (isRead) {
				const reason = await readRangeBlock(expandHome(path), event.input ?? {}, toolCtx).catch(() => undefined);
				return reason === undefined ? undefined : { block: true, reason };
			}
			const reason = await bashBlock(command, toolCtx);
			return reason === undefined ? undefined : { block: true, reason };
		} catch {
			return undefined;
		}
	});

	async function outlineFirst(event: ResultEvent, ctx: EventContext): Promise<string | undefined> {
		const path = event.input.path;
		if (event.toolName !== "read" || event.isError || typeof path !== "string" || !isOutlinable(path) || isSkillPath(path)) return undefined;
		if (event.input.offset !== undefined || event.input.limit !== undefined) return undefined;
		try {
			const file = resolve(ctx.cwd, expandHome(path));
			const outline = await outlineText(file, { cwd: ctx.cwd, signal: ctx.signal }, path);
			return `${outlineFirstNote(path, (await readSource(file)).lineCount, isMarkdown(path))}\n\n${outline}`;
		} catch {
			return undefined;
		}
	}

	pi.on("tool_result", async (rawEvent, rawCtx) => {
		const event = rawEvent as unknown as ResultEvent;
		const ctx = rawCtx as unknown as EventContext;
		if (event.parentToolCallId) return undefined;
		throttle.recordCall();
		const texts = event.content.filter((block): block is TextBlock => block.type === "text");
		if (texts.length === 0) return undefined;
		const original = texts.map((block) => block.text).join("\n");
		let replacement = await outlineFirst(event, ctx);
		replacement ??= await applyCap({
			toolName: event.toolName,
			toolCallId: event.toolCallId,
			input: event.input,
			text: original,
			details: event.details,
			structuredContent: event.structuredContent,
			cwd: ctx.cwd,
			sessionId: ctx.sessionManager.getSessionId(),
			tmpRoot,
		});
		const command = event.input.command;
		const hint = event.toolName === "bash" && typeof command === "string" && bashWantsHint(command, isOutlinable) && throttle.take();
		if (replacement === undefined && !hint) return undefined;
		const text = `${replacement ?? original}${hint ? `\n\n${HINT_TEXT}` : ""}`;
		const others = event.content.filter((block) => block.type !== "text");
		return { content: [{ type: "text", text }, ...others], structuredContent: event.structuredContent } as never;
	});
}
