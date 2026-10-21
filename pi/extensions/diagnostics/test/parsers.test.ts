import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCargo } from "../checkers/rust.ts";
import { parseTsc, parseEslint } from "../checkers/typescript.ts";
import { parseRuff, parseTy } from "../checkers/python.ts";
import { CARGO_SAMPLE, ESLINT_SAMPLE, RUFF_SAMPLE, TSC_SAMPLE, TY_SAMPLE } from "./helpers.ts";

const diags = (parsed: unknown) => {
	assert.ok(Array.isArray(parsed), JSON.stringify(parsed));
	return parsed;
};

test("parseTy reads GitLab output, strips the check name prefix, and maps severity", () => {
	const [a, b] = diags(parseTy(TY_SAMPLE, "/root"));
	assert.deepEqual(a, { file: "/root/pkg/bad.py", line: 2, column: 10, severity: "error", code: "invalid-assignment", message: 'Object of type `Literal["a"]` is not assignable to `int`' });
	assert.equal(b.severity, "warning");
	assert.equal(b.message, "Unused `ty: ignore` directive");
});

test("parseTy and parseRuff fail on non-JSON output", () => {
	assert.deepEqual(parseTy("error: bad config", "/root"), { failed: "" });
	assert.deepEqual(parseRuff("", ), { failed: "" });
	assert.deepEqual(parseRuff("{}"), { failed: "" });
});

test("parseRuff keeps absolute filenames and allows a null code", () => {
	const [a, b] = diags(parseRuff(RUFF_SAMPLE));
	assert.deepEqual(a, { file: "ROOT/pkg/bad.py", line: 1, column: 8, severity: "error", code: "F401", message: "`os` imported but unused" });
	assert.equal(b.code, "");
});

test("parseTsc joins continuation lines and resolves paths against the root", () => {
	const parsed = parseTsc(TSC_SAMPLE.split("\n").slice(1).join("\n"), "/root", 2);
	const list = diags(parsed);
	assert.equal(list.length, 3);
	assert.equal(list[1].file, "/root/components/b.vue");
	assert.equal(list[1].message, "Argument of type 'A' is not assignable to parameter of type 'B'. Types of property 'x' are incompatible. Type 'string' is not assignable to type 'number'.");
	assert.equal(list[2].severity, "warning");
	assert.equal(list[2].code, "TS6133");
});

test("parseTsc reports a missing extended tsconfig as a failure", () => {
	assert.deepEqual(parseTsc(TSC_SAMPLE, "/root", 2), { failed: "TS5083 Cannot read file '/x/.nuxt/tsconfig.json'." });
	const inFile = "tsconfig.json(2,14): error TS5083: Cannot read file './.nuxt/tsconfig.json'.";
	assert.match((parseTsc(inFile, "/root", 2) as { failed: string }).failed, /^tsconfig.json: TS5083/);
});

test("parseTsc fails on nonzero exit without diagnostics and accepts a clean run", () => {
	assert.deepEqual(parseTsc("error TS5058: The specified path does not exist: 'x'.", "/root", 1), { failed: "TS5058 The specified path does not exist: 'x'." } );
	assert.deepEqual(parseTsc("", "/root", 2), { failed: "" });
	assert.deepEqual(parseTsc("", "/root", 0), []);
});

test("parseEslint maps severity, fatal, and null rule ids", () => {
	const list = diags(parseEslint(ESLINT_SAMPLE));
	assert.deepEqual(list.map((d) => [d.line, d.severity, d.code]), [[2, "error", "no-var"], [9, "error", ""], [3, "warning", "semi"]]);
	assert.deepEqual(parseEslint("Oops"), { failed: "" });
});

test("parseCargo keeps primary spans of errors and warnings and skips summaries", () => {
	const list = diags(parseCargo(CARGO_SAMPLE, "/ws", "/ws/member"));
	assert.deepEqual(list.map((d) => [d.file, d.line, d.column, d.severity, d.code]), [
		["/ws/src/main.rs", 5, 27, "warning", "unused_variables"],
		["/ws/src/lib.rs", 6, 16, "warning", "clippy::ptr_arg"],
		["/ws/src/main.rs", 7, 23, "error", "E0308"],
	]);
});

test("parseCargo falls back to the manifest directory and fails without build-finished", () => {
	const list = diags(parseCargo(CARGO_SAMPLE.replaceAll("ROOT", "/mf"), undefined, "/other"));
	assert.equal(list[0].file, "/mf/src/main.rs");
	assert.deepEqual(parseCargo("", undefined, "/r"), { failed: "" });
});
