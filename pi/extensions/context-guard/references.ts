import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { REFERENCES_LIMIT, SIGNATURE_MAX_CHARS } from "./config.ts";
import { ALL_LANGS, definitionRules, escapeRegex, nameRegexBody, referenceRules, SCOPE_KINDS } from "./languages.ts";
import { sgScan } from "./proc.ts";
import {
	candidateFiles,
	type Definition,
	definitionSite,
	type FileSource,
	fileDefinitions,
	javaPackage,
	readSource,
	type SearchOptions,
	type SymbolName,
} from "./symbols.ts";

export interface Reference {
	file: string;
	line: number;
	column: number;
	text: string;
	enclosing: string | undefined;
}

export type FileTest = (file: string, text: string) => boolean;

const HEADER_EXTENSIONS = new Set([".h", ".hh", ".hpp", ".hxx"]);

function javaTest(def: Definition): FileTest {
	const pkg = def.scope.join(".");
	const top = def.container[0] ?? def.name;
	const inherits = new RegExp(`\\b(?:extends|implements)\\b[^{;]*\\b${escapeRegex(top)}\\b`);
	const qualified = pkg ? new RegExp(`\\b${escapeRegex(`${pkg}.${top}`)}\\b`) : undefined;
	const wildcard = pkg ? new RegExp(`^[ \\t]*import[ \\t]+${escapeRegex(pkg)}\\.\\*[ \\t]*;`, "m") : undefined;
	return (_file, text) =>
		javaPackage(text).join(".") === pkg || (qualified?.test(text) ?? false) || (wildcard?.test(text) ?? false) || inherits.test(text);
}

function pythonTest(def: Definition): FileTest | undefined {
	const module = def.scope[def.scope.length - 1];
	if (!module) return undefined;
	const m = escapeRegex(module);
	const pattern = new RegExp(
		`^[ \\t]*(?:from[ \\t]+[\\w.]*\\b${m}\\b[\\w.]*[ \\t]+import\\b|from[ \\t]+[\\w.]+[ \\t]+import[ \\t]*\\([^)]*\\b${m}\\b|from[ \\t]+[\\w.]+[ \\t]+import[ \\t]+[^#\\n]*\\b${m}\\b|import[ \\t]+[^#\\n]*\\b${m}\\b)`,
		"m",
	);
	return (_file, text) => pattern.test(text);
}

function cFamilyTest(defs: readonly Definition[]): FileTest | undefined {
	const headers = [...new Set(defs.filter((d) => HEADER_EXTENSIONS.has(extname(d.file).toLowerCase())).map((d) => basename(d.file)))];
	if (headers.length === 0) return undefined;
	const stems = new Set(headers.map((h) => basename(h, extname(h))));
	const include = new RegExp(`^[ \\t]*#[ \\t]*include[ \\t]*[<"](?:[^>"\\n]*/)?(?:${headers.map(escapeRegex).join("|")})[>"]`, "m");
	return (file, text) => include.test(text) || stems.has(basename(file, extname(file)));
}

export function narrowingTest(defs: readonly Definition[]): FileTest | undefined {
	const tests: FileTest[] = [];
	const cDefs = defs.filter((d) => d.lang === "c" || d.lang === "cpp");
	if (cDefs.length > 0) {
		const test = cFamilyTest(cDefs);
		if (!test) return undefined;
		tests.push(test);
	}
	for (const def of defs) {
		if (def.lang === "java") tests.push(javaTest(def));
		if (def.lang === "python") {
			const test = pythonTest(def);
			if (!test) return undefined;
			tests.push(test);
		}
	}
	return tests.length > 0 ? (file, text) => tests.some((test) => test(file, text)) : undefined;
}

export async function narrowFiles(defs: readonly Definition[], files: readonly string[]): Promise<{ files: string[]; applied: boolean }> {
	const test = narrowingTest(defs);
	if (!test) return { files: [...files], applied: false };
	const defFiles = new Set(defs.map((d) => d.file));
	const kept: string[] = [];
	for (const file of files) {
		if (defFiles.has(file) || test(file, await readFile(file, "utf8"))) kept.push(file);
	}
	return { files: kept, applied: true };
}

export function byLocation(a: Reference, b: Reference): number {
	if (a.file !== b.file) return a.file < b.file ? -1 : 1;
	return a.line - b.line || a.column - b.column;
}

export async function syntacticReferences(
	sym: SymbolName,
	defs: readonly Definition[],
	options: SearchOptions,
): Promise<{ refs: Reference[]; narrowed: boolean }> {
	const body = nameRegexBody(sym.name, sym.isGlob);
	let files = await candidateFiles(body, options);
	let narrowed = false;
	if (sym.qualifier.length > 0 && defs.length > 0) {
		const result = await narrowFiles(defs, files);
		files = result.files;
		narrowed = result.applied;
	}
	// Every definition of the name is a declaration, not a use, including other classes' same-named members.
	const [matches, declared] = await Promise.all([
		sgScan(referenceRules(ALL_LANGS, body), files, options),
		sgScan(definitionRules(ALL_LANGS, { body }), files, options),
	]);
	const sites = new Set(declared.map(definitionSite));
	const refs = matches
		.filter((m) => !sites.has(`${m.file}:${m.start.line + 1}:${m.start.column}`))
		.map((m): Reference => ({ file: m.file, line: m.start.line + 1, column: m.start.column, text: "", enclosing: undefined }))
		.sort(byLocation)
		.filter((ref, i, all) => i === 0 || ref.file !== all[i - 1].file || ref.line !== all[i - 1].line);
	return { refs, narrowed };
}

export function enclosingName(defs: readonly Definition[], line: number): string | undefined {
	let best: Definition | undefined;
	for (const def of defs) {
		if (!SCOPE_KINDS.has(def.kind) || def.nodeStartLine > line || def.endLine < line) continue;
		if (!best || def.endByte - def.startByte < best.endByte - best.startByte) best = def;
	}
	if (!best) return undefined;
	const parent = best.container[best.container.length - 1];
	return parent ? `${parent}.${best.name}` : best.name;
}

export async function describeReferences(refs: Reference[], options: SearchOptions): Promise<void> {
	const shown = refs.slice(0, REFERENCES_LIMIT);
	const defsByFile = await fileDefinitions([...new Set(shown.map((r) => r.file))], options);
	const sources = new Map<string, FileSource>();
	for (const ref of shown) {
		let source = sources.get(ref.file);
		if (!source) {
			source = await readSource(ref.file);
			sources.set(ref.file, source);
		}
		const text = (source.lines[ref.line - 1] ?? "").trim();
		ref.text = text.length > SIGNATURE_MAX_CHARS ? `${text.slice(0, SIGNATURE_MAX_CHARS - 3)}...` : text;
		ref.enclosing = enclosingName(defsByFile.get(ref.file) ?? [], ref.line);
	}
}
