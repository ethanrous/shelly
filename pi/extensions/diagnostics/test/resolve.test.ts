import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ancestors, findLocal, findUp, gitRoot, resolveBinary } from "../resolve.ts";
import { fakeBin, tempDir, write } from "./helpers.ts";

test("findUp returns the nearest ancestor with a marker and stops at the git root", () => {
	const top = tempDir();
	write(join(top, "pyproject.toml"));
	const repo = join(top, "repo");
	write(join(repo, ".git", "HEAD"));
	write(join(repo, "a", "ruff.toml"));
	write(join(repo, "a", "b", "c", "x.py"));
	assert.equal(findUp(join(repo, "a", "b", "c"), ["pyproject.toml", "ruff.toml"]), join(repo, "a"));
	assert.equal(findUp(join(repo, "a", "b", "c"), ["pyproject.toml"]), undefined);
	assert.equal(findUp(join(top, "elsewhere"), ["pyproject.toml"], top), top);
	assert.equal(gitRoot(join(repo, "a", "b")), repo);
});

test("ancestors lists directories up to the stop directory", () => {
	assert.deepEqual(ancestors("/a/b/c", "/a"), ["/a/b/c", "/a/b", "/a"]);
});

test("resolveBinary prefers the project, then ancestors, then the environment, then PATH", () => {
	const top = tempDir();
	write(join(top, ".git", "HEAD"));
	const root = join(top, "pkg");
	const venv = join(top, "venv");
	const onPath = join(top, "pathbin");
	const options = { localDir: ".venv/bin", envDirs: [join(venv, "bin")], env: { PATH: onPath } as NodeJS.ProcessEnv };
	fakeBin(join(onPath, "ty"));
	assert.deepEqual(resolveBinary("ty", root, options), { path: join(onPath, "ty") });
	fakeBin(join(venv, "bin", "ty"));
	assert.deepEqual(resolveBinary("ty", root, options), { path: join(venv, "bin", "ty") });
	fakeBin(join(top, ".venv", "bin", "ty"));
	assert.deepEqual(resolveBinary("ty", root, options), { path: join(top, ".venv", "bin", "ty") });
	fakeBin(join(root, ".venv", "bin", "ty"));
	assert.deepEqual(resolveBinary("ty", root, options), { path: join(root, ".venv", "bin", "ty") });
	assert.equal(findLocal("ty", root, ".venv/bin"), join(root, ".venv", "bin", "ty"));
});

test("resolveBinary lists where it looked when nothing is found", () => {
	const root = tempDir();
	assert.deepEqual(resolveBinary("ty", root, { localDir: ".venv/bin", env: { PATH: "" } }), { looked: [".venv/bin", "PATH"] });
	assert.deepEqual(resolveBinary("cargo", root, { extraDirs: ["/nowhere/bin"], env: { PATH: "" } }), { looked: ["PATH", "/nowhere/bin"] });
});

test("resolveBinary skips non-executable files", () => {
	const root = tempDir();
	write(join(root, "bin", "ty"), "not executable");
	assert.ok("looked" in resolveBinary("ty", root, { env: { PATH: join(root, "bin") } }));
});
