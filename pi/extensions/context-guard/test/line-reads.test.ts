import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findLineReads, findWholeReads, lineReadBlock, readRangeBlock, readToolSpan } from "../line-reads.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const reads = (command: string) => findLineReads(command, "/repo", "/home/u");
const spans = (command: string) => reads(command).map((read) => read.spans);

test("sed -n print addresses on source files", () => {
	assert.deepEqual(reads("sed -n 295,312p web/app.py"), [{ command: "sed -n 295,312p web/app.py", file: "/repo/web/app.py", spans: [{ start: 295, end: 312 }] }]);
	assert.deepEqual(spans("sed -n '10p;20,$p;30,+5p;40q' a.py"), [[{ start: 10, end: 10 }, { start: 20 }, { start: 30, end: 35 }]]);
	assert.deepEqual(spans("sed -ne 5,9p -e 12p A.java"), [[{ start: 5, end: 9 }, { start: 12, end: 12 }]]);
	assert.deepEqual(spans("sed -n '$p' a.py"), [[{ last: 1 }]]);
	assert.deepEqual(reads("sed -nE 1,3p a.py b.c").map((read) => read.file), ["/repo/a.py", "/repo/b.c"]);
});

test("head, tail, and awk line ranges", () => {
	assert.deepEqual(spans("head a.py"), [[{ start: 1, end: 10 }]]);
	assert.deepEqual(spans("head -n 60 a.py"), [[{ start: 1, end: 60 }]]);
	assert.deepEqual(spans("head -40 a.py"), [[{ start: 1, end: 40 }]]);
	assert.deepEqual(spans("head --lines=7 a.py"), [[{ start: 1, end: 7 }]]);
	assert.deepEqual(spans("tail -n 20 a.py"), [[{ last: 20 }]]);
	assert.deepEqual(spans("tail -n +100 a.py"), [[{ start: 100 }]]);
	assert.deepEqual(spans("awk 'NR>=5 && NR<=9' a.py"), [[{ start: 5, end: 9 }]]);
	assert.deepEqual(spans("awk 'NR==7' a.py"), [[{ start: 7, end: 7 }]]);
	assert.deepEqual(spans(`awk 'NR==3,NR==8 {print NR": "$0}' a.py`), [[{ start: 3, end: 8 }]]);
	assert.deepEqual(spans("awk -F: '10<NR' a.py"), [[{ start: 11 }]]);
});

test("sed -n print addresses on Markdown files", () => {
	assert.deepEqual(spans("sed -n 1,5p notes.md"), [[{ start: 1, end: 5 }]]);
});

test("follows cd, variables, ~, and cat or nl pipes", () => {
	assert.equal(reads("cd ~/repos/x/svc; P=lib/site; sed -n 640,672p $P/http.py")[0].file, "/home/u/repos/x/svc/lib/site/http.py");
	assert.deepEqual(reads("cd sub && cat -n a.py | sed -n 3,4p"), [{ command: "sed -n 3,4p", file: "/repo/sub/a.py", spans: [{ start: 3, end: 4 }] }]);
	assert.equal(reads("nl -ba ${HOME}/a.cpp | head -n 40")[0].file, "/home/u/a.cpp");
	assert.equal(reads("export D=/src\nhead -n40 $D/a.h")[0].file, "/src/a.h");
	assert.equal(reads("sed -n 1,5p < a.py")[0].file, "/repo/a.py");
	assert.equal(reads("sed -n 5,10p <a.py 2>/dev/null")[0].file, "/repo/a.py");
	assert.deepEqual(reads("(cd sub && ls); head -3 a.py").map((read) => read.file), ["/repo/a.py"]);
	assert.deepEqual(reads("(cd sub && head -3 a.py)").map((read) => read.file), ["/repo/sub/a.py"]);
	assert.deepEqual(reads("cat a.py |\nhead -5").map((read) => read.file), ["/repo/a.py"]);
});

test("looks past command prefixes", () => {
	for (const command of ["if [ -f a.py ]; then sed -n 1,5p a.py; fi", "sudo head a.py", "env X=1 tail a.py", "time awk 'NR<5' a.py", "{ head a.py; }"]) {
		assert.deepEqual(reads(command).map((read) => read.file), ["/repo/a.py"], command);
	}
});

test("leaves other commands alone", () => {
	for (const command of [
		"sed -n 1,5p notes.txt",
		"sed 1,5p a.py",
		"sed -i '' -n 1,5p a.py",
		"sed -n '/def foo/,/^def /p' a.py",
		"sed -n 's/x/y/p' a.py",
		"rg -n foo a.py | sed -n 1,25p",
		"git show HEAD:a.py | sed -n 1,5p",
		"cat a.py | rg foo | head -5",
		"head -c 100 a.py",
		"tail -f a.py",
		"tail -n 0 a.py",
		"awk '{print $1}' a.py",
		"cat a.py",
		"head -5 <<'EOF'\nsed -n 1,5p a.py\nEOF",
		"head -n 20 notes.txt > out.py",
		"echo ok # (head -n 5 a.py)",
	]) {
		assert.deepEqual(reads(command), [], command);
	}
});

const ctx = { cwd: FIX };
const callLines = (text: string | undefined) => (text ?? "").split("\n").filter((line) => /^(read_symbol|outline|search) \{/.test(line));
const RULE = "Read and search Python, Java, C/C++, and Markdown files only with read_symbol, outline, search, find_symbol, and find_references; line-range reads, cat, grep, and rg on these files are always blocked, in bash and with read offset/limit.";

test("lineReadBlock lets missing and non-code reads run", async () => {
	assert.equal(await lineReadBlock("sed -n 1,3p py/pkg/missing.py", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 1,3p py/pyproject.toml", ctx), undefined);
	assert.equal(await lineReadBlock("ls -la", ctx), undefined);
	assert.equal(await lineReadBlock("cat py/pyproject.toml", ctx), undefined);
});

test("lineReadBlock blocks a three-line read and names the module view", async () => {
	const text = await lineReadBlock("sed -n 1,3p py/pkg/core.py", ctx);
	assert.equal(
		text,
		[
			"Blocked: sed -n 1,3p py/pkg/core.py reads code by line number, so nothing in this command ran.",
			RULE,
			'read_symbol {"path": "py/pkg/core.py", "line": 1, "end_line": 3}',
			'read_symbol {"path": "py/pkg/core.py", "module": true}',
			"Rerun the rest of the command without it.",
		].join("\n"),
	);
});

test("lineReadBlock blocks short reads of C++ headers", async () => {
	assert.ok(await lineReadBlock("sed -n 19,20p cpp/geom.h", ctx));
	assert.ok(await lineReadBlock("head -n 4 cpp/geom.h", ctx));
});

test("lineReadBlock lists every definition a range touches", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-lines-"));
	await writeFile(join(dir, "many.py"), Array.from({ length: 8 }, (_, i) => `def f${i}():\n    return ${i}\n`).join("\n"));
	const text = await lineReadBlock("head -n 100 many.py", { cwd: dir });
	const calls = callLines(text);
	assert.equal(calls.length, 9, text);
	assert.ok(calls.includes('read_symbol {"path": "many.py", "line": 22}  function f7 (L22-23)'), text);
	assert.ok(!text?.includes("more"), text);
});

const bigFunction = (name: string, lines: number) => [`def ${name}():`, ...Array.from({ length: lines - 1 }, (_, i) => `    v${i} = ${i}`)].join("\n");

test("lineReadBlock blocks a narrow read inside a large function and a read of a huge one", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-narrow-"));
	await writeFile(join(dir, "big.py"), `${bigFunction("big", 258)}\n`);
	await writeFile(join(dir, "huge.py"), `${bigFunction("huge", 450)}\n`);
	assert.deepEqual(callLines(await lineReadBlock("sed -n 139p big.py", { cwd: dir })), [
		'read_symbol {"path": "big.py", "line": 139}',
		'read_symbol {"path": "big.py", "line": 1}  function big (L1-258)',
	]);
	assert.ok(await lineReadBlock("sed -n 100,140p big.py", { cwd: dir }));
	assert.ok(await lineReadBlock("sed -n 1,450p huge.py", { cwd: dir }));
});

const functionsFile = async (count: number, lines: number, extra = "") => {
	const dir = await mkdtemp(join(tmpdir(), "cg-fns-"));
	await writeFile(join(dir, "gen.py"), `${Array.from({ length: count }, (_, n) => bigFunction(`f${n}`, lines)).join("\n")}\n${extra}`);
	return { cwd: dir };
};

test("lineReadBlock lists the widened range and each definition the range overlaps", async () => {
	const klass = ["class K:", `    ${bigFunction("m", 29).replaceAll("\n", "\n    ")}`].join("\n");
	const gen = await functionsFile(3, 10, `${klass}\n`);
	const text = await lineReadBlock("sed -n 1,50p gen.py", gen);
	assert.ok(text?.startsWith("Blocked: sed -n 1,50p gen.py reads code by line number, so nothing in this command ran.\n"), text);
	assert.deepEqual(callLines(text), [
		'read_symbol {"path": "gen.py", "line": 1, "end_line": 50}',
		'read_symbol {"path": "gen.py", "line": 1}  function f0 (L1-10)',
		'read_symbol {"path": "gen.py", "line": 11}  function f1 (L11-20)',
		'read_symbol {"path": "gen.py", "line": 21}  function f2 (L21-30)',
		'read_symbol {"path": "gen.py", "line": 31}  class K (L31-60)',
	]);
});

test("lineReadBlock names each read's range and lists each definition once", async () => {
	const gen = await functionsFile(3, 10);
	const text = await lineReadBlock("head -n 25 gen.py; sed -n 1,22p gen.py", gen);
	assert.equal(text?.match(/"line": \d+\}/g)?.length, 3, text);
	assert.equal(text?.match(/"end_line"/g)?.length, 2, text);
	assert.ok(text?.startsWith("Blocked: head -n 25 gen.py; sed -n 1,22p gen.py reads"), text);
});

test("lineReadBlock blocks a window over a sliver of a function and omits the module view inside definitions", async () => {
	const gen = await functionsFile(3, 30);
	const text = await lineReadBlock("sed -n 20,21p gen.py", gen);
	assert.deepEqual(callLines(text), ['read_symbol {"path": "gen.py", "line": 20, "end_line": 21}', 'read_symbol {"path": "gen.py", "line": 1}  function f0 (L1-30)']);
});

test("lineReadBlock over module-level code names the range and the module view only", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-module-"));
	await writeFile(join(dir, "consts.py"), "import os\n\nA = 1\nB = 2\n\n\ndef f():\n    return A\n");
	assert.deepEqual(callLines(await lineReadBlock("sed -n 1,4p consts.py", { cwd: dir })), [
		'read_symbol {"path": "consts.py", "line": 1, "end_line": 4}',
		'read_symbol {"path": "consts.py", "module": true}',
	]);
	assert.deepEqual(callLines(await lineReadBlock("sed -n 7,8p consts.py", { cwd: dir })), [
		'read_symbol {"path": "consts.py", "line": 7, "end_line": 8}',
		'read_symbol {"path": "consts.py", "line": 7}  function f (L7-8)',
	]);
});

test("whole-file readers of code files are found", () => {
	for (const command of ["cat a.py", "less src/A.java", "more a.h", "nl -ba a.cpp", "bat a.md", "cat -n a.py b.py", "cat < a.py"]) {
		assert.ok(findWholeReads(command, "/repo", "/home/u").length > 0, command);
	}
	for (const command of ["cat notes.txt", "cat a.py > b.py", "echo a.py"]) {
		assert.deepEqual(findWholeReads(command, "/repo", "/home/u"), [], command);
	}
});

test("lineReadBlock blocks cat of a code file and points to outline and the module view", async () => {
	const text = await lineReadBlock("cat py/pkg/core.py", ctx);
	assert.equal(
		text,
		[
			"Blocked: cat py/pkg/core.py reads a whole code file, so nothing in this command ran.",
			RULE,
			'outline {"path": "py/pkg/core.py"}',
			'read_symbol {"path": "py/pkg/core.py", "module": true}',
			"Rerun the rest of the command without it.",
		].join("\n"),
	);
	assert.ok(await lineReadBlock("less cpp/geom.h", ctx));
});

test("readToolSpan follows the read tool's 1-based offset and limit", () => {
	assert.equal(readToolSpan({ path: "a.py" }), undefined);
	assert.deepEqual(readToolSpan({ offset: 282, limit: 100 }), { start: 282, end: 381 });
	assert.deepEqual(readToolSpan({ limit: 24 }), { start: 1, end: 24 });
	assert.deepEqual(readToolSpan({ offset: 0, limit: 5 }), { start: 1, end: 5 });
	assert.deepEqual(readToolSpan({ offset: 551 }), { start: 551, end: 2550 });
});

test("readRangeBlock blocks every offset or limit read of a code file", async () => {
	const gen = await functionsFile(4, 10);
	const text = await readRangeBlock("gen.py", { offset: 11, limit: 24 }, gen);
	assert.equal(
		text,
		[
			"Blocked: read of gen.py with offset 11 and limit 24 reads code by line number, so it did not run.",
			RULE,
			'read_symbol {"path": "gen.py", "line": 11, "end_line": 34}',
			'read_symbol {"path": "gen.py", "line": 11}  function f1 (L11-20)',
			'read_symbol {"path": "gen.py", "line": 21}  function f2 (L21-30)',
			'read_symbol {"path": "gen.py", "line": 31}  function f3 (L31-40)',
		].join("\n"),
	);
	assert.ok(await readRangeBlock("gen.py", { limit: 5 }, gen));
	assert.ok(await readRangeBlock("gen.py", { offset: 3 }, gen));
});

test("readRangeBlock lets whole-file and missing reads run", async () => {
	const gen = await functionsFile(3, 10);
	assert.equal(await readRangeBlock("gen.py", {}, gen), undefined);
	assert.equal(await readRangeBlock("missing.py", { offset: 1, limit: 50 }, gen), undefined);
});
