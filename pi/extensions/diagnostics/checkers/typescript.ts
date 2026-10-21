import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ESLINT_CONFIGS, TSC_CONFIG_ERRORS } from "../config.ts";
import { flatten, type Parsed, toolJob } from "../job.ts";
import { ancestors, findLocal, findUp, gitRoot, resolveBinary } from "../resolve.ts";
import type { Diagnostic, Job, Severity, Target } from "../types.ts";
import { groupByRoot, paths } from "./common.ts";

const LOCAL_DIR = "node_modules/.bin";
const TSC_LINE = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;
const TSC_GLOBAL = /^(error|warning) (TS\d+): (.*)$/;

export function parseTsc(output: string, root: string, code: number | null): Parsed {
	const diagnostics: Diagnostic[] = [];
	const globals: string[] = [];
	let last: { message: string } | undefined;
	let configFailure: string | undefined;
	for (const line of output.split("\n")) {
		if (/^\s/.test(line) && last) {
			last.message += ` ${line.trim()}`;
			continue;
		}
		const match = TSC_LINE.exec(line);
		if (match) {
			const [, file, row, column, level, id, message] = match;
			const diagnostic: Diagnostic = { file: resolve(root, file), line: Number(row), column: Number(column), severity: level as Severity, code: id, message };
			if (TSC_CONFIG_ERRORS.has(id) && /^tsconfig.*\.json$/.test(basename(file))) configFailure ??= `${file}: ${id} ${message}`;
			diagnostics.push(diagnostic);
			last = diagnostic;
			continue;
		}
		const global = TSC_GLOBAL.exec(line);
		last = undefined;
		if (!global) continue;
		globals.push(`${global[2]} ${global[3]}`);
		if (TSC_CONFIG_ERRORS.has(global[2])) configFailure ??= `${global[2]} ${global[3]}`;
	}
	if (configFailure) return { failed: flatten(configFailure) };
	if (code === 0 || diagnostics.length > 0) return diagnostics;
	return { failed: globals[0] ? flatten(globals[0]) : "" };
}

interface EslintFile {
	filePath: string;
	messages: Array<{ ruleId?: string | null; severity?: number; message?: string; line?: number; column?: number; fatal?: boolean }>;
}

export function parseEslint(stdout: string): Parsed {
	let files: EslintFile[];
	try {
		files = JSON.parse(stdout);
		if (!Array.isArray(files)) throw new Error("not an array");
	} catch {
		return { failed: "" };
	}
	return files.flatMap((file) =>
		file.messages.map((m): Diagnostic => ({
			file: file.filePath,
			line: m.line ?? 0,
			column: m.column ?? 0,
			severity: m.fatal || m.severity === 2 ? "error" : "warning",
			code: m.ruleId ?? "",
			message: m.message ?? "",
		})),
	);
}

function eslintDir(start: string): string | undefined {
	const pkg = findUp(start, ["package.json"]);
	if (!pkg) return undefined;
	return ancestors(start, pkg).find((dir) => ESLINT_CONFIGS.some((name) => existsSync(join(dir, name))));
}

export function planTypescript(targets: Target[], env: NodeJS.ProcessEnv): Job[] {
	const options = { localDir: LOCAL_DIR, env };
	const jobs: Job[] = [];
	for (const [root, group] of groupByRoot(targets, "ts", (dir) => findUp(dir, ["tsconfig.json"]))) {
		const covers = paths(group);
		const vue = findLocal("vue-tsc", root, LOCAL_DIR);
		const label = vue ? "vue-tsc" : "tsc";
		const bin = vue ? { path: vue } : resolveBinary("tsc", root, options);
		const args = vue ? ["--noEmit", "-p", "tsconfig.json"] : ["--noEmit", "--pretty", "false", "-p", "tsconfig.json"];
		jobs.push(toolJob({ label, root, covers, bin, cwd: root, args, parse: (r) => parseTsc(r.stdout || r.stderr, root, r.code) }));
	}
	for (const [dir, group] of groupByRoot(targets, "ts", eslintDir)) {
		const bin = findLocal("eslint", dir, LOCAL_DIR);
		if (!bin) continue;
		const covers = paths(group);
		const args = ["--format", "json", "--no-error-on-unmatched-pattern", ...covers];
		jobs.push(toolJob({ label: "eslint", root: dir, covers, bin: { path: bin }, cwd: dir, args, parse: (r) => (r.code === 0 || r.code === 1 ? parseEslint(r.stdout) : { failed: "" }) }));
	}
	return jobs;
}
