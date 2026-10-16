import { readFile, stat } from "node:fs/promises";
import { basename, relative, sep } from "node:path";
import { SIGNATURE_MAX_CHARS } from "./config.ts";
import {
	ALL_GLOBS,
	ALL_LANGS,
	CLASS_LIKE,
	definitionRules,
	type KindLabel,
	LANGUAGES,
	type LangId,
	languageForFile,
	nameRegexBody,
	ruleKindLabel,
	ruleLang,
	SCOPE_KINDS,
	SUPPORTED_EXTENSIONS,
} from "./languages.ts";
import { rgFiles, type RunOptions, type SgMatch, sgScan } from "./proc.ts";

export interface SymbolName {
	qualifier: string[];
	name: string;
	isGlob: boolean;
}

export interface FileSource {
	buffer: Buffer;
	lines: string[];
	lineCount: number;
}

export interface Definition {
	file: string;
	lang: LangId;
	kind: KindLabel;
	name: string;
	scope: string[];
	container: string[];
	startLine: number;
	nodeStartLine: number;
	endLine: number;
	startByte: number;
	endByte: number;
	bodyStartByte: number | undefined;
	nameLine: number;
	nameColumn: number;
	signature: string;
	hasBody: boolean;
}

export interface SearchOptions extends RunOptions {
	root: string;
	kind?: string;
	ignoreCase?: boolean;
}

interface Scoped {
	match: SgMatch;
	label: KindLabel;
	name: string;
	declQualifier: string[];
}

export function parseSymbolName(input: string): SymbolName {
	const parts = input.trim().split(/::|\./).filter(Boolean);
	const name = parts.pop();
	if (!name) throw new Error("symbol name is empty");
	if (parts.some((part) => part.includes("*"))) throw new Error('"*" is only allowed in the last segment of a symbol name');
	if (name.replace(/\*/g, "") === "") throw new Error("symbol name needs at least one character besides *");
	return { qualifier: parts, name, isGlob: name.includes("*") };
}

export async function readSource(file: string): Promise<FileSource> {
	const buffer = await readFile(file);
	const text = buffer.toString("utf8");
	const lines = text.split(/\r?\n/);
	return { buffer, lines, lineCount: text.endsWith("\n") ? lines.length - 1 : lines.length };
}

export function moduleChain(file: string, root: string): string[] {
	const rel = relative(root, file);
	const path = rel.startsWith("..") ? basename(file) : rel;
	const parts = path.replace(/\.pyi?$/, "").split(sep).filter(Boolean);
	if (parts[parts.length - 1] === "__init__") parts.pop();
	return parts;
}

export function javaPackage(text: string): string[] {
	const match = /^\s*package\s+([\w.]+)\s*;/m.exec(text);
	return match ? match[1].split(".") : [];
}

export function leadingCommentStart(lines: readonly string[], nodeStartIndex: number, lang: LangId): number {
	let start = nodeStartIndex;
	while (start > 0) {
		const previous = lines[start - 1].trim();
		if (lang === "python") {
			if (!previous.startsWith("#")) break;
			start--;
			continue;
		}
		if (previous.startsWith("//")) {
			start--;
			continue;
		}
		if (!previous.endsWith("*/")) break;
		let open = start - 1;
		while (open >= 0 && !lines[open].includes("/*")) open--;
		if (open < 0) break;
		start = open;
	}
	return start;
}

export function matchesQualifier(def: Definition, qualifier: readonly string[]): boolean {
	if (qualifier.length === 0) return true;
	const chain = [...def.scope, ...def.container];
	if (qualifier.length > chain.length) return false;
	const offset = chain.length - qualifier.length;
	return qualifier.every((part, i) => chain[offset + i] === part);
}

export function kindMatches(def: Definition, kind: string | undefined): boolean {
	const wanted = kind?.trim().toLowerCase();
	if (!wanted || wanted === "any") return true;
	if (wanted === "class") return CLASS_LIKE.has(def.kind);
	return def.kind === wanted;
}

function stripTemplateArgs(text: string): string {
	let out = text;
	for (let previous = ""; previous !== out; ) {
		previous = out;
		out = out.replace(/(?<!operator)<[^<>]*>/g, "");
	}
	return out;
}

function scoped(match: SgMatch): Scoped {
	const lang = ruleLang(match.ruleId);
	const nameText = match.meta.NAME?.text ?? "";
	const segments = LANGUAGES[lang].qualifiedNames ? stripTemplateArgs(nameText).split("::").map((s) => s.trim()) : [nameText];
	const name = segments.pop() ?? "";
	return { match, label: ruleKindLabel(match.ruleId), name, declQualifier: segments };
}

interface ScopeIndex {
	nodes: Scoped[];
	parents: number[];
}

// Scope nodes sorted by start, outer before inner, with each node's innermost container; AST ranges nest or are disjoint.
function scopeIndex(candidates: readonly Scoped[]): ScopeIndex {
	const nodes = candidates
		.filter((s) => SCOPE_KINDS.has(s.label))
		.sort((a, b) => a.match.startByte - b.match.startByte || b.match.endByte - a.match.endByte);
	const parents: number[] = [];
	const open: number[] = [];
	for (let i = 0; i < nodes.length; i++) {
		while (open.length > 0 && nodes[open[open.length - 1]].match.endByte < nodes[i].match.endByte) open.pop();
		parents.push(open.length > 0 ? open[open.length - 1] : -1);
		open.push(i);
	}
	return { nodes, parents };
}

// Scope nodes containing the target, outermost first.
function enclosing(target: SgMatch, index: ScopeIndex): Scoped[] {
	const contains = (s: Scoped) =>
		s.match.startByte <= target.startByte &&
		s.match.endByte >= target.endByte &&
		!(s.match.startByte === target.startByte && s.match.endByte === target.endByte);
	let low = 0;
	let high = index.nodes.length - 1;
	let last = -1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		if (index.nodes[mid].match.startByte <= target.startByte) {
			last = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	let at = last;
	while (at !== -1 && !contains(index.nodes[at])) at = index.parents[at];
	const chain: Scoped[] = [];
	for (; at !== -1; at = index.parents[at]) chain.push(index.nodes[at]);
	return chain.reverse();
}

function finalKind(item: Scoped, chain: readonly Scoped[], lang: LangId): KindLabel {
	const parent = chain[chain.length - 1];
	const inClass = parent !== undefined && CLASS_LIKE.has(parent.label);
	if (lang === "python") {
		if (item.label === "function" && inClass) return "method";
		if (item.label === "variable" && inClass) return "field";
		return item.label;
	}
	if ((lang === "c" || lang === "cpp") && item.label === "function") {
		const owner = item.declQualifier[item.declQualifier.length - 1] ?? (inClass ? parent.name : undefined);
		if (owner !== undefined && owner === item.name) return "constructor";
		if (item.declQualifier.length > 0 || inClass) return "method";
	}
	return item.label;
}

function endLine(match: SgMatch): number {
	return match.end.column === 0 && match.end.line > match.start.line ? match.end.line : match.end.line + 1;
}

// Drops leading Java annotations and Python decorators, including ones with multi-line arguments.
function stripLeadingAnnotations(text: string): string {
	let i = 0;
	for (;;) {
		while (i < text.length && /\s/.test(text[i])) i++;
		if (text[i] !== "@" || text.startsWith("@interface", i)) return text.slice(i);
		i++;
		while (i < text.length && /[\w.]/.test(text[i])) i++;
		let j = i;
		while (j < text.length && /\s/.test(text[j])) j++;
		if (text[j] !== "(") continue;
		let depth = 0;
		let quote = "";
		for (; j < text.length; j++) {
			const c = text[j];
			if (quote) {
				if (c === "\\") j++;
				else if (c === quote) quote = "";
			} else if (c === '"' || c === "'") {
				quote = c;
			} else if (c === "(") {
				depth++;
			} else if (c === ")" && --depth === 0) {
				j++;
				break;
			}
		}
		i = j;
	}
}

function signatureOf(match: SgMatch, source: FileSource): string {
	const end = match.meta.BODY ? match.meta.BODY.startByte : match.endByte;
	const raw = stripLeadingAnnotations(source.buffer.subarray(match.startByte, end).toString("utf8"));
	const text = raw.replace(/\s+/g, " ").trim().replace(/[;{]$/, "").trim();
	return text.length > SIGNATURE_MAX_CHARS ? `${text.slice(0, SIGNATURE_MAX_CHARS - 3)}...` : text;
}

function scopeOf(lang: LangId, file: string, source: FileSource, root: string): string[] {
	if (lang === "python") return moduleChain(file, root);
	if (lang === "java") return javaPackage(source.buffer.toString("utf8"));
	return [];
}

function nameLocation(match: SgMatch, name: string): { line: number; column: number } {
	const node = match.meta.NAME;
	return node
		? { line: node.end.line + 1, column: node.end.column - [...name].length }
		: { line: match.start.line + 1, column: match.start.column };
}

// Location key of a definition's name, comparable with a reference match's start.
export function definitionSite(match: SgMatch): string {
	const { line, column } = nameLocation(match, scoped(match).name);
	return `${match.file}:${line}:${column}`;
}

function buildDefinition(item: Scoped, index: ScopeIndex, source: FileSource, scope: string[]): Definition {
	const { match } = item;
	const lang = ruleLang(match.ruleId);
	const chain = enclosing(match, index);
	const nameAt = nameLocation(match, item.name);
	return {
		file: match.file,
		lang,
		kind: finalKind(item, chain, lang),
		name: item.name,
		scope,
		container: [...chain.flatMap((s) => [...s.declQualifier, s.name]), ...item.declQualifier],
		startLine: leadingCommentStart(source.lines, match.start.line, lang) + 1,
		nodeStartLine: match.start.line + 1,
		endLine: endLine(match),
		startByte: match.startByte,
		endByte: match.endByte,
		bodyStartByte: match.meta.BODY?.startByte,
		nameLine: nameAt.line,
		nameColumn: nameAt.column,
		signature: signatureOf(match, source),
		hasBody: match.meta.BODY !== undefined,
	};
}

function byFile(matches: readonly SgMatch[]): Map<string, SgMatch[]> {
	const grouped = new Map<string, SgMatch[]>();
	for (const match of matches) {
		const list = grouped.get(match.file);
		if (list) list.push(match);
		else grouped.set(match.file, [match]);
	}
	return grouped;
}

function byPosition(a: Definition, b: Definition): number {
	return a.file < b.file ? -1 : a.file > b.file ? 1 : a.startByte - b.startByte;
}

// Functions and classes, as opposed to namespaces and the declarations inside them.
export const BODY_KINDS: ReadonlySet<KindLabel> = new Set<KindLabel>([...CLASS_LIKE, "function", "method", "constructor"]);

// The innermost function or class spanning the line, else the smallest other declaration there. A namespace counts only on its own line.
export function definitionAt(defs: readonly Definition[], line: number): Definition | undefined {
	const spanning = defs.filter((d) => d.startLine <= line && line <= d.endLine);
	const tiers = [
		spanning.filter((d) => BODY_KINDS.has(d.kind)),
		spanning.filter((d) => !BODY_KINDS.has(d.kind) && d.kind !== "namespace"),
		spanning.filter((d) => d.kind === "namespace" && d.nodeStartLine === line),
	];
	const pool = tiers.find((tier) => tier.length > 0) ?? [];
	let best: Definition | undefined;
	for (const def of pool) {
		if (!best || def.endByte - def.startByte < best.endByte - best.startByte) best = def;
	}
	return best;
}

export async function candidateFiles(body: string, options: SearchOptions): Promise<string[]> {
	if ((await stat(options.root)).isFile()) {
		if (!languageForFile(options.root)) {
			throw new Error(`${options.root} is not a Python, Java, or C/C++ file; supported extensions: ${SUPPORTED_EXTENSIONS}`);
		}
		return rgFiles(body, options.root, [], options);
	}
	return rgFiles(body, options.root, ALL_GLOBS, options);
}

export async function fileDefinitions(files: readonly string[], options: SearchOptions): Promise<Map<string, Definition[]>> {
	const result = new Map<string, Definition[]>();
	const grouped = byFile(await sgScan(definitionRules(ALL_LANGS), files, options));
	for (const [file, matches] of grouped) {
		const source = await readSource(file);
		const scope = scopeOf(ruleLang(matches[0].ruleId), file, source, options.cwd);
		const items = matches.map(scoped);
		const index = scopeIndex(items);
		result.set(file, items.map((item) => buildDefinition(item, index, source, scope)).sort(byPosition));
	}
	for (const file of files) if (!result.has(file)) result.set(file, []);
	return result;
}

export async function findDefinitions(sym: SymbolName, options: SearchOptions): Promise<Definition[]> {
	const body = nameRegexBody(sym.name, sym.isGlob);
	const files = await candidateFiles(body, options);
	const hits = byFile(await sgScan(definitionRules(ALL_LANGS, { body, ignoreCase: options.ignoreCase }), files, options));
	if (hits.size === 0) return [];
	const all = byFile(await sgScan(definitionRules(ALL_LANGS), [...hits.keys()], options));
	const defs: Definition[] = [];
	for (const [file, fileHits] of hits) {
		const source = await readSource(file);
		const scope = scopeOf(ruleLang(fileHits[0].ruleId), file, source, options.cwd);
		const index = scopeIndex((all.get(file) ?? []).map(scoped));
		for (const hit of fileHits) {
			const def = buildDefinition(scoped(hit), index, source, scope);
			if (matchesQualifier(def, sym.qualifier) && kindMatches(def, options.kind)) defs.push(def);
		}
	}
	return defs.sort(byPosition);
}
