import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { NEAR_MATCH_LIMIT } from "./config.ts";
import {
	buildTree,
	displayPath,
	findNode,
	formatCandidates,
	formatDefinitions,
	formatNotFound,
	formatOutline,
	formatOversize,
	formatReferences,
	formatSkeleton,
	formatSource,
	qualifiedName,
	type TreeNode,
} from "./format.ts";
import { CLASS_LIKE, isSupportedSource, languageForFile, SUPPORTED_EXTENSIONS } from "./languages.ts";
import type { PreciseLang, PreciseResult } from "./lsp/manager.ts";
import { exceedsCap, expandHome, measure, type TextSize } from "./output-cap.ts";
import { byLocation, describeReferences, type Reference, syntacticReferences } from "./references.ts";
import {
	type Definition,
	definitionAt,
	type FileSource,
	fileDefinitions,
	findDefinitions,
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
const defSize = (def: Definition): TextSize => ({ bytes: def.endByte - def.startByte, lines: def.endLine - def.startLine + 1 });

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
	return defs.slice(0, NEAR_MATCH_LIMIT);
}

export async function runFindSymbol(params: { name: string; path?: string; kind?: string }, ctx: ToolContext): Promise<string> {
	const sym = parseSymbolName(params.name);
	const root = await resolvePath(params.path, ctx);
	const defs = await findDefinitions(sym, searchOptions(ctx, root, { kind: params.kind }));
	if (defs.length === 0) return formatNotFound(params.name, await nearMatches(sym.name, root, ctx), ctx.cwd);
	return formatDefinitions(params.name, defs, ctx.cwd);
}

export async function outlineText(file: string, ctx: ToolContext, shownPath = displayPath(file, ctx.cwd)): Promise<string> {
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	return formatOutline(defs, shownPath, (await readSource(file)).lineCount);
}

// Outline shown in place of a long source file; undefined when the file has no symbols to show.
export async function outlineForRead(file: string, ctx: ToolContext, shownPath: string): Promise<string | undefined> {
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	if (defs.length === 0) return undefined;
	return formatOutline(defs, shownPath, (await readSource(file)).lineCount);
}

export async function runOutline(params: { path: string }, ctx: ToolContext): Promise<string> {
	const file = await resolvePath(params.path, ctx);
	if ((await stat(file)).isDirectory() || !languageForFile(file)) {
		throw new Error(`${params.path} is not a Python, Java, or C/C++ file; supported extensions: ${SUPPORTED_EXTENSIONS}`);
	}
	return outlineText(file, ctx);
}

// Picks what read_symbol renders: one definition, a class with its own constructors, a C/C++ body with
// its declarations, or same-file overloads that fit under the cap. Anything else is ambiguous.
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
	if (defs.every((d) => d.file === defs[0].file)) {
		const total = defs.reduce((sum, d) => ({ bytes: sum.bytes + defSize(d).bytes, lines: sum.lines + defSize(d).lines }), { bytes: 0, lines: 0 });
		if (!exceedsCap(total)) return { render: [...defs], declarations: [] };
	}
	return undefined;
}

async function nestedNodes(def: Definition, ctx: ToolContext): Promise<TreeNode[]> {
	const defs = (await fileDefinitions([def.file], searchOptions(ctx, ctx.cwd))).get(def.file) ?? [];
	return findNode(buildTree(defs), def)?.children ?? [];
}

async function skeleton(def: Definition, source: FileSource, ctx: ToolContext, note?: string): Promise<string> {
	const members = (await nestedNodes(def, ctx)).map((node) => node.def);
	return formatSkeleton(def, members, source, ctx.cwd, note);
}

async function renderDefinition(def: Definition, full: boolean, ctx: ToolContext): Promise<string> {
	const source = await readSource(def.file);
	if (isContainer(def) && !full) return skeleton(def, source, ctx);
	const text = formatSource(def, source, ctx.cwd);
	if (!exceedsCap(measure(text))) return text;
	const lines = (def.endLine - def.startLine + 1).toLocaleString("en-US");
	const path = displayPath(def.file, ctx.cwd);
	const name = qualifiedName(def);
	if (isContainer(def)) {
		return skeleton(def, source, ctx, `[${name} is ${lines} lines; too large to return whole. Read members with read_symbol, or search ${path} with rg.]`);
	}
	const note = `[${name} is ${lines} lines; too large to return whole. Search ${path} with rg -n '<pattern>', or read a range with offset/limit.]`;
	return formatOversize(def, await nestedNodes(def, ctx), ctx.cwd, note);
}

export interface SourceLocation {
	path: string;
	line: number;
}

// Accepts path:line and rg's path:line:column, with or without a trailing colon; anything else is a symbol name.
export function parseLocation(symbol: string): SourceLocation | undefined {
	const match = /^(.+?):(\d+)(?::\d+)?:?$/.exec(symbol.trim());
	return match && isSupportedSource(match[1]) ? { path: match[1], line: Number(match[2]) } : undefined;
}

// A location is relative to the working directory, or to path when it is not found there.
async function locationFile(location: SourceLocation, base: string | undefined, ctx: ToolContext): Promise<string> {
	try {
		return await resolvePath(location.path, ctx);
	} catch (error) {
		if (base === undefined) throw error;
		return resolvePath(location.path, { ...ctx, cwd: await resolvePath(base, ctx) });
	}
}

async function readLocation(location: SourceLocation, base: string | undefined, full: boolean, ctx: ToolContext): Promise<string> {
	const file = await locationFile(location, base, ctx);
	const { lineCount } = await readSource(file);
	const shown = displayPath(file, ctx.cwd);
	if (location.line < 1 || location.line > lineCount) throw new Error(`${shown}:${location.line} is out of range; the file has ${lineCount} lines`);
	const defs = (await fileDefinitions([file], searchOptions(ctx, ctx.cwd))).get(file) ?? [];
	const def = definitionAt(defs, location.line);
	if (def) return renderDefinition(def, full, ctx);
	return `${shown}:${location.line} is not inside a function or class. Read it with read and offset/limit, or see the file's structure with outline.`;
}

export async function runReadSymbol(params: { symbol: string; path?: string; full?: boolean }, ctx: ToolContext): Promise<string> {
	const location = parseLocation(params.symbol);
	if (location) return readLocation(location, params.path, params.full === true, ctx);
	const sym = parseSymbolName(params.symbol);
	const root = await resolvePath(params.path, ctx);
	const defs = await findDefinitions(sym, searchOptions(ctx, root));
	if (defs.length === 0) return formatNotFound(params.symbol, await nearMatches(sym.name, root, ctx), ctx.cwd);
	const choice = chooseDefinitions(defs);
	if (!choice) return formatCandidates(params.symbol, defs, ctx.cwd);
	const parts: string[] = [];
	for (const def of choice.render) parts.push(await renderDefinition(def, params.full === true, ctx));
	if (choice.declarations.length > 0) {
		parts.push(choice.declarations.map((d) => `declared at ${displayPath(d.file, ctx.cwd)}:${d.nodeStartLine}`).join("\n"));
	}
	return parts.join("\n\n");
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

const MAX_PRECISE_DEFINITIONS = 5;

export function utf16Column(lineText: string, codePointColumn: number): number {
	return [...lineText].slice(0, codePointColumn).join("").length;
}

async function preciseReferences(
	defs: readonly Definition[],
	lsp: PreciseBackend,
): Promise<{ refs: Reference[]; server: string; warning: string | undefined } | { note: string }> {
	if (defs.length === 0) return { note: "Note: precise mode needs a definition and none was found; showing name matches." };
	if (defs.some((d) => d.lang === "c" || d.lang === "cpp")) return { note: "Note: precise mode is not available for C/C++; showing name matches." };
	if (defs.length > MAX_PRECISE_DEFINITIONS) {
		return {
			note: `Note: precise mode needs at most ${MAX_PRECISE_DEFINITIONS} definitions and found ${defs.length}; pass path or a qualified name. Showing name matches.`,
		};
	}
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
	const sym = parseSymbolName(params.symbol);
	const options = searchOptions(ctx, await resolvePath(params.path, ctx));
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
