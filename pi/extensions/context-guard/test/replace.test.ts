import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReplace } from "../replace.ts";

async function project(files: Record<string, string | Buffer>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "cg-replace-"));
	for (const [name, content] of Object.entries(files)) {
		await mkdir(join(dir, name, ".."), { recursive: true });
		await writeFile(join(dir, name), content);
	}
	return dir;
}

const read = (dir: string, name: string) => readFile(join(dir, name), "utf8");

test("replace changes a literal everywhere and lists the new lines", async () => {
	const dir = await project({ "a.txt": "a.b one\nnothing\na.b two a.b\n", "sub/b.txt": "x a.b\n", "c.txt": "untouched\n" });
	const text = await runReplace({ pattern: "a.b", with: "a.c" }, { cwd: dir });
	assert.equal(text, ['Replaced 4 occurrences of "a.b" with "a.c" in 2 files', "a.txt", "  1  a.c one", "  3  a.c two a.c", "sub/b.txt", "  1  x a.c"].join("\n"));
	assert.equal(await read(dir, "a.txt"), "a.c one\nnothing\na.c two a.c\n");
	assert.equal(await read(dir, "c.txt"), "untouched\n");
});

test("replace treats a literal replacement's dollar signs literally", async () => {
	const dir = await project({ "a.txt": "price\n" });
	await runReplace({ pattern: "price", with: "$1 and ${x} $$" }, { cwd: dir });
	assert.equal(await read(dir, "a.txt"), "$1 and ${x} $$\n");
});

test("replace expands capture groups in regex mode", async () => {
	const dir = await project({ "a.txt": "foo(1) foo(22)\n" });
	const text = await runReplace({ pattern: "foo\\((\\d+)\\)", with: "bar[$1]", regex: true }, { cwd: dir });
	assert.match(text, /^Replaced 2 occurrences of "foo\\\(\(\\d\+\)\\\)" with "bar\[\$1\]" in 1 file \(regex\)\n/);
	assert.equal(await read(dir, "a.txt"), "bar[1] bar[22]\n");
});

test("replace supports ignore_case", async () => {
	const dir = await project({ "a.txt": "Foo FOO foo\n" });
	const text = await runReplace({ pattern: "foo", with: "x", ignore_case: true }, { cwd: dir });
	assert.match(text, /^Replaced 3 occurrences .* \(ignore case\)\n/);
	assert.equal(await read(dir, "a.txt"), "x x x\n");
});

test("replace takes path and glob lists with ! exclusions", async () => {
	const dir = await project({ "src/a.py": "k\n", "src/a.txt": "k\n", "tests/t.py": "k\n", "tests/skip_t.py": "k\n", "other/o.py": "k\n" });
	const text = await runReplace({ pattern: "k", with: "v", path: ["src", "tests"], glob: ["*.py", "!skip_*"] }, { cwd: dir });
	assert.match(text, /^Replaced 2 occurrences of "k" with "v" in 2 files \(glob \*\.py !skip_\*\)\n/);
	assert.equal(await read(dir, "src/a.py"), "v\n");
	assert.equal(await read(dir, "src/a.txt"), "k\n");
	assert.equal(await read(dir, "tests/t.py"), "v\n");
	assert.equal(await read(dir, "tests/skip_t.py"), "k\n");
	assert.equal(await read(dir, "other/o.py"), "k\n");
});

test("replace applies once when roots overlap", async () => {
	const dir = await project({ "src/app/a.txt": "ab\n" });
	const text = await runReplace({ pattern: "ab", with: "abab", path: ["src", "src/app"] }, { cwd: dir });
	assert.match(text, /^Replaced 1 occurrence of "ab" with "abab" in 1 file\n/);
	assert.equal(await read(dir, "src/app/a.txt"), "abab\n");
});

test("replace writes nothing when expect differs and lists current lines", async () => {
	const dir = await project({ "a.txt": "x\nx\n", "b.txt": "x\n" });
	const text = await runReplace({ pattern: "x", with: "y", expect: 5 }, { cwd: dir });
	assert.equal(text, ['Found 3 occurrences of "x" in 2 files, expected 5; nothing was changed.', "a.txt", "  1  x", "  2  x", "b.txt", "  1  x"].join("\n"));
	assert.equal(await read(dir, "a.txt"), "x\nx\n");
});

test("replace writes when expect matches", async () => {
	const dir = await project({ "a.txt": "x\nx\n" });
	assert.match(await runReplace({ pattern: "x", with: "y", expect: 2 }, { cwd: dir }), /^Replaced 2 occurrences/);
	assert.equal(await read(dir, "a.txt"), "y\ny\n");
});

test("replace rejects a bad expect, an empty pattern, and bad input", async () => {
	const dir = await project({ "a.txt": "x\n" });
	await assert.rejects(runReplace({ pattern: "x", with: "y", expect: -1 }, { cwd: dir }), /expect must be an integer >= 0/);
	await assert.rejects(runReplace({ pattern: "x", with: "y", expect: 1.5 }, { cwd: dir }), /expect must be/);
	await assert.rejects(runReplace({ pattern: "", with: "y" }, { cwd: dir }), /pattern must be a non-empty string\./);
	await assert.rejects(runReplace({ pattern: "(", with: "y", regex: true }, { cwd: dir }), /rg failed: regex parse error/);
	await assert.rejects(runReplace({ pattern: "x", with: "y", path: "nope" }, { cwd: dir }), /Path not found: nope/);
});

test("replace reports no matches without changing anything", async () => {
	const dir = await project({ "a.txt": "x\n" });
	assert.equal(await runReplace({ pattern: "zzz", with: "y" }, { cwd: dir }), 'No matches for "zzz"; nothing was changed.');
	assert.equal(await runReplace({ pattern: "zzz", with: "y", path: ["a.txt", "."], regex: true, glob: "*.txt" }, { cwd: dir }), 'No matches for "zzz" in a.txt, . (regex, glob *.txt); nothing was changed.');
});

test("replace handles multi-line literal and regex patterns", async () => {
	const dir = await project({ "a.txt": "one\ntwo\nthree\none\ntwo\n" });
	const text = await runReplace({ pattern: "one\ntwo", with: "1\n2\n2b" }, { cwd: dir });
	assert.equal(text, ['Replaced 2 occurrences of "one\ntwo" with "1\n2\n2b" in 1 file', "a.txt", "  1  1", "  2  2", "  3  2b", "  5  1", "  6  2", "  7  2b"].join("\n"));
	assert.equal(await read(dir, "a.txt"), "1\n2\n2b\nthree\n1\n2\n2b\n");
	await runReplace({ pattern: "three\\n", with: "", regex: true }, { cwd: dir });
	assert.equal(await read(dir, "a.txt"), "1\n2\n2b\n1\n2\n2b\n");
});

test("replace keeps single-line regex anchors working", async () => {
	const dir = await project({ "a.txt": "ab\nab\n" });
	await runReplace({ pattern: "^ab$", with: "X", regex: true }, { cwd: dir });
	assert.equal(await read(dir, "a.txt"), "X\nX\n");
});

test("replace handles a file without a trailing newline", async () => {
	const dir = await project({ "a.txt": "keep\nend x" });
	const text = await runReplace({ pattern: "x", with: "yy" }, { cwd: dir });
	assert.equal(text, ['Replaced 1 occurrence of "x" with "yy" in 1 file', "a.txt", "  2  end yy"].join("\n"));
	assert.equal(await read(dir, "a.txt"), "keep\nend yy");
});

test("replace preserves non-UTF-8 bytes", async () => {
	const dir = await project({ "a.txt": Buffer.concat([Buffer.from("x \u00e9 "), Buffer.from([0xff, 0xfe]), Buffer.from(" x\nx\n")]) });
	await runReplace({ pattern: "x", with: "z" }, { cwd: dir });
	const out = await readFile(join(dir, "a.txt"));
	assert.deepEqual(out, Buffer.concat([Buffer.from("z \u00e9 "), Buffer.from([0xff, 0xfe]), Buffer.from(" z\nz\n")]));
});

test("replace matches non-UTF-8 text on the same line as a replacement", async () => {
	const dir = await project({ "a.txt": Buffer.concat([Buffer.from([0xff]), Buffer.from("needle\n")]) });
	await runReplace({ pattern: "needle", with: "n" }, { cwd: dir });
	assert.deepEqual(await readFile(join(dir, "a.txt")), Buffer.concat([Buffer.from([0xff]), Buffer.from("n\n")]));
});

test("replace runs the mutate wrapper once per changed file", async () => {
	const dir = await project({ "a.txt": "x\n", "b.txt": "x x\n", "c.txt": "q\n" });
	const seen: string[] = [];
	await runReplace(
		{ pattern: "x", with: "y" },
		{
			cwd: dir,
			mutate: (file, fn) => {
				seen.push(file);
				return fn();
			},
		},
	);
	assert.deepEqual(seen.sort(), [join(dir, "a.txt"), join(dir, "b.txt")]);
});

test("replace names the enclosing definition in Python files", async () => {
	const dir = await project({ "t.py": 'def test_foo():\n    patch("a.b.thing")\n\n\nclass K:\n    def m(self):\n        patch("a.b.other")\n' });
	const text = await runReplace({ pattern: "a.b", with: "a.c" }, { cwd: dir });
	assert.equal(text, ['Replaced 2 occurrences of "a.b" with "a.c" in 1 file', "t.py", '  2 (in test_foo)  patch("a.c.thing")', '  7 (in K.m)  patch("a.c.other")'].join("\n"));
});

test("replace skips gitignored files but searches an ignored directory root", async () => {
	const dir = await project({ ".ignore": "skipped.txt\n", "skipped.txt": "k\n", "kept.txt": "k\n" });
	await runReplace({ pattern: "k", with: "v" }, { cwd: dir });
	assert.equal(await read(dir, "skipped.txt"), "k\n");
	assert.equal(await read(dir, "kept.txt"), "v\n");
});
