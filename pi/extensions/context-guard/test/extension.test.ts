import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerContextGuard } from "../extension.ts";
import { capNotice, measure, spillPath } from "../output-cap.ts";
import { GUIDELINES, HINT_TEXT } from "../steering.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const FakeType = {
	Object: (properties: Record<string, unknown>) => ({ type: "object", properties }),
	String: (options = {}) => ({ type: "string", ...options }),
	Boolean: (options = {}) => ({ type: "boolean", ...options }),
	Optional: (schema: unknown) => ({ optional: true, schema }),
};
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");

// biome-ignore lint/suspicious/noExplicitAny: test double for pi's ExtensionAPI
type Any = any;

async function setup() {
	const tmpRoot = await mkdtemp(join(tmpdir(), "cg-ext-"));
	const tools = new Map<string, Any>();
	const handlers = new Map<string, Any[]>();
	let active: string[] | undefined;
	const pi = {
		registerTool: (tool: Any) => tools.set(tool.name, tool),
		getActiveTools: () => active ?? [...tools.keys()],
		on: (event: string, handler: Any) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
			return () => {};
		},
	};
	let shutdowns = 0;
	const lsp = {
		references: async () => ({ status: "unavailable" as const, reason: "test" }),
		shutdownAll: async () => {
			shutdowns++;
		},
	};
	registerContextGuard(pi as Any, FakeType, { lsp, tmpRoot });
	const ctx = (cwd = FIX) => ({ cwd, signal: undefined, sessionManager: { getSessionId: () => "sess" } });
	const emit = async (event: string, payload: Any, context = ctx()) => {
		let result: Any;
		for (const handler of handlers.get(event) ?? []) result = await handler(payload, context);
		return result;
	};
	const toolResult = (over: Record<string, unknown>) =>
		emit("tool_result", { type: "tool_result", toolCallId: "c1", input: {}, content: [], details: undefined, isError: false, toolName: "bash", ...over });
	const setActive = (names: string[]) => {
		active = names;
	};
	return { tools, emit, toolResult, tmpRoot, setActive, shutdowns: () => shutdowns };
}

test("registers the four tools with flat parameters", async () => {
	const { tools } = await setup();
	assert.deepEqual([...tools.keys()].sort(), ["find_references", "find_symbol", "outline", "read_symbol"]);
	assert.deepEqual(Object.keys(tools.get("read_symbol").parameters.properties), ["symbol", "path", "full"]);
	assert.equal(tools.get("find_references").parameters.properties.precise.schema.type, "boolean");
	for (const tool of tools.values()) {
		assert.ok(tool.description.length > 40, tool.name);
		assert.ok(tool.promptSnippet, tool.name);
	}
});

test("tool execute returns text content", async () => {
	const { tools } = await setup();
	const result = await tools.get("find_symbol").execute("id", { name: "OTHER" }, undefined, undefined, { cwd: FIX });
	assert.equal(result.content[0].type, "text");
	assert.match(result.content[0].text, /^1 definition of "OTHER":/);
});

test("tool_call blocks a top-level bash line-range read of a function", async () => {
	const { emit } = await setup();
	const call = (over: Record<string, unknown>) =>
		emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command: "sed -n 13,14p py/pkg/core.py" }, ...over });
	const result = await call({});
	assert.equal(result.block, true);
	assert.match(result.reason, /read_symbol "py\/pkg\/core.py:12" {2}function build_report \(L12-15\)/);
	assert.equal(await call({ parentToolCallId: "p1" }), undefined);
	assert.equal(await call({ toolName: "read", input: { path: "py/pkg/core.py" } }), undefined);
	assert.equal(await call({ input: { command: "sed -n 1,3p py/pkg/core.py" } }), undefined);
	assert.equal(await call({ input: {} }), undefined);
});

test("tool_call lets the read run when read_symbol is not an active tool", async () => {
	const { emit, setActive } = await setup();
	setActive(["bash", "read"]);
	assert.equal(await emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command: "sed -n 13,14p py/pkg/core.py" } }), undefined);
});

test("read_symbol documents the file:line form", async () => {
	const { tools } = await setup();
	const tool = tools.get("read_symbol");
	assert.match(tool.parameters.properties.symbol.description, /file:line/);
	assert.match(tool.description, /file:line/);
});

test("before_agent_start adds the guidelines once", async () => {
	const { emit } = await setup();
	const event = { systemPromptOptions: { promptGuidelines: ["existing"] } };
	await emit("before_agent_start", event);
	await emit("before_agent_start", event);
	assert.deepEqual(event.systemPromptOptions.promptGuidelines, ["existing", ...GUIDELINES]);
});

test("small results pass through untouched", async () => {
	const { toolResult } = await setup();
	assert.equal(await toolResult({ input: { command: "ls" }, content: [{ type: "text", text: "a\nb" }] }), undefined);
});

test("large results are spilled and replaced by a notice, keeping images and structuredContent", async () => {
	const { toolResult, tmpRoot } = await setup();
	const text = lines(500);
	const image = { type: "image", data: "AAAA", mimeType: "image/png" };
	const result = await toolResult({
		input: { command: "make" },
		content: [{ type: "text", text }, image],
		structuredContent: { exit_code: 0 },
	});
	const path = spillPath(tmpRoot, "sess", "c1");
	assert.deepEqual(result, { content: [{ type: "text", text: capNotice(measure(text), path, 0) }, image], structuredContent: { exit_code: 0 } });
	assert.equal(await readFile(path, "utf8"), text);
});

test("nested codemode calls and exempt tools are left alone", async () => {
	const { toolResult } = await setup();
	assert.equal(await toolResult({ parentToolCallId: "p", content: [{ type: "text", text: lines(900) }] }), undefined);
	assert.equal(await toolResult({ toolName: "Agent", content: [{ type: "text", text: lines(900) }] }), undefined);
});

test("an unranged read of a long source file returns the outline", async () => {
	const { emit, toolResult } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-read-"));
	const source = `class Long {\n${Array.from({ length: 450 }, (_, i) => `    int f${i};`).join("\n")}\n}\n`;
	await writeFile(join(dir, "Long.java"), source);
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	const event = { type: "tool_result", toolCallId: "r1", toolName: "read", input: { path: "Long.java" }, content: [{ type: "text", text: source }], details: undefined, isError: false };
	const handlerResult = await emit("tool_result", event, readCtx);
	const text = handlerResult.content[0].text as string;
	assert.ok(text.startsWith("Long.java is 452 lines; outline shown. Use read_symbol for a symbol, or read with offset/limit for a range.\n\nLong.java (452 lines)\n"), text.slice(0, 200));
	const ranged = await toolResult({ toolName: "read", input: { path: join(dir, "Long.java"), offset: 1, limit: 20 }, content: [{ type: "text", text: lines(20) }] });
	assert.equal(ranged, undefined);
});

test("bash readers of source files get one hint, then the throttle holds", async () => {
	const { toolResult } = await setup();
	const first = await toolResult({ input: { command: "cat src/app.py" }, content: [{ type: "text", text: "x = 1" }] });
	assert.deepEqual(first, { content: [{ type: "text", text: `x = 1\n\n${HINT_TEXT}` }], structuredContent: undefined });
	const second = await toolResult({ input: { command: "cat src/app.py" }, content: [{ type: "text", text: "x = 1" }] });
	assert.equal(second, undefined);
});

test("an oversized bash read of a source file gets the cap notice, then the hint", async () => {
	const { toolResult, tmpRoot } = await setup();
	const text = lines(500);
	const result = await toolResult({ input: { command: "cat big.py" }, content: [{ type: "text", text }], structuredContent: { exit_code: 0 } });
	assert.equal(result.content[0].text, `${capNotice(measure(text), spillPath(tmpRoot, "sess", "c1"), 0)}\n\n${HINT_TEXT}`);
});

test("session_shutdown stops language servers", async () => {
	const { emit, shutdowns } = await setup();
	await emit("session_shutdown", { type: "session_shutdown" });
	assert.equal(shutdowns(), 1);
});

test("a long source file without symbols falls through to the cap", async () => {
	const { emit, tmpRoot } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-nosym-"));
	const source = `${Array.from({ length: 450 }, (_, i) => `print(${i})`).join("\n")}\n`;
	await writeFile(join(dir, "script.py"), source);
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	const event = { type: "tool_result", toolCallId: "r2", toolName: "read", input: { path: "script.py" }, content: [{ type: "text", text: source }], details: undefined, isError: false };
	const result = await emit("tool_result", event, readCtx);
	assert.match(result.content[0].text, /^\[script\.py is 450 lines, \d+KB: too large to return whole\./);
	assert.ok(tmpRoot);
});
