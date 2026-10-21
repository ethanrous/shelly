import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFindSymbol, runOutline, runReadSymbol } from "../tools.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const ctx = { cwd: FIX };
const row = (depth: number, range: string, kind: string, signature: string, suffix = "") =>
	`${"  ".repeat(depth)}${range.padEnd(9)} ${kind.padEnd(12)} ${signature}${suffix}`;

test("outline lists nested symbols with ranges and signatures", async () => {
	assert.equal(
		await runOutline({ path: "java/com/ex/DocumentService.java" }, ctx),
		[
			"java/com/ex/DocumentService.java (32 lines)",
			row(0, "L8-32", "class", "public class DocumentService extends BaseService implements Svc"),
			row(1, "L9", "field", "private final Repo repo"),
			row(1, "L10", "field", "static final int LIMIT = 1, OTHER = 2"),
			row(1, "L12-14", "constructor", "public DocumentService(Repo repo)"),
			row(1, "L17-22", "method", "public String getDocumentId(Request r)"),
			row(1, "L24-26", "method", "public String getDocumentId()"),
			row(1, "L28-31", "class", "static class Inner"),
			row(2, "L29-30", "method", "void run()"),
		].join("\n"),
	);
});

test("outline rejects unsupported and missing paths", async () => {
	await assert.rejects(runOutline({ path: "py/pyproject.toml" }, ctx), /supported extensions/);
	await assert.rejects(runOutline({ path: "java" }, ctx), /supported extensions/);
	await assert.rejects(runOutline({ path: "nope.py" }, ctx), /Path not found: nope.py/);
});

test("outline of a huge file collapses and then truncates", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-outline-"));
	const body = Array.from({ length: 600 }, (_, i) => `def f${i}(a, b):\n    return a\n`).join("\n");
	await writeFile(join(dir, "many.py"), body);
	const text = await runOutline({ path: "many.py" }, { cwd: dir });
	const lines = text.split("\n");
	assert.ok(lines.length <= 400, String(lines.length));
	assert.ok(Buffer.byteLength(text) <= 16 * 1024);
	assert.match(lines[lines.length - 1], /^\(\d+ more top-level symbols; use find_symbol with path to search this file\)$/);
});

test("find_symbol lists definitions without bodies", async () => {
	assert.equal(
		await runFindSymbol({ name: "getDocumentId", path: "java" }, ctx),
		[
			'4 definitions of "getDocumentId":',
			"java/com/ex/DocumentService.java:17  method  public String getDocumentId(Request r)  (in DocumentService)",
			"java/com/ex/DocumentService.java:24  method  public String getDocumentId()  (in DocumentService)",
			"java/com/ex/Svc.java:4  method  default String getDocumentId()  (in Svc)",
			"java/com/other/Unrelated.java:4  method  String getDocumentId()  (in Unrelated)",
		].join("\n"),
	);
	assert.equal(
		await runFindSymbol({ name: "DocumentService", kind: "constructor" }, ctx),
		'1 definition of "DocumentService":\njava/com/ex/DocumentService.java:12  constructor  public DocumentService(Repo repo)  (in DocumentService)',
	);
});

test("read_symbol returns overloads from one class", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "DocumentService.getDocumentId" }, ctx),
		[
			"java/com/ex/DocumentService.java:16-22  method DocumentService.getDocumentId",
			"    /** Returns the id for a request. */",
			"    @Override",
			"    public String getDocumentId(Request r) {",
			"        // getDocumentId is cached",
			'        String label = "getDocumentId";',
			"        return r.id();",
			"    }",
			"",
			"java/com/ex/DocumentService.java:24-26  method DocumentService.getDocumentId",
			"    public String getDocumentId() {",
			'        return "none";',
			"    }",
		].join("\n"),
	);
});

test("read_symbol returns candidates for an ambiguous name", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "getDocumentId" }, ctx),
		[
			'4 matches for "getDocumentId"; pass path or a qualified name:',
			"java/com/ex/DocumentService.java:17  method  public String getDocumentId(Request r)  (in DocumentService)",
			"java/com/ex/DocumentService.java:24  method  public String getDocumentId()  (in DocumentService)",
			"java/com/ex/Svc.java:4  method  default String getDocumentId()  (in Svc)",
			"java/com/other/Unrelated.java:4  method  String getDocumentId()  (in Unrelated)",
		].join("\n"),
	);
});

test("read_symbol returns a class skeleton, or the whole class with full", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "DocumentService" }, ctx),
		[
			'java/com/ex/DocumentService.java:8-32  class DocumentService  (skeleton; read_symbol "DocumentService.<member>" for a body, full: true for all)',
			"/**",
			" * Service for documents.",
			" */",
			"public class DocumentService extends BaseService implements Svc {",
			row(1, "L9", "field", "private final Repo repo"),
			row(1, "L10", "field", "static final int LIMIT = 1, OTHER = 2"),
			row(1, "L12-14", "constructor", "public DocumentService(Repo repo)"),
			row(1, "L17-22", "method", "public String getDocumentId(Request r)"),
			row(1, "L24-26", "method", "public String getDocumentId()"),
			row(1, "L28-31", "class", "static class Inner"),
			"}",
		].join("\n"),
	);
	const full = await runReadSymbol({ symbol: "DocumentService", full: true }, ctx);
	assert.ok(full.startsWith("java/com/ex/DocumentService.java:5-32  class DocumentService\n/**\n"));
	assert.ok(full.endsWith("    }\n}"));
});

test("read_symbol for C++ returns the body and names the declaration", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "Shape.area" }, ctx),
		[
			"cpp/geom.cpp:5-8  method geo.Shape.area",
			"/* Area of a generic shape. */",
			"double geo::Shape::area() const {",
			"    return 0;",
			"}",
			"",
			"declared at cpp/geom.h:9",
		].join("\n"),
	);
	assert.equal(
		await runReadSymbol({ symbol: "Shape", path: "cpp" }, ctx),
		[
			'cpp/geom.h:6-11  class geo.Shape  (skeleton; read_symbol "geo.Shape.<member>" for a body, full: true for all)',
			"// A shape with an area.",
			"class Shape {",
			row(1, "L8", "constructor", "Shape()"),
			row(1, "L9", "method", "virtual double area() const"),
			row(1, "L10", "field", "int sides_"),
			"}",
		].join("\n"),
	);
});

test("read_symbol for a decorated Python method", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "Report.render" }, ctx),
		[
			"py/pkg/core.py:24-29  method Report.render",
			"    @staticmethod",
			"    @deco",
			"    def render(rows):",
			"        def nested():",
			'            return "build_report"',
			"        return nested()",
		].join("\n"),
	);
});

test("read_symbol at a file:line returns the innermost function or class there", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "py/pkg/core.py:28" }, ctx),
		["py/pkg/core.py:27-28  function Report.render.nested", "        def nested():", '            return "build_report"'].join("\n"),
	);
	assert.ok((await runReadSymbol({ symbol: "py/pkg/core.py:14:5" }, ctx)).startsWith("py/pkg/core.py:10-15  function build_report\n# Builds the report."));
	assert.ok((await runReadSymbol({ symbol: "java/com/ex/DocumentService.java:20" }, ctx)).startsWith("java/com/ex/DocumentService.java:16-22  method DocumentService.getDocumentId\n"));
	assert.ok((await runReadSymbol({ symbol: "py/pkg/core.py:19" }, ctx)).startsWith("py/pkg/core.py:18-29  class Report  (skeleton;"));
	assert.ok((await runReadSymbol({ symbol: "py/pkg/core.py:19", full: true }, ctx)).startsWith("py/pkg/core.py:18-29  class Report\nclass Report:\n"));
	assert.equal(await runReadSymbol({ symbol: "py/pkg/core.py:3" }, ctx), "py/pkg/core.py:3-3  variable MAX_ROWS\nMAX_ROWS = 100");
	assert.ok((await runReadSymbol({ symbol: "c/util.c:3:" }, ctx)).startsWith("c/util.c:1-4  function add\n"));
	assert.ok((await runReadSymbol({ symbol: "pkg/core.py:28", path: "py" }, ctx)).startsWith("py/pkg/core.py:27-28  function Report.render.nested\n"));
});

test("read_symbol at a file:line ranks namespaces and declarations below functions and classes", async () => {
	assert.equal(await runReadSymbol({ symbol: "cpp/geom.h:19" }, ctx), "cpp/geom.h:19-19  type geo.Id\ntypedef int Id;");
	assert.ok((await runReadSymbol({ symbol: "cpp/geom.h:8" }, ctx)).startsWith("cpp/geom.h:8-8  constructor geo.Shape.Shape\n"));
	assert.ok((await runReadSymbol({ symbol: "cpp/geom.h:3" }, ctx)).startsWith("cpp/geom.h:3-25  namespace geo  (skeleton;"));
	assert.equal(
		await runReadSymbol({ symbol: "cpp/geom.h:4" }, ctx),
		"cpp/geom.h:4 is not inside a function or class. Read it with read and offset/limit, or see the file's structure with outline.",
	);
});

test("read_symbol at a file:line outside any definition says so", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "py/pkg/core.py:16" }, ctx),
		"py/pkg/core.py:16 is not inside a function or class. Read it with read and offset/limit, or see the file's structure with outline.",
	);
	await assert.rejects(runReadSymbol({ symbol: "py/pkg/core.py:30" }, ctx), /^Error: py\/pkg\/core.py:30 is out of range; the file has 29 lines$/);
	await assert.rejects(runReadSymbol({ symbol: "py/pkg/core.py:0" }, ctx), /py\/pkg\/core.py:0 is out of range/);
	await assert.rejects(runReadSymbol({ symbol: "py/pkg/nope.py:3" }, ctx), /Path not found: py\/pkg\/nope.py/);
});

test("read_symbol suggests near names when nothing matches", async () => {
	const text = await runReadSymbol({ symbol: "getDocumentID" }, ctx);
	assert.equal(
		text,
		[
			'No definition of "getDocumentID" found.',
			"Similar names:",
			"java/com/ex/DocumentService.java:17  method  public String getDocumentId(Request r)  (in DocumentService)",
			"java/com/ex/DocumentService.java:24  method  public String getDocumentId()  (in DocumentService)",
			"java/com/ex/Svc.java:4  method  default String getDocumentId()  (in Svc)",
			"java/com/other/Unrelated.java:4  method  String getDocumentId()  (in Unrelated)",
		].join("\n"),
	);
});

test("CRLF sources come back without carriage returns", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-crlf-"));
	await writeFile(join(dir, "W.java"), "class W {\r\n    void a() {\r\n        int x = 1;\r\n    }\r\n}\r\n");
	const text = await runReadSymbol({ symbol: "W.a" }, { cwd: dir });
	assert.equal(text, ["W.java:2-4  method W.a", "    void a() {", "        int x = 1;", "    }"].join("\n"));
	assert.equal((await runFindSymbol({ name: "a" }, { cwd: dir })).includes("\r"), false);
});

test("read_symbol does not return oversized bodies", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-big-"));
	const lines = ["class Big {", "    void huge() {", ...Array.from({ length: 450 }, (_, i) => `        int v${i} = ${i};`), "    }", "}"];
	await writeFile(join(dir, "Big.java"), `${lines.join("\n")}\n`);
	const big = { cwd: dir };
	assert.equal(
		await runReadSymbol({ symbol: "Big.huge" }, big),
		[
			"Big.java:2-453  method Big.huge",
			"void huge()",
			"[Big.huge is 452 lines; too large to return whole. Search Big.java with rg -n '<pattern>', or read a range with offset/limit.]",
		].join("\n"),
	);
	assert.equal(
		await runReadSymbol({ symbol: "Big", full: true }, big),
		[
			'Big.java:1-454  class Big  (skeleton; read_symbol "Big.<member>" for a body, full: true for all)',
			"class Big {",
			row(1, "L2-453", "method", "void huge()"),
			"}",
			"[Big is 454 lines; too large to return whole. Read members with read_symbol, or search Big.java with rg.]",
		].join("\n"),
	);
});

test("a class and a function with the same name are candidates", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "Report" }, ctx),
		[
			'2 matches for "Report"; pass path or a qualified name:',
			"py/other/report.py:1  function  def Report(rows):",
			"py/pkg/core.py:18  class  class Report:",
		].join("\n"),
	);
});

test("a CRLF class skeleton carries no carriage returns", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-crlf2-"));
	await writeFile(join(dir, "W.java"), "@Entity\r\n@Table(name = \"w\")\r\npublic class W\r\n    extends Base {\r\n    int x;\r\n}\r\n");
	assert.equal(
		await runReadSymbol({ symbol: "W" }, { cwd: dir }),
		[
			'W.java:1-6  class W  (skeleton; read_symbol "W.<member>" for a body, full: true for all)',
			'@Entity\n@Table(name = "w")\npublic class W\n    extends Base {',
			row(1, "L5", "field", "int x"),
			"}",
		].join("\n"),
	);
});

test("outline collapses to depth 1 when the full tree is over the cap", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-deep-"));
	const fields = (prefix: string) => Array.from({ length: 250 }, (_, i) => `        int ${prefix}${i};`);
	const source = ["class Deep {", "    static class A {", ...fields("a"), "    }", "    static class B {", ...fields("b"), "    }", "}"];
	await writeFile(join(dir, "Deep.java"), `${source.join("\n")}\n`);
	assert.equal(
		await runOutline({ path: "Deep.java" }, { cwd: dir }),
		[
			"Deep.java (506 lines)",
			row(0, "L1-506", "class", "class Deep"),
			row(1, "L2-253", "class", "static class A", " (250 members)"),
			row(1, "L254-505", "class", "static class B", " (250 members)"),
		].join("\n"),
	);
});

const CLASS_SKELETON_HEAD = 'py/pkg/core.py:18-29  class Report  (skeleton; read_symbol "Report.<member>" for a body, full: true for all)';

test("read_symbol after returns the next definition at the same level", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "py/pkg/core.py:12", after: 1 }, ctx),
		[
			"py/pkg/core.py:10-15  function build_report",
			"# Builds the report.",
			"# Second comment line.",
			"def build_report(rows):",
			'    """Return a report."""',
			"    # build_report is not called here",
			"    return [r for r in rows][:MAX_ROWS]",
			"",
			CLASS_SKELETON_HEAD,
			"class Report:",
			row(1, "L19", "field", 'title = "report"'),
			row(1, "L21-22", "method", "def __init__(self, rows):"),
			row(1, "L24-29", "method", "def render(rows):"),
		].join("\n"),
	);
});

test("read_symbol before returns the previous definition ahead of the target", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "py/pkg/core.py:12", before: 1 }, ctx),
		[
			"py/pkg/core.py:6-7  function deco",
			"def deco(fn):",
			"    return fn",
			"",
			"py/pkg/core.py:10-15  function build_report",
			"# Builds the report.",
			"# Second comment line.",
			"def build_report(rows):",
			'    """Return a report."""',
			"    # build_report is not called here",
			"    return [r for r in rows][:MAX_ROWS]",
		].join("\n"),
	);
});

test("read_symbol by name reads neighbors and stops at the parent with a note", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "Report.__init__", before: 1, after: 3 }, ctx),
		[
			"[No more definitions before Report.__init__ in Report.]",
			"",
			"py/pkg/core.py:21-22  method Report.__init__",
			"    def __init__(self, rows):",
			"        self.rows = rows",
			"",
			"py/pkg/core.py:24-29  method Report.render",
			"    @staticmethod",
			"    @deco",
			"    def render(rows):",
			"        def nested():",
			'            return "build_report"',
			"        return nested()",
			"",
			"[No more definitions after Report.render in Report.]",
		].join("\n"),
	);
});

test("read_symbol boundary note names the last neighbor returned on each side", async () => {
	const text = await runReadSymbol({ symbol: "Report.render", before: 5 }, ctx);
	assert.ok(text.startsWith("[No more definitions before Report.__init__ in Report.]\n\n"), text);
});

test("read_symbol neighbors skip fields and report the top-level scope", async () => {
	const text = await runReadSymbol({ symbol: "Report.__init__", before: 1 }, ctx);
	assert.ok(!text.includes("title"));
	assert.equal(
		await runReadSymbol({ symbol: "py/pkg/core.py:6", before: 1 }, ctx),
		["[No more definitions before deco in py/pkg/core.py.]", "", "py/pkg/core.py:6-7  function deco", "def deco(fn):", "    return fn"].join("\n"),
	);
	assert.ok((await runReadSymbol({ symbol: "java/com/ex/DocumentService.java:18", before: 2 }, ctx)).startsWith("[No more definitions before DocumentService.DocumentService in DocumentService.]\n\njava/com/ex/DocumentService.java:12-14  constructor"));
});

test("read_symbol renders a class neighbor as a skeleton unless full", async () => {
	assert.ok((await runReadSymbol({ symbol: "py/pkg/core.py:12", after: 1 }, ctx)).includes(`\n\n${CLASS_SKELETON_HEAD}\n`));
	const full = await runReadSymbol({ symbol: "py/pkg/core.py:12", after: 1, full: true }, ctx);
	assert.ok(full.includes("\n\npy/pkg/core.py:18-29  class Report\nclass Report:\n"));
});

test("read_symbol without a neighbor count or with zero is unchanged", async () => {
	const plain = await runReadSymbol({ symbol: "Report.render" }, ctx);
	assert.equal(await runReadSymbol({ symbol: "Report.render", before: 0, after: 0 }, ctx), plain);
});

test("read_symbol rejects invalid neighbor counts", async () => {
	await assert.rejects(runReadSymbol({ symbol: "Report.render", after: -1 }, ctx), /^Error: after must be a non-negative integer, got -1$/);
	await assert.rejects(runReadSymbol({ symbol: "py/pkg/core.py:12", before: 1.5 }, ctx), /before must be a non-negative integer/);
	await assert.rejects(runReadSymbol({ symbol: "Report.render", after: Number.NaN }, ctx), /after must be a non-negative integer/);
});

test("read_symbol neighbors are skipped for candidates and misses", async () => {
	assert.equal(await runReadSymbol({ symbol: "build_report", after: 1 }, ctx), await runReadSymbol({ symbol: "build_report" }, ctx));
	assert.equal(await runReadSymbol({ symbol: "nope_missing", after: 1 }, ctx), await runReadSymbol({ symbol: "nope_missing" }, ctx));
});

test("read_symbol counts after from the last overload", async () => {
	const text = await runReadSymbol({ symbol: "DocumentService.getDocumentId", before: 1, after: 1 }, ctx);
	assert.ok(text.startsWith("java/com/ex/DocumentService.java:12-14  constructor DocumentService.DocumentService\n"));
	assert.ok(text.includes("\n\njava/com/ex/DocumentService.java:16-22  method DocumentService.getDocumentId\n"));
	assert.ok(text.includes("\n\njava/com/ex/DocumentService.java:24-26  method DocumentService.getDocumentId\n"));
	assert.ok(text.includes("\n\njava/com/ex/DocumentService.java:28-31  class DocumentService.Inner  (skeleton;"));
});

test("read_symbol stops adding neighbors at the output cap and names the next one", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-neighbors-"));
	const body = (name: string) => [`    void ${name}() {`, ...Array.from({ length: 150 }, (_, i) => `        int v${i} = ${i};`), "    }"];
	await writeFile(join(dir, "Many.java"), `${["class Many {", ...body("a"), ...body("b"), ...body("c"), ...body("d"), "}"].join("\n")}\n`);
	const text = await runReadSymbol({ symbol: "Many.a", after: 3 }, { cwd: dir });
	assert.ok(text.includes("Many.java:2-153  method Many.a"));
	assert.ok(text.includes("Many.java:154-305  method Many.b"));
	assert.ok(!text.includes("method Many.c\n"));
	assert.ok(text.endsWith("[Stopped before Many.c at Many.java:306 to stay under the output cap; read it with read_symbol Many.java:306.]"), text.slice(-200));
});

test("read_symbol at a file:line in an oversized function adds the lines around it", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-around-"));
	const lines = ["class Big {", "    void huge() {", ...Array.from({ length: 450 }, (_, i) => `        int v${i} = ${i};`), "    }", "}"];
	await writeFile(join(dir, "Big.java"), `${lines.join("\r\n")}\r\n`);
	const big = { cwd: dir };
	const text = await runReadSymbol({ symbol: "Big.java:100" }, big);
	const [summary, around] = text.split("\n\n");
	assert.ok(summary.startsWith("Big.java:2-453  method Big.huge\nvoid huge()\n[Big.huge is 452 lines; too large"), summary);
	assert.equal(around.split("\n")[0], "Big.java:80-120  lines around 100 in Big.huge");
	assert.equal(around.split("\n").length, 42);
	assert.equal(around.split("\n")[1], "        int v77 = 77;");
	assert.ok(!text.includes("\r"));
	const edge = (await runReadSymbol({ symbol: "Big.java:3" }, big)).split("\n\n")[1];
	assert.equal(edge.split("\n")[0], "Big.java:2-23  lines around 3 in Big.huge");
	assert.ok(!(await runReadSymbol({ symbol: "Big.huge" }, big)).includes("lines around"));
});

test("read_symbol accepts path:Name", async () => {
	const byName = await runReadSymbol({ symbol: "py/pkg/core.py:Report.render" }, ctx);
	assert.equal(byName, await runReadSymbol({ symbol: "Report.render", path: "py/pkg/core.py" }, ctx));
	assert.ok((await runReadSymbol({ symbol: "core.py:build_report", path: "py/pkg" }, ctx)).startsWith("py/pkg/core.py:10-15  function build_report"));
	assert.ok((await runReadSymbol({ symbol: "cpp/geom.h:geo::Shape" }, ctx)).startsWith("cpp/geom.h:6-11  class geo.Shape"));
	assert.ok((await runReadSymbol({ symbol: "geo::Shape" }, ctx)).startsWith("cpp/geom.h:6-11  class geo.Shape"));
	assert.ok((await runReadSymbol({ symbol: "py/pkg/core.py:nope" }, ctx)).startsWith('No definition of "py/pkg/core.py:nope" found.'));
});

test("read_symbol accepts a path that is a file, with or without a location suffix", async () => {
	const core = "py/pkg/core.py";
	const expected = await runReadSymbol({ symbol: `${core}:12` }, ctx);
	assert.equal(await runReadSymbol({ symbol: "core.py:12", path: `${core}:12` }, ctx), expected);
	assert.equal(await runReadSymbol({ symbol: "core.py:12", path: core }, ctx), expected);
	assert.equal(await runReadSymbol({ symbol: "pkg/core.py:12", path: core }, ctx), expected);
	assert.equal(await runReadSymbol({ symbol: "core.py:build_report", path: core }, ctx), await runReadSymbol({ symbol: "build_report", path: core }, ctx));
	await assert.rejects(runReadSymbol({ symbol: "other.py:12", path: core }, ctx), /Path not found: other.py/);
});
