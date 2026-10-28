import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { toolCall } from "./calls.ts";
import {
	buildTree,
	displayPath,
	findNode,
	findSiblings,
	formatCandidates,
	formatDefinitions,
	formatNextLine,
	formatModule,
	formatNextLineAfter,
	formatRange,
	formatNotFound,
	formatOutline,
	formatReferences,
	formatSkeleton,
	formatSource,
	qualifiedName,
	type TreeNode,
} from "./format.ts";
import { CLASS_LIKE, isMarkdown, isOutlinable, OUTLINE_EXTENSIONS } from "./languages.ts";
import { type HeadingQuery, parseHeadingQuery } from "./markdown.ts";
import type { PreciseLang, PreciseResult } from "./lsp/manager.ts";
import { expandHome } from "./output-cap.ts";
import { byLocation, describeReferences, type Reference, syntacticReferences } from "./references.ts";
import {
	type Definition,
	definitionAt,
	fileDefinitions,
	BODY_KINDS,
	findDefinitions,
	findSections,
	parseSymbolName,
	readSource,
	type SearchOptions,
	type SymbolName,
} from "./symbols.ts";

export interface ToolContext {
	cwd: string;
	signal?: AbortSignal;
}

const isContainer = (def: Definition) => CLASS_LIKE.has(def.kind) || def.kind === "namespace";

export async function resolvePath(path: string | undefined, ctx: ToolContext): Promise<string> {
	const resolved = path ? resolve(ctx.cwd, expandHome(path)) : ctx.cwd;
	try {
		await stat(resolved);
	} catch {
		throw new Error(`Path not found: ${path}`);
	}
	return resolved;
}

export function searchOptions(ctx: ToolContext, root: string, extra: Partial<SearchOptions> = {}): SearchOptions {
	return { cwd: ctx.cwd, signal: ctx.signal, root, ...extra };
}

export async function nearMatches(name: string, root: string, ctx: ToolContext): Promise<Definition[]> {
	const bare = name.replace(/\*/g, "");
	if (!bare) return [];
	const defs = await findDefinitions({ qualifier: [], name: `*${bare}*`, isGlob: true }, searchOptions(ctx, root, { ignoreCase: true }));
	return defs;
}

async function isMarkdownFile(path: string): Promise<boolean> {
	return isMarkdown(path) && (await stat(path)).isFile();
}

function attempt<T>(parse: () => T): { value?: T; error?: unknown } {
	try {
		return { value: parse() };
	} catch (error) {
		return { error };
	}
}

const wantsSections = (kind: string | undefined) => ["", "any", "section"].includes(kind?.trim().toLowerCase() ?? "");

async function nearSections(query: HeadingQuery, options: SearchOptions): Promise<Definition[]> {
	return findSections(query, options, true);
}

// Code definitions first; when none match, Markdown headings. A Markdown file root or kind "section" searches Markdown only.
async function lookupSymbol(name: string, root: string, kind: string | undefined, ctx: ToolContext): Promise<{ defs: Definition[]; near: Definition[] }> {
	const markdownOnly = (await isMarkdownFile(root)) || kind?.trim().toLowerCase() === "section";
	const sections = wantsSections(kind);
	const code = markdownOnly ? undefined : attempt(() => parseSymbolName(name));
	const heading = sections ? attempt(() => parseHeadingQuery(name)) : undefined;
	const sym = code?.value;
	const query = heading?.value;
	if (!sym && !query) throw (code?.error ?? heading?.error);
	if (sym) {
		const defs = await findDefinitions(sym, searchOptions(ctx, root, { kind }));
		if (defs.length > 0) return { defs, near: [] };
	}
	const options = searchOptions(ctx, root, { kind });
	if (query) {
		const defs = await findSections(query, options);
		if (defs.length > 0) return { defs, near: [] };
	}
	const near = [...(sym ? await nearMatches(sym.name, root, ctx) : []), ...(query ? await nearSections(query, options) : [])];
	return { defs: [], near };
}

export async function runFindSymbol(params: { name: string; path?: string; kind?: string }, ctx: ToolContext): Promise<string> {
	const root = await resolvePath(params.path, ctx);
	const { defs, near } = await lookupSymbol(params.name, root, params.kind, ctx);
	return defs.length === 0 ? formatNotFound(params.name, near, ctx.cwd) : formatDefinitions(params.name, defs, ctx.cwd);
}

export async function outlineText(file: string, ctx: ToolContext, shownPath = displayPath(file, ctx.cwd)): Promise<string> {
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	return formatOutline(defs, shownPath, (await readSource(file)).lineCount);
}

export async function runOutline(params: { path: string }, ctx: ToolContext): Promise<string> {
	const file = await resolvePath(params.path, ctx);
	if ((await stat(file)).isDirectory() || !isOutlinable(file)) {
		throw new Error(`${params.path} is not a Python, Java, C/C++, or Markdown file; supported extensions: ${OUTLINE_EXTENSIONS}`);
	}
	return outlineText(file, ctx);
}

// Picks what read_symbol renders: one definition, a class with its own constructors, a C/C++ body with
// its declarations, or every match when all are in one file. Anything else is ambiguous.
export function chooseDefinitions(defs: readonly Definition[]): { render: Definition[]; declarations: Definition[] } | undefined {
	if (defs.length === 1) return { render: [...defs], declarations: [] };
	const containers = defs.filter(isContainer);
	if (containers.length > 0) {
		const owner = containers[0];
		const ownConstructors = defs.every(
			(d) => d === owner || (d.kind === "constructor" && d.container[d.container.length - 1] === owner.name),
		);
		return containers.length === 1 && ownConstructors ? { render: [owner], declarations: [] } : undefined;
	}
	const bodies = defs.filter((d) => d.hasBody);
	if (bodies.length === 1 && defs.every((d) => d.lang === "c" || d.lang === "cpp")) {
		return { render: bodies, declarations: defs.filter((d) => d !== bodies[0]) };
	}
	return defs.every((d) => d.file === defs[0].file) ? { render: [...defs], declarations: [] } : undefined;
}

async function nestedNodes(def: Definition, ctx: ToolContext): Promise<TreeNode[]> {
	const defs = (await fileDefinitions([def.file], searchOptions(ctx, ctx.cwd))).get(def.file) ?? [];
	return findNode(buildTree(defs), def)?.children ?? [];
}

async function renderDefinition(def: Definition, full: boolean, ctx: ToolContext): Promise<string> {
	const source = await readSource(def.file);
	if (isContainer(def) && !full) {
		const members = (await nestedNodes(def, ctx)).map((node) => node.def);
		return formatSkeleton(def, members, source, ctx.cwd);
	}
	return formatSource(def, source, ctx.cwd);
}

export interface SourceLocation {
	path: string;
	line: number;
}

// Recognizes a symbol written as path:line or rg's path:line:column, with or without a trailing colon.
export function parseLocation(symbol: string): SourceLocation | undefined {
	const match = /^(.+?):(\d+)(?::\d+)?:?$/.exec(symbol.trim());
	return match && isOutlinable(match[1]) ? { path: match[1], line: Number(match[2]) } : undefined;
}

export interface SourceRange {
	path: string;
	start: number;
	end: number;
}

// Recognizes a symbol written as path:A-B.
export function parseRange(symbol: string): SourceRange | undefined {
	const match = /^(.+?):(\d+)-(\d+):?$/.exec(symbol.trim());
	return match && isOutlinable(match[1]) ? { path: match[1], start: Number(match[2]), end: Number(match[3]) } : undefined;
}

// Recognizes a symbol written as path:Name, where Name may be qualified; splits at the first colon that ends a source file path and is not part of ::.
export function parseNamedSymbol(symbol: string): { path: string; name: string } | undefined {
	for (let i = symbol.indexOf(":"); i > 0; i = symbol.indexOf(":", i + 1)) {
		if (symbol[i + 1] === ":" || i + 1 >= symbol.length) continue;
		if (isOutlinable(symbol.slice(0, i))) return { path: symbol.slice(0, i), name: symbol.slice(i + 1) };
	}
	return undefined;
}

// The field-form call that replaces a symbol written as path:line, path:A-B, or path:Name; undefined for a plain name.
export function fieldFormCall(symbol: string): string | undefined {
	const range = parseRange(symbol);
	if (range) return toolCall("read_symbol", { path: range.path, line: range.start, end_line: range.end });
	const location = parseLocation(symbol);
	if (location) return toolCall("read_symbol", { path: location.path, line: location.line });
	const named = parseNamedSymbol(symbol);
	return named ? toolCall("read_symbol", { symbol: named.name, path: named.path }) : undefined;
}

export interface NeighborRange {
	before: number;
	after: number;
}

function neighborCount(value: number | undefined, name: string): number {
	if (value === undefined) return 0;
	if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer, got ${value}`);
	return value;
}

const sameDefinition = (a: Definition, b: Definition) => a.startByte === b.startByte && a.endByte === b.endByte;

// Wraps the rendered target text with the nearest function or class siblings on each side, in source order.
async function withNeighbors(
	targets: readonly Definition[],
	rendered: string[],
	fileDefs: readonly Definition[],
	full: boolean,
	range: NeighborRange,
	ctx: ToolContext,
	trailer: string[] = [],
): Promise<string[]> {
	if (range.before === 0 && range.after === 0) return [...rendered, ...trailer];
	const roots = buildTree(fileDefs);
	const before: string[] = [];
	const after: string[] = [];
	const notes = { before: undefined as string | undefined, after: undefined as string | undefined };
	const side = async (anchor: Definition, count: number, direction: "before" | "after") => {
		if (count === 0) return;
		const found = findSiblings(roots, anchor);
		if (!found) return;
		const index = found.nodes.findIndex((n) => sameDefinition(n.def, anchor));
		const ordered = direction === "after" ? found.nodes.slice(index + 1) : found.nodes.slice(0, index).reverse();
		const candidates = ordered.filter((n) => BODY_KINDS.has(n.def.kind) && !targets.some((t) => sameDefinition(t, n.def)));
		let edge = anchor;
		for (const node of candidates.slice(0, count)) {
			const text = await renderDefinition(node.def, full, ctx);
			if (direction === "before") before.unshift(text);
			else after.push(text);
			edge = node.def;
		}
		if (candidates.length < count) {
			const scope = found.parent ? qualifiedName(found.parent.def) : displayPath(anchor.file, ctx.cwd);
			notes[direction] = `[No more definitions ${direction} ${qualifiedName(edge)} in ${scope}.]`;
		}
	};
	await side(targets[0], range.before, "before");
	await side(targets[targets.length - 1], range.after, "after");
	return [...(notes.before ? [notes.before] : []), ...before, ...rendered, ...after, ...(notes.after ? [notes.after] : []), ...trailer];
}

// A definition read by line, ended by the next non-blank line unless after: N follows it.
async function readDefinitionAt(def: Definition, line: number, defs: readonly Definition[], full: boolean, range: NeighborRange, ctx: ToolContext): Promise<string> {
	const text = await renderDefinition(def, full, ctx);
	const rendered = range.after === 0 ? `${text}\n${formatNextLine(def, await readSource(def.file))}` : text;
	return (await withNeighbors([def], [rendered], defs, full, range, ctx)).join("\n\n");
}

async function readLocation(file: string, line: number, full: boolean, range: NeighborRange, ctx: ToolContext): Promise<string> {
	const { lineCount } = await readSource(file);
	const shown = displayPath(file, ctx.cwd);
	if (line > lineCount) throw new Error(`line ${line} is out of range; ${shown} has ${lineCount} lines`);
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	const def = definitionAt(defs, line);
	if (def) return readDefinitionAt(def, line, defs, full, range, ctx);
	const module = toolCall("read_symbol", { path: shown, module: true });
	const where = isMarkdown(file) ? "comes before the first heading" : "is not inside a function or class";
	return `${shown} line ${line} ${where}. Read module-level code with ${module}, or see the file's structure with ${toolCall("outline", { path: shown })}.`;
}

const overlaps = (def: Definition, start: number, end: number) => def.startLine <= end && def.endLine >= start;

export interface RangeTargets {
	// The definition read whole: the innermost one holding the range, when the range is inside its code or covers all of it.
	whole: Definition | undefined;
	// The functions, classes, or sections the range overlaps at its level.
	covered: Definition[];
}

// What a line range reads: a single definition, or the definitions it overlaps (none when it sits in module-level code).
export function rangeTargets(defs: readonly Definition[], start: number, end: number): RangeTargets {
	const bodies = defs.filter((d) => BODY_KINDS.has(d.kind));
	const tree = buildTree(bodies);
	const owner = bodies
		.filter((d) => d.startLine <= start && end <= d.endLine)
		.reduce<Definition | undefined>((best, d) => (!best || d.endByte - d.startByte < best.endByte - best.startByte ? d : best), undefined);
	const children = (owner ? findNode(tree, owner)?.children : tree) ?? [];
	const covered = children.filter((node) => overlaps(node.def, start, end)).map((node) => node.def);
	const coversOwner = owner !== undefined && start <= owner.nodeStartLine && end === owner.endLine;
	return { whole: owner && (covered.length === 0 || coversOwner) ? owner : undefined, covered };
}

// Everything a line range covers, widened to whole functions, classes, or sections. A range inside one
// definition's own code, or over all of it, reads that definition.
async function readRange(file: string, start: number, endLine: number, full: boolean, range: NeighborRange, ctx: ToolContext): Promise<string> {
	const source = await readSource(file);
	const shown = displayPath(file, ctx.cwd);
	if (start > endLine) throw new Error(`line ${start} is after end_line ${endLine}; ${shown} has ${source.lineCount} lines`);
	if (start > source.lineCount) throw new Error(`line ${start} is out of range; ${shown} has ${source.lineCount} lines`);
	// An end past the last line reads to the end of the file.
	const end = Math.min(endLine, source.lineCount);
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	const { whole, covered } = rangeTargets(defs, start, end);
	if (whole) return readDefinitionAt(whole, start, defs, full, range, ctx);
	if (covered.length === 0 && range.before + range.after > 0) throw new Error(`before and after need a function or class in the range; ${shown} lines ${start}-${end} have none`);
	const span = {
		start: Math.min(start, ...covered.map((def) => def.startLine)),
		end: Math.max(end, ...covered.map((def) => def.endLine)),
	};
	const footer = range.after === 0 ? formatNextLineAfter(span.end, source) : undefined;
	const text = formatRange(file, span, { start, end: endLine }, source, ctx.cwd, footer);
	return (await withNeighbors(covered, [text], defs, full, range, ctx)).join("\n\n");
}

export interface ReadSymbolParams {
	symbol?: string;
	path?: string;
	line?: number;
	end_line?: number;
	module?: boolean;
	full?: boolean;
	before?: number;
	after?: number;
}

function lineNumber(value: number, name: string): number {
	if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be an integer of at least 1, got ${value}`);
	return value;
}

// Files that line and module read: one supported source or Markdown file.
async function readableFile(path: string | undefined, field: string, ctx: ToolContext): Promise<string> {
	if (path === undefined || path === "") throw new Error(`${field} needs path, the file to read.`);
	const file = await resolvePath(path, ctx);
	if ((await stat(file)).isDirectory()) throw new Error(`${field} needs path to be a file; ${path} is a directory.`);
	if (!isOutlinable(file)) throw new Error(`${path} is not a Python, Java, C/C++, or Markdown file; supported extensions: ${OUTLINE_EXTENSIONS}`);
	return file;
}

export async function runReadSymbol(params: ReadSymbolParams, ctx: ToolContext): Promise<string> {
	const symbol = params.symbol?.trim() ? params.symbol : undefined;
	const colonForm = symbol === undefined ? undefined : fieldFormCall(symbol);
	if (colonForm) throw new Error(`symbol takes only a name. Use separate fields instead: ${colonForm}`);
	if (params.end_line !== undefined && params.line === undefined) throw new Error("end_line needs line, the first line of the range.");
	const modes = [symbol !== undefined ? "symbol" : undefined, params.line !== undefined ? "line" : undefined, params.module === true ? "module: true" : undefined].filter(
		(mode): mode is string => mode !== undefined,
	);
	if (modes.length === 0) {
		throw new Error(`read_symbol needs one of symbol (a name), line (with path), or module: true (with path), for example ${toolCall("read_symbol", { path: "a.py", line: 12 })}.`);
	}
	if (modes.length > 1) throw new Error(`Pass only one of symbol, line, or module: true; got ${modes.join(" and ")}.`);
	const range = { before: neighborCount(params.before, "before"), after: neighborCount(params.after, "after") };
	const full = params.full !== false;
	if (params.module === true) {
		if (params.full !== undefined || params.before !== undefined || params.after !== undefined) throw new Error("full, before, and after do not apply to module: true.");
		const file = await readableFile(params.path, "module", ctx);
		const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
		return formatModule(displayPath(file, ctx.cwd), defs, await readSource(file));
	}
	if (params.line !== undefined) {
		const line = lineNumber(params.line, "line");
		const endLine = params.end_line === undefined ? undefined : lineNumber(params.end_line, "end_line");
		const file = await readableFile(params.path, "line", ctx);
		return endLine === undefined ? readLocation(file, line, full, range, ctx) : readRange(file, line, endLine, full, range, ctx);
	}
	const name = symbol as string;
	const root = await resolvePath(params.path, ctx);
	const { defs, near } = await lookupSymbol(name, root, undefined, ctx);
	if (defs.length === 0) return formatNotFound(name, near, ctx.cwd);
	const choice = chooseDefinitions(defs);
	if (!choice) return formatCandidates(name, defs, ctx.cwd);
	const parts: string[] = [];
	for (const def of choice.render) parts.push(await renderDefinition(def, full, ctx));
	if (choice.render.length === 1 && range.after === 0) parts[0] += `\n${formatNextLine(choice.render[0], await readSource(choice.render[0].file))}`;
	const trailer =
		choice.declarations.length > 0 ? [choice.declarations.map((d) => `declared at ${displayPath(d.file, ctx.cwd)}:${d.nodeStartLine}`).join("\n")] : [];
	const fileDefs = range.before + range.after > 0 ? ((await fileDefinitions([choice.render[0].file], searchOptions(ctx, ctx.cwd))).get(choice.render[0].file) ?? []) : [];
	return (await withNeighbors(choice.render, parts, fileDefs, full, range, ctx, trailer)).join("\n\n");
}

export function syntacticLabel(sym: SymbolName, narrowed: boolean): string {
	return narrowed
		? `(syntactic: name matches in files that can see ${sym.qualifier.join(".")}; may include same-named members of other classes)`
		: "(syntactic: name matches; may include unrelated symbols with the same name)";
}

async function syntacticResult(
	symbol: string,
	sym: SymbolName,
	defs: readonly Definition[],
	options: SearchOptions,
	ctx: ToolContext,
	note?: string,
): Promise<string> {
	const { refs, narrowed } = await syntacticReferences(sym, defs, options);
	await describeReferences(refs, options);
	const missing =
		sym.qualifier.length > 0 && defs.length === 0 ? `Note: no definition of "${symbol}" found; showing every use of "${sym.name}".` : undefined;
	const notes = [missing, note].filter((n): n is string => n !== undefined).join("\n") || undefined;
	return formatReferences(symbol, syntacticLabel(sym, narrowed), refs, ctx.cwd, notes);
}

export interface PreciseBackend {
	references(lang: PreciseLang, file: string, line: number, character: number): Promise<PreciseResult>;
}

export function utf16Column(lineText: string, codePointColumn: number): number {
	return [...lineText].slice(0, codePointColumn).join("").length;
}

async function preciseReferences(
	defs: readonly Definition[],
	lsp: PreciseBackend,
): Promise<{ refs: Reference[]; server: string; warning: string | undefined } | { note: string }> {
	if (defs.length === 0) return { note: "Note: precise mode needs a definition and none was found; showing name matches." };
	if (defs.some((d) => d.lang === "c" || d.lang === "cpp")) return { note: "Note: precise mode is not available for C/C++; showing name matches." };
	const seen = new Set<string>();
	const refs: Reference[] = [];
	let server = "";
	let warning: string | undefined;
	for (const def of defs) {
		const source = await readSource(def.file);
		const character = utf16Column(source.lines[def.nameLine - 1] ?? "", def.nameColumn);
		const result = await lsp.references(def.lang as PreciseLang, def.file, def.nameLine - 1, character);
		if (result.status === "loading") return { note: `Note: precise index still loading (${result.server}); retry later. Showing name matches.` };
		if (result.status === "unavailable") return { note: `Note: precise mode unavailable: ${result.reason}. Showing name matches.` };
		server = result.server;
		warning ??= result.warning;
		for (const location of result.locations) {
			const key = `${location.file}:${location.line}:${location.character}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push({ file: location.file, line: location.line + 1, column: location.character, text: "", enclosing: undefined });
		}
	}
	return { refs: refs.sort(byLocation), server, warning };
}

export async function runFindReferences(
	params: { symbol: string; path?: string; precise?: boolean },
	ctx: ToolContext,
	lsp?: PreciseBackend,
): Promise<string> {
	const root = await resolvePath(params.path, ctx);
	if (await isMarkdownFile(root)) throw new Error("find_references does not support Markdown files; find text in them with search.");
	const sym = parseSymbolName(params.symbol);
	const options = searchOptions(ctx, root);
	const defs = await findDefinitions(sym, options);
	if (!params.precise) return syntacticResult(params.symbol, sym, defs, options, ctx);
	const precise = lsp ? await preciseReferences(defs, lsp) : { note: "Note: precise mode is unavailable here; showing name matches." };
	if ("note" in precise) return syntacticResult(params.symbol, sym, defs, options, ctx, precise.note);
	// An empty precise answer is often a project that did not import, so name matches are shown instead.
	if (precise.refs.length === 0) {
		const cause = precise.warning ? ` (${precise.warning})` : "";
		return syntacticResult(params.symbol, sym, defs, options, ctx, `Note: ${precise.server} found no references${cause}; showing name matches.`);
	}
	await describeReferences(precise.refs, options);
	const note = precise.warning ? `Note: ${precise.server} reported a problem, so results may be incomplete: ${precise.warning}.` : undefined;
	return formatReferences(params.symbol, `(precise: ${precise.server})`, precise.refs, ctx.cwd, note);
}
