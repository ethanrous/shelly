import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findExecutable,
	parseSgLine,
	parseVersion,
	rgFiles,
	run,
	sgScan,
	toolProblem,
	versionAtLeast,
} from "../proc.ts";

const tmp = () => mkdtemp(join(tmpdir(), "cg-proc-"));

test("findExecutable searches PATH then extra dirs and skips non-executables", async () => {
	const a = await tmp();
	const b = await tmp();
	await writeFile(join(a, "tool"), "");
	await writeFile(join(b, "tool"), "#!/bin/sh\n");
	await chmod(join(b, "tool"), 0o755);
	assert.equal(findExecutable("tool", a, [b]), join(b, "tool"));
	assert.equal(findExecutable("tool", `${a}:${b}`, []), join(b, "tool"));
	assert.equal(findExecutable("missing", a, [b]), undefined);
});

test("parseVersion and versionAtLeast", () => {
	assert.deepEqual(parseVersion("ast-grep 0.51.0\n"), [0, 51, 0]);
	assert.equal(parseVersion("nope"), undefined);
	assert.equal(versionAtLeast([0, 51, 0], [0, 51]), true);
	assert.equal(versionAtLeast([0, 52, 1], [0, 51]), true);
	assert.equal(versionAtLeast([1, 0, 0], [0, 51]), true);
	assert.equal(versionAtLeast([0, 50, 9], [0, 51]), false);
});

test("run collects output and exit code", async () => {
	const result = await run(process.execPath, ["-e", "console.log('hi'); console.error('err'); process.exit(3)"], { cwd: tmpdir() });
	assert.deepEqual(result, { stdout: "hi\n", stderr: "err\n", code: 3 });
});

test("run kills the child on timeout", async () => {
	await assert.rejects(
		run(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { cwd: tmpdir(), timeoutMs: 100 }),
		/node timed out after 0.1s/,
	);
});

test("run kills the child on abort", async () => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 50);
	await assert.rejects(
		run(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { cwd: tmpdir(), signal: controller.signal }),
		/aborted/,
	);
});

test("parseSgLine maps ranges and captures", () => {
	const line = JSON.stringify({
		text: "void run() {}",
		range: { byteOffset: { start: 10, end: 23 }, start: { line: 2, column: 4 }, end: { line: 2, column: 17 } },
		file: "/x/A.java",
		lines: "    void run() {}",
		ruleId: "java/method_declaration",
		metaVariables: {
			single: {
				NAME: { text: "run", range: { byteOffset: { start: 15, end: 18 }, start: { line: 2, column: 9 }, end: { line: 2, column: 12 } } },
				BODY: { text: "{}", range: { byteOffset: { start: 21, end: 23 }, start: { line: 2, column: 15 }, end: { line: 2, column: 17 } } },
			},
			multi: {},
			transformed: {},
		},
	});
	assert.deepEqual(parseSgLine(line), {
		start: { line: 2, column: 4 },
		end: { line: 2, column: 17 },
		startByte: 10,
		endByte: 23,
		ruleId: "java/method_declaration",
		file: "/x/A.java",
		meta: {
			NAME: { text: "run", start: { line: 2, column: 9 }, end: { line: 2, column: 12 }, startByte: 15, endByte: 18 },
			BODY: { text: "", start: { line: 2, column: 15 }, end: { line: 2, column: 17 }, startByte: 21, endByte: 23 },
		},
	});
});

test("run streams stdout lines, including multi-byte characters split across chunks", async () => {
	const lines: string[] = [];
	const script = "process.stdout.write(Buffer.from([0x61, 0x0a, 0xc3])); setTimeout(() => process.stdout.write(Buffer.from([0xa9, 0x0a, 0x62])), 20);";
	const result = await run(process.execPath, ["-e", script], { cwd: tmpdir(), onStdoutLine: (line) => lines.push(line) });
	assert.deepEqual(lines, ["a", "é", "b"]);
	assert.equal(result.stdout, "");
});

test("run fails when a line handler throws", async () => {
	const handler = () => {
		throw new Error("bad line");
	};
	await assert.rejects(run(process.execPath, ["-e", "console.log('x')"], { cwd: tmpdir(), onStdoutLine: handler }), /bad line/);
});

test("toolProblem is undefined when rg and ast-grep 0.51+ are installed", async () => {
	assert.equal(await toolProblem(), undefined);
});

test("sgScan matches, parses .h as C++, and ignores a stray sgconfig.yml", async () => {
	const dir = await tmp();
	await writeFile(join(dir, "sgconfig.yml"), "ruleDirs: [does-not-exist]\n");
	await writeFile(join(dir, "A.java"), "class A {\n  void foo() {}\n  // foo\n}\n");
	await writeFile(join(dir, "g.h"), "namespace geo { class Shape {}; }\n");
	const rules = [
		JSON.stringify({ id: "t/ref", language: "java", rule: { kind: "identifier", regex: "^foo$" } }),
		JSON.stringify({ id: "t/ns", language: "cpp", rule: { kind: "namespace_definition" } }),
	].join("\n---\n");
	const matches = await sgScan(rules, [join(dir, "A.java"), join(dir, "g.h")], { cwd: dir });
	const byRule = Object.fromEntries(matches.map((m) => [m.ruleId, m]));
	assert.equal(matches.length, 2);
	assert.deepEqual(byRule["t/ref"].start, { line: 1, column: 7 });
	assert.equal(byRule["t/ns"].file, join(dir, "g.h"));
});

test("sgScan rejects an invalid rule", async () => {
	const dir = await tmp();
	await writeFile(join(dir, "A.java"), "class A {}\n");
	const bad = JSON.stringify({ id: "bad", language: "java", rule: { kind: "not_a_real_kind" } });
	await assert.rejects(sgScan(bad, [join(dir, "A.java")], { cwd: dir }), /ast-grep failed \(exit 8\)/);
});

test("sgScan returns nothing for no files", async () => {
	assert.deepEqual(await sgScan("id: x", [], { cwd: tmpdir() }), []);
});

test("rgFiles lists sorted matching files, honors globs, and ignores globs for a file root", async () => {
	const dir = await tmp();
	await mkdir(join(dir, "b"));
	await writeFile(join(dir, "b", "Z.java"), "int fooBar;\n");
	await writeFile(join(dir, "A.java"), "fooBar();\n");
	await writeFile(join(dir, "n.py"), "fooBar = 1\n");
	await writeFile(join(dir, "c.java"), "fooBarBaz();\n");
	assert.deepEqual(await rgFiles("fooBar", dir, ["*.java"], { cwd: dir }), [join(dir, "A.java"), join(dir, "b", "Z.java")]);
	assert.deepEqual(await rgFiles("foobar", dir, ["*.py"], { cwd: dir, ignoreCase: true }), [join(dir, "n.py")]);
	assert.deepEqual(await rgFiles("nothing", dir, ["*.java"], { cwd: dir }), []);
	assert.deepEqual(await rgFiles("fooBar", join(dir, "n.py"), ["*.java"], { cwd: dir }), [join(dir, "n.py")]);
});
