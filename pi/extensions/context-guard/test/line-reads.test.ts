import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findLineReads, lineReadBlock } from "../line-reads.ts";

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
		"sed -n 1,5p notes.md",
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

test("lineReadBlock lets module-level, missing, and non-code reads run", async () => {
	assert.equal(await lineReadBlock("sed -n 1,3p py/pkg/core.py", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 1,3p py/pkg/missing.py", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 1,3p py/pyproject.toml", ctx), undefined);
	assert.equal(await lineReadBlock("ls -la", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 19,20p cpp/geom.h", ctx), undefined);
	assert.equal(await lineReadBlock("head -n 4 cpp/geom.h", ctx), undefined);
});

test("lineReadBlock shortens a long list of definitions", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-lines-"));
	await writeFile(join(dir, "many.py"), Array.from({ length: 8 }, (_, i) => `def f${i}():\n    return ${i}\n`).join("\n"));
	const text = await lineReadBlock("head -n 100 many.py", { cwd: dir });
	assert.ok(text?.includes('  read_symbol "many.py:13"  function f4 (L13-14)'), text);
	assert.ok(text?.includes("  and 3 more; outline many.py lists them all"), text);
	assert.ok(!text?.includes("function f5"), text);
});

const bigFunction = (name: string, lines: number) => [`def ${name}():`, ...Array.from({ length: lines - 1 }, (_, i) => `    v${i} = ${i}`)].join("\n");

test("lineReadBlock allows a narrow read inside a large function", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-narrow-"));
	await writeFile(join(dir, "big.py"), `${bigFunction("big", 258)}\n`);
	assert.equal(await lineReadBlock("sed -n 139p big.py", { cwd: dir }), undefined);
	assert.equal(await lineReadBlock("sed -n 100,140p big.py", { cwd: dir }), undefined);
});

test("lineReadBlock allows a full read of a function too large to return whole", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-huge-"));
	await writeFile(join(dir, "huge.py"), `${bigFunction("huge", 450)}\n`);
	assert.equal(await lineReadBlock("sed -n 1,450p huge.py", { cwd: dir }), undefined);
});

const functionsFile = async (count: number, lines: number, extra = "") => {
	const dir = await mkdtemp(join(tmpdir(), "cg-fns-"));
	await writeFile(join(dir, "gen.py"), `${Array.from({ length: count }, (_, n) => bigFunction(`f${n}`, lines)).join("\n")}\n${extra}`);
	return { cwd: dir };
};

test("lineReadBlock lists the definitions a line-range read overlaps", async () => {
	const klass = ["class K:", `    ${bigFunction("m", 29).replaceAll("\n", "\n    ")}`].join("\n");
	const gen = await functionsFile(3, 10, `${klass}\n`);
	const text = await lineReadBlock("sed -n 1,50p gen.py", gen);
	assert.ok(text?.startsWith("Blocked: sed -n 1,50p gen.py reads source code by line number, so nothing in this command ran. Read the code in that range by name or location instead:\n"), text);
	assert.deepEqual(
		text?.split("\n").filter((line) => line.startsWith("  read_symbol")),
		[
			'  read_symbol "gen.py:1"  function f0 (L1-10)',
			'  read_symbol "gen.py:11"  function f1 (L11-20)',
			'  read_symbol "gen.py:21"  function f2 (L21-30)',
			'  read_symbol "gen.py:31"  class K (L31-60)',
			'  read_symbol "gen.py:32"  method K.m (L32-60)',
		],
	);
});

test("lineReadBlock lists each location once", async () => {
	const gen = await functionsFile(3, 10);
	const text = await lineReadBlock("head -n 25 gen.py; sed -n 1,22p gen.py", gen);
	assert.equal(text?.match(/read_symbol "/g)?.length, 3, text);
	assert.ok(text?.startsWith("Blocked: head -n 25 gen.py; sed -n 1,22p gen.py reads"), text);
});

test("lineReadBlock blocks a window covering half of a small function", async () => {
	const gen = await functionsFile(1, 50);
	assert.ok(await lineReadBlock("sed -n 1,25p gen.py", gen));
	assert.equal(await lineReadBlock("sed -n 1,24p gen.py", gen), undefined);
});

test("lineReadBlock lists only the functions a range mostly covers", async () => {
	const gen = await functionsFile(3, 30);
	assert.equal(await lineReadBlock("sed -n 20,41p gen.py", gen), undefined);
	const text = await lineReadBlock("sed -n 25,66p gen.py", gen);
	assert.equal(text?.match(/read_symbol "/g)?.length, 1, text);
	assert.ok(text?.includes('  read_symbol "gen.py:31"  function f1 (L31-60)'), text);
});

test("lineReadBlock runs a read of 20 lines even when it covers a whole function", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-free-"));
	await writeFile(join(dir, "gen.py"), `${bigFunction("pad", 10)}\n${bigFunction("target", 20)}\n`);
	assert.equal(await lineReadBlock("sed -n 11,30p gen.py", { cwd: dir }), undefined);
	assert.equal(await lineReadBlock("head -n 20 gen.py", { cwd: dir }), undefined);
});

test("lineReadBlock blocks a read of 21 lines that covers half of a function", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-free-"));
	await writeFile(join(dir, "gen.py"), `${bigFunction("pad", 10)}\n${bigFunction("target", 20)}\n`);
	const text = await lineReadBlock("sed -n 10,30p gen.py", { cwd: dir });
	assert.ok(text?.includes('  read_symbol "gen.py:11"  function target (L11-30)'), text);
});
