import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDELINE } from "../config.ts";
import { registerDiagnostics } from "../extension.ts";
import { tempDir } from "./helpers.ts";

const FakeType = {
	Object: (properties: Record<string, unknown>) => ({ type: "object", properties }),
	String: (options = {}) => ({ type: "string", ...options }),
	Array: (items: unknown, options = {}) => ({ type: "array", items, ...options }),
	Optional: (schema: unknown) => ({ optional: true, schema }),
};

// biome-ignore lint/suspicious/noExplicitAny: test double for pi's ExtensionAPI
type Any = any;

function setup() {
	const tools = new Map<string, Any>();
	const handlers = new Map<string, Any>();
	const pi = { registerTool: (tool: Any) => tools.set(tool.name, tool), on: (event: string, handler: Any) => handlers.set(event, handler) };
	registerDiagnostics(pi as Any, FakeType);
	return { tools, handlers };
}

test("registers one diagnostics tool with an optional paths array", () => {
	const { tools } = setup();
	assert.deepEqual([...tools.keys()], ["diagnostics"]);
	const tool = tools.get("diagnostics");
	assert.deepEqual(tool.parameters, { type: "object", properties: { paths: { optional: true, schema: { type: "array", items: { type: "string" }, description: tool.parameters.properties.paths.schema.description } } } });
	assert.ok(tool.promptSnippet);
	assert.ok(tool.description.length < 400);
});

test("execute returns text content", async () => {
	const { tools } = setup();
	const cwd = tempDir();
	const result = await tools.get("diagnostics").execute("id", { paths: ["missing.py"] }, undefined, undefined, { cwd });
	assert.deepEqual(result, { content: [{ type: "text", text: "not found: missing.py" }], details: undefined });
});

test("before_agent_start adds the guideline once", async () => {
	const { handlers } = setup();
	const event = { systemPromptOptions: { promptGuidelines: [] as string[] } };
	await handlers.get("before_agent_start")(event);
	await handlers.get("before_agent_start")(event);
	assert.deepEqual(event.systemPromptOptions.promptGuidelines, [GUIDELINE]);
});
