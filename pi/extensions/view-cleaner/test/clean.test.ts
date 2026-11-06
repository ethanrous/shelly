import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAssistantMessage } from "../clean.ts";

const ctx = { cwd: "/Users/me/repo", home: "/Users/me" };

test("edits bash arguments in place", () => {
	const args = { command: "cd /Users/me/repo && ls", timeout: 5 };
	const message = { role: "assistant", content: [{ type: "text", text: "hi" }, { type: "toolCall", id: "1", name: "bash", arguments: args }] };
	assert.equal(cleanAssistantMessage(message, ctx), true);
	assert.equal(message.content[1].arguments, args);
	assert.deepEqual(args, { command: "ls", timeout: 5 });
});

test("reports no change when nothing applies", () => {
	const message = { role: "assistant", content: [{ type: "toolCall", id: "1", name: "bash", arguments: { command: "ls" } }] };
	assert.equal(cleanAssistantMessage(message, ctx), false);
});

test("ignores other tools, roles, and malformed arguments", () => {
	const read = { role: "assistant", content: [{ type: "toolCall", id: "1", name: "read", arguments: { command: "cd /Users/me/repo && ls" } }] };
	assert.equal(cleanAssistantMessage(read, ctx), false);
	assert.equal(cleanAssistantMessage({ role: "user", content: "cd /Users/me/repo && ls" }, ctx), false);
	const bad = { role: "assistant", content: [{ type: "toolCall", id: "1", name: "bash", arguments: "cd /Users/me/repo && ls" }] };
	assert.equal(cleanAssistantMessage(bad, ctx), false);
});
