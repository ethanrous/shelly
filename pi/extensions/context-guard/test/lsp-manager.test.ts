import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MASON_BIN } from "../config.ts";
import { defaultServerCommand, LspManager, projectRoot } from "../lsp/manager.ts";
import { findExecutable } from "../proc.ts";

const FAKE = fileURLToPath(new URL("./fixtures/fake-lsp.mjs", import.meta.url));
const PY_FIXTURE = fileURLToPath(new URL("./fixtures/py/", import.meta.url));
const fake = (mode: string) => () => ({ command: process.execPath, args: [FAKE], env: { FAKE_LSP_MODE: mode }, name: "fake" });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function workspace(marker: string, fileName: string) {
	const root = await mkdtemp(join(tmpdir(), "cg-lsp-"));
	await writeFile(join(root, marker), "");
	await mkdir(join(root, "src"), { recursive: true });
	const file = join(root, "src", fileName);
	await writeFile(file, "x\ny\n");
	return { root, file };
}

test("projectRoot prefers the nearest marker, then the git root", async () => {
	const base = await mkdtemp(join(tmpdir(), "cg-root-"));
	await mkdir(join(base, ".git"));
	await mkdir(join(base, "svc", "src"), { recursive: true });
	await writeFile(join(base, "svc", "pyproject.toml"), "");
	assert.equal(projectRoot("python", join(base, "svc", "src", "a.py")), join(base, "svc"));
	assert.equal(projectRoot("java", join(base, "svc", "src", "A.java")), base);
});

test("defaultServerCommand builds the jdtls command line", { skip: !findExecutable("jdtls", process.env.PATH, [MASON_BIN]) }, () => {
	const command = defaultServerCommand("java", "/repo/root");
	assert.ok(command);
	assert.equal(command.name, "jdtls");
	assert.equal(command.args[0], "-data");
	assert.match(command.args[1], /pi-context-guard\/jdtls\/[0-9a-f]{16}$/);
	assert.equal(command.args[2], "--jvm-arg=-Xmx2G");
});

test("references returns file locations and drops non-file URIs", async (t) => {
	const { file } = await workspace("pyproject.toml", "mod.py");
	const manager = new LspManager({ resolveCommand: fake("python") });
	t.after(() => manager.shutdownAll());
	assert.deepEqual(await manager.references("python", file, 0, 4), {
		status: "ok",
		server: "fake",
		locations: [{ file, line: 1, character: 4 }],
	});
});

test("java waits for ServiceReady", async (t) => {
	const { file } = await workspace("settings.gradle", "A.java");
	const manager = new LspManager({ resolveCommand: fake("java") });
	t.after(() => manager.shutdownAll());
	const result = await manager.references("java", file, 3, 1);
	assert.equal(result.status, "ok");
});

test("java reports a failed build import with its results", async (t) => {
	const { file } = await workspace("settings.gradle", "A.java");
	const manager = new LspManager({ resolveCommand: fake("java-broken") });
	t.after(() => manager.shutdownAll());
	assert.deepEqual(await manager.references("java", file, 0, 0), {
		status: "ok",
		server: "fake",
		locations: [],
		warning: "build import failed: The supplied phased action failed with an exception.",
	});
});

test("java reports loading until the server is ready", async (t) => {
	const { file } = await workspace("settings.gradle", "A.java");
	const manager = new LspManager({ resolveCommand: fake("java-never"), readyWaitMs: 100 });
	t.after(() => manager.shutdownAll());
	assert.deepEqual(await manager.references("java", file, 0, 0), { status: "loading", server: "fake" });
	assert.equal(manager.serverCount, 1);
});

test("a missing binary is unavailable", async () => {
	const { file } = await workspace("pyproject.toml", "mod.py");
	const manager = new LspManager({ resolveCommand: () => undefined });
	const result = await manager.references("python", file, 0, 0);
	assert.equal(result.status, "unavailable");
	assert.match((result as { reason: string }).reason, /no pyright-langserver found/);
});

test("a crash is reported, and a second crash disables the language", async (t) => {
	const { file } = await workspace("pyproject.toml", "mod.py");
	const manager = new LspManager({ resolveCommand: fake("crash") });
	t.after(() => manager.shutdownAll());
	assert.equal((await manager.references("python", file, 0, 0)).status, "unavailable");
	assert.equal((await manager.references("python", file, 0, 0)).status, "unavailable");
	assert.deepEqual(await manager.references("python", file, 0, 0), {
		status: "unavailable",
		reason: "precise mode is disabled for python after repeated server crashes",
	});
	assert.equal(manager.serverCount, 0);
});

test("idle servers stop", async (t) => {
	const { file } = await workspace("pyproject.toml", "mod.py");
	const manager = new LspManager({ resolveCommand: fake("python"), idleMs: 50 });
	t.after(() => manager.shutdownAll());
	await manager.references("python", file, 0, 0);
	assert.equal(manager.serverCount, 1);
	await sleep(400);
	assert.equal(manager.serverCount, 0);
});

test("starting past maxServers stops the least recently used server", async (t) => {
	const a = await workspace("pyproject.toml", "a.py");
	const b = await workspace("pyproject.toml", "b.py");
	const manager = new LspManager({ resolveCommand: fake("python"), maxServers: 1 });
	t.after(() => manager.shutdownAll());
	await manager.references("python", a.file, 0, 0);
	await manager.references("python", b.file, 0, 0);
	assert.equal(manager.serverCount, 1);
});

test("shutdownAll stops every server", async () => {
	const { file } = await workspace("pyproject.toml", "mod.py");
	const manager = new LspManager({ resolveCommand: fake("python") });
	await manager.references("python", file, 0, 0);
	await manager.shutdownAll();
	assert.equal(manager.serverCount, 0);
});

test(
	"pyright finds a cross-file reference in the Python fixture",
	{ skip: !findExecutable("pyright-langserver", process.env.PATH, [MASON_BIN]), timeout: 120_000 },
	async (t) => {
		const core = join(PY_FIXTURE, "pkg", "core.py");
		const lines = (await readFile(core, "utf8")).split("\n");
		const line = lines.findIndex((l) => l.startsWith("def build_report("));
		const character = lines[line].indexOf("build_report");
		const manager = new LspManager({ readyWaitMs: 60_000, requestTimeoutMs: 60_000 });
		t.after(() => manager.shutdownAll());
		const result = await manager.references("python", core, line, character);
		assert.equal(result.status, "ok", JSON.stringify(result));
		const files = (result as { locations: { file: string }[] }).locations.map((l) => l.file);
		assert.ok(files.includes(join(PY_FIXTURE, "pkg", "app.py")), files.join(", "));
	},
);

test(
	"pyright sees edits made after the first query",
	{ skip: !findExecutable("pyright-langserver", process.env.PATH, [MASON_BIN]), timeout: 120_000 },
	async (t) => {
		const dir = await realpath(await mkdtemp(join(tmpdir(), "cg-pyedit-")));
		await cp(PY_FIXTURE, dir, { recursive: true });
		const core = join(dir, "pkg", "core.py");
		const manager = new LspManager({ readyWaitMs: 60_000, requestTimeoutMs: 60_000 });
		t.after(() => manager.shutdownAll());
		const query = async () => {
			const lines = (await readFile(core, "utf8")).split("\n");
			const line = lines.findIndex((l) => l.startsWith("def build_report("));
			return manager.references("python", core, line, lines[line].indexOf("build_report"));
		};
		const before = await query();
		await writeFile(core, `# one\n# two\n# three\n${await readFile(core, "utf8")}`);
		const after = await query();
		for (const result of [before, after]) {
			assert.equal(result.status, "ok", JSON.stringify(result));
			const files = (result as { locations: { file: string }[] }).locations.map((l) => l.file);
			assert.ok(files.includes(join(dir, "pkg", "app.py")), files.join(", "));
		}
	},
);
