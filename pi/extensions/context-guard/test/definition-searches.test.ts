import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { definitionSearchBlock, findDefinitionSearches } from "../definition-searches.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const searches = (command: string) => findDefinitionSearches(command, "/repo", "/home/u");
const matching = (command: string) => {
	const found = searches(command);
	assert.equal(found.length, 1, command);
	return found[0].args;
};

test("keeps the options that decide which lines match", () => {
	assert.deepEqual(searches(`rg -n "^class |^def |    def test" a.py`), [{ command: "rg -n '^class |^def |    def test' a.py", tool: "rg", args: ["-e", "^class |^def |    def test"], files: ["/repo/a.py"] }]);
	assert.deepEqual(matching(String.raw`grep -n "^def \|^class (" a.py`), ["-e", String.raw`^def \|^class (`]);
	assert.deepEqual(matching(`grep -nE -i "^(async )?def " a.py`), ["-E", "-i", "-e", "^(async )?def "]);
	assert.deepEqual(matching(`grep -E -G -F -w "x" a.py`), ["-F", "-w", "-e", "x"]);
	assert.deepEqual(matching(`rg -i -S -x -e "^def " -e "^class " a.py b.java`), ["-S", "-x", "-e", "^def ", "-e", "^class "]);
	assert.deepEqual(matching(`rg --smart-case --pcre2 --word-regexp foo a.py`), ["-S", "-P", "-w", "-e", "foo"]);
	assert.deepEqual(matching(`rg -s -E utf-8 foo a.py`), ["-s", "-e", "foo"]);
});

test("value options are not taken for the pattern or a path", () => {
	for (const command of [
		`rg -n -A5 -g '*.py' "def x" a.py`,
		`rg --type=py -t py "def x" a.py`,
		`rg -nA3 -B 2 --max-count 4 "def x" a.py`,
		`grep -n -C3 --include '*.py' "def x" a.py`,
		`rg --regexp "def x" a.py`,
		`rg -- "def x" a.py`,
		`rg "def x" a.py 2>/dev/null`,
	]) {
		const found = searches(command);
		assert.deepEqual(found.map((search) => search.files), [["/repo/a.py"]], command);
		assert.deepEqual(found[0].args, ["-e", "def x"], command);
	}
	assert.deepEqual(searches(`cd sub && rg "def x" ../b.java ~/c.cpp`)[0].files, ["/repo/b.java", "/home/u/c.cpp"]);
	assert.equal(searches(`rg "def x" a.py 2>&1 | head`)[0].command, "rg 'def x' a.py 2>&1");
});

test("leaves other searches alone", () => {
	for (const command of [
		"rg -v def a.py",
		"rg -c def a.py",
		"rg -l def a.py",
		"rg -o def a.py",
		"rg -f patterns a.py",
		"rg --json def a.py",
		"rg -r x def a.py",
		"grep -L def a.py",
		"rg def",
		"rg def src",
		"rg def a.py notes.md",
		"cat a.py | rg def",
		"git grep def a.py",
		"rg def a.py > out.txt",
		"rg def a.py &>/dev/null && echo yes",
	]) {
		assert.deepEqual(searches(command), [], command);
	}
});

const ctx = { cwd: FIX };

test("definitionSearchBlock lists the definitions a search matches", async () => {
	assert.equal(
		await definitionSearchBlock(`cd py && rg -n "^def |^class " pkg/core.py | head -20; ls`, ctx),
		[
			"Blocked: rg -n '^def |^class ' pkg/core.py matches only function and class definitions, so nothing in this command ran. List or read them with these instead:",
			'  read_symbol "py/pkg/core.py:6"  function deco (L6-7)',
			'  read_symbol "py/pkg/core.py:12"  function build_report (L12-15)',
			'  read_symbol "py/pkg/core.py:18"  class Report (L18-29)',
			'  outline "py/pkg/core.py"',
			"outline lists a file's functions, classes, and methods with their line ranges, and read_symbol takes a name or a file:line and returns the whole function or class. Rerun the rest of the command without the search.",
		].join("\n"),
	);
	const grep = await definitionSearchBlock(String.raw`grep -n "^def \|^class " py/pkg/core.py`, ctx);
	assert.ok(grep?.includes('  read_symbol "py/pkg/core.py:18"  class Report (L18-29)'), grep);
	const render = await definitionSearchBlock(`grep -n -A4 "def render" py/pkg/core.py`, ctx);
	assert.ok(render?.includes('  read_symbol "py/pkg/core.py:24"  method Report.render (L24-29)'), render);
	const java = await definitionSearchBlock(`rg -n "public String getDocumentId" java/com/ex/DocumentService.java`, ctx);
	assert.equal(java?.match(/read_symbol "java\/com\/ex\/DocumentService.java:\d+" {2}method DocumentService.getDocumentId/g)?.length, 2, java);
});

test("definitionSearchBlock covers every named file", async () => {
	const both = await definitionSearchBlock(`rg -n "^def Report|^class Report" py/pkg/core.py py/other/report.py`, ctx);
	assert.ok(both?.includes('  read_symbol "py/pkg/core.py:18"  class Report (L18-29)'), both);
	assert.ok(both?.includes('  read_symbol "py/other/report.py:1"  function Report (L1-2)'), both);
	const one = await definitionSearchBlock(`rg -n "^def deco" py/pkg/core.py py/other/report.py`, ctx);
	assert.ok(one?.includes('  outline "py/pkg/core.py"') && !one.includes('"py/other/report.py'), one);
});

test("definitionSearchBlock lets searches that match other lines run", async () => {
	for (const command of [
		`rg -n "^def |^MAX" py/pkg/core.py`,
		`rg -n "^def nothing" py/pkg/core.py`,
		`rg -n "@deco" py/pkg/core.py`,
		`rg -n "getDocumentId" java/com/ex/DocumentService.java`,
		`rg -n "^def " py/pkg`,
		`rg -n "^def " py/pkg/missing.py`,
		`rg -n "^def " py/pkg/core.py py/pkg/missing.py`,
		`rg -n "def (" py/pkg/core.py`,
		`rg -nw "@deco|def render" py/pkg/core.py`,
		`rg -n "^def " py/pkg/core.py > /dev/null && echo found`,
	]) {
		assert.equal(await definitionSearchBlock(command, ctx), undefined, command);
	}
});

test("definitionSearchBlock points to outline for a long list", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-defs-"));
	await writeFile(join(dir, "many.py"), Array.from({ length: 8 }, (_, i) => `def f${i}():\n    return ${i}\n`).join("\n"));
	const text = await definitionSearchBlock(`rg -n "^def " many.py`, { cwd: dir });
	assert.ok(text?.includes('\n  outline "many.py"  (8 matching definitions)\n'), text);
	assert.ok(!text?.includes("read_symbol \""), text);
});

test("definitionSearchBlock counts a line only when it holds a header and no body", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-heads-"));
	await writeFile(join(dir, "a.py"), "class A:\n    def name(self): return self.resolve(1)\n\n    def resolve(self, x):\n        return x\n");
	await writeFile(join(dir, "x.cc"), "int foo(int);\nint bar() {  // the bar\n  return 1;\n}\n");
	await writeFile(join(dir, "T.java"), "class T {\n  @Test public void foo() { bar(); }\n  void bar() {\n  }\n}\n");
	const block = (command: string) => definitionSearchBlock(command, { cwd: dir });
	assert.equal(await block("rg -n resolve a.py"), undefined);
	assert.ok((await block(`rg -n "def resolve" a.py`))?.includes('  read_symbol "a.py:4"  method A.resolve (L4-5)'));
	assert.equal(await block("rg -n foo x.cc"), undefined);
	assert.ok((await block(`rg -n "int bar" x.cc`))?.includes('  read_symbol "x.cc:2"  function bar (L2-4)'));
	assert.equal(await block("rg -n bar T.java"), undefined);
	assert.ok((await block(`rg -n "void bar" T.java`))?.includes('  read_symbol "T.java:3"  method T.bar (L3-4)'));
	await writeFile(join(dir, "s.pyi"), "def f(x: int) -> int: ...\nclass C:\n    def g(self) -> None: pass\n");
	assert.ok((await block(`rg -n "def " s.pyi`))?.includes('  read_symbol "s.pyi:3"  method C.g (L3)'));
});

test("definitionSearchBlock leaves the matching to rg, so a backtracking pattern returns quickly", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-slow-"));
	await writeFile(join(dir, "s.py"), `${"a".repeat(40)} x\ndef f():\n    pass\n`);
	const started = Date.now();
	assert.equal(await definitionSearchBlock(String.raw`rg -n "^(\w+\s*)+:$" s.py`, { cwd: dir }), undefined);
	assert.ok(Date.now() - started < 3000);
});
