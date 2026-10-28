import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, utimes, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyCap,
	type CapRequest,
	capNotice,
	cleanupSpillDirs,
	exceedsCap,
	existingFullOutputPath,
	expandHome,
	formatBytes,
	isCapExempt,
	measure,
	measureFile,
	readNotice,
	spillPath,
} from "../output-cap.ts";

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");
const tmp = () => mkdtemp(join(tmpdir(), "cg-cap-"));
const req = (over: Partial<CapRequest>): CapRequest => ({
	toolName: "bash",
	toolCallId: "c1",
	input: {},
	text: "",
	details: undefined,
	structuredContent: undefined,
	cwd: "/",
	sessionId: "s1",
	tmpRoot: tmpdir(),
	...over,
});

test("measure counts bytes and lines", () => {
	assert.deepEqual(measure(""), { bytes: 0, lines: 0 });
	assert.deepEqual(measure("a\nb"), { bytes: 3, lines: 2 });
	assert.deepEqual(measure("a\nb\n"), { bytes: 4, lines: 2 });
	assert.equal(measure("é").bytes, 2);
});

test("exceedsCap uses strict greater-than on both limits", () => {
	assert.equal(exceedsCap({ bytes: 16384, lines: 400 }), false);
	assert.equal(exceedsCap({ bytes: 16385, lines: 1 }), true);
	assert.equal(exceedsCap({ bytes: 10, lines: 401 }), true);
});

test("isCapExempt covers edit/write, subagent tools, and skill reads", () => {
	for (const name of ["edit", "write", "Agent", "get_subagent_result"]) {
		assert.equal(isCapExempt(name, {}), true, name);
	}
	for (const name of ["read_symbol", "outline", "find_symbol", "find_references", "search"]) assert.equal(isCapExempt(name, {}), false, name);
	assert.equal(isCapExempt("read", { path: "/u/.pi/agent/skills/foo/SKILL.md" }), true);
	assert.equal(isCapExempt("read", { path: "pi/skills/rust-guidelines/references/SOURCES.md" }), true);
	assert.equal(isCapExempt("read", { path: "src/skillset/notes.md" }), false);
	assert.equal(isCapExempt("bash", { command: "ls" }), false);
	assert.equal(isCapExempt("mcp__srv__tool", {}), false);
});

test("existingFullOutputPath reads bash details and the MCP marker", () => {
	assert.equal(existingFullOutputPath("bash", { fullOutputPath: "/tmp/a.log" }, "x"), "/tmp/a.log");
	assert.equal(existingFullOutputPath("bash", undefined, "x"), undefined);
	const mcp = "Warning: truncated output\n\n...\n\n[Full output: /tmp/pi-mcp/out.txt (read it with offset/limit)]";
	assert.equal(existingFullOutputPath("mcp__s__t", undefined, mcp), "/tmp/pi-mcp/out.txt");
	assert.equal(existingFullOutputPath("mcp__s__t", undefined, "plain"), undefined);
});

test("formatBytes", () => {
	assert.equal(formatBytes(512), "512B");
	assert.equal(formatBytes(100_352), "98KB");
	assert.equal(formatBytes(3 * 1024 * 1024), "3.0MB");
});

test("capNotice and readNotice text", () => {
	assert.equal(
		capNotice({ lines: 1234, bytes: 100_352 }, "/t/x.txt", 1),
		"[Output too large for context: 1,234 lines, 98KB, bash exit code 1. Saved to /t/x.txt.\n" +
			'Find text in it with search {"pattern": "<text to find>", "path": "/t/x.txt"}, or view a slice with head -n N / tail -n N.]',
	);
	assert.ok(!capNotice({ lines: 5, bytes: 5 }, "/p").includes("exit code"));
	assert.equal(
		readNotice({ lines: 5000, bytes: 2_000_000 }, "logs/big.log"),
		"[logs/big.log is 5,000 lines, 1.9MB: too large to return whole. " +
			'Find text in it with search {"pattern": "<text to find>", "path": "logs/big.log"}, then read a range with offset/limit.]',
	);
	assert.equal(
		readNotice({ lines: 5000, bytes: 2_000_000 }, "src/big.py"),
		'[src/big.py is 5,000 lines, 1.9MB: too large to return whole. List its structure with outline {"path": "src/big.py"}, then read parts of it with read_symbol.]',
	);
});

test("spillPath sanitizes ids", () => {
	assert.equal(spillPath("/tmp", "s/1", "call:7"), join("/tmp", "pi-tool-output", "s_1", "call_7.txt"));
});

test("expandHome", () => {
	assert.equal(expandHome("~/x"), join(homedir(), "x"));
	assert.equal(expandHome("x/~"), "x/~");
	assert.equal(expandHome("@src/a.py"), "src/a.py");
	assert.equal(expandHome("@~/x"), join(homedir(), "x"));
});

test("measureFile matches measure", async () => {
	const root = await tmp();
	for (const text of ["", "a", "a\n", lines(1000)]) {
		const f = join(root, "f.txt");
		await writeFile(f, text);
		assert.deepEqual(await measureFile(f), measure(text));
	}
});

test("applyCap leaves small output alone", async () => {
	assert.equal(await applyCap(req({ text: "ok" })), undefined);
});

test("applyCap skips exempt tools", async () => {
	assert.equal(await applyCap(req({ toolName: "Agent", text: lines(5000) })), undefined);
});

test("applyCap spills large bash output and reports the exit code", async () => {
	const root = await tmp();
	const text = lines(500);
	const out = await applyCap(req({ text, tmpRoot: root, structuredContent: { exit_code: 2 } }));
	const path = spillPath(root, "s1", "c1");
	assert.equal(await readFile(path, "utf8"), text);
	assert.equal(out, capNotice(measure(text), path, 2));
});

test("applyCap falls back to the exit status line when structuredContent is missing", async () => {
	const root = await tmp();
	const text = `${lines(500)}\n\nCommand exited with code 3`;
	const out = await applyCap(req({ text, tmpRoot: root }));
	assert.ok(out?.includes("bash exit code 3"));
});

test("applyCap triggers on bytes alone for any tool", async () => {
	const root = await tmp();
	const out = await applyCap(req({ toolName: "mcp__a__b", text: "y".repeat(17 * 1024), tmpRoot: root }));
	assert.ok(out?.startsWith("[Output too large for context: 1 lines, 17KB. Saved to "));
});

test("applyCap reuses bash fullOutputPath and measures that file", async () => {
	const root = await tmp();
	const full = join(root, "full.log");
	await writeFile(full, lines(3000));
	const out = await applyCap(req({ text: lines(2000), tmpRoot: root, details: { fullOutputPath: full } }));
	assert.equal(out, capNotice(await measureFile(full), full, undefined));
	assert.deepEqual(await readdir(root), ["full.log"]);
});

test("applyCap on read points at the file and writes nothing", async () => {
	const root = await tmp();
	await writeFile(join(root, "big.log"), lines(5000));
	const out = await applyCap(
		req({ toolName: "read", input: { path: "big.log" }, cwd: root, text: lines(2000), tmpRoot: root }),
	);
	assert.equal(out, readNotice(await measureFile(join(root, "big.log")), "big.log"));
	assert.deepEqual(await readdir(root), ["big.log"]);
});

test("applyCap passes a ranged read under the cap", async () => {
	const root = await tmp();
	await writeFile(join(root, "big.log"), lines(5000));
	const out = await applyCap(
		req({ toolName: "read", input: { path: "big.log", offset: 10, limit: 100 }, cwd: root, text: lines(100) }),
	);
	assert.equal(out, undefined);
});

test("applyCap returns undefined when the spill cannot be written", async () => {
	const root = await tmp();
	await writeFile(join(root, "pi-tool-output"), "not a directory");
	assert.equal(await applyCap(req({ text: lines(500), tmpRoot: root })), undefined);
});

test("cleanupSpillDirs removes session dirs older than 7 days", async () => {
	const root = await tmp();
	const old = join(root, "pi-tool-output", "old");
	const fresh = join(root, "pi-tool-output", "new");
	await mkdir(old, { recursive: true });
	await mkdir(fresh, { recursive: true });
	const eightDaysAgo = (Date.now() - 8 * 86_400_000) / 1000;
	await utimes(old, eightDaysAgo, eightDaysAgo);
	await cleanupSpillDirs(root, Date.now());
	assert.deepEqual(await readdir(join(root, "pi-tool-output")), ["new"]);
});

test("cleanupSpillDirs tolerates a missing spill root", async () => {
	await cleanupSpillDirs(await tmp(), Date.now());
});
