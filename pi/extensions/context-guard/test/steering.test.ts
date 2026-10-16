import { test } from "node:test";
import assert from "node:assert/strict";
import {
	bashWantsHint,
	GUIDELINES,
	HINT_TEXT,
	HintThrottle,
	outlineFirstNote,
	shellSegments,
	wantsOutlineFirst,
} from "../steering.ts";

const isSource = (p: string) => /\.(py|pyi|java|c|h|cc|cpp|cxx|hh|hpp|hxx)$/.test(p);

test("shellSegments splits pipelines and respects quotes", () => {
	assert.deepEqual(shellSegments(`rg -n "def foo" src | head -5`), [
		["rg", "-n", "def foo", "src"],
		["head", "-5"],
	]);
	assert.deepEqual(shellSegments(`cd x && sed -n '10,20p' a.py; echo "a|b"`), [
		["cd", "x"],
		["sed", "-n", "10,20p", "a.py"],
		["echo", "a|b"],
	]);
	assert.deepEqual(shellSegments(`grep foo\\ bar f.c`), [["grep", "foo bar", "f.c"]]);
	assert.deepEqual(shellSegments(""), []);
});

test("bashWantsHint fires for readers on supported source files", () => {
	for (const cmd of [
		"sed -n '100,200p' src/main/java/Foo.java",
		"cat lib/mod.py",
		"head -50 geom.h",
		"tail -n 20 a/b.cpp",
		"awk 'NR>5' x.cc",
		"grep -n render src/view.py",
		"cd src && cat Foo.java | head",
		"/usr/bin/grep foo bar.hpp",
	]) {
		assert.equal(bashWantsHint(cmd, isSource), true, cmd);
	}
});

test("bashWantsHint fires for rg/grep with a bare identifier pattern", () => {
	for (const cmd of [
		"rg getDocumentId",
		"rg -n -t java getDocumentId .",
		'rg "def build_report"',
		"rg 'class DocumentService' src",
		"grep -rn '\\bfetchAll\\b' .",
		"rg -e handle_event src",
		"rg -g '*.py' parse_args",
	]) {
		assert.equal(bashWantsHint(cmd, isSource), true, cmd);
	}
});

test("bashWantsHint stays quiet otherwise", () => {
	for (const cmd of [
		"rg 'TODO: fix' src",
		"rg -n 'foo.*bar' .",
		"cat README.md",
		"sed -n '1,20p' config.yaml",
		"ls -la",
		"git grep -n foo",
		"python -m pytest tests/test_x.py",
		"echo hello",
	]) {
		assert.equal(bashWantsHint(cmd, isSource), false, cmd);
	}
});

test("HintThrottle allows the first hint, then one per 10 calls", () => {
	const throttle = new HintThrottle();
	throttle.recordCall();
	assert.equal(throttle.take(), true);
	for (let i = 0; i < 9; i++) {
		throttle.recordCall();
		assert.equal(throttle.take(), false, `call ${i}`);
	}
	throttle.recordCall();
	assert.equal(throttle.take(), true);
	throttle.reset();
	assert.equal(throttle.take(), true);
});

test("wantsOutlineFirst requires an unranged read of a long supported file", () => {
	assert.equal(wantsOutlineFirst({ path: "a.java" }, 401, true), true);
	assert.equal(wantsOutlineFirst({ path: "a.java" }, 400, true), false);
	assert.equal(wantsOutlineFirst({ path: "a.md" }, 5000, false), false);
	assert.equal(wantsOutlineFirst({ path: "a.java", offset: 1 }, 5000, true), false);
	assert.equal(wantsOutlineFirst({ path: "a.java", limit: 50 }, 5000, true), false);
});

test("text constants", () => {
	assert.equal(outlineFirstNote("src/A.java", 1234), "src/A.java is 1,234 lines; outline shown. Use read_symbol for a symbol, or read with offset/limit for a range.");
	assert.equal(HINT_TEXT, "Hint: find_symbol / read_symbol / find_references return code by name with less output.");
	assert.equal(GUIDELINES.length, 2);
	assert.ok(GUIDELINES[0].startsWith("For Python, Java, and C/C++ code: use outline"));
	assert.ok(GUIDELINES[1].startsWith("Oversized tool output is saved to a file"));
});
