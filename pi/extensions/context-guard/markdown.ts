import { escapeRegex } from "./languages.ts";
import type { Definition, FileSource } from "./symbols.ts";

interface Heading {
	level: number;
	// Zero-based index of the heading's first line.
	index: number;
	name: string;
	signature: string;
}

interface OpenSection {
	heading: Heading;
	container: string[];
}

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const COMMENT_OPEN = /^ {0,3}<!--/;

function atxHeading(line: string, index: number): Heading | undefined {
	const match = ATX.exec(line);
	if (!match) return undefined;
	const name = (match[2] ?? "").trim().replace(/(^|[ \t]+)#+$/, "").trim();
	return name ? { level: match[1].length, index, name, signature: line.trim() } : undefined;
}

function fenceOpening(line: string): { char: string; length: number } | undefined {
	const match = FENCE_OPEN.exec(line);
	if (!match || (match[1][0] === "`" && match[2].includes("`"))) return undefined;
	return { char: match[1][0], length: match[1].length };
}

function closesFence(line: string, fence: { char: string; length: number }): boolean {
	const match = /^ {0,3}([`~]{3,})[ \t]*$/.exec(line);
	return match !== null && match[1][0] === fence.char && match[1].length >= fence.length;
}

// A line that can be the text of a setext heading.
function isParagraphText(line: string): boolean {
	if (!/^ {0,3}\S/.test(line)) return false;
	return !ATX.test(line) && !LIST_ITEM.test(line) && !THEMATIC_BREAK.test(line) && !/^ {0,3}>/.test(line) && !fenceOpening(line) && !COMMENT_OPEN.test(line);
}

// Index of the line after a leading YAML front matter block; 0 when there is none.
function frontMatterEnd(lines: readonly string[]): number {
	if (lines[0]?.trimEnd() !== "---") return 0;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trimEnd();
		if (line === "---" || line === "...") return i + 1;
	}
	return 0;
}

export function markdownHeadings(lines: readonly string[]): Heading[] {
	const headings: Heading[] = [];
	let fence: { char: string; length: number } | undefined;
	let inComment = false;
	let paragraph = -1;
	for (let i = frontMatterEnd(lines); i < lines.length; i++) {
		const line = lines[i];
		if (fence) {
			if (closesFence(line, fence)) fence = undefined;
			continue;
		}
		if (inComment) {
			if (line.includes("-->")) inComment = false;
			continue;
		}
		const opening = fenceOpening(line);
		if (opening) {
			fence = opening;
			paragraph = -1;
			continue;
		}
		if (COMMENT_OPEN.test(line)) {
			inComment = !line.includes("-->", line.indexOf("<!--") + 4);
			paragraph = -1;
			continue;
		}
		const underline = SETEXT_UNDERLINE.exec(line);
		if (underline && paragraph >= 0) {
			const name = lines[paragraph].trim();
			const level = underline[1][0] === "=" ? 1 : 2;
			headings.push({ level, index: paragraph, name, signature: `${"#".repeat(level)} ${name}` });
			paragraph = -1;
			continue;
		}
		const heading = atxHeading(line, i);
		if (heading) headings.push(heading);
		paragraph = heading ? -1 : isParagraphText(line) ? i : -1;
	}
	return headings;
}

function lineStarts(buffer: Buffer): number[] {
	const starts = [0];
	for (let i = buffer.indexOf(10); i !== -1; i = buffer.indexOf(10, i + 1)) starts.push(i + 1);
	return starts;
}

// Each heading's section runs to the line before the next heading of the same or a higher level, minus trailing blank lines.
export function parseMarkdown(file: string, source: FileSource): Definition[] {
	const { lines } = source;
	const starts = lineStarts(source.buffer);
	const endByte = (line: number) => starts[line - 1] + Buffer.byteLength(lines[line - 1]);
	const defs: Definition[] = [];
	const open: OpenSection[] = [];
	const close = (section: OpenSection, nextIndex: number) => {
		const { heading, container } = section;
		let end = nextIndex;
		while (end > heading.index + 1 && lines[end - 1].trim() === "") end--;
		const line = heading.index + 1;
		const column = Math.max(0, lines[heading.index].indexOf(heading.name));
		defs.push({
			file,
			lang: "markdown",
			kind: "section",
			name: heading.name,
			scope: [],
			container,
			startLine: line,
			nodeStartLine: line,
			endLine: end,
			startByte: starts[heading.index],
			endByte: endByte(end),
			bodyStartByte: undefined,
			nameLine: line,
			nameColumn: [...lines[heading.index].slice(0, column)].length,
			signature: heading.signature,
			hasBody: true,
		});
	};
	for (const heading of markdownHeadings(lines)) {
		while (open.length > 0 && open[open.length - 1].heading.level >= heading.level) close(open.pop() as OpenSection, heading.index);
		open.push({ heading, container: open.map((s) => s.heading.name) });
	}
	while (open.length > 0) close(open.pop() as OpenSection, source.lineCount);
	return defs.sort((a, b) => a.startByte - b.startByte);
}

export interface HeadingQuery {
	// Normalized enclosing heading names, outermost first.
	qualifier: string[];
	// Normalized heading text, or the glob pieces joined by * when isGlob.
	name: string;
	isGlob: boolean;
	pattern: RegExp | undefined;
	// The longest run of letters and digits in the heading text, which a candidate-file search matches inside any word.
	token: string | undefined;
}

const stripLinks = (text: string) => text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");

function stripMarkup(text: string): string {
	return stripLinks(text).replace(/[`*_]/g, "").replace(/\s+/g, " ");
}

function longestToken(text: string): string | undefined {
	const tokens = stripLinks(text).match(/[\p{L}\p{N}]+/gu) ?? [];
	return tokens.reduce<string | undefined>((best, token) => (best === undefined || token.length > best.length ? token : best), undefined);
}

export function normalizeHeading(text: string): string {
	return stripMarkup(text).trim().replace(/:+$/, "").trim().toLowerCase();
}

// Wildcard * is allowed in the last segment only; segments are separated by " > ".
export function parseHeadingQuery(input: string): HeadingQuery {
	const parts = input.trim().split(/\s+>\s+/).filter(Boolean);
	const last = parts.pop();
	if (!last) throw new Error("symbol name is empty");
	if (parts.some((part) => part.includes("*"))) throw new Error('"*" is only allowed in the last segment of a heading name');
	if (last.replace(/\*/g, "").trim() === "") throw new Error("symbol name needs at least one character besides *");
	const qualifier = parts.map(normalizeHeading);
	const token = longestToken(last);
	if (!last.includes("*")) return { qualifier, name: normalizeHeading(last), isGlob: false, pattern: undefined, token };
	const pieces = last.split("*").map((piece) => stripMarkup(piece).toLowerCase());
	return { qualifier, name: pieces.join("*"), isGlob: true, pattern: new RegExp(`^${pieces.map(escapeRegex).join(".*")}$`, "s"), token };
}

// Each qualifier part names an enclosing heading, in order, with any levels between them.
function qualifierMatches(def: Definition, qualifier: readonly string[]): boolean {
	let at = 0;
	for (const heading of def.container.map(normalizeHeading)) if (heading === qualifier[at]) at++;
	return at >= qualifier.length;
}

export function headingMatches(def: Definition, query: HeadingQuery): boolean {
	if (def.lang !== "markdown") return false;
	const name = normalizeHeading(def.name);
	const nameMatches = query.pattern ? query.pattern.test(name) : name === query.name;
	return nameMatches && qualifierMatches(def, query.qualifier);
}

// A heading whose text contains the query text, ignoring case and markup.
export function headingNearMatches(def: Definition, query: HeadingQuery): boolean {
	const bare = query.name.replace(/\*/g, "").trim();
	return def.lang === "markdown" && bare !== "" && normalizeHeading(def.name).includes(bare);
}
