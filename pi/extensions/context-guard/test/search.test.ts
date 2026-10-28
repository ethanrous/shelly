import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSearch, runSearch, searchPatterns } from "../search.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const ctx = { cwd: FIX };

test("search lists literal matches by file with the enclosing definition", async () => {
	const text = await runSearch({ pattern: "class Shape", path: "cpp" }, ctx);
	assert.equal(
		text,
		[
			'1 matching line for "class Shape" in 1 file',
			"cpp/geom.h",
			"  6 (in geo.Shape)  class Shape {",
			'Read the function or class around a match with read_symbol and its file and line, for example read_symbol {"path": "cpp/geom.h", "line": 6}.',
		].join("\n"),
	);
});

test("search matches any of several patterns", async () => {
	const text = await runSearch({ pattern: ["virtual double area", "double area() const {"], path: "cpp" }, ctx);
	assert.match(text, /^2 matching lines for "virtual double area" or "double area\(\) const \{" in 2 files\n/);
	assert.match(text, /cpp\/geom\.h\n {2}9 \(in Shape\.area\) {2}virtual double area\(\) const;/);
	assert.match(text, /cpp\/other\.cpp\n {2}2 \(in Circle\.area\) {2}double area\(\) const \{ return 3\.14; \}/);
});

test("search treats patterns literally unless regex is set", async () => {
	assert.equal(await runSearch({ pattern: "ar.a()", path: "cpp" }, ctx), 'No matches for "ar.a()" in cpp.');
	assert.match(await runSearch({ pattern: "ar.a\\(\\)", path: "cpp", regex: true }, ctx), /^6 matching lines for "ar\.a\\\(\\\)" in 4 files \(regex\)\n/);
});

test("search supports ignore_case, glob, and a file path", async () => {
	assert.match(await runSearch({ pattern: "CLASS SHAPE", path: "cpp", ignore_case: true }, ctx), /^1 matching line .* \(ignore case\)\n/);
	assert.match(await runSearch({ pattern: "area", path: "cpp", glob: "*.h" }, ctx), /^2 matching lines for "area" in 1 file \(glob \*\.h\)\ncpp\/geom\.h\n/);
	assert.match(await runSearch({ pattern: "area", path: "cpp/other.cpp" }, ctx), /^2 matching lines for "area" in 1 file\ncpp\/other\.cpp\n {2}2 .*\n {2}6 \(in circleArea\) {2}return c\.area\(\);\n/);
});

test("search includes hidden files and skips .git and ignored files", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-search-"));
	await mkdir(join(dir, ".github"));
	await mkdir(join(dir, ".git"));
	await writeFile(join(dir, ".github", "ci.yml"), "needle\n");
	await writeFile(join(dir, ".git", "config"), "needle\n");
	await writeFile(join(dir, ".ignore"), "skipped.txt\n");
	await writeFile(join(dir, "skipped.txt"), "needle\n");
	await writeFile(join(dir, "kept.txt"), "a needle here\n");
	const text = await runSearch({ pattern: "needle" }, { cwd: dir });
	assert.equal(text, ['2 matching lines for "needle" in 2 files', ".github/ci.yml", "  1  needle", "kept.txt", "  1  a needle here"].join("\n"));
});

test("search rejects empty patterns, bad regexes, and missing paths", async () => {
	assert.throws(() => searchPatterns(""), /non-empty/);
	assert.throws(() => searchPatterns(["", ""]), /non-empty/);
	assert.deepEqual(searchPatterns(["a", "", "b"]), ["a", "b"]);
	await assert.rejects(runSearch({ pattern: "(unclosed", regex: true, path: "cpp" }, ctx), /rg failed: regex parse error/);
	await assert.rejects(runSearch({ pattern: "x", path: "nope" }, ctx), /Path not found: nope/);
});

test("search lists every match, however many, and trims only whitespace", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-search-many-"));
	const long = "x".repeat(500);
	await writeFile(join(dir, "big.txt"), Array.from({ length: 250 }, (_, i) => `  hit ${i} ${long}  `).join("\n"));
	await writeFile(join(dir, "more.txt"), Array.from({ length: 50 }, () => "hit").join("\n"));
	const text = await runSearch({ pattern: "hit" }, { cwd: dir });
	const lines = text.split("\n");
	assert.equal(lines[0], '300 matching lines for "hit" in 2 files');
	assert.equal(lines.length, 1 + 2 + 300);
	assert.equal(lines[3], `  2  hit 1 ${long}`);
	assert.ok(!text.includes("showing") && !text.includes("more;"), text.slice(0, 200));
});

test("formatSearch lists every match it is given", () => {
	const matches = Array.from({ length: 100 }, (_, i) => ({ file: `/r/f${Math.floor(i / 50)}.txt`, line: i + 1, text: "x".repeat(230) }));
	const lines = formatSearch({ patterns: ["x"], modes: [] }, matches, 2, "/r").split("\n");
	assert.equal(lines.length, 1 + 2 + 100);
	assert.deepEqual([lines[0], lines[1], lines[52]], ['100 matching lines for "x" in 2 files', "f0.txt", "f1.txt"]);
});

test("search takes a list of paths and a list of globs, with ! excluding", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-search-lists-"));
	for (const sub of ["a/tests", "b", "c"]) await mkdir(join(dir, sub), { recursive: true });
	for (const file of ["a/x.py", "a/y.md", "a/z.yml", "a/tests/t.py", "b/keep.py", "b/skip.py", "c/other.py"]) await writeFile(join(dir, file), "needle\n");
	const files = async (params: Record<string, unknown>) =>
		(await runSearch({ pattern: "needle", ...params }, { cwd: dir })).split("\n").filter((line) => !line.startsWith(" ")).slice(1);
	assert.deepEqual(await files({ path: ["a", "b"], glob: ["*.py", "!**/tests/**", "!b/skip.py"] }), ["a/x.py", "b/keep.py"]);
	assert.deepEqual(await files({ glob: ["*.md", "*.yml"] }), ["a/y.md", "a/z.yml"]);
	assert.deepEqual(await files({ path: "b", glob: "!skip.py" }), ["b/keep.py"]);
	assert.match(await runSearch({ pattern: "needle", path: ["a", "b"], glob: ["*.rs"] }, { cwd: dir }), /^No matches for "needle" in a, b \(glob \*\.rs\)\.$/);
});

test("search reports a line once when paths overlap", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-search-overlap-"));
	await mkdir(join(dir, "src", "app"), { recursive: true });
	await writeFile(join(dir, "src", "app", "m.txt"), "needle\n");
	assert.equal(await runSearch({ pattern: "needle", path: ["src", "src/app", "src/app/m.txt"] }, { cwd: dir }), ['1 matching line for "needle" in 1 file', "src/app/m.txt", "  1  needle"].join("\n"));
});
