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

test("lineReadBlock lists the definitions a line-range read overlaps", async () => {
	assert.equal(
		await lineReadBlock("cd py && sed -n 20,26p pkg/core.py", ctx),
		[
			"Blocked: sed -n 20,26p pkg/core.py reads source code by line number, so nothing in this command ran. Read the code in that range by name or location instead:",
			'  read_symbol "py/pkg/core.py:18"  class Report (L18-29)',
			'  read_symbol "py/pkg/core.py:21"  method Report.__init__ (L21-22)',
			'  read_symbol "py/pkg/core.py:24"  method Report.render (L24-29)',
			"read_symbol takes a name or a file:line and returns the whole function or class, and outline shows a file's structure. Read lines outside them with read and offset/limit. Rerun the rest of the command without the line-range read.",
		].join("\n"),
	);
	const tail = await lineReadBlock("tail -n 3 java/com/ex/DocumentService.java", ctx);
	assert.ok(tail?.includes('  read_symbol "java/com/ex/DocumentService.java:28"  class DocumentService.Inner (L28-31)'), tail);
});

test("lineReadBlock lets module-level, missing, and non-code reads run", async () => {
	assert.equal(await lineReadBlock("sed -n 1,3p py/pkg/core.py", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 1,3p py/pkg/missing.py", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 1,3p py/pyproject.toml", ctx), undefined);
	assert.equal(await lineReadBlock("ls -la", ctx), undefined);
	assert.equal(await lineReadBlock("sed -n 19,20p cpp/geom.h", ctx), undefined);
	assert.equal(await lineReadBlock("head -n 4 cpp/geom.h", ctx), undefined);
});

test("lineReadBlock lists each location once", async () => {
	const text = await lineReadBlock("head -n 8 c/util.c; sed -n 1,3p c/util.c", ctx);
	assert.equal(text?.match(/read_symbol "/g)?.length, 2, text);
	assert.ok(text?.startsWith("Blocked: head -n 8 c/util.c; sed -n 1,3p c/util.c reads"), text);
	const dir = await mkdtemp(join(tmpdir(), "cg-one-"));
	await writeFile(join(dir, "one.h"), "struct Point { int x; int len() const { return x; } };\n");
	const one = await lineReadBlock("head -n 1 one.h", { cwd: dir });
	assert.equal(one?.match(/read_symbol "/g)?.length, 1, one);
	assert.ok(one?.includes('  read_symbol "one.h:1"  method Point.len (L1)'), one);
});

test("lineReadBlock shortens a long list of definitions", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-lines-"));
	await writeFile(join(dir, "many.py"), Array.from({ length: 8 }, (_, i) => `def f${i}():\n    return ${i}\n`).join("\n"));
	const text = await lineReadBlock("head -n 100 many.py", { cwd: dir });
	assert.ok(text?.includes('  read_symbol "many.py:13"  function f4 (L13-14)'), text);
	assert.ok(text?.includes("  and 3 more; outline many.py lists them all"), text);
	assert.ok(!text?.includes("function f5"), text);
});
