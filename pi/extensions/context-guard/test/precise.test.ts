import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PreciseLang, PreciseResult } from "../lsp/manager.ts";
import { runFindReferences, utf16Column } from "../tools.ts";

const FIX = fileURLToPath(new URL("./fixtures", import.meta.url));
const ctx = { cwd: FIX };
const CALLER = join(FIX, "java", "com", "client", "Caller.java");

function backend(result: PreciseResult) {
	const calls: { lang: PreciseLang; file: string; line: number; character: number }[] = [];
	return {
		calls,
		async references(lang: PreciseLang, file: string, line: number, character: number): Promise<PreciseResult> {
			calls.push({ lang, file, line, character });
			return result;
		},
	};
}

test("utf16Column converts code points to UTF-16 units", () => {
	assert.equal(utf16Column("abc", 2), 2);
	assert.equal(utf16Column("é😀x", 2), 3);
	assert.equal(utf16Column("😀😀x", 2), 4);
});

test("precise references query each definition's name and merge duplicate locations", async () => {
	const lsp = backend({ status: "ok", server: "fake", locations: [{ file: CALLER, line: 9, character: 24 }] });
	assert.equal(
		await runFindReferences({ symbol: "DocumentService.getDocumentId", precise: true }, ctx, lsp),
		['1 reference to "DocumentService.getDocumentId" (precise: fake)', "java/com/client/Caller.java", "  10 (in Caller.run)  String id = svc.getDocumentId(req);"].join("\n"),
	);
	assert.deepEqual(
		lsp.calls.map((c) => [c.lang, c.file.slice(FIX.length + 1), c.line, c.character]),
		[
			["java", "java/com/ex/DocumentService.java", 17, 18],
			["java", "java/com/ex/DocumentService.java", 23, 18],
		],
	);
});

test("a loading server falls back to syntactic results with a note", async () => {
	const lines = (await runFindReferences({ symbol: "DocumentService.getDocumentId", precise: true }, ctx, backend({ status: "loading", server: "jdtls" }))).split("\n");
	assert.match(lines[0], /^2 references to "DocumentService.getDocumentId" \(syntactic: /);
	assert.equal(lines[1], "Note: precise index still loading (jdtls); retry later. Showing name matches.");
});

test("an unavailable server falls back with its reason", async () => {
	const text = await runFindReferences(
		{ symbol: "DocumentService.getDocumentId", precise: true },
		ctx,
		backend({ status: "unavailable", reason: "no jdtls found on PATH or in /x" }),
	);
	assert.equal(text.split("\n")[1], "Note: precise mode unavailable: no jdtls found on PATH or in /x. Showing name matches.");
});

test("C/C++ precise requests fall back without calling the server", async () => {
	const lsp = backend({ status: "ok", server: "fake", locations: [] });
	const text = await runFindReferences({ symbol: "Shape.area", precise: true }, ctx, lsp);
	assert.equal(text.split("\n")[1], "Note: precise mode is not available for C/C++; showing name matches.");
	assert.equal(lsp.calls.length, 0);
});

test("precise without a backend, or without a definition, falls back", async () => {
	const noBackend = await runFindReferences({ symbol: "DocumentService.getDocumentId", precise: true }, ctx);
	assert.equal(noBackend.split("\n")[1], "Note: precise mode is unavailable here; showing name matches.");
	const noDef = await runFindReferences({ symbol: "missingThing", precise: true }, ctx, backend({ status: "ok", server: "fake", locations: [] }));
	assert.match(noDef, /Note: precise mode needs a definition and none was found; showing name matches\./);
});
