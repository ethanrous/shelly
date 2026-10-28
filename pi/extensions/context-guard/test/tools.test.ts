import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFindSymbol, runOutline, runReadSymbol } from "../tools.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const ctx = { cwd: FIX };
const row = (depth: number, range: string, text: string) => `${"  ".repeat(depth)}${range.padEnd(9)} ${text}`;

test("outline lists nested symbols with ranges and names", async () => {
	assert.equal(
		await runOutline({ path: "java/com/ex/DocumentService.java" }, ctx),
		[
			"java/com/ex/DocumentService.java (32 lines)",
			row(0, "L8-32", "class DocumentService"),
			row(1, "L9", "repo"),
			row(1, "L10", "LIMIT"),
			row(1, "L12-14", "DocumentService"),
			row(1, "L17-22", "getDocumentId"),
			row(1, "L24-26", "getDocumentId"),
			row(1, "L28-31", "class Inner"),
			row(2, "L29-30", "run"),
		].join("\n"),
	);
});

test("outline rejects unsupported and missing paths", async () => {
	await assert.rejects(runOutline({ path: "py/pyproject.toml" }, ctx), /supported extensions/);
	await assert.rejects(runOutline({ path: "java" }, ctx), /supported extensions/);
	await assert.rejects(runOutline({ path: "nope.py" }, ctx), /Path not found: nope.py/);
});

test("outline of a huge file lists every symbol", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-outline-"));
	const body = Array.from({ length: 600 }, (_, i) => `def f${i}(a, b):\n    return a\n`).join("\n");
	await writeFile(join(dir, "many.py"), body);
	const lines = (await runOutline({ path: "many.py" }, { cwd: dir })).split("\n");
	assert.equal(lines.length, 601);
	assert.equal(lines[600], row(0, "L1798-1799", "f599"));
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
			'Read one with read_symbol {"path": "java/com/ex/DocumentService.java", "line": 17}, using the file and line of its row.',
		].join("\n"),
	);
	assert.equal(
		await runFindSymbol({ name: "DocumentService", kind: "constructor" }, ctx),
		'1 definition of "DocumentService":\njava/com/ex/DocumentService.java:12  constructor  public DocumentService(Repo repo)  (in DocumentService)\nRead one with read_symbol {"path": "java/com/ex/DocumentService.java", "line": 12}, using the file and line of its row.',
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
			'4 matches for "getDocumentId"; read one with its call, or pass path or a qualified name:',
			'read_symbol {"path": "java/com/ex/DocumentService.java", "line": 17}  method  public String getDocumentId(Request r)  (in DocumentService)',
			'read_symbol {"path": "java/com/ex/DocumentService.java", "line": 24}  method  public String getDocumentId()  (in DocumentService)',
			'read_symbol {"path": "java/com/ex/Svc.java", "line": 4}  method  default String getDocumentId()  (in Svc)',
			'read_symbol {"path": "java/com/other/Unrelated.java", "line": 4}  method  String getDocumentId()  (in Unrelated)',
		].join("\n"),
	);
});

test("read_symbol returns a class whole, or its skeleton with full: false", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "DocumentService", full: false }, ctx),
		[
			'java/com/ex/DocumentService.java:8-32  class DocumentService  (skeleton, not source text; read a member with read_symbol {\"symbol\": \"DocumentService.<member>\"})',
			"/**",
			" * Service for documents.",
			" */",
			"public class DocumentService extends BaseService implements Svc {",
			row(1, "L9", "private final Repo repo"),
			row(1, "L10", "static final int LIMIT = 1, OTHER = 2"),
			row(1, "L12-14", "public DocumentService(Repo repo)"),
			row(1, "L17-22", "public String getDocumentId(Request r)"),
			row(1, "L24-26", "public String getDocumentId()"),
			row(1, "L28-31", "static class Inner"),
			"}",
			"[End of file after L32.]",
		].join("\n"),
	);
	const whole = await runReadSymbol({ symbol: "DocumentService" }, ctx);
	assert.ok(whole.startsWith("java/com/ex/DocumentService.java:5-32  class DocumentService\n/**\n"));
	assert.ok(whole.endsWith("    }\n}\n[End of file after L32.]"));
	assert.equal(await runReadSymbol({ symbol: "DocumentService", full: true }, ctx), whole);
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
			"[Next non-blank line, L10: namespace geo {]",
			"",
			"declared at cpp/geom.h:9",
		].join("\n"),
	);
	assert.equal(
		await runReadSymbol({ symbol: "Shape", path: "cpp", full: false }, ctx),
		[
			'cpp/geom.h:6-11  class geo.Shape  (skeleton, not source text; read a member with read_symbol {\"symbol\": \"geo.Shape.<member>\"})',
			"// A shape with an area.",
			"class Shape {",
			row(1, "L8", "Shape()"),
			row(1, "L9", "virtual double area() const"),
			row(1, "L10", "int sides_"),
			"}",
			"[Next non-blank line, L13: struct Point {]",
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
			"[End of file after L29.]",
		].join("\n"),
	);
});

test("read_symbol at a path and line returns the innermost function or class there", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 28 }, ctx),
		["py/pkg/core.py:27-28  function Report.render.nested", "        def nested():", '            return "build_report"', "[Next non-blank line, L29:         return nested()]"].join("\n"),
	);
	assert.ok((await runReadSymbol({ path: "py/pkg/core.py", line: 14 }, ctx)).startsWith("py/pkg/core.py:10-15  function build_report\n# Builds the report."));
	assert.ok((await runReadSymbol({ path: "java/com/ex/DocumentService.java", line: 20 }, ctx)).startsWith("java/com/ex/DocumentService.java:16-22  method DocumentService.getDocumentId\n"));
	assert.ok((await runReadSymbol({ path: "py/pkg/core.py", line: 19, full: false }, ctx)).startsWith("py/pkg/core.py:18-29  class Report  (skeleton,"));
	assert.ok((await runReadSymbol({ path: "py/pkg/core.py", line: 19 }, ctx)).startsWith("py/pkg/core.py:18-29  class Report\nclass Report:\n"));
	assert.equal(await runReadSymbol({ path: "py/pkg/core.py", line: 3 }, ctx), "py/pkg/core.py:3-3  variable MAX_ROWS\nMAX_ROWS = 100\n[Next non-blank line, L6: def deco(fn):]");
	assert.ok((await runReadSymbol({ path: "c/util.c", line: 3 }, ctx)).startsWith("c/util.c:1-4  function add\n"));
});

test("read_symbol at a path and line ranks namespaces and declarations below functions and classes", async () => {
	assert.equal(await runReadSymbol({ path: "cpp/geom.h", line: 19 }, ctx), "cpp/geom.h:19-19  type geo.Id\ntypedef int Id;\n[Next non-blank line, L20: using Size = long;]");
	assert.ok((await runReadSymbol({ path: "cpp/geom.h", line: 8 }, ctx)).startsWith("cpp/geom.h:8-8  constructor geo.Shape.Shape\n"));
	assert.ok((await runReadSymbol({ path: "cpp/geom.h", line: 3, full: false }, ctx)).startsWith("cpp/geom.h:3-25  namespace geo  (skeleton,"));
	assert.equal(
		await runReadSymbol({ path: "cpp/geom.h", line: 4 }, ctx),
		`cpp/geom.h line 4 is not inside a function or class. Read module-level code with read_symbol {"path": "cpp/geom.h", "module": true}, or see the file's structure with outline {"path": "cpp/geom.h"}.`,
	);
});

test("read_symbol at a path and line outside any definition says so", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 16 }, ctx),
		`py/pkg/core.py line 16 is not inside a function or class. Read module-level code with read_symbol {"path": "py/pkg/core.py", "module": true}, or see the file's structure with outline {"path": "py/pkg/core.py"}.`,
	);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 30 }, ctx), /^Error: line 30 is out of range; py\/pkg\/core.py has 29 lines$/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 0 }, ctx), /line must be an integer of at least 1, got 0/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/nope.py", line: 3 }, ctx), /Path not found: py\/pkg\/nope.py/);
});

test("read_symbol suggests near names when nothing matches", async () => {
	const text = await runReadSymbol({ symbol: "getDocumentID" }, ctx);
	assert.equal(
		text,
		[
			'No definition of "getDocumentID" found.',
			"Similar names:",
			'read_symbol {"path": "java/com/ex/DocumentService.java", "line": 17}  method  public String getDocumentId(Request r)  (in DocumentService)',
			'read_symbol {"path": "java/com/ex/DocumentService.java", "line": 24}  method  public String getDocumentId()  (in DocumentService)',
			'read_symbol {"path": "java/com/ex/Svc.java", "line": 4}  method  default String getDocumentId()  (in Svc)',
			'read_symbol {"path": "java/com/other/Unrelated.java", "line": 4}  method  String getDocumentId()  (in Unrelated)',
		].join("\n"),
	);
});

test("CRLF sources come back without carriage returns", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-crlf-"));
	await writeFile(join(dir, "W.java"), "class W {\r\n    void a() {\r\n        int x = 1;\r\n    }\r\n}\r\n");
	const text = await runReadSymbol({ symbol: "W.a" }, { cwd: dir });
	assert.equal(text, ["W.java:2-4  method W.a", "    void a() {", "        int x = 1;", "    }", "[Next non-blank line, L5: }]"].join("\n"));
	assert.equal((await runFindSymbol({ name: "a" }, { cwd: dir })).includes("\r"), false);
});

test("read_symbol returns oversized bodies whole", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-big-"));
	const lines = ["class Big {", "    void huge() {", ...Array.from({ length: 450 }, (_, i) => `        int v${i} = ${i};`), "    }", "}"];
	await writeFile(join(dir, "Big.java"), `${lines.join("\n")}\n`);
	const big = { cwd: dir };
	assert.equal(await runReadSymbol({ symbol: "Big.huge" }, big), ["Big.java:2-453  method Big.huge", ...lines.slice(1, 453), "[Next non-blank line, L454: }]"].join("\n"));
	assert.equal(await runReadSymbol({ symbol: "Big" }, big), ["Big.java:1-454  class Big", ...lines, "[End of file after L454.]"].join("\n"));
});

test("a class and a function with the same name are candidates", async () => {
	assert.equal(
		await runReadSymbol({ symbol: "Report" }, ctx),
		[
			'2 matches for "Report"; read one with its call, or pass path or a qualified name:',
			'read_symbol {"path": "py/other/report.py", "line": 1}  function  def Report(rows):',
			'read_symbol {"path": "py/pkg/core.py", "line": 18}  class  class Report:',
		].join("\n"),
	);
});

test("a CRLF class skeleton carries no carriage returns", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-crlf2-"));
	await writeFile(join(dir, "W.java"), "@Entity\r\n@Table(name = \"w\")\r\npublic class W\r\n    extends Base {\r\n    int x;\r\n}\r\n");
	assert.equal(
		await runReadSymbol({ symbol: "W", full: false }, { cwd: dir }),
		[
			'W.java:1-6  class W  (skeleton, not source text; read a member with read_symbol {\"symbol\": \"W.<member>\"})',
			'@Entity\n@Table(name = "w")\npublic class W\n    extends Base {',
			row(1, "L5", "int x"),
			"}",
			"[End of file after L6.]",
		].join("\n"),
	);
});

test("outline lists the members of every class, however large", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-deep-"));
	const fields = (prefix: string) => Array.from({ length: 250 }, (_, i) => `        int ${prefix}${i};`);
	const source = ["class Deep {", "    static class A {", ...fields("a"), "    }", "    static class B {", ...fields("b"), "    }", "}"];
	await writeFile(join(dir, "Deep.java"), `${source.join("\n")}\n`);
	const lines = (await runOutline({ path: "Deep.java" }, { cwd: dir })).split("\n");
	assert.equal(lines.length, 504);
	assert.deepEqual(lines.slice(0, 4), ["Deep.java (506 lines)", row(0, "L1-506", "class Deep"), row(1, "L2-253", "class A"), row(2, "L3", "a0")]);
	assert.equal(lines[503], row(2, "L504", "b249"));
});

const CLASS_SKELETON_HEAD = 'py/pkg/core.py:18-29  class Report  (skeleton, not source text; read a member with read_symbol {\"symbol\": \"Report.<member>\"})';

test("read_symbol after returns the next definition at the same level", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 12, after: 1, full: false }, ctx),
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
			row(1, "L19", 'title = "report"'),
			row(1, "L21-22", "def __init__(self, rows):"),
			row(1, "L24-29", "def render(rows):"),
		].join("\n"),
	);
});

test("read_symbol before returns the previous definition ahead of the target", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 12, before: 1 }, ctx),
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
			"[Next non-blank line, L18: class Report:]",
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
		await runReadSymbol({ path: "py/pkg/core.py", line: 6, before: 1 }, ctx),
		["[No more definitions before deco in py/pkg/core.py.]", "", "py/pkg/core.py:6-7  function deco", "def deco(fn):", "    return fn", "[Next non-blank line, L10: # Builds the report.]"].join("\n"),
	);
	assert.ok((await runReadSymbol({ path: "java/com/ex/DocumentService.java", line: 18, before: 2 }, ctx)).startsWith("[No more definitions before DocumentService.DocumentService in DocumentService.]\n\njava/com/ex/DocumentService.java:12-14  constructor"));
});

test("read_symbol renders a class neighbor whole unless full is false", async () => {
	assert.ok((await runReadSymbol({ path: "py/pkg/core.py", line: 12, after: 1, full: false }, ctx)).includes(`\n\n${CLASS_SKELETON_HEAD}\n`));
	const whole = await runReadSymbol({ path: "py/pkg/core.py", line: 12, after: 1 }, ctx);
	assert.ok(whole.includes("\n\npy/pkg/core.py:18-29  class Report\nclass Report:\n"));
});

test("read_symbol without a neighbor count or with zero is unchanged", async () => {
	const plain = await runReadSymbol({ symbol: "Report.render" }, ctx);
	assert.equal(await runReadSymbol({ symbol: "Report.render", before: 0, after: 0 }, ctx), plain);
});

test("read_symbol rejects invalid neighbor counts", async () => {
	await assert.rejects(runReadSymbol({ symbol: "Report.render", after: -1 }, ctx), /^Error: after must be a non-negative integer, got -1$/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 12, before: 1.5 }, ctx), /before must be a non-negative integer/);
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
	assert.ok(text.includes("\n\njava/com/ex/DocumentService.java:28-31  class DocumentService.Inner\n"));
});

test("read_symbol adds every neighbor asked for, however large", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-neighbors-"));
	const body = (name: string) => [`    void ${name}() {`, ...Array.from({ length: 150 }, (_, i) => `        int v${i} = ${i};`), "    }"];
	await writeFile(join(dir, "Many.java"), `${["class Many {", ...body("a"), ...body("b"), ...body("c"), ...body("d"), "}"].join("\n")}\n`);
	const text = await runReadSymbol({ symbol: "Many.a", after: 3 }, { cwd: dir });
	for (const head of ["Many.java:2-153  method Many.a", "Many.java:154-305  method Many.b", "Many.java:306-457  method Many.c", "Many.java:458-609  method Many.d"]) {
		assert.ok(text.includes(`${head}\n`), head);
	}
	assert.ok(text.endsWith("        int v149 = 149;\n    }"), text.slice(-200));
});

test("read_symbol at a path and line in an oversized function returns it whole", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-around-"));
	const lines = ["class Big {", "    void huge() {", ...Array.from({ length: 450 }, (_, i) => `        int v${i} = ${i};`), "    }", "}"];
	await writeFile(join(dir, "Big.java"), `${lines.join("\r\n")}\r\n`);
	const text = await runReadSymbol({ path: "Big.java", line: 100 }, { cwd: dir });
	assert.equal(text, ["Big.java:2-453  method Big.huge", ...lines.slice(1, 453), "[Next non-blank line, L454: }]"].join("\n"));
});

test("read_symbol takes a name with the file as path", async () => {
	const byName = await runReadSymbol({ symbol: "Report.render", path: "py/pkg/core.py" }, ctx);
	assert.ok(byName.startsWith("py/pkg/core.py:"), byName);
	assert.ok((await runReadSymbol({ symbol: "build_report", path: "py/pkg" }, ctx)).startsWith("py/pkg/core.py:10-15  function build_report"));
	assert.ok((await runReadSymbol({ symbol: "geo::Shape", path: "cpp/geom.h" }, ctx)).startsWith("cpp/geom.h:5-11  class geo.Shape"));
	assert.ok((await runReadSymbol({ symbol: "geo::Shape" }, ctx)).startsWith("cpp/geom.h:5-11  class geo.Shape"));
	assert.ok((await runReadSymbol({ symbol: "nope", path: "py/pkg/core.py" }, ctx)).startsWith('No definition of "nope" found.'));
});

test("read_symbol rejects the colon forms and shows the field call to make", async () => {
	const rejects = (symbol: string, call: string) => assert.rejects(runReadSymbol({ symbol }, ctx), (error: Error) => error.message === `symbol takes only a name. Use separate fields instead: ${call}`);
	await rejects("py/pkg/core.py:28", 'read_symbol {"path": "py/pkg/core.py", "line": 28}');
	await rejects("py/pkg/core.py:28:5", 'read_symbol {"path": "py/pkg/core.py", "line": 28}');
	await rejects("py/pkg/core.py:12-15", 'read_symbol {"path": "py/pkg/core.py", "line": 12, "end_line": 15}');
	await rejects("py/pkg/core.py:Report.render", 'read_symbol {"symbol": "Report.render", "path": "py/pkg/core.py"}');
	await rejects("cpp/geom.h:geo::Shape", 'read_symbol {"symbol": "geo::Shape", "path": "cpp/geom.h"}');
	await assert.doesNotReject(runReadSymbol({ symbol: "geo::Shape" }, ctx));
});

test("read_symbol needs exactly one of symbol, line, or module", async () => {
	await assert.rejects(runReadSymbol({}, ctx), /needs one of symbol \(a name\), line \(with path\), or module: true \(with path\), for example read_symbol \{"path": "a.py", "line": 12\}/);
	await assert.rejects(runReadSymbol({ symbol: "x", path: "py/pkg/core.py", line: 3 }, ctx), /Pass only one of symbol, line, or module: true; got symbol and line\./);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 3, module: true }, ctx), /got line and module: true/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", end_line: 9 }, ctx), /needs one of|end_line needs line/);
	await assert.rejects(runReadSymbol({ symbol: "", path: "py/pkg/core.py" }, ctx), /needs one of/);
	await assert.rejects(runReadSymbol({ line: 3 }, ctx), /line needs path, the file to read\./);
	await assert.rejects(runReadSymbol({ path: "py/pkg", line: 3 }, ctx), /line needs path to be a file; py\/pkg is a directory\./);
	await assert.rejects(runReadSymbol({ path: "py/pyproject.toml", line: 1 }, ctx), /is not a Python, Java, C\/C\+\+, or Markdown file/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 1.5 }, ctx), /line must be an integer of at least 1, got 1.5/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 3, end_line: 0 }, ctx), /end_line must be an integer of at least 1/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", module: true, full: false }, ctx), /full, before, and after do not apply to module: true/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", module: true, after: 0 }, ctx), /do not apply to module/);
	await assert.rejects(runReadSymbol({ path: "py/pkg", module: true }, ctx), /module needs path to be a file/);
	await assert.rejects(runReadSymbol({ module: true }, ctx), /module needs path/);
});

test("read_symbol with module: false is the same as leaving it out", async () => {
	assert.ok((await runReadSymbol({ symbol: "build_report", path: "py/pkg/core.py", module: false }, ctx)).startsWith("py/pkg/core.py:10-15"));
});

const NEXT_FIXTURE = [
	"class Alpha(Base):",
	"    a: int",
	"    b: str",
	"",
	"",
	"class Beta(Base):",
	"    c: int",
	"",
	"",
	"",
].join("\n");

test("read_symbol ends with the next non-blank line or the end of the file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-next-"));
	await writeFile(join(dir, "m.py"), NEXT_FIXTURE);
	const c = { cwd: dir };
	assert.equal(
		await runReadSymbol({ symbol: "Alpha" }, c),
		["m.py:1-3  class Alpha", "class Alpha(Base):", "    a: int", "    b: str", "[Next non-blank line, L6: class Beta(Base):]"].join("\n"),
	);
	assert.equal(await runReadSymbol({ symbol: "Beta" }, c), ["m.py:6-7  class Beta", "class Beta(Base):", "    c: int", "[End of file after L7.]"].join("\n"));
	assert.ok((await runReadSymbol({ path: "m.py", line: 2 }, c)).endsWith("\n[Next non-blank line, L6: class Beta(Base):]"));
	assert.ok((await runReadSymbol({ symbol: "Alpha", full: false }, c)).endsWith("\n[Next non-blank line, L6: class Beta(Base):]"));
});

test("read_symbol omits the next-line note when neighbors follow or several definitions render", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-next2-"));
	await writeFile(join(dir, "m.py"), NEXT_FIXTURE);
	const c = { cwd: dir };
	assert.ok(!(await runReadSymbol({ symbol: "Alpha", after: 1 }, c)).includes("Next non-blank line"));
	assert.ok((await runReadSymbol({ symbol: "Beta", before: 1 }, c)).endsWith("[End of file after L7.]"));
	assert.ok(!(await runReadSymbol({ path: "m.py", line: 2, after: 1 }, c)).includes("Next non-blank line"));
});

test("read_symbol does not add a next-line note when overloads render together", async () => {
	const text = await runReadSymbol({ symbol: "DocumentService.getDocumentId" }, ctx);
	assert.ok(text.includes("DocumentService.java:16-22") && text.includes("DocumentService.java:24-26"));
	assert.ok(!text.includes("Next non-blank line"), text);
});

test("the next-line note quotes the whole line", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-next4-"));
	await writeFile(join(dir, "m.py"), `def a():\n    pass\n\nVALUE = "${"x".repeat(300)}"   \n`);
	const text = await runReadSymbol({ symbol: "a" }, { cwd: dir });
	const note = text.split("\n").at(-1) ?? "";
	assert.equal(note, `[Next non-blank line, L4: VALUE = "${"x".repeat(300)}"]`);
});

const CORE = (from: number, to: number) =>
	readFile(join(FIX, "py/pkg/core.py"), "utf8").then((text) => text.split("\n").slice(from - 1, to).join("\n"));

test("read_symbol of a range inside one function returns that function", async () => {
	const text = await runReadSymbol({ path: "py/pkg/core.py", line: 13, end_line: 14 }, ctx);
	assert.equal(text, `py/pkg/core.py:10-15  function build_report\n${await CORE(10, 15)}\n[Next non-blank line, L18: class Report:]`);
	assert.equal(await runReadSymbol({ path: "py/pkg/core.py", line: 12, end_line: 15 }, ctx), text);
});

test("read_symbol of a range across functions returns the expanded span", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 7, end_line: 12 }, ctx),
		`py/pkg/core.py:6-15  lines 7-12 expanded to whole definitions\n${await CORE(6, 15)}\n[Next non-blank line, L18: class Report:]`,
	);
});

test("read_symbol of a range on definition boundaries is not marked expanded", async () => {
	const text = await runReadSymbol({ path: "py/pkg/core.py", line: 6, end_line: 15 }, ctx);
	assert.ok(text.startsWith("py/pkg/core.py:6-15  lines 6-15\n"), text);
});

test("read_symbol of a range keeps module-level code at its start", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", line: 3, end_line: 6 }, ctx),
		`py/pkg/core.py:3-7  lines 3-6 expanded to whole definitions\n${await CORE(3, 7)}\n[Next non-blank line, L10: # Builds the report.]`,
	);
});

test("read_symbol of a range across methods returns those methods, not the class", async () => {
	const text = await runReadSymbol({ path: "py/pkg/core.py", line: 21, end_line: 26 }, ctx);
	assert.equal(text, `py/pkg/core.py:21-29  lines 21-26 expanded to whole definitions\n${await CORE(21, 29)}\n[End of file after L29.]`);
	assert.ok(!text.includes("class Report"));
});

test("read_symbol of a range rejects reversed and out-of-range lines", async () => {
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 9, end_line: 3 }, ctx), /line 9 is after end_line 3; py\/pkg\/core.py has 29 lines/);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 30, end_line: 40 }, ctx), /line 30 is out of range; py\/pkg\/core.py has 29 lines/);
	const clamped = await runReadSymbol({ path: "py/pkg/core.py", line: 21, end_line: 99 }, ctx);
	assert.equal(clamped, (await runReadSymbol({ path: "py/pkg/core.py", line: 21, end_line: 29 }, ctx)).replace("lines 21-29", "lines 21-99"));
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 0, end_line: 3 }, ctx), /line must be an integer of at least 1, got 0/);
});

test("read_symbol of a range accepts after: N from the last covered definition", async () => {
	const text = await runReadSymbol({ path: "py/pkg/core.py", line: 7, end_line: 12, after: 1 }, ctx);
	assert.ok(text.startsWith("py/pkg/core.py:6-15  lines 7-12 expanded"), text);
	assert.ok(text.includes("\n\npy/pkg/core.py:18-"), text);
	assert.ok(!text.includes("Next non-blank line"), text);
	await assert.rejects(runReadSymbol({ path: "py/pkg/core.py", line: 3, end_line: 4, after: 1 }, ctx), /before and after need a function or class in the range; py\/pkg\/core.py lines 3-4 have none/);
});

test("read_symbol of an oversized range returns the whole definitions", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-range-"));
	const fn = (name: string) => `def ${name}():\n${Array.from({ length: 250 }, (_, i) => `    x${i} = ${i}`).join("\n")}\n`;
	await writeFile(join(dir, "big.py"), `${fn("a")}\n\n${fn("b")}`);
	const lines = (await runReadSymbol({ path: "big.py", line: 100, end_line: 400 }, { cwd: dir })).split("\n");
	assert.equal(lines[0], "big.py:1-504  lines 100-400 expanded to whole definitions");
	assert.equal(lines.length, 506);
	assert.deepEqual([lines[1], lines[254], lines[504]], ["def a():", "def b():", "    x249 = 249"]);
	assert.equal(lines[505], "[End of file after L504.]");
});

test("read_symbol of a range over module-level code returns those lines as written", async () => {
	const text = await runReadSymbol({ path: "py/pkg/core.py", line: 1, end_line: 3 }, ctx);
	assert.equal(text, `py/pkg/core.py:1-3  lines 1-3\n${await CORE(1, 3)}\n[Next non-blank line, L6: def deco(fn):]`);
});

test("module view of Python shows module-level code and collapses top-level definitions", async () => {
	assert.equal(
		await runReadSymbol({ path: "py/pkg/core.py", module: true }, ctx),
		[
			'py/pkg/core.py (29 lines) module view: each definition is shown as its first line and line range; read one with read_symbol and its path and a line in that range, for example read_symbol {"path": "py/pkg/core.py", "line": 6}',
			'L1      """Core report helpers."""',
			"L2",
			"L3      MAX_ROWS = 100",
			"L6-7    def deco(fn):",
			"L10-15  def build_report(rows):",
			"L18-29  class Report:",
		].join("\n"),
	);
});

test("module view hides decorators and comments in the range and shows the def line", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-module-"));
	const source = [
		"import os",
		"",
		"__all__ = [",
		'    "run",',
		"]",
		"",
		"# Runs it.",
		"@decorate(",
		"    1,",
		")",
		"def run(",
		"    a,",
		"):",
		"    return a",
		"",
		"if os.name:",
		"    def inner():",
		"        return 1",
		"",
		'if __name__ == "__main__":',
		"    run(1)",
		"",
	].join("\n");
	await writeFile(join(dir, "m.py"), source);
	assert.equal(
		await runReadSymbol({ path: "m.py", module: true }, { cwd: dir }),
		[
			'm.py (21 lines) module view: each definition is shown as its first line and line range; read one with read_symbol and its path and a line in that range, for example read_symbol {"path": "m.py", "line": 11}',
			"L1      import os",
			"L2",
			"L3      __all__ = [",
			'L4          "run",',
			"L5      ]",
			"L7-14   def run(",
			"L16     if os.name:",
			"L17-18      def inner():",
			"L20     if __name__ == \"__main__\":",
			"L21         run(1)",
		].join("\n"),
	);
});

test("module view of C++ keeps includes, macros, and namespace wrappers", async () => {
	assert.equal(
		await runReadSymbol({ path: "cpp/geom.h", module: true }, ctx),
		[
			'cpp/geom.h (25 lines) module view: each definition is shown as its first line and line range; read one with read_symbol and its path and a line in that range, for example read_symbol {"path": "cpp/geom.h", "line": 6}',
			"L1      #pragma once",
			"L2",
			"L3      namespace geo {",
			"L5-11   class Shape {",
			"L13-15  struct Point {",
			"L17     double distance(Point a, Point b);",
			"L19     typedef int Id;",
			"L20     using Size = long;",
			"L22-23  T clampv(T v);",
			"L25     }  // namespace geo",
		].join("\n"),
	);
});

test("module view of Java keeps the package and imports", async () => {
	const text = await runReadSymbol({ path: "java/com/ex/DocumentService.java", module: true }, ctx);
	const rows = text.split("\n");
	assert.ok(rows[1].startsWith("L1 "), rows[1]);
	assert.ok(rows.some((row) => /^L\d+ +package com\.ex;$/.test(row)), text);
	assert.ok(rows.some((row) => /^L\d+-32 +public class DocumentService extends BaseService implements Svc \{$/.test(row)), text);
	assert.ok(!text.includes("getDocumentId"), text);
});

test("module view of a file without definitions is all module-level code", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-module-none-"));
	await writeFile(join(dir, "consts.py"), "A = 1\n\n\nB = 2\n");
	assert.equal(
		await runReadSymbol({ path: "consts.py", module: true }, { cwd: dir }),
		["consts.py (4 lines) module view: each definition is shown as its first line and line range; read one with read_symbol and its path and a line in that range", "L1  A = 1", "L2", "L3", "L4  B = 2"].join("\n"),
	);
});

test("module view has no size limit", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-module-big-"));
	const source = `${Array.from({ length: 700 }, (_, i) => `V${i} = ${i}`).join("\n")}\n\n\ndef f():\n    pass\n`;
	await writeFile(join(dir, "big.py"), source);
	const rows = (await runReadSymbol({ path: "big.py", module: true }, { cwd: dir })).split("\n");
	assert.equal(rows.length, 1 + 700 + 1);
	assert.equal(rows.at(-1), "L703-704  def f():");
});

test("find_symbol, candidates, and similar names list every match", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-many-"));
	await writeFile(join(dir, "many.py"), Array.from({ length: 60 }, (_, i) => `def handler(x${i}):\n    return ${i}\n`).join("\n"));
	await writeFile(join(dir, "near.py"), Array.from({ length: 9 }, (_, i) => `def do_handler_${i}():\n    pass\n`).join("\n"));
	const found = await runFindSymbol({ name: "handler", path: "many.py" }, { cwd: dir });
	assert.equal(found.split("\n").length, 1 + 60 + 1);
	assert.ok(found.startsWith('60 definitions of "handler":'), found);
	assert.ok(!found.includes("showing"), found);
	for (let i = 0; i < 60; i++) await writeFile(join(dir, `h${i}.py`), "def handler():\n    pass\n");
	const candidates = await runReadSymbol({ symbol: "handler", path: "." }, { cwd: dir });
	assert.equal(candidates.split("\n").length, 1 + 120);
	assert.ok(!candidates.includes("showing"), candidates);
	const similar = await runReadSymbol({ symbol: "handle", path: "near.py" }, { cwd: dir });
	assert.equal(similar.split("\n").filter((line) => line.startsWith("read_symbol {")).length, 9, similar);
});
