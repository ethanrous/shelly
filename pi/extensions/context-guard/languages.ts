import { extname } from "node:path";

export type LangId = "python" | "java" | "c" | "cpp";
export type DefLang = LangId | "markdown";
export type KindLabel =
	| "class"
	| "interface"
	| "enum"
	| "record"
	| "struct"
	| "union"
	| "namespace"
	| "function"
	| "method"
	| "constructor"
	| "field"
	| "variable"
	| "type"
	| "macro"
	| "section";

export interface Language {
	id: LangId;
	sgLanguage: string;
	extensions: readonly string[];
	globs: readonly string[];
	qualifiedNames: boolean;
	referenceKinds: readonly string[];
}

export interface NameFilter {
	body: string;
	ignoreCase?: boolean;
}

type Rule = Record<string, unknown>;

export const CLASS_LIKE: ReadonlySet<KindLabel> = new Set<KindLabel>(["class", "interface", "enum", "record", "struct", "union"]);
export const SCOPE_KINDS: ReadonlySet<KindLabel> = new Set<KindLabel>([...CLASS_LIKE, "namespace", "function", "method", "constructor"]);

function language(id: LangId, extensions: string[], qualifiedNames: boolean, referenceKinds: string[]): Language {
	return { id, sgLanguage: id, extensions, globs: extensions.map((e) => `*${e}`), qualifiedNames, referenceKinds };
}

export const LANGUAGES: Readonly<Record<LangId, Language>> = {
	python: language("python", [".py", ".pyi"], false, ["identifier"]),
	java: language("java", [".java"], false, ["identifier", "type_identifier"]),
	c: language("c", [".c"], true, ["identifier", "field_identifier", "type_identifier"]),
	cpp: language("cpp", [".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"], true, [
		"identifier",
		"field_identifier",
		"type_identifier",
		"namespace_identifier",
	]),
};

export const ALL_LANGS: readonly LangId[] = ["python", "java", "c", "cpp"];
export const ALL_GLOBS: readonly string[] = ALL_LANGS.flatMap((id) => LANGUAGES[id].globs);
export const SUPPORTED_EXTENSIONS = ALL_LANGS.flatMap((id) => LANGUAGES[id].extensions).join(" ");

export function languageForFile(path: string): Language | undefined {
	const ext = extname(path).toLowerCase();
	return ALL_LANGS.map((id) => LANGUAGES[id]).find((lang) => lang.extensions.includes(ext));
}

export function isSupportedSource(path: string): boolean {
	return languageForFile(path) !== undefined;
}

export const MARKDOWN_EXTENSIONS: readonly string[] = [".md", ".markdown", ".mdx"];
export const MARKDOWN_GLOBS: readonly string[] = MARKDOWN_EXTENSIONS.map((e) => `*${e}`);
export const OUTLINE_EXTENSIONS = `${SUPPORTED_EXTENSIONS} ${MARKDOWN_EXTENSIONS.join(" ")}`;

export function isMarkdown(path: string): boolean {
	return MARKDOWN_EXTENSIONS.includes(extname(path).toLowerCase());
}

// Files that outline and read_symbol handle: supported code and Markdown.
export function isOutlinable(path: string): boolean {
	return isSupportedSource(path) || isMarkdown(path);
}

export function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nameRegexBody(name: string, isGlob: boolean): string {
	return isGlob ? name.split("*").map(escapeRegex).join("[\\w$~]*") : escapeRegex(name);
}

const all = (...rules: Rule[]): Rule => ({ all: rules });
const NAME: Rule = { has: { field: "name", pattern: "$NAME" } };
const BODY: Rule = { has: { field: "body", pattern: "$BODY" } };
const BODY_OPT: Rule = { any: [BODY, { not: { has: { field: "body", pattern: "$B2" } } }] };
const STOP_FN: Rule = { any: [{ kind: "compound_statement" }, { kind: "parameter_list" }] };
const FN_DECLARATOR: Rule = {
	has: { kind: "function_declarator", stopBy: STOP_FN, has: { field: "declarator", pattern: "$NAME" } },
};
const NOT_TEMPLATE: Rule = { not: { inside: { kind: "template_declaration" } } };
const NOT_IN_BODY: Rule = { not: { inside: { kind: "compound_statement", stopBy: "end" } } };

function javaRules(): Record<string, Rule> {
	const rules: Record<string, Rule> = {};
	for (const kind of [
		"class_declaration",
		"interface_declaration",
		"enum_declaration",
		"record_declaration",
		"annotation_type_declaration",
		"method_declaration",
		"constructor_declaration",
		"compact_constructor_declaration",
	]) {
		rules[kind] = all({ kind }, NAME, BODY_OPT);
	}
	rules.enum_constant = all({ kind: "enum_constant" }, NAME);
	for (const kind of ["field_declaration", "constant_declaration"]) {
		rules[kind] = all({ kind }, { has: { kind: "variable_declarator", has: { field: "name", pattern: "$NAME" } } });
	}
	return rules;
}

function pythonRules(): Record<string, Rule> {
	const rules: Record<string, Rule> = {};
	const definition = (kind: string) => all({ kind }, NAME, BODY_OPT);
	for (const kind of ["class_definition", "function_definition"]) {
		rules[kind] = all(definition(kind), { not: { inside: { kind: "decorated_definition" } } });
		rules[`decorated_${kind.split("_")[0]}`] = all(
			{ kind: "decorated_definition" },
			{ has: { field: "definition", ...definition(kind) } },
		);
	}
	rules.assignment = all(
		{ kind: "expression_statement" },
		{ any: [{ inside: { kind: "module" } }, { inside: { kind: "block", inside: { kind: "class_definition" } } }] },
		{ has: { kind: "assignment", has: { field: "left", kind: "identifier", pattern: "$NAME" } } },
	);
	return rules;
}

function cFamilyRules(cpp: boolean): Record<string, Rule> {
	const base: Record<string, Rule> = {};
	const typeKinds = ["struct_specifier", "union_specifier", "enum_specifier", ...(cpp ? ["class_specifier"] : [])];
	for (const kind of typeKinds) base[kind] = all({ kind }, NAME, BODY);
	base.function_definition = all({ kind: "function_definition" }, FN_DECLARATOR, BODY_OPT);
	base.function_declaration = all(
		{ any: [{ kind: "declaration" }, ...(cpp ? [{ kind: "field_declaration" }] : [])] },
		FN_DECLARATOR,
		NOT_IN_BODY,
	);
	base.type_definition = all({ kind: "type_definition" }, { has: { field: "declarator", pattern: "$NAME" } });
	if (cpp) {
		base.namespace_definition = all({ kind: "namespace_definition" }, NAME, BODY);
		base.alias_declaration = all({ kind: "alias_declaration" }, NAME);
		base.data_member = all(
			{ kind: "field_declaration" },
			{
				any: [
					{ has: { kind: "field_identifier", pattern: "$NAME" } },
					{
						has: {
							any: [{ kind: "pointer_declarator" }, { kind: "reference_declarator" }, { kind: "array_declarator" }],
							has: { kind: "field_identifier", pattern: "$NAME", stopBy: "end" },
						},
					},
				],
			},
			{ not: { has: { kind: "function_declarator", stopBy: STOP_FN } } },
		);
	} else {
		base.macro = all({ any: [{ kind: "preproc_def" }, { kind: "preproc_function_def" }] }, NAME);
	}
	const wrappable = new Set(["class_specifier", "struct_specifier", "union_specifier", "function_definition", "function_declaration", "alias_declaration"]);
	const rules: Record<string, Rule> = {};
	for (const [kind, rule] of Object.entries(base)) {
		if (cpp && wrappable.has(kind)) {
			rules[kind] = all(rule, NOT_TEMPLATE);
			rules[`template_${kind}`] = all({ kind: "template_declaration" }, { has: rule });
		} else {
			rules[kind] = rule;
		}
	}
	return rules;
}

const RULE_SETS: Readonly<Record<LangId, () => Record<string, Rule>>> = {
	python: pythonRules,
	java: javaRules,
	c: () => cFamilyRules(false),
	cpp: () => cFamilyRules(true),
};

function withNameRegex(rule: unknown, regex: string): unknown {
	if (Array.isArray(rule)) return rule.map((item) => withNameRegex(item, regex));
	if (rule && typeof rule === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(rule)) out[key] = withNameRegex(value, regex);
		if (out.pattern === "$NAME") out.regex = regex;
		return out;
	}
	return rule;
}

function anchoredName(lang: LangId, name: NameFilter): string {
	const flags = name.ignoreCase ? "(?i)" : "";
	return LANGUAGES[lang].qualifiedNames ? `${flags}(^|::)${name.body}$` : `${flags}^${name.body}$`;
}

export function definitionRules(langs: readonly LangId[], name?: NameFilter): string {
	const docs: string[] = [];
	for (const lang of langs) {
		for (const [kind, rule] of Object.entries(RULE_SETS[lang]())) {
			const filtered = name ? withNameRegex(rule, anchoredName(lang, name)) : rule;
			docs.push(JSON.stringify({ id: `${lang}/${kind}`, language: LANGUAGES[lang].sgLanguage, rule: filtered }));
		}
	}
	return docs.join("\n---\n");
}

export function referenceRules(langs: readonly LangId[], body: string): string {
	return langs
		.map((lang) =>
			JSON.stringify({
				id: `${lang}/ref`,
				language: LANGUAGES[lang].sgLanguage,
				rule: { any: LANGUAGES[lang].referenceKinds.map((kind) => ({ kind })), regex: `^${body}$` },
			}),
		)
		.join("\n---\n");
}

const RULE_KIND_LABELS: Readonly<Record<string, KindLabel>> = {
	class_declaration: "class",
	interface_declaration: "interface",
	enum_declaration: "enum",
	record_declaration: "record",
	annotation_type_declaration: "interface",
	method_declaration: "method",
	constructor_declaration: "constructor",
	compact_constructor_declaration: "constructor",
	enum_constant: "field",
	field_declaration: "field",
	constant_declaration: "field",
	class_definition: "class",
	decorated_class: "class",
	function_definition: "function",
	decorated_function: "function",
	assignment: "variable",
	class_specifier: "class",
	struct_specifier: "struct",
	union_specifier: "union",
	enum_specifier: "enum",
	namespace_definition: "namespace",
	function_declaration: "function",
	type_definition: "type",
	alias_declaration: "type",
	data_member: "field",
	macro: "macro",
};

export function ruleLang(ruleId: string): LangId {
	return ruleId.slice(0, ruleId.indexOf("/")) as LangId;
}

export function ruleKindLabel(ruleId: string): KindLabel {
	const kind = ruleId.slice(ruleId.indexOf("/") + 1).replace(/^template_/, "");
	return RULE_KIND_LABELS[kind] ?? "function";
}
