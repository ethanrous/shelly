import { isAbsolute, relative } from "node:path";
import { CAP_MAX_BYTES, CAP_MAX_LINES, FIND_SYMBOL_LIMIT, SKELETON_COMMENT_MAX_LINES } from "./config.ts";
import { exceedsCap, measure } from "./output-cap.ts";
import type { Definition, FileSource } from "./symbols.ts";

export interface TreeNode {
	def: Definition;
	children: TreeNode[];
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export function displayPath(file: string, cwd: string): string {
	const rel = relative(cwd, file);
	return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}

export function qualifiedName(def: Definition): string {
	return [...def.container, def.name].join(".");
}

export function rangeLabel(def: Definition): string {
	return def.endLine > def.nodeStartLine ? `L${def.nodeStartLine}-${def.endLine}` : `L${def.nodeStartLine}`;
}

export function cell(text: string, width: number): string {
	return `${text.padEnd(width - 1)} `;
}

export function definitionLine(def: Definition, cwd: string): string {
	const where = def.container.length > 0 ? `  (in ${def.container.join(".")})` : "";
	return `${displayPath(def.file, cwd)}:${def.nodeStartLine}  ${def.kind}  ${def.signature}${where}`;
}

export function formatDefinitions(symbol: string, defs: readonly Definition[], cwd: string): string {
	const shown = defs.slice(0, FIND_SYMBOL_LIMIT);
	const lines = [`${plural(defs.length, "definition")} of "${symbol}":`, ...shown.map((d) => definitionLine(d, cwd))];
	if (defs.length > shown.length) lines.push(`showing ${shown.length} of ${defs.length}; narrow with path or a qualified name`);
	return lines.join("\n");
}

export function formatNotFound(symbol: string, near: readonly Definition[], cwd: string): string {
	const lines = [`No definition of "${symbol}" found.`];
	if (near.length > 0) lines.push("Similar names:", ...near.map((d) => definitionLine(d, cwd)));
	return lines.join("\n");
}

export function formatCandidates(symbol: string, defs: readonly Definition[], cwd: string): string {
	const shown = defs.slice(0, FIND_SYMBOL_LIMIT);
	const lines = [`${defs.length} matches for "${symbol}"; pass path or a qualified name:`, ...shown.map((d) => definitionLine(d, cwd))];
	if (defs.length > shown.length) lines.push(`showing ${shown.length} of ${defs.length}`);
	return lines.join("\n");
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

export function outlineRows(nodes: readonly TreeNode[], maxDepth: number, depth = 0): string[] {
	const rows: string[] = [];
	for (const node of nodes) {
		const collapsed = depth >= maxDepth && node.children.length > 0;
		const suffix = collapsed ? ` (${plural(node.children.length, "member")})` : "";
		rows.push(`${"  ".repeat(depth)}${cell(rangeLabel(node.def), 10)}${cell(node.def.kind, 13)}${node.def.signature}${suffix}`);
		if (!collapsed) rows.push(...outlineRows(node.children, maxDepth, depth + 1));
	}
	return rows;
}

// Keeps as many rows as fit under the output cap, leaving room for the footer.
export function fitRows(header: string, rows: readonly string[], footer: (hidden: number) => string): string {
	const kept: string[] = [];
	let bytes = Buffer.byteLength(header) + 200;
	for (const row of rows) {
		const size = Buffer.byteLength(row) + 1;
		if (kept.length + 3 > CAP_MAX_LINES || bytes + size > CAP_MAX_BYTES) break;
		kept.push(row);
		bytes += size;
	}
	const lines = [header, ...kept];
	if (kept.length < rows.length) lines.push(footer(rows.length - kept.length));
	return lines.join("\n");
}

export function formatOutline(defs: readonly Definition[], path: string, lineCount: number): string {
	const header = `${path} (${plural(lineCount, "line")})`;
	if (defs.length === 0) return `${header}\nNo symbols found.`;
	const roots = buildTree(defs);
	for (const maxDepth of [Number.POSITIVE_INFINITY, 1, 0]) {
		const text = [header, ...outlineRows(roots, maxDepth)].join("\n");
		if (!exceedsCap(measure(text))) return text;
	}
	return fitRows(header, outlineRows(roots, 0), (hidden) => `(${hidden} more top-level symbols; use find_symbol with path to search this file)`);
}

export function formatSkeleton(def: Definition, members: readonly Definition[], source: FileSource, cwd: string, note?: string): string {
	const name = qualifiedName(def);
	const head = `${displayPath(def.file, cwd)}:${def.nodeStartLine}-${def.endLine}  ${def.kind} ${name}  (skeleton; read_symbol "${name}.<member>" for a body, full: true for all)`;
	const comment = source.lines.slice(def.startLine - 1, def.nodeStartLine - 1).slice(0, SKELETON_COMMENT_MAX_LINES);
	const braces = def.lang !== "python" && def.bodyStartByte !== undefined;
	const header =
		def.bodyStartByte !== undefined ? source.buffer.subarray(def.startByte, def.bodyStartByte).toString("utf8").replace(/\r\n?/g, "\n").trimEnd() : def.signature;
	const top = [head, ...comment, braces ? `${header} {` : header].join("\n");
	const rows = members.map((m) => `  ${cell(rangeLabel(m), 10)}${cell(m.kind, 13)}${m.signature}`);
	const bottom = [...(braces ? ["}"] : []), ...(note ? [note] : [])];
	const text = [top, ...rows, ...bottom].join("\n");
	if (!exceedsCap(measure(text))) return text;
	return [fitRows(top, rows, (hidden) => `  (${hidden} more members; use outline)`), ...bottom].join("\n");
}

export function formatSource(def: Definition, source: FileSource, cwd: string): string {
	const body = source.lines.slice(def.startLine - 1, def.endLine).join("\n");
	return `${displayPath(def.file, cwd)}:${def.startLine}-${def.endLine}  ${def.kind} ${qualifiedName(def)}\n${body}`;
}

export function formatOversize(def: Definition, nested: readonly TreeNode[], cwd: string, note: string): string {
	const head = `${displayPath(def.file, cwd)}:${def.startLine}-${def.endLine}  ${def.kind} ${qualifiedName(def)}`;
	return [head, def.signature, ...outlineRows(nested, 0, 1), note].join("\n");
}
