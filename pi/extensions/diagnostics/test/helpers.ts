import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const tempDir = (prefix = "diag-") => realpathSync(mkdtempSync(join(tmpdir(), prefix)));

export function write(path: string, content = ""): string {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
	return path;
}

// Writes an executable shell script that prints `stdout`, optionally `stderr`, and exits with `code`.
export function fakeBin(path: string, options: { stdout?: string; stderr?: string; code?: number; sleep?: number } = {}): string {
	const lines = ["#!/bin/sh"];
	if (options.sleep) lines.push(`exec sleep ${options.sleep}`);
	if (options.stdout) lines.push(`cat <<'__OUT__'\n${options.stdout}\n__OUT__`);
	if (options.stderr) lines.push(`cat >&2 <<'__ERR__'\n${options.stderr}\n__ERR__`);
	lines.push(`exit ${options.code ?? 0}`);
	write(path, `${lines.join("\n")}\n`);
	chmodSync(path, 0o755);
	return path;
}

export const NO_PATH = { PATH: "" } as NodeJS.ProcessEnv;

export const TY_SAMPLE = JSON.stringify([
	{
		check_name: "invalid-assignment",
		description: 'invalid-assignment: Object of type `Literal["a"]` is not assignable to `int`',
		severity: "major",
		fingerprint: "bc115e85e1a606c9",
		location: { path: "pkg/bad.py", positions: { begin: { line: 2, column: 10 }, end: { line: 2, column: 13 } } },
	},
	{
		check_name: "unused-ignore-comment",
		description: "unused-ignore-comment: Unused `ty: ignore` directive",
		severity: "minor",
		fingerprint: "2ad5274db782e07a",
		location: { path: "pkg/bad.py", positions: { begin: { line: 3, column: 1 }, end: { line: 3, column: 5 } } },
	},
]);

export const RUFF_SAMPLE = JSON.stringify([
	{
		cell: null,
		code: "F401",
		end_location: { column: 10, row: 1 },
		filename: "ROOT/pkg/bad.py",
		fix: null,
		location: { column: 8, row: 1 },
		message: "`os` imported but unused",
		name: "unused-import",
		noqa_row: 1,
		url: "https://docs.astral.sh/ruff/rules/unused-import",
	},
	{
		cell: null,
		code: null,
		end_location: { column: 6, row: 1 },
		filename: "ROOT/pkg/syn.py",
		fix: null,
		location: { column: 5, row: 1 },
		message: "Expected an identifier",
		name: "invalid-syntax",
		noqa_row: null,
		url: null,
	},
]);

export const TSC_SAMPLE = [
	"error TS5083: Cannot read file '/x/.nuxt/tsconfig.json'.",
	"services/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.",
	"components/b.vue(7,3): error TS2345: Argument of type 'A' is not assignable to parameter of type 'B'.",
	"  Types of property 'x' are incompatible.",
	"    Type 'string' is not assignable to type 'number'.",
	"services/c.ts(2,1): warning TS6133: 'c' is declared but never used.",
].join("\n");

export const ESLINT_SAMPLE = JSON.stringify([
	{
		filePath: "ROOT/services/a.ts",
		messages: [
			{ ruleId: "no-var", severity: 2, message: "Unexpected var, use let or const instead.", line: 2, column: 1, nodeType: "VariableDeclaration" },
			{ ruleId: null, severity: 2, fatal: true, message: "Parsing error: Unexpected token", line: 9, column: 4 },
			{ ruleId: "semi", severity: 1, message: "Missing semicolon.", line: 3, column: 2 },
		],
		suppressedMessages: [],
		errorCount: 2,
	},
]);

const span = (file: string, line: number, column: number, primary = true) => ({ file_name: file, line_start: line, column_start: column, is_primary: primary });
const cargoMessage = (level: string, code: string | null, message: string, spans: unknown[]) =>
	JSON.stringify({ reason: "compiler-message", manifest_path: "ROOT/Cargo.toml", message: { level, code: code ? { code } : null, message, spans } });

export const CARGO_SAMPLE = [
	cargoMessage("warning", "unused_variables", "unused variable: `unused`", [span("src/main.rs", 5, 27)]),
	cargoMessage("warning", "clippy::ptr_arg", "writing `&Vec` instead of `&[_]`", [span("src/lib.rs", 6, 16), span("src/lib.rs", 6, 1, false)]),
	cargoMessage("error", "E0308", "mismatched types", [span("src/main.rs", 7, 23)]),
	cargoMessage("error", null, "aborting due to 1 previous error", []),
	cargoMessage("warning", null, "2 warnings emitted", []),
	cargoMessage("failure-note", null, "For more information about this error, try `rustc --explain E0308`.", []),
	JSON.stringify({ reason: "build-finished", success: false }),
].join("\n");
