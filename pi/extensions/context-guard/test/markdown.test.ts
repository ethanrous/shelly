import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { headingMatches, normalizeHeading, parseHeadingQuery, parseMarkdown } from "../markdown.ts";
import { runFindReferences, runFindSymbol, runOutline, runReadSymbol } from "../tools.ts";

function parse(text: string) {
	const lines = text.split(/\r?\n/);
	return parseMarkdown("doc.md", { buffer: Buffer.from(text), lines, lineCount: text.endsWith("\n") ? lines.length - 1 : lines.length });
}

const summary = (text: string) => parse(text).map((d) => `${d.container.join(">")}|${d.name}|${d.startLine}-${d.endLine}`);

async function tempDir(files: Record<string, string>) {
	const dir = await mkdtemp(join(tmpdir(), "cg-md-"));
	for (const [name, text] of Object.entries(files)) {
		await mkdir(join(dir, name, ".."), { recursive: true });
		await writeFile(join(dir, name), text);
	}
	return { cwd: dir };
}

const DOC = [
	"# Guide", // 1
	"", // 2
	"Intro text.", // 3
	"", // 4
	"## Setup", // 5
	"", // 6
	"Setup text.", // 7
	"", // 8
	"### Install", // 9
	"", // 10
	"Run `make`.", // 11
	"", // 12
	"### Configure", // 13
	"", // 14
	"Edit the file.", // 15
	"", // 16
	"## Usage", // 17
	"", // 18
	"Use it.", // 19
	"", // 20
].join("\n");

test("parser finds ATX headings with levels, nesting, and trimmed section ends", () => {
	assert.deepEqual(summary(DOC), [
		"|Guide|1-19",
		"Guide|Setup|5-15",
		"Guide>Setup|Install|9-11",
		"Guide>Setup|Configure|13-15",
		"Guide|Usage|17-19",
	]);
});

test("parser handles closing hashes, indentation, and non-headings", () => {
	const text = ["## Closed ##", "   ### Indented ###   ", "    #### Code", "#NoSpace", "####### Seven", "#", "# Real #  x #"].join("\n");
	assert.deepEqual(
		parse(text).map((d) => [d.name, d.signature]),
		[
			["Closed", "## Closed ##"],
			["Indented", "### Indented ###"],
			["Real #  x", "# Real #  x #"],
		],
	);
});

test("parser reads setext headings and ignores thematic breaks", () => {
	const text = ["Title", "=====", "", "text", "", "Sub", "---", "", "para", "", "---", "", "- item", "---", "", "> quote", "---"].join("\n");
	const defs = parse(text);
	assert.deepEqual(
		defs.map((d) => [d.name, d.signature, d.startLine, d.endLine]),
		[
			["Title", "# Title", 1, 17],
			["Sub", "## Sub", 6, 17],
		],
	);
	assert.equal(defs[1].nameLine, 6);
});

test("parser skips fenced code, front matter, and HTML comments", () => {
	const text = [
		"---",
		"title: x",
		"# not a heading",
		"---",
		"# Real",
		"```sh",
		"# comment",
		"```",
		"~~~~",
		"# tilde",
		"~~~",
		"# still code",
		"~~~~",
		"<!--",
		"# hidden",
		"-->",
		"<!-- one line -->",
		"## After",
		"````",
		"```",
		"# nested",
		"````",
	].join("\n");
	assert.deepEqual(summary(text), ["|Real|5-22", "Real|After|18-22"]);
});

test("parser nests across skipped levels and closes on equal or higher levels", () => {
	assert.deepEqual(summary(["# A", "### C", "## B", "#### D", "# E"].join("\n")), ["|A|1-4", "A|C|2-2", "A|B|3-4", "A>B|D|4-4", "|E|5-5"]);
});

test("parser computes byte offsets from line starts", () => {
	const text = "# Ünï\n\ntext\n\n## B\nmore\n";
	const [a, b] = parse(text);
	assert.equal(a.startByte, 0);
	assert.equal(text.slice(0), Buffer.from(text).toString());
	assert.equal(Buffer.from(text).subarray(b.startByte, b.endByte).toString(), "## B\nmore");
	assert.equal(Buffer.from(text).subarray(a.startByte, a.endByte).toString(), text.trimEnd());
	assert.equal(b.lang, "markdown");
	assert.equal(b.kind, "section");
	assert.equal(b.bodyStartByte, undefined);
	assert.equal(b.hasBody, true);
});

test("parser handles CRLF files and files without headings", () => {
	assert.deepEqual(summary("# A\r\n\r\ntext\r\n## B\r\n"), ["|A|1-4", "A|B|4-4"]);
	assert.deepEqual(parse("just text\n"), []);
});

test("heading queries normalize markup, case, and trailing colons", () => {
	assert.equal(normalizeHeading("  The `Foo`  **bar** [link](http://x) _baz_: "), "the foo bar link baz");
	const [def] = parse("## Install `make`:\n");
	for (const query of ["install make", "INSTALL `Make`", "*stall*", "Install*"]) assert.ok(headingMatches(def, parseHeadingQuery(query)), query);
	assert.ok(!headingMatches(def, parseHeadingQuery("Install")));
	assert.ok(!headingMatches(def, parseHeadingQuery("Setup > Install make")));
	assert.throws(() => parseHeadingQuery("A* > B"), /last segment/);
});

const README = ["# Project", "", "Overview.", "", "## Setup", "", "Setup text.", "", "### Install", "", "Run make.", "", "## Usage", "", "### Install", "", "Usage install.", ""].join("\n");

test("outline lists headings as nested sections", async () => {
	const ctx = await tempDir({ "README.md": README });
	assert.equal(
		await runOutline({ path: "README.md" }, ctx),
		[
			"README.md (17 lines)",
			"L1-17     Project",
			"  L5-11     Setup",
			"    L9-11     Install",
			"  L13-17    Usage",
			"    L15-17    Install",
		].join("\n"),
	);
	const bare = await tempDir({ "plain.md": "no headings\n", "x.mdx": "# Hi\n" });
	assert.equal(await runOutline({ path: "plain.md" }, bare), "plain.md (1 line)\nNo symbols found.");
	assert.equal(await runOutline({ path: "x.mdx" }, bare), "x.mdx (1 line)\nL1        Hi");
	await assert.rejects(runOutline({ path: "plain.md/../nope.txt" }, bare), /Path not found/);
	await assert.rejects(runOutline({ path: "README.txt" }, await tempDir({ "README.txt": "x" })), /Markdown file; supported extensions: .*\.md/);
});

test("read_symbol returns a section whole with its subsections", async () => {
	const ctx = await tempDir({ "README.md": README });
	assert.equal(
		await runReadSymbol({ symbol: "Setup", path: "README.md" }, ctx),
		"README.md:5-11  section Project > Setup\n## Setup\n\nSetup text.\n\n### Install\n\nRun make.\n[Next non-blank line, L13: ## Usage]",
	);
});

test("read_symbol matches names ignoring case and markup, and qualifies with >", async () => {
	const ctx = await tempDir({ "README.md": README });
	assert.match(await runReadSymbol({ symbol: "_Setup_:", path: "README.md" }, ctx), /^README.md:5-11 /);
	assert.match(await runReadSymbol({ symbol: "Install", path: "README.md" }, ctx), /^README.md:9-11 [^]*\n\nREADME.md:15-17 /);
	const two = await tempDir({ "a.md": "# Install\n", "b.md": "# Install\n" });
	assert.equal(
		await runReadSymbol({ symbol: "Install" }, two),
		'2 matches for "Install"; read one with its call, or pass path or a qualified name:\nread_symbol {"path": "a.md", "line": 1}  section  # Install\nread_symbol {"path": "b.md", "line": 1}  section  # Install',
	);
	assert.equal(await runReadSymbol({ symbol: "Usage > Install", path: "README.md" }, ctx), "README.md:15-17  section Project > Usage > Install\n### Install\n\nUsage install.\n[End of file after L17.]");
	assert.match(await runReadSymbol({ symbol: "Setup > Install", path: "README.md" }, ctx), /^README.md:9-11 /);
	assert.match(await runReadSymbol({ symbol: "Project > Install", path: "README.md" }, ctx), /^README.md:9-11 [^]*\n\nREADME.md:15-17 /);
	assert.match(await runReadSymbol({ symbol: "Project > Usage > Install", path: "README.md" }, ctx), /^README.md:15-17 /);
	assert.match(await runReadSymbol({ symbol: "Usage > Setup > Install", path: "README.md" }, ctx), /^No definition/);
	assert.match(await runReadSymbol({ symbol: "Project > Setup > Install", path: "README.md" }, ctx), /^README.md:9-11 /);
	assert.match(await runReadSymbol({ symbol: "Us*", path: "README.md" }, ctx), /^README.md:13-17 /);
});

test("read_symbol takes a Markdown heading by symbol, or a line by path and line", async () => {
	const ctx = await tempDir({ "README.md": README });
	assert.match(await runReadSymbol({ symbol: "Setup > Install", path: "README.md" }, ctx), /^README.md:9-11 /);
	assert.match(await runReadSymbol({ path: "README.md", line: 10 }, ctx), /^README.md:9-11 {2}section Project > Setup > Install\n### Install/);
	assert.match(await runReadSymbol({ path: "README.md", line: 12 }, ctx), /^README.md:1-17 {2}section Project\n/);
	await assert.rejects(runReadSymbol({ path: "README.md", line: 99 }, ctx), /line 99 is out of range; README.md has 17 lines/);
	await assert.rejects(runReadSymbol({ symbol: "README.md:Setup > Install" }, ctx), /Use separate fields instead: read_symbol \{"symbol": "Setup > Install", "path": "README.md"\}/);
	await assert.rejects(runReadSymbol({ symbol: "README.md:10" }, ctx), /read_symbol \{"path": "README.md", "line": 10\}/);
});

test("read_symbol at a line before the first heading says so", async () => {
	const ctx = await tempDir({ "a.md": "intro\nmore\n\n# First\ntext\n" });
	const text = await runReadSymbol({ path: "a.md", line: 2 }, ctx);
	assert.equal(text, 'a.md line 2 comes before the first heading. Read module-level code with read_symbol {"path": "a.md", "module": true}, or see the file\'s structure with outline {"path": "a.md"}.');
});

test("read_symbol before and after return neighboring sections", async () => {
	const ctx = await tempDir({ "README.md": README });
	const after = await runReadSymbol({ symbol: "Setup", path: "README.md", after: 1 }, ctx);
	assert.match(after, /^README.md:5-11 [^]*\n\nREADME.md:13-17 {2}section Project > Usage\n## Usage/);
	const before = await runReadSymbol({ symbol: "Usage", path: "README.md", before: 1 }, ctx);
	assert.match(before, /^README.md:5-11 [^]*\n\nREADME.md:13-17 /);
	const edge = await runReadSymbol({ symbol: "Usage", path: "README.md", after: 1 }, ctx);
	assert.match(edge, /\[No more definitions after Project > Usage in Project\.\]$/);
});

test("an oversized section comes back whole", async () => {
	const body = Array.from({ length: 300 }, (_, i) => `own line ${i}`).join("\n");
	const sub = Array.from({ length: 300 }, (_, i) => `sub line ${i}`).join("\n");
	const source = `# Big\n\n${body}\n\n## One\n\n${sub}\n\n## Two\n\nshort\n`;
	const ctx = await tempDir({ "big.md": source });
	const text = await runReadSymbol({ symbol: "Big", path: "big.md" }, ctx);
	assert.equal(text, ["big.md:1-609  section Big", ...source.trimEnd().split("\n"), "[End of file after L609.]"].join("\n"));
	assert.equal(await runReadSymbol({ path: "big.md", line: 250 }, ctx), text);
	assert.match(await runReadSymbol({ symbol: "One", path: "big.md" }, ctx), /^big.md:\d+-\d+ {2}section Big > One\n## One/);
});

test("find_symbol and kind: section search Markdown headings", async () => {
	const ctx = await tempDir({ "docs/a.md": "# Alpha\n\n## Deploy\n", "docs/b.mdx": "# Deploy now\n", "src/m.py": "def deploy():\n    pass\n", "notes.txt": "Deploy\n" });
	assert.equal(
		await runFindSymbol({ name: "deploy", kind: "section" }, ctx),
		'1 definition of "deploy":\ndocs/a.md:3  section  ## Deploy  (in Alpha)\nRead one with read_symbol {"path": "docs/a.md", "line": 3}, using the file and line of its row.',
	);
	assert.equal(await runFindSymbol({ name: "deploy" }, ctx), '1 definition of "deploy":\nsrc/m.py:1  function  def deploy():\nRead one with read_symbol {"path": "src/m.py", "line": 1}, using the file and line of its row.');
	assert.equal(await runFindSymbol({ name: "Deploy*", kind: "section" }, ctx), '2 definitions of "Deploy*":\ndocs/a.md:3  section  ## Deploy  (in Alpha)\ndocs/b.mdx:1  section  # Deploy now\nRead one with read_symbol {"path": "docs/a.md", "line": 3}, using the file and line of its row.');
	assert.match(await runFindSymbol({ name: "deploy", kind: "function" }, ctx), /^1 definition/);
});

test("code is searched first and Markdown headings are the fallback", async () => {
	const ctx = await tempDir({ "docs/a.md": "# Alpha\n\n## Release process\n\ntext\n", "src/m.py": "def helper():\n    pass\n" });
	assert.match(await runReadSymbol({ symbol: "helper" }, ctx), /^src\/m.py:1-2 /);
	assert.equal(await runReadSymbol({ symbol: "Release process" }, ctx), "docs/a.md:3-5  section Alpha > Release process\n## Release process\n\ntext\n[End of file after L5.]");
	assert.equal(await runReadSymbol({ symbol: "Alpha > Release process", path: "docs" }, ctx), "docs/a.md:3-5  section Alpha > Release process\n## Release process\n\ntext\n[End of file after L5.]");
	const missing = await runReadSymbol({ symbol: "release", path: "docs" }, ctx);
	assert.equal(missing, 'No definition of "release" found.\nSimilar names:\nread_symbol {"path": "docs/a.md", "line": 3}  section  ## Release process  (in Alpha)');
	assert.equal(await runReadSymbol({ symbol: "nothing here" }, ctx), 'No definition of "nothing here" found.');
});

test("find_references rejects Markdown files", async () => {
	const ctx = await tempDir({ "a.md": "# A\n" });
	await assert.rejects(runFindReferences({ symbol: "A", path: "a.md" }, ctx), /does not support Markdown/);
});

test("a section ends with the next non-blank line after it", async () => {
	const ctx = await tempDir({ "a.md": "# A\n\ntext\n\n\n# B\n\nmore\n" });
	assert.equal(await runReadSymbol({ symbol: "A", path: "a.md" }, ctx), "a.md:1-3  section A\n# A\n\ntext\n[Next non-blank line, L6: # B]");
});

test("read_symbol of a range inside one section's own text returns the section", async () => {
	const ctx = await tempDir({ "README.md": DOC });
	const text = await runReadSymbol({ path: "README.md", line: 6, end_line: 7 }, ctx);
	assert.ok(text.startsWith("README.md:5-15  section Guide > Setup\n"), text);
});

test("read_symbol of a range across sections returns them whole with the text between", async () => {
	const ctx = await tempDir({ "README.md": DOC });
	assert.equal(
		await runReadSymbol({ path: "README.md", line: 10, end_line: 14 }, ctx),
		["README.md:9-15  lines 10-14 expanded to whole definitions", ...DOC.split("\n").slice(8, 15), "[Next non-blank line, L17: ## Usage]"].join("\n"),
	);
	const wide = await runReadSymbol({ path: "README.md", line: 7, end_line: 18 }, ctx);
	assert.ok(wide.startsWith("README.md:5-19  lines 7-18 expanded to whole definitions\n## Setup"), wide);
});
