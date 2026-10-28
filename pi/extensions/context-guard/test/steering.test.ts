import { test } from "node:test";
import assert from "node:assert/strict";
import { toolCall } from "../calls.ts";
import {
	bashWantsHint,
	BLOCK_RULE,
	blockMessage,
	GUIDELINES,
	HINT_TEXT,
	HintThrottle,
	outlineFirstNote,
	shellCommands,
	shellSegments,
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
	assert.deepEqual(shellSegments(String.raw`grep "a\|b" "x\"y" "\$HOME" "c\\d" 'e\|f'`), [["grep", String.raw`a\|b`, 'x"y', "$HOME", String.raw`c\d`, String.raw`e\|f`]]);
	assert.deepEqual(shellSegments(`rg "x\\`), [["rg", "x\\"]]);
	assert.deepEqual(shellSegments(""), []);
});

test("shellCommands marks pipes and splits on newlines and subshells", () => {
	assert.deepEqual(shellCommands("cat a.py | sed -n 1,5p\ncd x || (head b.py); ls"), [
		{ tokens: ["cat", "a.py"], piped: false, depth: 0 },
		{ tokens: ["sed", "-n", "1,5p"], piped: true, depth: 0 },
		{ tokens: ["cd", "x"], piped: false, depth: 0 },
		{ tokens: ["head", "b.py"], piped: false, depth: 1 },
		{ tokens: ["ls"], piped: false, depth: 0 },
	]);
	assert.deepEqual(shellCommands("echo 'a\nb' \"(c)\" 2>&1 &>/dev/null"), [{ tokens: ["echo", "a\nb", "(c)", "2>&1", "&>/dev/null"], piped: false, depth: 0 }]);
	assert.deepEqual(shellCommands("cat a.py |\n  head -5 &&\nls"), [
		{ tokens: ["cat", "a.py"], piped: false, depth: 0 },
		{ tokens: ["head", "-5"], piped: true, depth: 0 },
		{ tokens: ["ls"], piped: false, depth: 0 },
	]);
});

test("shellCommands skips comments and here-document bodies", () => {
	assert.deepEqual(shellCommands("echo ok # (head -n 5 a.py) | x\nrg a#b"), [
		{ tokens: ["echo", "ok"], piped: false, depth: 0 },
		{ tokens: ["rg", "a#b"], piped: false, depth: 0 },
	]);
	assert.deepEqual(shellCommands("python3 - <<'E'\nprint(1) | x\nE\nls; cat <<-EOF\n\tsed -n 1p a.py\n\tEOF\nwc <<< 'w'"), [
		{ tokens: ["python3", "-", "<<E"], piped: false, depth: 0 },
		{ tokens: ["ls"], piped: false, depth: 0 },
		{ tokens: ["cat", "<<-EOF"], piped: false, depth: 0 },
		{ tokens: ["wc", "<<<", "w"], piped: false, depth: 0 },
	]);
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

test("toolCall writes the tool name and its JSON arguments", () => {
	assert.equal(toolCall("read_symbol", { path: "data_insights/cheq.py", line: 510 }), 'read_symbol {"path": "data_insights/cheq.py", "line": 510}');
	assert.equal(toolCall("read_symbol", { path: "a.py", module: true }), 'read_symbol {"path": "a.py", "module": true}');
	assert.equal(toolCall("search", { pattern: "foo", path: "src", glob: ["*.py", "!**/t/**"], regex: undefined }), 'search {"pattern": "foo", "path": "src", "glob": ["*.py", "!**/t/**"]}');
});

test("blockMessage states the rule once and joins the reasons", () => {
	const parts = [
		{ subjects: ["sed -n 1,3p a.py"], reason: "reads code by line number", calls: ['read_symbol {"path": "a.py", "line": 1, "end_line": 3}'] },
		{ subjects: ["cat b.py"], reason: "reads a whole code file", calls: ['outline {"path": "b.py"}'], notes: ["a note"] },
	];
	assert.equal(
		blockMessage(parts, true),
		[
			"Blocked: sed -n 1,3p a.py reads code by line number; cat b.py reads a whole code file, so nothing in this command ran.",
			BLOCK_RULE,
			'read_symbol {"path": "a.py", "line": 1, "end_line": 3}',
			'outline {"path": "b.py"}',
			"a note",
			"Rerun the rest of the command without it.",
		].join("\n"),
	);
	assert.ok(blockMessage(parts.slice(0, 1), false).startsWith("Blocked: sed -n 1,3p a.py reads code by line number, so it did not run.\n"));
	assert.ok(!blockMessage(parts.slice(0, 1), false).includes("Rerun"));
});

test("text constants state the absolute rule and the field syntax", () => {
	assert.equal(
		outlineFirstNote("src/A.java", 1234),
		'src/A.java is 1,234 lines; its outline is shown instead of the file. Read imports and other module-level code with read_symbol {"path": "src/A.java", "module": true}, and a function or class with read_symbol, passing path and a line from an outline row\'s range.',
	);
	assert.ok(outlineFirstNote("README.md", 40, true).includes("the text before the first heading with read_symbol"));
	assert.ok(HINT_TEXT.includes('read_symbol {"path": "a.py", "module": true}'));
	assert.ok(HINT_TEXT.includes('outline {"path": "a.py"}'));
	assert.ok(HINT_TEXT.includes('search {"pattern": "foo", "path": "src", "glob": ["*.py"]}'));
	assert.equal(GUIDELINES.length, 6);
	assert.ok(GUIDELINES[0].startsWith("Read and search Python, Java, C/C++, and Markdown files only with read_symbol"));
	assert.ok(GUIDELINES[0].includes("always blocked, whatever their size"));
	assert.ok(GUIDELINES[1].includes('read_symbol {"path": "src/app.py", "line": 302}'));
	assert.ok(GUIDELINES[4].includes('replace {"pattern": "pkg.old_mod", "with": "pkg.new_mod", "path": "tests", "expect": 9}'));
	assert.ok(GUIDELINES[5].startsWith("Oversized tool output is saved to a file"));
	const all = [HINT_TEXT, ...GUIDELINES].join("\n");
	assert.ok(!/20 lines|offset\/limit only|file:line|path:A-B/.test(all), all);
});
