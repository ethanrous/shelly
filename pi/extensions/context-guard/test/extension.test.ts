import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
	Integer: (options = {}) => ({ type: "integer", ...options }),
	Optional: (schema: unknown) => ({ optional: true, schema }),
	Array: (items: unknown, options = {}) => ({ type: "array", items, ...options }),
	Union: (anyOf: unknown[], options = {}) => ({ anyOf, ...options }),
};
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");

// biome-ignore lint/suspicious/noExplicitAny: test double for pi's ExtensionAPI
type Any = any;

async function setup(mutate?: Any) {
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
	registerContextGuard(pi as Any, FakeType, { lsp, tmpRoot, mutate });
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

test("registers the six tools with flat parameters", async () => {
	const { tools } = await setup();
	assert.deepEqual([...tools.keys()].sort(), ["find_references", "find_symbol", "outline", "read_symbol", "replace", "search"]);
	assert.deepEqual(Object.keys(tools.get("replace").parameters.properties), ["pattern", "with", "path", "regex", "ignore_case", "glob", "expect"]);
	assert.deepEqual(Object.keys(tools.get("search").parameters.properties), ["pattern", "path", "regex", "ignore_case", "glob"]);
	assert.deepEqual(Object.keys(tools.get("read_symbol").parameters.properties), ["symbol", "path", "line", "end_line", "module", "full", "before", "after"]);
	assert.equal(tools.get("find_references").parameters.properties.precise.schema.type, "boolean");
	for (const tool of tools.values()) {
		assert.ok(tool.description.length > 40, tool.name);
		assert.ok(tool.promptSnippet, tool.name);
	}
});

test("replace writes through the mutate option", async () => {
	const queued: string[] = [];
	const { tools } = await setup(async (file: string, fn: () => Promise<unknown>) => {
		queued.push(file);
		return fn();
	});
	const dir = await mkdtemp(join(tmpdir(), "cg-ext-replace-"));
	await writeFile(join(dir, "a.txt"), "old old\n");
	const result = await tools.get("replace").execute("id", { pattern: "old", with: "new" }, undefined, undefined, { cwd: dir });
	assert.match(result.content[0].text, /^Replaced 2 occurrences of "old" with "new" in 1 file\na\.txt\n {2}1 {2}new new$/);
	assert.deepEqual(queued, [join(dir, "a.txt")]);
	assert.deepEqual(result.details, { files: [join(dir, "a.txt")] });
});

test("tool execute returns text content", async () => {
	const { tools } = await setup();
	const result = await tools.get("find_symbol").execute("id", { name: "OTHER" }, undefined, undefined, { cwd: FIX });
	assert.equal(result.content[0].type, "text");
	assert.match(result.content[0].text, /^1 definition of "OTHER":/);
});

const pyFunctions = (count: number, lines: number) =>
	Array.from({ length: count }, (_, n) => [`def f${n}():`, ...Array.from({ length: lines - 1 }, (_, i) => `    v${i} = ${i}`)].join("\n")).join("\n");

async function pythonDir() {
	const dir = await mkdtemp(join(tmpdir(), "cg-ext-py-"));
	await writeFile(join(dir, "gen.py"), `${pyFunctions(3, 30)}\n`);
	return { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
}

test("tool_call blocks a top-level bash line-range read of any size", async () => {
	const { emit } = await setup();
	const context = await pythonDir();
	const call = (over: Record<string, unknown>) =>
		emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command: "sed -n 1,30p gen.py" }, ...over }, context);
	const result = await call({});
	assert.equal(result.block, true);
	assert.match(result.reason, /read_symbol \{"path": "gen.py", "line": 1\} {2}function f0 \(L1-30\)/);
	assert.equal(await call({ parentToolCallId: "p1" }), undefined);
	assert.equal(await call({ toolName: "read", input: { path: "gen.py" } }), undefined);
	assert.equal((await call({ input: { command: "sed -n 1,3p gen.py" } })).block, true);
	assert.equal(await call({ input: {} }), undefined);
});

test("tool_call joins every reason for a bash command into one message", async () => {
	const { emit } = await setup();
	const call = (command: string) => emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command } });
	const search = await call(`rg -n "^def |^class " py/pkg/core.py`);
	assert.equal(search.block, true);
	assert.match(search.reason, /^Blocked: rg -n '\^def \|\^class ' py\/pkg\/core.py matches only function and class definitions, so nothing in this command ran\.\n/);
	const context = await pythonDir();
	const both = await emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command: `sed -n 1,30p gen.py; rg -n "def f0" gen.py` } }, context);
	assert.match(both.reason, /^Blocked: sed -n 1,30p gen.py reads code by line number; rg -n 'def f0' gen.py matches only function and class definitions, so nothing in this command ran\./);
	assert.equal(both.reason.match(/^Rerun the rest of the command without it\.$/gm)?.length, 1);
	assert.equal(await call(`rg -n "^def |^MAX" py/pkg/core.py`) === undefined, false);
	assert.match((await call(`rg -n "^def |^MAX" py/pkg/core.py`)).reason, /^Blocked: rg -n '\^def \|\^MAX' py\/pkg\/core.py searches code files/);
	assert.equal(await call("rg --files"), undefined);
});

test("tool_call lets the read run when read_symbol is not an active tool", async () => {
	const { emit, setActive } = await setup();
	setActive(["bash", "read"]);
	assert.equal(await emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command: "sed -n 12,15p py/pkg/core.py" } }), undefined);
});

test("read_symbol documents separate fields and the module view", async () => {
	const { tools } = await setup();
	const tool = tools.get("read_symbol");
	assert.match(tool.description, /read_symbol \{"path": "src\/app.py", "line": 302\}/);
	assert.match(tool.description, /read_symbol \{"path": "src\/app.py", "line": 280, "end_line": 340\}/);
	assert.match(tool.description, /read_symbol \{"path": "src\/app.py", "module": true\}/);
	assert.doesNotMatch(tool.description, /path:A-B|path:LINE|file:line/);
	assert.match(tool.parameters.properties.symbol.schema.description, /Only a name/);
	assert.match(tool.parameters.properties.module.schema.description, /module-level code/);
	for (const name of ["find_symbol", "outline", "search", "find_references"]) assert.doesNotMatch(tools.get(name).description, /path:LINE|file:line/, name);
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

test("large results from this extension's own tools are spilled like any other", async () => {
	const { toolResult, tmpRoot } = await setup();
	const text = lines(500);
	const result = await toolResult({ toolName: "outline", input: { path: "big.py" }, content: [{ type: "text", text }] });
	const path = spillPath(tmpRoot, "sess", "c1");
	assert.equal(result.content[0].text, capNotice(measure(text), path));
	assert.equal(await readFile(path, "utf8"), text);
});

test("nested codemode calls and exempt tools are left alone", async () => {
	const { toolResult } = await setup();
	assert.equal(await toolResult({ parentToolCallId: "p", content: [{ type: "text", text: lines(900) }] }), undefined);
	assert.equal(await toolResult({ toolName: "Agent", content: [{ type: "text", text: lines(900) }] }), undefined);
});

const readEvent = (path: string, text: string, over: Record<string, unknown> = {}) => ({
	type: "tool_result",
	toolCallId: "r1",
	toolName: "read",
	input: { path },
	content: [{ type: "text", text }],
	details: undefined,
	isError: false,
	...over,
});

test("an unranged read of a source file returns the outline", async () => {
	const { emit, toolResult } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-read-"));
	const source = `class Long {\n${Array.from({ length: 450 }, (_, i) => `    int f${i};`).join("\n")}\n}\n`;
	await writeFile(join(dir, "Long.java"), source);
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	const handlerResult = await emit("tool_result", readEvent("Long.java", source), readCtx);
	const text = handlerResult.content[0].text as string;
	assert.ok(
		text.startsWith(
			'Long.java is 452 lines; its outline is shown instead of the file. Read imports and other module-level code with read_symbol {"path": "Long.java", "module": true}, and a function or class with read_symbol, passing path and a line from an outline row\'s range.\n\nLong.java (452 lines)\n',
		),
		text.slice(0, 300),
	);
	const ranged = await toolResult({ toolName: "read", input: { path: join(dir, "Long.java"), offset: 1, limit: 20 }, content: [{ type: "text", text: lines(20) }] });
	assert.equal(ranged, undefined);
});

test("an unranged read of a three-line source file returns the outline", async () => {
	const { emit } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-small-"));
	const source = "X = 1\n\n\ndef f():\n    return X\n";
	await writeFile(join(dir, "small.py"), source);
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	const text = (await emit("tool_result", readEvent("small.py", source), readCtx)).content[0].text as string;
	assert.ok(text.startsWith("small.py is 5 lines; its outline is shown instead of the file."), text);
	assert.ok(text.endsWith("small.py (5 lines)\nL1        X\nL4-5      f"), text);
});

test("a source file without symbols returns its outline and the module view call", async () => {
	const { emit } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-nosym-"));
	const source = `${Array.from({ length: 450 }, (_, i) => `print(${i})`).join("\n")}\n`;
	await writeFile(join(dir, "script.py"), source);
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	const text = (await emit("tool_result", readEvent("script.py", source, { toolCallId: "r2" }), readCtx)).content[0].text as string;
	assert.ok(text.includes('read_symbol {"path": "script.py", "module": true}'), text);
	assert.ok(text.endsWith("script.py (450 lines)\nNo symbols found."), text);
});

test("reads of skill files and errors are left alone", async () => {
	const { emit } = await setup();
	const dir = await mkdtemp(join(tmpdir(), "cg-skill-"));
	await mkdir(join(dir, "skills", "x"), { recursive: true });
	await writeFile(join(dir, "skills", "x", "SKILL.md"), "# Skill\ntext\n");
	const readCtx = { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } };
	assert.equal(await emit("tool_result", readEvent("skills/x/SKILL.md", "# Skill\ntext\n"), readCtx), undefined);
	assert.equal(await emit("tool_call", { type: "tool_call", toolCallId: "r1", toolName: "read", input: { path: "skills/x/SKILL.md", limit: 1 } }, readCtx), undefined);
	assert.equal(await emit("tool_result", readEvent("skills/x/SKILL.md", "boom", { path: "gen.py", isError: true }), readCtx), undefined);
});

test("any read with offset or limit of a code file is blocked with the read_symbol calls", async () => {
	const { emit, setActive } = await setup();
	const context = await pythonDir();
	const call = (input: Record<string, unknown>) => emit("tool_call", { type: "tool_call", toolCallId: "r1", toolName: "read", input }, context);
	const blocked = await call({ path: "gen.py", offset: 1, limit: 60 });
	assert.equal(blocked.block, true);
	assert.match(blocked.reason, /^Blocked: read of gen\.py with offset 1 and limit 60 reads code by line number, so it did not run\.\nRead and search [^\n]*\nread_symbol \{"path": "gen\.py", "line": 1, "end_line": 60\}[^]*read_symbol \{"path": "gen\.py", "line": 31\} {2}function f2 \(L61-90\)|f1 \(L31-60\)/);
	assert.equal((await call({ path: "gen.py", offset: 5, limit: 10 })).block, true);
	assert.equal((await call({ path: "gen.py", limit: 3 })).block, true);
	assert.equal(await call({ path: "gen.py" }), undefined);
	setActive(["bash", "read"]);
	assert.equal(await call({ path: "gen.py", offset: 1, limit: 60 }), undefined);
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

async function markdownDir() {
	const dir = await mkdtemp(join(tmpdir(), "cg-ext-md-"));
	const section = (n: number) => `## Part ${n}\n\n${Array.from({ length: 40 }, (_, i) => `text ${n}.${i}`).join("\n")}\n`;
	const source = `# Doc\n\n${Array.from({ length: 12 }, (_, i) => section(i)).join("\n")}`;
	await writeFile(join(dir, "README.md"), source);
	return { source, context: { cwd: dir, signal: undefined, sessionManager: { getSessionId: () => "sess" } } };
}

test("an unranged read of a Markdown file returns its outline", async () => {
	const { emit } = await setup();
	const { source, context } = await markdownDir();
	const text = (await emit("tool_result", readEvent("README.md", source), context)).content[0].text as string;
	assert.match(text, /^README\.md is 51\d lines; its outline is shown instead of the file\. Read the text before the first heading with read_symbol \{"path": "README\.md", "module": true\}[^\n]*\n\nREADME\.md \(51\d lines\)\nL1-\d+ +Doc\n {2}L3-\d+ +Part 0\n/);
});

test("a ranged read of Markdown is blocked, and so are bash line reads and cats of Markdown", async () => {
	const { emit } = await setup();
	const { context } = await markdownDir();
	const read = (input: Record<string, unknown>) => emit("tool_call", { type: "tool_call", toolCallId: "r1", toolName: "read", input }, context);
	const blocked = await read({ path: "README.md", offset: 1, limit: 100 });
	assert.match(blocked.reason, /^Blocked: read of README\.md with offset 1 and limit 100 reads code by line number, so it did not run\.\n[^\n]*\nread_symbol \{"path": "README\.md", "line": 1, "end_line": 100\}\nread_symbol \{"path": "README\.md", "line": 3\} {2}section Doc > Part 0 \(L3-44\)\n/);
	assert.equal((await read({ path: "README.md", offset: 5, limit: 10 })).block, true);
	const call = (command: string) => emit("tool_call", { type: "tool_call", toolCallId: "c1", toolName: "bash", input: { command } }, context);
	assert.equal((await call("sed -n 1,80p README.md")).block, true);
	assert.equal((await call("cat README.md")).block, true);
	assert.match((await call("head -n 100 README.md; rg -n '^#+ ' README.md")).reason, /reads code by line number; rg -n '\^#\+ ' README\.md searches code files/);
});
