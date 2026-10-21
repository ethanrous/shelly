import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { PYTHON_ROOT_MARKERS } from "../config.ts";
import { type Parsed, toolJob } from "../job.ts";
import { ancestors, findLocal, findUp, gitRoot, resolveBinary } from "../resolve.ts";
import type { Diagnostic, Job, Severity, Target } from "../types.ts";
import { groupByRoot, paths } from "./common.ts";

const LOCAL_DIR = ".venv/bin";
type Checker = "ty" | "ruff";
const TABLES: Record<Checker, RegExp> = { ty: /^\s*\[tool\.ty[\].]/m, ruff: /^\s*\[tool\.ruff[\].]/m };

function declares(dir: string, name: Checker): boolean {
	if (existsSync(join(dir, `${name}.toml`)) || (name === "ruff" && existsSync(join(dir, ".ruff.toml")))) return true;
	try {
		return TABLES[name].test(readFileSync(join(dir, "pyproject.toml"), "utf8"));
	} catch {
		return false;
	}
}

// The nearest ancestor that configures the checker, such as a uv workspace root above a member, else the nearest project with the checker in a local .venv.
function checkerRoot(dir: string, name: Checker): string | undefined {
	const configured = ancestors(dir, gitRoot(dir)).find((candidate) => declares(candidate, name));
	if (configured) return configured;
	const project = findUp(dir, PYTHON_ROOT_MARKERS);
	return project && findLocal(name, project, LOCAL_DIR) ? project : undefined;
}

const tySeverity = (value: string): Severity => (value === "minor" ? "warning" : value === "info" ? "info" : "error");

interface TyEntry {
	description?: string;
	check_name?: string;
	severity?: string;
	location?: { path?: string; positions?: { begin?: { line?: number; column?: number } } };
}

export function parseTy(stdout: string, root: string): Parsed {
	let entries: TyEntry[];
	try {
		entries = JSON.parse(stdout);
		if (!Array.isArray(entries)) throw new Error("not an array");
	} catch {
		return { failed: "" };
	}
	return entries.map((entry): Diagnostic => {
		const code = entry.check_name ?? "";
		const description = entry.description ?? "";
		const path = entry.location?.path ?? "";
		return {
			file: isAbsolute(path) ? path : resolve(root, path),
			line: entry.location?.positions?.begin?.line ?? 0,
			column: entry.location?.positions?.begin?.column ?? 0,
			severity: tySeverity(entry.severity ?? "major"),
			code,
			message: code && description.startsWith(`${code}: `) ? description.slice(code.length + 2) : description,
		};
	});
}

interface RuffEntry {
	code?: string | null;
	message?: string;
	filename?: string;
	location?: { row?: number; column?: number };
}

export function parseRuff(stdout: string): Parsed {
	let entries: RuffEntry[];
	try {
		entries = JSON.parse(stdout);
		if (!Array.isArray(entries)) throw new Error("not an array");
	} catch {
		return { failed: "" };
	}
	return entries.map((entry) => ({
		file: entry.filename ?? "",
		line: entry.location?.row ?? 0,
		column: entry.location?.column ?? 0,
		severity: "error" as const,
		code: entry.code ?? "",
		message: entry.message ?? "",
	}));
}

export function planPython(targets: Target[], env: NodeJS.ProcessEnv): Job[] {
	const options = { localDir: LOCAL_DIR, envDirs: env.VIRTUAL_ENV ? [join(env.VIRTUAL_ENV, "bin")] : [], env };
	const jobs: Job[] = [];
	for (const [root, group] of groupByRoot(targets, "python", (dir) => checkerRoot(dir, "ty"))) {
		const covers = paths(group);
		jobs.push(toolJob({ label: "ty", root, covers, bin: resolveBinary("ty", root, options), cwd: root, args: ["check", "--output-format", "gitlab", ...covers], parse: (r) => (r.code === 0 || r.code === 1 ? parseTy(r.stdout, root) : { failed: "" }) }));
	}
	for (const [root, group] of groupByRoot(targets, "python", (dir) => checkerRoot(dir, "ruff"))) {
		const covers = paths(group);
		jobs.push(toolJob({ label: "ruff", root, covers, bin: resolveBinary("ruff", root, options), cwd: root, args: ["check", "--output-format", "json", "--no-fix", ...covers], parse: (r) => (r.code === 0 || r.code === 1 ? parseRuff(r.stdout) : { failed: "" }) }));
	}
	return jobs;
}
