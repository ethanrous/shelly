import { displayPath, readLineCall } from "./format.ts";
import { isSupportedSource } from "./languages.ts";
import { rgSearch } from "./proc.ts";
import { enclosingName } from "./references.ts";
import { fileDefinitions } from "./symbols.ts";
import { resolvePath, searchOptions, type ToolContext } from "./tools.ts";

export interface SearchParams {
	pattern: string | readonly string[];
	path?: string | readonly string[];
	regex?: boolean;
	ignore_case?: boolean;
	glob?: string | readonly string[];
}

export interface SearchMatch {
	file: string;
	line: number;
	text: string;
	enclosing?: string;
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

const list = (value: string | readonly string[] | undefined): string[] => (value === undefined ? [] : typeof value === "string" ? [value] : [...value]).filter((v) => v !== "");

export function searchPatterns(pattern: SearchParams["pattern"]): string[] {
	const patterns = list(pattern);
	if (patterns.length === 0) throw new Error("pattern must be a non-empty string or a list of non-empty strings.");
	return patterns;
}

const byLocation = (a: SearchMatch, b: SearchMatch) => (a.file !== b.file ? (a.file < b.file ? -1 : 1) : a.line - b.line);

// Names the function or class around each match in a supported source file; matches elsewhere keep no name.
async function addEnclosing(matches: SearchMatch[], ctx: ToolContext): Promise<void> {
	const files = [...new Set(matches.map((m) => m.file).filter(isSupportedSource))];
	if (files.length === 0) return;
	const defs = await fileDefinitions(files, searchOptions(ctx, ctx.cwd)).catch(() => undefined);
	if (!defs) return;
	for (const match of matches) match.enclosing = enclosingName(defs.get(match.file) ?? [], match.line);
}

export interface SearchLabel {
	patterns: readonly string[];
	path?: string;
	modes: readonly string[];
}

export function formatSearch(label: SearchLabel, matches: readonly SearchMatch[], files: number, cwd: string): string {
	const quoted = label.patterns.map((p) => `"${p}"`).join(" or ");
	const modes = label.modes.length > 0 ? ` (${label.modes.join(", ")})` : "";
	if (matches.length === 0) return `No matches for ${quoted}${label.path ? ` in ${label.path}` : ""}${modes}.`;
	const head = `${plural(matches.length, "matching line")} for ${quoted} in ${plural(files, "file")}${modes}`;
	const lines = [head];
	let current = "";
	for (const match of matches) {
		if (match.file !== current) lines.push(displayPath(match.file, cwd));
		lines.push(`  ${match.line}${match.enclosing ? ` (in ${match.enclosing})` : ""}  ${match.text}`);
		current = match.file;
	}
	const named = matches.find((match) => match.enclosing);
	if (named) lines.push(`Read the function or class around a match with read_symbol and its file and line, for example ${readLineCall(displayPath(named.file, cwd), named.line)}.`);
	return lines.join("\n");
}

export async function runSearch(params: SearchParams, ctx: ToolContext): Promise<string> {
	const patterns = searchPatterns(params.pattern);
	const paths = list(params.path);
	const roots = [...new Set(await Promise.all(paths.length > 0 ? paths.map((p) => resolvePath(p, ctx)) : [resolvePath(undefined, ctx)]))];
	const globs = list(params.glob);
	const matches: SearchMatch[] = [];
	const files = new Set<string>();
	// Overlapping roots, such as src and src/app, report the same line once.
	const seen = new Set<string>();
	const search = { patterns, roots, regex: params.regex === true, ignoreCase: params.ignore_case === true, globs };
	await rgSearch(search, { cwd: ctx.cwd, signal: ctx.signal }, (file, line, text) => {
		const key = `${file}\0${line}`;
		if (seen.has(key)) return;
		seen.add(key);
		files.add(file);
		matches.push({ file, line, text: text.trim() });
	});
	matches.sort(byLocation);
	await addEnclosing(matches, ctx);
	const modes = [...(search.regex ? ["regex"] : []), ...(search.ignoreCase ? ["ignore case"] : []), ...(globs.length > 0 ? [`glob ${globs.join(" ")}`] : [])];
	return formatSearch({ patterns, path: paths.length > 0 ? paths.join(", ") : undefined, modes }, matches, files.size, ctx.cwd);
}
