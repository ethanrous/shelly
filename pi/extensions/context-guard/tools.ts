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
	formatSkeleton,
	formatSource,
	qualifiedName,
	type TreeNode,
} from "./format.ts";
import { CLASS_LIKE, languageForFile, SUPPORTED_EXTENSIONS } from "./languages.ts";
import { exceedsCap, expandHome, measure, type TextSize } from "./output-cap.ts";
import {
	type Definition,
	type FileSource,
	fileDefinitions,
	findDefinitions,
	parseSymbolName,
	readSource,
	type SearchOptions,
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

export async function runReadSymbol(params: { symbol: string; path?: string; full?: boolean }, ctx: ToolContext): Promise<string> {
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
