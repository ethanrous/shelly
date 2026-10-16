import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type Definition,
	fileDefinitions,
	findDefinitions,
	javaPackage,
	leadingCommentStart,
	matchesQualifier,
	moduleChain,
	parseSymbolName,
} from "../symbols.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const opts = { cwd: FIX, root: FIX };
const brief = (d: Definition) => ({
	file: d.file.slice(FIX.length + 1),
	kind: d.kind,
	name: d.name,
	container: d.container,
	lines: [d.startLine, d.nodeStartLine, d.endLine],
});
const find = async (symbol: string, extra: Record<string, unknown> = {}) =>
	(await findDefinitions(parseSymbolName(symbol), { ...opts, ...extra })).map(brief);

test("parseSymbolName", () => {
	assert.deepEqual(parseSymbolName("getId"), { qualifier: [], name: "getId", isGlob: false });
	assert.deepEqual(parseSymbolName("a.b.C.m"), { qualifier: ["a", "b", "C"], name: "m", isGlob: false });
	assert.deepEqual(parseSymbolName("geo::Shape::~Shape"), { qualifier: ["geo", "Shape"], name: "~Shape", isGlob: false });
	assert.deepEqual(parseSymbolName(" *Service "), { qualifier: [], name: "*Service", isGlob: true });
	assert.throws(() => parseSymbolName(""), /empty/);
	assert.throws(() => parseSymbolName("a*.b"), /last segment/);
	assert.throws(() => parseSymbolName("**"), /besides \*/);
});

test("moduleChain and javaPackage", () => {
	assert.deepEqual(moduleChain("/r/src/pkg/core.py", "/r"), ["src", "pkg", "core"]);
	assert.deepEqual(moduleChain("/r/pkg/__init__.py", "/r"), ["pkg"]);
	assert.deepEqual(moduleChain("/elsewhere/mod.py", "/r"), ["mod"]);
	assert.deepEqual(javaPackage("// x\npackage com.ex;\n"), ["com", "ex"]);
	assert.deepEqual(javaPackage("class A {}"), []);
});

test("leadingCommentStart", () => {
	const java = ["int x;", "", "/**", " * Doc.", " */", "@Override", "void f() {}"];
	assert.equal(leadingCommentStart(java, 5, "java"), 2);
	assert.equal(leadingCommentStart(["// a", "// b", "void f();"], 2, "cpp"), 0);
	assert.equal(leadingCommentStart(["/* one */", "int f();"], 1, "c"), 0);
	assert.equal(leadingCommentStart(["x = 1", "# a", "def f():"], 2, "python"), 1);
	assert.equal(leadingCommentStart(["# a", "", "def f():"], 2, "python"), 2);
});

test("matchesQualifier uses suffixes of scope plus container", () => {
	const def = { scope: ["com", "ex"], container: ["DocumentService"] } as Definition;
	assert.equal(matchesQualifier(def, []), true);
	assert.equal(matchesQualifier(def, ["DocumentService"]), true);
	assert.equal(matchesQualifier(def, ["ex", "DocumentService"]), true);
	assert.equal(matchesQualifier(def, ["com", "ex", "DocumentService"]), true);
	assert.equal(matchesQualifier(def, ["Svc"]), false);
	assert.equal(matchesQualifier(def, ["x", "com", "ex", "DocumentService"]), false);
});

test("Java definitions by name, with containers, comments, and annotations", async () => {
	assert.deepEqual(await find("getDocumentId"), [
		{ file: "java/com/ex/DocumentService.java", kind: "method", name: "getDocumentId", container: ["DocumentService"], lines: [16, 17, 22] },
		{ file: "java/com/ex/DocumentService.java", kind: "method", name: "getDocumentId", container: ["DocumentService"], lines: [24, 24, 26] },
		{ file: "java/com/ex/Svc.java", kind: "method", name: "getDocumentId", container: ["Svc"], lines: [4, 4, 6] },
		{ file: "java/com/other/Unrelated.java", kind: "method", name: "getDocumentId", container: ["Unrelated"], lines: [4, 4, 6] },
	]);
});

test("Java qualifiers, globs, multi-declarator fields, and kind filters", async () => {
	assert.equal((await find("DocumentService.getDocumentId")).length, 2);
	assert.equal((await find("com.ex.DocumentService.getDocumentId")).length, 2);
	assert.equal((await find("Svc.getDocumentId")).length, 1);
	assert.equal((await find("Nope.getDocumentId")).length, 0);
	assert.deepEqual((await find("*Service")).map((d) => [d.kind, d.name]), [
		["class", "DocumentService"],
		["constructor", "DocumentService"],
	]);
	assert.deepEqual(await find("OTHER"), [
		{ file: "java/com/ex/DocumentService.java", kind: "field", name: "OTHER", container: ["DocumentService"], lines: [10, 10, 10] },
	]);
	assert.deepEqual((await find("DocumentService", { kind: "constructor" })).map((d) => d.lines), [[12, 12, 14]]);
	assert.deepEqual((await find("DocumentService", { kind: "class" })).map((d) => d.lines), [[5, 8, 32]]);
	assert.deepEqual((await find("DocumentService", { kind: " Constructor " })).map((d) => d.lines), [[12, 12, 14]]);
	assert.deepEqual((await find("Inner.run")).map((d) => d.container), [["DocumentService", "Inner"]]);
});

test("Java definitions carry signature, scope, and name position", async () => {
	const [def] = await findDefinitions(parseSymbolName("DocumentService.getDocumentId"), opts);
	assert.equal(def.signature, "public String getDocumentId(Request r)");
	assert.deepEqual(def.scope, ["com", "ex"]);
	assert.equal(def.nameLine, 18);
	assert.equal(def.nameColumn, 18);
	assert.equal(def.hasBody, true);
});

test("Python definitions", async () => {
	assert.deepEqual(await find("build_report"), [
		{ file: "py/other/tool.py", kind: "function", name: "build_report", container: [], lines: [1, 1, 2] },
		{ file: "py/pkg/core.py", kind: "function", name: "build_report", container: [], lines: [10, 12, 15] },
	]);
	assert.equal((await find("core.build_report")).length, 1);
	assert.equal((await find("pkg.core.build_report")).length, 1);
	assert.deepEqual(await find("Report.render"), [
		{ file: "py/pkg/core.py", kind: "method", name: "render", container: ["Report"], lines: [24, 24, 29] },
	]);
	assert.deepEqual((await find("nested")).map((d) => [d.kind, d.container]), [["function", ["Report", "render"]]]);
	assert.deepEqual((await find("MAX_ROWS")).map((d) => d.kind), ["variable"]);
	assert.deepEqual((await find("title")).map((d) => [d.kind, d.container]), [["field", ["Report"]]]);
	const [render] = await findDefinitions(parseSymbolName("render"), opts);
	assert.equal(render.signature, "def render(rows):");
});

test("C++ definitions, out-of-line members, and templates", async () => {
	assert.deepEqual(await find("area"), [
		{ file: "cpp/geom.cpp", kind: "method", name: "area", container: ["geo", "Shape"], lines: [5, 6, 8] },
		{ file: "cpp/geom.h", kind: "method", name: "area", container: ["geo", "Shape"], lines: [9, 9, 9] },
		{ file: "cpp/other.cpp", kind: "method", name: "area", container: ["Circle"], lines: [2, 2, 2] },
	]);
	assert.equal((await find("Shape.area")).length, 2);
	assert.equal((await find("geo::Shape::area")).length, 2);
	assert.deepEqual((await find("Shape")).map((d) => [d.file, d.kind, d.lines]), [
		["cpp/geom.cpp", "constructor", [3, 3, 3]],
		["cpp/geom.h", "class", [5, 6, 11]],
		["cpp/geom.h", "constructor", [8, 8, 8]],
	]);
	assert.deepEqual((await find("distance")).map((d) => [d.file, d.kind, d.container]), [
		["cpp/geom.cpp", "function", ["geo"]],
		["cpp/geom.h", "function", ["geo"]],
	]);
	assert.deepEqual((await find("clampv")).map((d) => d.lines), [[22, 22, 23]]);
	assert.deepEqual((await find("Id")).map((d) => d.kind), ["type"]);
	assert.deepEqual((await find("Size")).map((d) => d.kind), ["type"]);
	assert.deepEqual((await find("sides_")).map((d) => d.kind), ["field"]);
	assert.deepEqual((await find("Point")).map((d) => d.kind), ["struct"]);
	assert.deepEqual((await find("geo")).map((d) => d.kind), ["namespace", "namespace"]);
	const [areaDef] = await findDefinitions(parseSymbolName("Shape.area"), opts);
	assert.equal(areaDef.signature, "double geo::Shape::area() const");
	assert.equal(areaDef.nameColumn, 19);
});

test("C definitions", async () => {
	assert.deepEqual(await find("add"), [{ file: "c/util.c", kind: "function", name: "add", container: [], lines: [1, 2, 4] }]);
	assert.deepEqual(await find("node"), [{ file: "c/util.c", kind: "struct", name: "node", container: [], lines: [6, 6, 8] }]);
});

test("a file root limits the search; an unsupported file is rejected", async () => {
	const file = join(FIX, "java", "com", "other", "Unrelated.java");
	assert.equal((await findDefinitions(parseSymbolName("getDocumentId"), { cwd: FIX, root: file })).length, 1);
	await assert.rejects(
		findDefinitions(parseSymbolName("x"), { cwd: FIX, root: join(FIX, "py", "pyproject.toml") }),
		/supported extensions/,
	);
});

test("ignoreCase glob search finds near names", async () => {
	const defs = await findDefinitions(parseSymbolName("*documentid*"), { ...opts, ignoreCase: true });
	assert.equal(defs.length, 4);
});

test("fileDefinitions builds every definition in a file", async () => {
	const file = join(FIX, "java", "com", "ex", "DocumentService.java");
	const defs = (await fileDefinitions([file], opts)).get(file) ?? [];
	assert.deepEqual(
		defs.map((d) => [d.kind, d.name, d.nodeStartLine, d.endLine, d.container.join(".")]),
		[
			["class", "DocumentService", 8, 32, ""],
			["field", "repo", 9, 9, "DocumentService"],
			["field", "LIMIT", 10, 10, "DocumentService"],
			["constructor", "DocumentService", 12, 14, "DocumentService"],
			["method", "getDocumentId", 17, 22, "DocumentService"],
			["method", "getDocumentId", 24, 26, "DocumentService"],
			["class", "Inner", 28, 31, "DocumentService"],
			["method", "run", 29, 30, "DocumentService.Inner"],
		],
	);
	assert.deepEqual(
		defs.map((d) => d.signature),
		[
			"public class DocumentService extends BaseService implements Svc",
			"private final Repo repo",
			"static final int LIMIT = 1, OTHER = 2",
			"public DocumentService(Repo repo)",
			"public String getDocumentId(Request r)",
			"public String getDocumentId()",
			"static class Inner",
			"void run()",
		],
	);
});

test("Python module qualifiers resolve against cwd when path narrows the search", async () => {
	for (const root of [join(FIX, "py", "pkg", "core.py"), join(FIX, "py", "pkg")]) {
		for (const symbol of ["core.build_report", "pkg.core.build_report"]) {
			assert.equal((await findDefinitions(parseSymbolName(symbol), { cwd: FIX, root })).length, 1, `${symbol} in ${root}`);
		}
	}
});

test("signatures skip multi-line annotations and decorators", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-sig-"));
	await writeFile(
		join(dir, "A.java"),
		'class A {\n    @RequestMapping(\n        value = "/x)",\n        method = GET)\n    @Deprecated\n    public void multi(String a) {\n    }\n}\n',
	);
	await writeFile(join(dir, "t.py"), '@pytest.mark.parametrize(\n    "a",\n    [1, 2],\n)\ndef test_a(a):\n    pass\n');
	const signature = async (name: string) => (await findDefinitions(parseSymbolName(name), { cwd: dir, root: dir }))[0].signature;
	assert.equal(await signature("multi"), "public void multi(String a)");
	assert.equal(await signature("test_a"), "def test_a(a):");
});

test("C++ nested namespace names and template member qualifiers", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cg-cpp-"));
	const source = [
		"namespace a::b {",
		"class Foo {",
		"public:",
		"    ~Foo();",
		"};",
		"}",
		"a::b::Foo::~Foo() {}",
		"template <class T>",
		"class Box {",
		"public:",
		"    T get() const;",
		"};",
		"template <class T>",
		"T Box<T>::get() const {",
		"    return T();",
		"}",
	];
	await writeFile(join(dir, "adv.cpp"), `${source.join("\n")}\n`);
	const found = async (name: string) =>
		(await findDefinitions(parseSymbolName(name), { cwd: dir, root: dir })).map((d) => [d.kind, d.container.join("."), d.nodeStartLine, d.hasBody]);
	assert.deepEqual(await found("a::b::Foo::~Foo"), [
		["method", "a.b.Foo", 4, false],
		["method", "a.b.Foo", 7, true],
	]);
	assert.deepEqual(await found("Box.get"), [
		["method", "Box", 11, false],
		["method", "Box", 13, true],
	]);
});
