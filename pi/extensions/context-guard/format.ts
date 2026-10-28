import { isAbsolute, relative } from "node:path";
import { toolCall } from "./calls.ts";
import { CLASS_LIKE } from "./languages.ts";
import type { Reference } from "./references.ts";
import { BODY_KINDS, type Definition, type FileSource } from "./symbols.ts";

export interface TreeNode {
	def: Definition;
	children: TreeNode[];
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export function displayPath(file: string, cwd: string): string {
	const rel = relative(cwd, file);
	return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}

// Heading text contains dots and spaces, so Markdown names are joined with " > ".
export function containerPath(def: Definition): string {
	return def.container.join(def.lang === "markdown" ? " > " : ".");
}

export function qualifiedName(def: Definition): string {
	return [...def.container, def.name].join(def.lang === "markdown" ? " > " : ".");
}

export function rangeLabel(def: Definition): string {
	return def.endLine > def.nodeStartLine ? `L${def.nodeStartLine}-${def.endLine}` : `L${def.nodeStartLine}`;
}

// The read_symbol call that reads the definition containing a line.
export const readLineCall = (shownPath: string, line: number): string => toolCall("read_symbol", { path: shownPath, line });

// A read_symbol call for the definition at a line, as listed in a blocked command's reason.
export function definitionRow(shownPath: string, line: number, def: Definition): string {
	return `${readLineCall(shownPath, line)}  ${def.kind} ${qualifiedName(def)} (${rangeLabel(def)})`;
}

export function cell(text: string, width: number): string {
	return `${text.padEnd(width - 1)} `;
}

export function definitionLine(def: Definition, cwd: string): string {
	const where = def.container.length > 0 ? `  (in ${containerPath(def)})` : "";
	return `${displayPath(def.file, cwd)}:${def.nodeStartLine}  ${def.kind}  ${def.signature}${where}`;
}

// A definition as a read_symbol call followed by its kind and signature.
function definitionCallRow(def: Definition, cwd: string): string {
	const where = def.container.length > 0 ? `  (in ${containerPath(def)})` : "";
	return `${readLineCall(displayPath(def.file, cwd), def.nodeStartLine)}  ${def.kind}  ${def.signature}${where}`;
}

export function formatDefinitions(symbol: string, defs: readonly Definition[], cwd: string): string {
	const lines = [`${plural(defs.length, "definition")} of "${symbol}":`, ...defs.map((d) => definitionLine(d, cwd))];
	if (defs.length > 0) lines.push(`Read one with ${readLineCall(displayPath(defs[0].file, cwd), defs[0].nodeStartLine)}, using the file and line of its row.`);
	return lines.join("\n");
}

export function formatNotFound(symbol: string, near: readonly Definition[], cwd: string): string {
	const lines = [`No definition of "${symbol}" found.`];
	if (near.length > 0) lines.push("Similar names:", ...near.map((d) => definitionCallRow(d, cwd)));
	return lines.join("\n");
}

export function formatCandidates(symbol: string, defs: readonly Definition[], cwd: string): string {
	return [`${defs.length} matches for "${symbol}"; read one with its call, or pass path or a qualified name:`, ...defs.map((d) => definitionCallRow(d, cwd))].join("\n");
}

const contains = (outer: Definition, inner: Definition) => outer.startByte <= inner.startByte && outer.endByte >= inner.endByte;

export function buildTree(defs: readonly Definition[]): TreeNode[] {
	const sorted = [...defs].sort((a, b) => a.startByte - b.startByte || b.endByte - a.endByte);
	const roots: TreeNode[] = [];
	const stack: TreeNode[] = [];
	for (const def of sorted) {
		while (stack.length > 0 && !contains(stack[stack.length - 1].def, def)) stack.pop();
		const node: TreeNode = { def, children: [] };
		if (stack.length > 0) stack[stack.length - 1].children.push(node);
		else roots.push(node);
		stack.push(node);
	}
	return roots;
}

export function findNode(nodes: readonly TreeNode[], def: Definition): TreeNode | undefined {
	for (const node of nodes) {
		if (node.def.startByte === def.startByte && node.def.endByte === def.endByte) return node;
		if (contains(node.def, def)) return findNode(node.children, def);
	}
	return undefined;
}

export interface Siblings {
	nodes: TreeNode[];
	parent: TreeNode | undefined;
}

// The nodes sharing a parent with def, and that parent; the root nodes when def is top level.
export function findSiblings(roots: TreeNode[], def: Definition, parent?: TreeNode): Siblings | undefined {
	for (const node of roots) {
		if (node.def.startByte === def.startByte && node.def.endByte === def.endByte) return { nodes: roots, parent };
		if (contains(node.def, def)) return findSiblings(node.children, def, node);
	}
	return undefined;
}

// A member's name relative to its parent's, such as Shape.area for an out-of-line C++ method under namespace geo.
function outlineName(def: Definition, parent: Definition | undefined): string {
	const full = qualifiedName(def);
	const prefix = parent ? `${qualifiedName(parent)}${def.lang === "markdown" ? " > " : "."}` : "";
	const name = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : parent ? def.name : full;
	return CLASS_LIKE.has(def.kind) || def.kind === "namespace" ? `${def.kind} ${name}` : name;
}

export function outlineRows(nodes: readonly TreeNode[], parent?: Definition, depth = 0): string[] {
	const rows: string[] = [];
	for (const node of nodes) {
		rows.push(`${"  ".repeat(depth)}${cell(rangeLabel(node.def), 10)}${outlineName(node.def, parent)}`);
		rows.push(...outlineRows(node.children, node.def, depth + 1));
	}
	return rows;
}

export function formatOutline(defs: readonly Definition[], path: string, lineCount: number): string {
	const header = `${path} (${plural(lineCount, "line")})`;
	if (defs.length === 0) return `${header}\nNo symbols found.`;
	return [header, ...outlineRows(buildTree(defs))].join("\n");
}

export function formatSkeleton(def: Definition, members: readonly Definition[], source: FileSource, cwd: string): string {
	const name = qualifiedName(def);
	const head = `${displayPath(def.file, cwd)}:${def.nodeStartLine}-${def.endLine}  ${def.kind} ${name}  (skeleton, not source text; read a member with ${toolCall("read_symbol", { symbol: `${name}.<member>` })})`;
	const comment = source.lines.slice(def.startLine - 1, def.nodeStartLine - 1);
	const braces = def.lang !== "python" && def.bodyStartByte !== undefined;
	const header =
		def.bodyStartByte !== undefined ? source.buffer.subarray(def.startByte, def.bodyStartByte).toString("utf8").replace(/\r\n?/g, "\n").trimEnd() : def.signature;
	const top = [head, ...comment, braces ? `${header} {` : header].join("\n");
	const rows = members.map((m) => `  ${cell(rangeLabel(m), 10)}${m.signature}`);
	return [top, ...rows, ...(braces ? ["}"] : [])].join("\n");
}

// Names the first non-blank line after a line, or the end of the file.
export function formatNextLineAfter(endLine: number, source: FileSource): string {
	for (let n = endLine + 1; n <= source.lineCount; n++) {
		const text = (source.lines[n - 1] ?? "").trimEnd();
		if (text.trim() === "") continue;
		return `[Next non-blank line, L${n}: ${text}]`;
	}
	return `[End of file after L${endLine}.]`;
}

export const formatNextLine = (def: Definition, source: FileSource): string => formatNextLineAfter(def.endLine, source);

export function formatSource(def: Definition, source: FileSource, cwd: string): string {
	const body = source.lines.slice(def.startLine - 1, def.endLine).join("\n");
	return `${displayPath(def.file, cwd)}:${def.startLine}-${def.endLine}  ${def.kind} ${qualifiedName(def)}\n${body}`;
}

export function formatReferences(symbol: string, label: string, refs: readonly Reference[], cwd: string, note?: string): string {
	const notes = note ? [note] : [];
	if (refs.length === 0) return [`No references to "${symbol}" found ${label}.`, ...notes].join("\n");
	const lines = [`${plural(refs.length, "reference")} to "${symbol}" ${label}`, ...notes];
	let current = "";
	for (const ref of refs) {
		if (ref.file !== current) {
			current = ref.file;
			lines.push(displayPath(ref.file, cwd));
		}
		lines.push(`  ${ref.line}${ref.enclosing ? ` (in ${ref.enclosing})` : ""}  ${ref.text}`);
	}
	return lines.join("\n");
}

// A line range widened to whole definitions, as source text.
export function formatRange(
	file: string,
	span: { start: number; end: number },
	asked: { start: number; end: number },
	source: FileSource,
	cwd: string,
	footer?: string,
): string {
	const expanded = span.start < asked.start || span.end > asked.end;
	const head = `${displayPath(file, cwd)}:${span.start}-${span.end}  lines ${asked.start}-${asked.end}${expanded ? " expanded to whole definitions" : ""}`;
	return [head, ...source.lines.slice(span.start - 1, span.end), ...(footer ? [footer] : [])].join("\n");
}

// A file's module-level code in full, with each top-level function, class, or section collapsed to its first line and line range.
export function formatModule(shownPath: string, defs: readonly Definition[], source: FileSource): string {
	const roots = buildTree(defs.filter((d) => BODY_KINDS.has(d.kind))).map((node) => node.def).sort((a, b) => a.startLine - b.startLine);
	const rows: { label: string; text: string }[] = [];
	let run: number[] = [];
	const flush = () => {
		while (run.length > 0 && source.lines[run[0] - 1].trim() === "") run.shift();
		while (run.length > 0 && source.lines[run[run.length - 1] - 1].trim() === "") run.pop();
		for (const n of run) rows.push({ label: `L${n}`, text: source.lines[n - 1].trimEnd() });
		run = [];
	};
	let next = 1;
	for (const def of roots) {
		if (def.startLine < next) continue;
		for (let n = next; n < def.startLine; n++) run.push(n);
		flush();
		const label = def.endLine > def.startLine ? `L${def.startLine}-${def.endLine}` : `L${def.startLine}`;
		rows.push({ label, text: (source.lines[def.nameLine - 1] ?? "").trimEnd() });
		next = def.endLine + 1;
	}
	for (let n = next; n <= source.lineCount; n++) run.push(n);
	flush();
	const first = roots[0];
	const example = first ? `, for example ${readLineCall(shownPath, first.nameLine)}` : "";
	const header = `${shownPath} (${plural(source.lineCount, "line")}) module view: each definition is shown as its first line and line range; read one with read_symbol and its path and a line in that range${example}`;
	const width = rows.reduce((max, row) => Math.max(max, row.label.length), 0) + 2;
	return [header, ...rows.map((row) => `${cell(row.label, width)}${row.text}`.trimEnd())].join("\n");
}
