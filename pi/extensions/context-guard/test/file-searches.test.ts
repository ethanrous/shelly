import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bashBlock } from "../bash-blocks.ts";
import { fileSearchBlock, findFileSearches, searchesCodeFiles, translateSearch } from "../file-searches.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const RULE = "Read and search Python, Java, C/C++, and Markdown files only with read_symbol, outline, search, find_symbol, and find_references; line-range reads, cat, grep, and rg on these files are always blocked, in bash and with read offset/limit.";

async function workspace() {
	const dir = await mkdtemp(join(tmpdir(), "cg-fsearch-"));
	await mkdir(join(dir, "src"));
	await mkdir(join(dir, "data"));
	for (const file of ["src/a.py", "src/b.java", "notes.md", "notes.txt", "data/x.json", "data/y.yaml", "config.yaml"]) await writeFile(join(dir, file), "foo\n");
	return dir;
}

const analyze = (command: string, cwd: string) => {
	const found = findFileSearches(command, cwd, "/home/u");
	assert.equal(found.length, 1, command);
	return found[0];
};

const calls = (text: string | undefined) => (text ?? "").split("\n").filter((line) => line.startsWith("search {"));

test("searches of code files, directories, and recursive searches are blocked", async () => {
	const cwd = await workspace();
	for (const command of [
		"grep -n foo src/a.py",
		"grep foo notes.md",
		"rg foo src/b.java",
		"grep -rn foo .",
		"grep -R foo src",
		"rg foo",
		"rg foo src",
		"rg foo data",
		"grep foo notes.txt src/a.py",
		"git grep -n foo",
		"xargs grep -l foo",
		"git ls-files | xargs rg foo",
		"rg foo -g '*.py'",
		"rg foo -g '*.{json,py}' data",
		"grep -r foo --include='*' data",
		"rg -t json foo data",
		"grep -rn foo -- data",
		"cd src && rg foo",
		"rg -l foo notes.md",
	]) {
		assert.equal(searchesCodeFiles(analyze(command, cwd)), true, command);
	}
});

test("searches of stdin, non-code files, and file listings run", async () => {
	const cwd = await workspace();
	for (const command of [
		"cat notes.txt | grep foo",
		"ls | rg foo",
		"git log | grep foo",
		"grep foo notes.txt",
		"grep foo config.yaml data/x.json",
		"rg foo config.yaml",
		"rg --files",
		"rg --files -g '*.py'",
		"rg --files src",
		"rg foo -g '*.json' data",
		"rg foo --glob '*.{json,yaml}' data",
		"grep -r foo --include='*.json' data",
		"grep -r foo --include '*.yaml' --include='*.json' data",
		"rg foo -g '*.json' -g '!x.json' .",
		"git grep foo -- '*.json'",
		"grep foo < notes.txt",
		"grep foo",
		"grep -V",
		"rg --version",
	]) {
		const found = findFileSearches(command, cwd, "/home/u");
		assert.ok(found.length > 0, command);
		assert.equal(searchesCodeFiles(found[0]), false, command);
		assert.equal(await fileSearchBlock(command, { cwd }), undefined, command);
	}
});

test("a piped rg or grep with a code file operand is still a file search", async () => {
	const cwd = await workspace();
	assert.equal(searchesCodeFiles(analyze("cat notes.txt | rg foo src/a.py", cwd)), true);
	assert.equal(searchesCodeFiles(analyze("cat notes.txt | rg foo src", cwd)), true);
});

test("translateSearch writes a search call for common flag combinations", async () => {
	const cwd = await workspace();
	const call = (command: string) => translateSearch(analyze(command, cwd), cwd);
	assert.deepEqual(call("grep -rn -i -C3 --include='*.py' --exclude-dir=tests foo src"), {
		call: 'search {"pattern": "foo", "path": "src", "ignore_case": true, "glob": ["*.py", "!**/tests/**"]}',
		notes: ["search names each match's enclosing function or class, and read_symbol with that path and the match's line reads it."],
	});
	assert.deepEqual(call("rg -l 'foo.bar' -g '!tests' src/a.py"), {
		call: 'search {"pattern": "foo.bar", "path": "src/a.py", "regex": true, "glob": ["!tests"]}',
		notes: ["search's header counts the matching lines and files, and the matches are grouped by file."],
	});
	assert.equal(call("grep -F -c 'a.b' notes.md").call, 'search {"pattern": "a.b", "path": "notes.md"}');
	assert.match(call("grep -F -c 'a.b' notes.md").notes[0], /header counts/);
	assert.equal(call("grep -E 'a|b' src/a.py").call, 'search {"pattern": "a|b", "path": "src/a.py", "regex": true}');
	assert.equal(call("grep 'a|b' src/a.py").call, 'search {"pattern": "a|b", "path": "src/a.py"}');
	assert.equal(call("grep 'a.b' src/a.py").call, 'search {"pattern": "a.b", "path": "src/a.py", "regex": true}');
	assert.equal(call("grep -P 'foo(?=bar)' src/a.py").call, 'search {"pattern": "foo(?=bar)", "path": "src/a.py", "regex": true}');
	assert.equal(call("grep -e foo -e bar src/a.py").call, 'search {"pattern": ["foo", "bar"], "path": "src/a.py"}');
	assert.equal(call("rg foo src notes.md").call, 'search {"pattern": "foo", "path": ["src", "notes.md"]}');
	assert.equal(call("rg -c TODO .").call, 'search {"pattern": "TODO"}');
	assert.equal(call("rg 'a|b' src").call, 'search {"pattern": "a|b", "path": "src", "regex": true}');
	assert.equal(call("rg -F foo").call, 'search {"pattern": "foo"}');
	assert.equal(call("rg -w foo src/a.py").call, 'search {"pattern": "\\\\b(?:foo)\\\\b", "path": "src/a.py", "regex": true}');
	assert.equal(call("grep -x -F 'a.b' src/a.py").call, 'search {"pattern": "^(?:a\\\\.b)$", "path": "src/a.py", "regex": true}');
	assert.equal(call("grep -r --exclude=x.py --exclude-dir=build foo src").call, 'search {"pattern": "foo", "path": "src", "glob": ["!x.py", "!**/build/**"]}');
	assert.equal(call("rg -g '*.py' -g '!test_*' foo src").call, 'search {"pattern": "foo", "path": "src", "glob": ["*.py", "!test_*"]}');
	assert.equal(call("rg -A 2 foo src/a.py").notes.length, 1);
	assert.equal(call("grep -5 foo src/a.py").notes.length, 1);
	assert.equal(call("fgrep foo src/a.py").call, 'search {"pattern": "foo", "path": "src/a.py"}');
	assert.equal(call("egrep 'a+' src/a.py").call, 'search {"pattern": "a+", "path": "src/a.py", "regex": true}');
});

test("translateSearch handles git grep pathspecs, xargs, and untranslatable options", async () => {
	const cwd = await workspace();
	assert.equal(translateSearch(analyze("git grep -n -i foo -- '*.py' ':!tests'", cwd), cwd).call, 'search {"pattern": "foo", "ignore_case": true, "glob": ["*.py", "!tests"]}');
	assert.equal(translateSearch(analyze("git -C src grep foo", cwd), cwd).call, 'search {"pattern": "foo"}');
	assert.equal(translateSearch(analyze("git ls-files | xargs grep -n foo", cwd), cwd).call, 'search {"pattern": "foo"}');
	const inverted = translateSearch(analyze("grep -v foo src/a.py", cwd), cwd);
	assert.equal(inverted.call, 'search {"pattern": "foo", "path": "src/a.py"}');
	assert.match(inverted.notes[0], /no inverted match/);
	assert.equal(translateSearch(analyze("grep -f patterns.txt src/a.py", cwd), cwd).call, 'search {"pattern": "<text to find>", "path": "src/a.py"}');
});

test("fileSearchBlock writes the full block message", async () => {
	const cwd = await workspace();
	assert.equal(
		await fileSearchBlock("grep -rn -i -C3 --include='*.py' --exclude-dir=tests foo src | head -20", { cwd }),
		[
			"Blocked: grep -rn -i -C3 '--include=*.py' --exclude-dir=tests foo src searches code files, so nothing in this command ran.",
			RULE,
			'search {"pattern": "foo", "path": "src", "ignore_case": true, "glob": ["*.py", "!**/tests/**"]}',
			"search names each match's enclosing function or class, and read_symbol with that path and the match's line reads it.",
			"Rerun the rest of the command without it.",
		].join("\n"),
	);
});

test("bashBlock keeps the definition-search suggestions for a definition-only grep", async () => {
	const ctx = { cwd: FIX };
	const text = await bashBlock(`rg -n "^def |^class " py/pkg/core.py`, ctx);
	assert.ok(text?.startsWith("Blocked: rg -n '^def |^class ' py/pkg/core.py matches only function and class definitions, so nothing in this command ran.\n"), text);
	assert.ok(text?.includes('read_symbol {"path": "py/pkg/core.py", "line": 18}  class Report (L18-29)'), text);
	assert.deepEqual(calls(text), []);
});

test("bashBlock reports a definition search and a file search from one command together", async () => {
	const ctx = { cwd: FIX };
	const text = await bashBlock(`rg -n "^def |^class " py/pkg/core.py; grep -rn MAX_ROWS py`, ctx);
	assert.match(text ?? "", /^Blocked: rg -n '\^def \|\^class ' py\/pkg\/core\.py matches only function and class definitions; grep -rn MAX_ROWS py searches code files, so nothing in this command ran\./);
	assert.deepEqual(calls(text), ['search {"pattern": "MAX_ROWS", "path": "py"}']);
	assert.equal(text?.match(/Rerun the rest/g)?.length, 1);
});

test("bashBlock blocks reads and searches together and lets other commands run", async () => {
	const ctx = { cwd: FIX };
	const text = await bashBlock("cat py/pkg/core.py | grep MAX", ctx);
	assert.match(text ?? "", /^Blocked: cat py\/pkg\/core\.py reads a whole code file, so nothing in this command ran\./);
	assert.equal(await bashBlock("ls -la && echo done", ctx), undefined);
	assert.equal(await bashBlock("rg --files py", ctx), undefined);
});
