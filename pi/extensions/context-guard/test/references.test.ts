import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { narrowingTest } from "../references.ts";
import type { Definition } from "../symbols.ts";
import { runFindReferences } from "../tools.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const ctx = { cwd: FIX };
const def = (over: Partial<Definition>) => ({ scope: [], container: [], name: "x", ...over }) as Definition;

test("Java narrowing: same package, import, wildcard, inheritance", () => {
	const t = narrowingTest([def({ lang: "java", file: "/r/com/ex/A.java", scope: ["com", "ex"], container: ["A"], name: "m" })]);
	assert.ok(t);
	assert.equal(t("/r/B.java", "package com.ex;\nclass B {}"), true);
	assert.equal(t("/r/C.java", "package com.c;\nimport com.ex.A;\n"), true);
	assert.equal(t("/r/C.java", "package com.c;\nimport static com.ex.A.m;\n"), true);
	assert.equal(t("/r/C.java", "package com.c;\nimport com.ex.*;\n"), true);
	assert.equal(t("/r/C.java", "package com.c;\nclass C extends A {}"), true);
	assert.equal(t("/r/C.java", "package com.c;\nimport com.exa.A;\nclass C {}"), false);
});

test("Python narrowing: absolute, relative, and module imports", () => {
	const t = narrowingTest([def({ lang: "python", file: "/r/pkg/core.py", scope: ["pkg", "core"], name: "f" })]);
	assert.ok(t);
	for (const text of ["from pkg.core import f", "from .core import f", "from . import core", "import pkg.core as c", "from pkg import core, other", "from pkg import (\n    other,\n    core,\n)"]) {
		assert.equal(t("/r/x.py", text), true, text);
	}
	for (const text of ["from pkg.score import f", "import core_utils", "# from .core import f"]) {
		assert.equal(t("/r/x.py", text), false, text);
	}
});

test("C/C++ narrowing: include of a declaring header, or the same stem", () => {
	const t = narrowingTest([
		def({ lang: "cpp", file: "/r/geom.h" }),
		def({ lang: "cpp", file: "/r/geom.cpp" }),
	]);
	assert.ok(t);
	assert.equal(t("/r/use.cpp", '#include "geom.h"\n'), true);
	assert.equal(t("/r/use.cpp", "#include <lib/geom.h>\n"), true);
	assert.equal(t("/r/sub/geom.cc", "int x;\n"), true);
	assert.equal(t("/r/other.cpp", '#include "geometry.h"\n'), false);
	assert.equal(narrowingTest([def({ lang: "cpp", file: "/r/only.cpp" })]), undefined);
});

test("qualified Java references are narrowed and exclude declarations, comments, and strings", async () => {
	assert.equal(
		await runFindReferences({ symbol: "DocumentService.getDocumentId" }, ctx),
		[
			'2 references to "DocumentService.getDocumentId" (syntactic: name matches in files that can see DocumentService; may include same-named members of other classes)',
			"java/com/client/Caller.java",
			"  10 (in Caller.run)  String id = svc.getDocumentId(req);",
			"  11 (in Caller.run)  Function<DocumentService, String> f = DocumentService::getDocumentId;",
		].join("\n"),
	);
});

test("unqualified references cover every file", async () => {
	assert.equal(
		await runFindReferences({ symbol: "getDocumentId" }, ctx),
		[
			'3 references to "getDocumentId" (syntactic: name matches; may include unrelated symbols with the same name)',
			"java/com/client/Caller.java",
			"  10 (in Caller.run)  String id = svc.getDocumentId(req);",
			"  11 (in Caller.run)  Function<DocumentService, String> f = DocumentService::getDocumentId;",
			"java/com/other/Unrelated.java",
			"  9 (in Unrelated.use)  return u.getDocumentId();",
		].join("\n"),
	);
});

test("Python and C++ qualified references", async () => {
	assert.equal(
		await runFindReferences({ symbol: "core.build_report" }, ctx),
		[
			'2 references to "core.build_report" (syntactic: name matches in files that can see core; may include same-named members of other classes)',
			"py/pkg/app.py",
			"  1  from .core import build_report",
			"  5 (in main)  return build_report(rows)",
		].join("\n"),
	);
	assert.equal(
		await runFindReferences({ symbol: "Shape.area" }, ctx),
		[
			'1 reference to "Shape.area" (syntactic: name matches in files that can see Shape; may include same-named members of other classes)',
			"cpp/use.cpp",
			"  6 (in total)  return s.area();",
		].join("\n"),
	);
});

test("a qualified name without a definition falls back to name matches with a note", async () => {
	const text = await runFindReferences({ symbol: "Nope.getDocumentId" }, ctx);
	const lines = text.split("\n");
	assert.equal(lines[0], '3 references to "Nope.getDocumentId" (syntactic: name matches; may include unrelated symbols with the same name)');
	assert.equal(lines[1], 'Note: no definition of "Nope.getDocumentId" found; showing every use of "getDocumentId".');
});

test("no references", async () => {
	assert.equal(
		await runFindReferences({ symbol: "Inner.run" }, ctx),
		'No references to "Inner.run" found (syntactic: name matches in files that can see Inner; may include same-named members of other classes).',
	);
});

test("non-ASCII text before a name keeps declaration and reference columns aligned", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-utf-"));
	await writeFile(
		join(dir, "U.java"),
		'class U {\n    String s = "é😀"; int ok() { return 1; }\n    int use() { String t = "é"; return ok(); }\n}\n',
	);
	assert.equal(
		await runFindReferences({ symbol: "ok" }, { cwd: dir }),
		[
			'1 reference to "ok" (syntactic: name matches; may include unrelated symbols with the same name)',
			"U.java",
			'  3 (in U.use)  int use() { String t = "é"; return ok(); }',
		].join("\n"),
	);
});

test("references past the limit are counted, not shown", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-refs-"));
	const calls = Array.from({ length: 70 }, () => "        f();").join("\n");
	await writeFile(join(dir, "T.java"), `class T {\n    void f() {}\n    void g() {\n${calls}\n    }\n}\n`);
	const text = await runFindReferences({ symbol: "f" }, { cwd: dir });
	const lines = text.split("\n");
	assert.equal(lines[0], '70 references to "f" (syntactic: name matches; may include unrelated symbols with the same name)');
	assert.equal(lines.filter((l) => l.startsWith("  ")).length, 60);
	assert.equal(lines[lines.length - 1], "showing 60 of 70 in 1 file; narrow with path");
});

test("several uses on one line are listed once", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-line-"));
	await writeFile(join(dir, "Foo.java"), "class Foo {\n    static Foo make() {\n        Foo foo = new Foo();\n        return foo;\n    }\n}\n");
	assert.equal(
		await runFindReferences({ symbol: "Foo" }, { cwd: dir }),
		[
			'2 references to "Foo" (syntactic: name matches; may include unrelated symbols with the same name)',
			"Foo.java",
			"  2 (in Foo.make)  static Foo make() {",
			"  3 (in Foo.make)  Foo foo = new Foo();",
		].join("\n"),
	);
});
