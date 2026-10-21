import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { MAX_DIAGNOSTICS, MAX_MESSAGE_CHARS, MAX_OUTPUT_BYTES } from "../config.ts";
import { runDiagnostics } from "../run.ts";
import { CARGO_SAMPLE, ESLINT_SAMPLE, NO_PATH, RUFF_SAMPLE, TSC_SAMPLE, TY_SAMPLE, fakeBin, tempDir, write } from "./helpers.ts";

const check = (cwd: string, paths: string[] | undefined, extra: { timeoutMs?: number } = {}) => runDiagnostics({ paths }, { cwd, env: NO_PATH, ...extra });

function pythonProject(): string {
	const root = tempDir();
	write(join(root, "pyproject.toml"), "[tool.ty.src]\nexclude = []\n[tool.ruff]\nline-length = 100\n");
	write(join(root, "pkg", "bad.py"), "x = 1\n");
	return root;
}

test("python: runs ty and ruff from the project root and groups diagnostics by file", async () => {
	const root = pythonProject();
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: TY_SAMPLE, code: 1 });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: RUFF_SAMPLE.replaceAll("ROOT", root), code: 1 });
	const out = await check(root, ["pkg/bad.py"]);
	assert.equal(
		out,
		[
			"ty: 1 error, 1 warning",
			"pkg/bad.py",
			'  2:10  error  invalid-assignment  Object of type `Literal["a"]` is not assignable to `int`',
			"  3:1  warning  unused-ignore-comment  Unused `ty: ignore` directive",
			"ruff: 1 error (1 elsewhere in the project)",
			"pkg/bad.py",
			"  1:8  error  F401  `os` imported but unused",
		].join("\n"),
	);
});

test("python: checker selection follows the project configuration", async () => {
	const root = tempDir();
	write(join(root, "pyproject.toml"), "[project]\nname = 'x'\n[tool.typo]\n");
	write(join(root, "a.py"), "");
	assert.equal(await check(root, ["a.py"]), "no checker for: a.py");
	write(join(root, "ruff.toml"), "");
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	assert.equal(await check(root, ["a.py"]), "ruff: no issues");
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: "[]" });
	assert.equal(await check(root, ["a.py"]), "ty: no issues\nruff: no issues");
});

test("python: a workspace member runs each checker once from the root that configures it", async () => {
	const root = pythonProject();
	write(join(root, "a", "pyproject.toml"), "[project]\nname = 'a'\n");
	write(join(root, "b", "pyproject.toml"), "[project]\nname = 'b'\n[tool.ruff]\n");
	write(join(root, "a", "x.py"), "");
	write(join(root, "b", "y.py"), "");
	assert.equal(
		await check(root, ["a/x.py", "b/y.py"]),
		"ty: not found (looked in .venv/bin, PATH)\nruff (.): not found (looked in .venv/bin, PATH)\nruff (b): not found (looked in .venv/bin, PATH)",
	);
});

test("python: a configured checker without a binary reports where it looked", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	assert.equal(await check(root, ["a.py"]), "ty: not found (looked in .venv/bin, PATH)\nruff: not found (looked in .venv/bin, PATH)");
});

test("python: unparseable output and other exit codes are checker failures", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	fakeBin(join(root, ".venv", "bin", "ty"), { stderr: "error: invalid config\nline2\nline3\nline4", code: 2 });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]", stderr: "boom", code: 3 });
	assert.equal(await check(root, ["a.py"]), "ty: failed (exit 2): line2 | line3 | line4\nruff: failed (exit 3): boom");
});

test("files without a project root or a known extension are listed once", async () => {
	const root = tempDir();
	write(join(root, "README.md"), "");
	write(join(root, "loose.py"), "");
	assert.equal(await check(root, ["README.md", "loose.py", "README.md"]), "no checker for: README.md, loose.py");
	assert.equal(await check(root, ["nope.py"]), "not found: nope.py");
});

test("directories run the checkers of the languages they contain", async () => {
	const root = pythonProject();
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: "[]" });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	assert.equal(await check(root, ["pkg"]), "ty: no issues\nruff: no issues");
	write(join(root, "docs", "a.md"), "");
	assert.equal(await check(root, ["docs"]), "no checker for: docs");
});

function tsProject(): string {
	const root = tempDir();
	write(join(root, "package.json"), "{}");
	write(join(root, "tsconfig.json"), "{}");
	write(join(root, "services", "a.ts"), "");
	write(join(root, "services", "c.ts"), "");
	return root;
}

test("typescript: tsc output is filtered to the requested paths and the rest is counted", async () => {
	const root = tsProject();
	fakeBin(join(root, "node_modules", ".bin", "tsc"), { stdout: TSC_SAMPLE.split("\n").slice(1).join("\n"), code: 2 });
	const out = await check(root, ["services/a.ts"]);
	assert.equal(out, "tsc: 1 error (2 elsewhere in the project)\nservices/a.ts\n  1:14  error  TS2322  Type 'string' is not assignable to type 'number'.");
	assert.equal(await check(root, ["services/c.ts", "services/a.ts"]).then((text) => text.split("\n")[0]), "tsc: 1 error, 1 warning (1 elsewhere in the project)");
	write(join(root, "services", "d.ts"), "");
	assert.equal(await check(root, ["services/d.ts"]), "tsc: no issues in the requested paths (3 elsewhere in the project)");
});

test("typescript: vue-tsc is used when it resolves locally", async () => {
	const root = tsProject();
	write(join(root, "components", "b.vue"), "");
	fakeBin(join(root, "node_modules", ".bin", "tsc"), { stdout: "", code: 0 });
	fakeBin(join(root, "node_modules", ".bin", "vue-tsc"), { stdout: "components/b.vue(7,3): error TS2345: bad", code: 2 });
	assert.equal(await check(root, ["components/b.vue"]), "vue-tsc: 1 error\ncomponents/b.vue\n  7:3  error  TS2345  bad");
});

test("typescript: a missing tsc and a failing tsconfig are reported", async () => {
	const root = tsProject();
	assert.equal(await check(root, ["services/a.ts"]), "tsc: not found (looked in node_modules/.bin, PATH)");
	fakeBin(join(root, "node_modules", ".bin", "tsc"), { stdout: TSC_SAMPLE, code: 2 });
	assert.equal(await check(root, ["services/a.ts"]), "tsc: failed (exit 2): TS5083 Cannot read file '/x/.nuxt/tsconfig.json'.");
});

test("typescript: eslint runs only with a config and a local binary", async () => {
	const root = tsProject();
	fakeBin(join(root, "node_modules", ".bin", "tsc"), { stdout: "" });
	fakeBin(join(root, "node_modules", ".bin", "eslint"), { stdout: ESLINT_SAMPLE.replaceAll("ROOT", root), code: 1 });
	assert.equal(await check(root, ["services/a.ts"]), "tsc: no issues");
	write(join(root, "eslint.config.mjs"), "");
	const out = await check(root, ["services/a.ts"]);
	assert.equal(out.split("\n").slice(1).join("\n"), ["eslint: 2 errors, 1 warning", "services/a.ts", "  2:1  error  no-var  Unexpected var, use let or const instead.", "  3:2  warning  semi  Missing semicolon.", "  9:4  error  Parsing error: Unexpected token"].join("\n"));
	fakeBin(join(root, "node_modules", ".bin", "eslint"), { stderr: "Oops\n    at x (y.js:1:1)\nNode.js v24", code: 2 });
	assert.match(await check(root, ["services/a.ts"]), /eslint: failed \(exit 2\): Oops$/);
});

test("rust: clippy output is filtered by file and falls back to check without clippy", async () => {
	const root = tempDir();
	write(join(root, "Cargo.toml"), "");
	write(join(root, "src", "main.rs"), "");
	const bin = join(root, "bin");
	const cargoOut = CARGO_SAMPLE.replaceAll("ROOT", root);
	fakeBin(join(bin, "cargo"), { stdout: cargoOut, code: 101 });
	const env = { PATH: bin, CARGO_HOME: join(root, "nocargo") } as NodeJS.ProcessEnv;
	const run = () => runDiagnostics({ paths: ["src/main.rs"] }, { cwd: root, env });
	assert.equal(
		await run(),
		["cargo check: 1 error, 1 warning (1 elsewhere in the project)", "src/main.rs", "  5:27  warning  unused_variables  unused variable: `unused`", "  7:23  error  E0308  mismatched types"].join("\n"),
	);
	fakeBin(join(bin, "cargo-clippy"));
	assert.match(await run(), /^cargo clippy: /);
});

test("rust: a missing cargo is reported", async () => {
	const root = tempDir();
	write(join(root, "Cargo.toml"), "");
	write(join(root, "src", "lib.rs"), "");
	const env = { PATH: "", CARGO_HOME: join(root, "nocargo") } as NodeJS.ProcessEnv;
	assert.equal(await runDiagnostics({ paths: ["src/lib.rs"] }, { cwd: root, env }), `cargo check: not found (looked in PATH, ${join(root, "nocargo", "bin")})`);
});

test("a checker that exceeds the timeout is reported", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	fakeBin(join(root, ".venv", "bin", "ty"), { sleep: 20 });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	assert.equal(await check(root, ["a.py"], { timeoutMs: 1500 }), "ty: timed out after 1.5 s\nruff: no issues");
});

test("an aborted signal rejects", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	fakeBin(join(root, ".venv", "bin", "ty"), { sleep: 5 });
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 100);
	await assert.rejects(runDiagnostics({ paths: ["a.py"] }, { cwd: root, env: NO_PATH, signal: controller.signal }), /aborted/);
});

test("identical diagnostics are deduplicated", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	const entry = { check_name: "x", description: "x: boom", severity: "major", location: { path: "a.py", positions: { begin: { line: 1, column: 1 } } } };
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: JSON.stringify([entry, entry, { ...entry, description: "x: other" }]), code: 1 });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	assert.match(await check(root, ["a.py"]), /^ty: 2 errors\na.py\n {2}1:1 {2}error {2}x {2}boom\n {2}1:1 {2}error {2}x {2}other\nruff/);
});

test("diagnostic and size caps end with the number not shown", async () => {
	const root = pythonProject();
	write(join(root, "a.py"), "");
	const entries = Array.from({ length: 150 }, (_, i) => ({ check_name: "r", description: `r: m${i}`, severity: "major", location: { path: "a.py", positions: { begin: { line: i + 1, column: 1 } } } }));
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: JSON.stringify(entries), code: 1 });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	const out = await check(root, ["a.py"]);
	assert.equal(out.split("\n").filter((line) => line.startsWith("  ")).length, MAX_DIAGNOSTICS);
	assert.match(out, /ty: 150 errors/);
	assert.match(out, /50 more diagnostics not shown; narrow paths to see them/);

	const long = Array.from({ length: 90 }, (_, i) => ({ check_name: "r", description: `r: ${"w".repeat(1000)}`, severity: "major", location: { path: "a.py", positions: { begin: { line: i + 1, column: 1 } } } }));
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: JSON.stringify(long), code: 1 });
	const big = await check(root, ["a.py"]);
	assert.ok(Buffer.byteLength(big) <= MAX_OUTPUT_BYTES, String(Buffer.byteLength(big)));
	assert.match(big, /more diagnostics not shown/);
	assert.ok(big.split("\n")[2].length <= MAX_MESSAGE_CHARS + 30);
	assert.ok(big.split("\n")[2].endsWith("..."));
});

test("several roots for one checker are labelled with their directory", async () => {
	const top = tempDir();
	for (const name of ["a", "b"]) {
		write(join(top, name, "ruff.toml"));
		write(join(top, name, "m.py"));
		fakeBin(join(top, name, ".venv", "bin", "ruff"), { stdout: "[]" });
	}
	assert.equal(await check(top, ["a/m.py", "b/m.py"]), "ruff (a): no issues\nruff (b): no issues");
});

test("with no paths, the changed files of the git working tree are checked", async () => {
	const root = pythonProject();
	write(join(root, ".gitignore"), ".venv/\n");
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=a@b", "-c", "user.name=n", ...args], { cwd: root, stdio: "ignore" });
	git("init", "-q");
	git("add", "-A");
	git("commit", "-qm", "init");
	fakeBin(join(root, ".venv", "bin", "ty"), { stdout: "[]" });
	fakeBin(join(root, ".venv", "bin", "ruff"), { stdout: "[]" });
	assert.equal(await check(root, undefined), "No changed files to check.");
	write(join(root, "pkg", "bad.py"), "x = 2\n");
	write(join(root, "new.md"), "");
	assert.equal(await check(root, undefined), "ty: no issues\nruff: no issues\nno checker for: new.md");
});

test("with no paths, an unchanged tree and a non-repository are reported", async () => {
	const root = tempDir();
	assert.match(await check(root, []), /not in a git repository/);
	execFileSync("git", ["init", "-q"], { cwd: root });
	assert.equal(await check(root, undefined), "No changed files to check.");
	write(join(root, "notes.txt"));
	assert.equal(await check(root, undefined), "no checker for: notes.txt");
});
