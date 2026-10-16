import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isSupportedSource } from "./languages.ts";
import { lineReadBlock } from "./line-reads.ts";
import { LspManager } from "./lsp/manager.ts";
import { applyCap, cleanupSpillDirs, expandHome, measureFile } from "./output-cap.ts";
import { bashWantsHint, GUIDELINES, HINT_TEXT, HintThrottle, outlineFirstNote, wantsOutlineFirst } from "./steering.ts";
import { outlineForRead, type PreciseBackend, runFindReferences, runFindSymbol, runOutline, runReadSymbol, type ToolContext } from "./tools.ts";

export interface SchemaBuilder {
	Object(properties: Record<string, unknown>): unknown;
	String(options?: { description?: string }): unknown;
	Boolean(options?: { description?: string }): unknown;
	Optional(schema: unknown): unknown;
}

export interface ExtensionOptions {
	lsp?: PreciseBackend & { shutdownAll(): Promise<void> };
	tmpRoot?: string;
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
	"Symbol name, optionally qualified (getDocumentId, DocumentService.getDocumentId, pkg.module.func, or ns::Class::method; a * in the last segment is a wildcard), or a file:line such as src/app.py:302 from rg -n, which reads the function or class containing that line.";
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
			"Find where a symbol is defined in Python, Java, or C/C++ code. Returns file:line, kind, and signature for each definition, without bodies. Use it instead of rg or grep to locate a definition.",
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
			"Read the source of a function, method, class, or other symbol by name or by file:line in Python, Java, or C/C++ code, without guessing line ranges. A file:line, such as a match from rg -n, returns the function or class containing that line. Functions and methods come back whole with their doc comment and annotations or decorators. A class comes back as a skeleton listing its members with line ranges; read a member with Class.member, or pass full: true for the whole class. An ambiguous name returns the candidates; narrow it with path or a qualified name.",
		promptSnippet: "Read a function, method, or class by name or file:line, without line ranges (Python, Java, C/C++)",
		parameters: Type.Object({
			symbol: Type.String({ description: READ_SYMBOL_DESCRIPTION }),
			path: Type.Optional(Type.String({ description: PATH_DESCRIPTION })),
			full: Type.Optional(Type.Boolean({ description: "Return a whole class instead of its skeleton." })),
		}),
		constrainedSampling: CONSTRAINED_SAMPLING,
		async execute(_id: string, params: { symbol: string; path?: string; full?: boolean }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return textResult(await runReadSymbol(params, toolContext(ctx, signal)));
		},
	});

	register({
		name: "outline",
		label: "Outline",
		description:
			"List the symbols in one Python, Java, or C/C++ file with line ranges, kinds, and signatures, without bodies. Use it before reading a file to find the part you need.",
		promptSnippet: "List a source file's functions, classes, and members with line ranges",
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
			"Find usages of a symbol in Python, Java, or C/C++ code, grouped by file, with the enclosing function for each usage. By default it matches by name, which is fast but can include same-named symbols elsewhere. precise: true asks a language server for exact references (Python and Java only); the first precise call in a project can take a while.",
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
		const command = event.input?.command;
		if (event.parentToolCallId || event.toolName !== "bash" || typeof command !== "string") return undefined;
		// pi blocks a call whose tool_call handler throws, so a failed check lets the command run.
		try {
			if (!pi.getActiveTools().includes("read_symbol")) return undefined;
			const reason = await lineReadBlock(command, { cwd: ctx.cwd, signal: ctx.signal });
			return reason === undefined ? undefined : { block: true, reason };
		} catch {
			return undefined;
		}
	});

	async function outlineFirst(event: ResultEvent, ctx: EventContext): Promise<string | undefined> {
		const path = event.input.path;
		if (event.toolName !== "read" || event.isError || typeof path !== "string" || !isSupportedSource(path)) return undefined;
		try {
			const file = resolve(ctx.cwd, expandHome(path));
			const { lines } = await measureFile(file);
			if (!wantsOutlineFirst(event.input, lines, true)) return undefined;
			const outline = await outlineForRead(file, { cwd: ctx.cwd, signal: ctx.signal }, path);
			return outline === undefined ? undefined : `${outlineFirstNote(path, lines)}\n\n${outline}`;
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
		const hint = event.toolName === "bash" && typeof command === "string" && bashWantsHint(command, isSupportedSource) && throttle.take();
		if (replacement === undefined && !hint) return undefined;
		const text = `${replacement ?? original}${hint ? `\n\n${HINT_TEXT}` : ""}`;
		const others = event.content.filter((block) => block.type !== "text");
		return { content: [{ type: "text", text }, ...others], structuredContent: event.structuredContent } as never;
	});
}
