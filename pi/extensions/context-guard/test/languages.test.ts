import { test } from "node:test";
import assert from "node:assert/strict";
import {
	ALL_LANGS,
	definitionRules,
	escapeRegex,
	isSupportedSource,
	languageForFile,
	nameRegexBody,
	referenceRules,
	ruleKindLabel,
	ruleLang,
} from "../languages.ts";

test("languageForFile maps extensions", () => {
	assert.equal(languageForFile("a/B.java")?.id, "java");
	assert.equal(languageForFile("x.pyi")?.id, "python");
	assert.equal(languageForFile("u.c")?.id, "c");
	assert.equal(languageForFile("g.h")?.id, "cpp");
	assert.equal(languageForFile("g.HPP")?.id, "cpp");
	assert.equal(languageForFile("README.md"), undefined);
	assert.equal(isSupportedSource("x.cc"), true);
	assert.equal(isSupportedSource("x.ts"), false);
});

test("nameRegexBody escapes and expands globs", () => {
	assert.equal(escapeRegex("a.b$c"), "a\\.b\\$c");
	assert.equal(nameRegexBody("getId", false), "getId");
	assert.equal(nameRegexBody("get*Id", true), "get[\\w$~]*Id");
	assert.equal(nameRegexBody("*Service", true), "[\\w$~]*Service");
});

test("definitionRules emits one JSON rule per kind", () => {
	const docs = definitionRules(ALL_LANGS).split("\n---\n").map((d) => JSON.parse(d));
	const ids = docs.map((d) => d.id);
	assert.equal(docs.length, 39);
	assert.ok(ids.includes("java/method_declaration"));
	assert.ok(ids.includes("python/decorated_function"));
	assert.ok(ids.includes("cpp/template_function_definition"));
	assert.ok(ids.includes("c/macro"));
	assert.ok(!JSON.stringify(docs).includes('"regex"'));
});

test("definitionRules with a name adds a regex next to every $NAME", () => {
	const text = definitionRules(["java", "cpp"], { body: "area" });
	const docs = text.split("\n---\n").map((d) => JSON.parse(d));
	const names = (v: unknown, out: unknown[] = []): unknown[] => {
		if (Array.isArray(v)) for (const x of v) names(x, out);
		else if (v && typeof v === "object") {
			if ((v as Record<string, unknown>).pattern === "$NAME") out.push(v);
			for (const x of Object.values(v)) names(x, out);
		}
		return out;
	};
	for (const doc of docs) {
		for (const node of names(doc.rule) as Record<string, unknown>[]) {
			assert.equal(node.regex, doc.language === "cpp" ? "(^|::)area$" : "^area$", doc.id);
		}
	}
	const ci = JSON.parse(definitionRules(["python"], { body: "x", ignoreCase: true }).split("\n---\n")[0]);
	assert.match(JSON.stringify(ci), /"\(\?i\)\^x\$"/);
});

test("referenceRules uses the language's identifier kinds", () => {
	const docs = referenceRules(["java", "cpp"], "area").split("\n---\n").map((d) => JSON.parse(d));
	assert.deepEqual(docs[0], { id: "java/ref", language: "java", rule: { any: [{ kind: "identifier" }, { kind: "type_identifier" }], regex: "^area$" } });
	assert.deepEqual(docs[1].rule.any.map((k: { kind: string }) => k.kind), ["identifier", "field_identifier", "type_identifier", "namespace_identifier"]);
});

test("ruleLang and ruleKindLabel", () => {
	assert.equal(ruleLang("cpp/template_function_definition"), "cpp");
	assert.equal(ruleKindLabel("cpp/template_function_definition"), "function");
	assert.equal(ruleKindLabel("java/annotation_type_declaration"), "interface");
	assert.equal(ruleKindLabel("python/decorated_class"), "class");
	assert.equal(ruleKindLabel("cpp/data_member"), "field");
	assert.equal(ruleKindLabel("c/macro"), "macro");
});
