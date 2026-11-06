import { test } from "node:test";
import assert from "node:assert/strict";
import { commandLines, displayArgs, displayCommand } from "../command-lines.ts";

test("puts each ; command on its own line and keeps pipes together", () => {
	assert.equal(
		commandLines("python mything.py | grep 'blah'; touch somefile.txt; rm somefile.txt"),
		"python mything.py | grep 'blah'\ntouch somefile.txt\nrm somefile.txt",
	);
});

test("keeps && and || at the end of their line", () => {
	assert.equal(commandLines("make && ./run || echo failed"), "make &&\n./run ||\necho failed");
});

test("drops a trailing ; and does not double existing line breaks", () => {
	assert.equal(commandLines("a;"), "a");
	assert.equal(commandLines("a &&\n  b; c"), "a &&\n  b\nc");
	assert.equal(commandLines("a;\nb"), "a\nb");
});

test("leaves a single command unchanged", () => {
	assert.equal(commandLines("git status --short"), "git status --short");
	assert.equal(commandLines("ls 2>&1 | head &"), "ls 2>&1 | head &");
});

test("does not split inside quotes, substitutions, or subshells", () => {
	assert.equal(commandLines("echo 'a; b' \"c && d\""), "echo 'a; b' \"c && d\"");
	assert.equal(commandLines('x="$(echo "a; b")"; y'), 'x="$(echo "a; b")"\ny');
	assert.equal(commandLines("(cd sub && make); ls"), "(cd sub && make)\nls");
	assert.equal(commandLines("echo `a; b`; c"), "echo `a; b`\nc");
	assert.equal(commandLines("echo $((1 + 2)); c"), "echo $((1 + 2))\nc");
	assert.equal(commandLines("echo $'it\\'s; ok'; c"), "echo $'it\\'s; ok'\nc");
	assert.equal(commandLines("find . -exec rm {} \\; ; ls"), "find . -exec rm {} \\;\nls");
});

test("keeps comments, case terminators, and heredocs intact", () => {
	assert.equal(commandLines("ls # a; b\npwd; id"), "ls # a; b\npwd\nid");
	assert.equal(commandLines("echo a#b; c"), "echo a#b\nc");
	assert.equal(commandLines("case $x in a) echo a;; b) echo b;; esac"), "case $x in a) echo a;; b) echo b;; esac");
	assert.equal(commandLines("cd x; cat <<EOF > f\na; b\nEOF\nls; pwd"), "cd x\ncat <<EOF > f\na; b\nEOF\nls; pwd");
	assert.equal(commandLines("grep x <<< 'a; b'; c"), "grep x <<< 'a; b'\nc");
});

test("handles a command that is still streaming", () => {
	assert.equal(commandLines("a; echo 'unterminated; b"), "a\necho 'unterminated; b");
	assert.equal(commandLines('a; echo "open; b'), 'a\necho "open; b');
});

test("indents continuation lines for display", () => {
	assert.equal(displayCommand("a; b && c"), "a\n  b &&\n  c");
});

test("displayArgs copies changed arguments and leaves the original alone", () => {
	const args = { command: "a; b", timeout: 5 };
	assert.deepEqual(displayArgs(args), { command: "a\n  b", timeout: 5 });
	assert.equal(args.command, "a; b");
	const single = { command: "ls" };
	assert.equal(displayArgs(single), single);
	assert.equal(displayArgs(undefined), undefined);
});
