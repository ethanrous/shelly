import { type Dirent, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";
import { EXTENSION_LANGS, SCAN_ENTRY_LIMIT, SCAN_SKIP_DIRS } from "./config.ts";
import { run } from "./proc.ts";
import type { Lang, Target } from "./types.ts";

export const expandHome = (path: string) => (path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);

export function realPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

export const langOf = (file: string): Lang | undefined => EXTENSION_LANGS[extname(file).toLowerCase()];

// Languages of the files under a directory, scanning a bounded number of entries.
function scanLangs(dir: string): Lang[] {
	const langs = new Set<Lang>();
	const queue = [dir];
	let seen = 0;
	for (let current = queue.shift(); current !== undefined && seen < SCAN_ENTRY_LIMIT; current = queue.shift()) {
		let entries: Dirent[];
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			seen++;
			if (entry.isDirectory()) {
				if (!SCAN_SKIP_DIRS.has(entry.name)) queue.push(join(current, entry.name));
			} else {
				const lang = langOf(entry.name);
				if (lang) langs.add(lang);
			}
		}
	}
	return [...langs];
}

export function resolveTargets(paths: string[], cwd: string): { targets: Target[]; missing: string[] } {
	const targets: Target[] = [];
	const missing: string[] = [];
	for (const raw of new Set(paths)) {
		const path = realPath(resolve(cwd, expandHome(raw)));
		if (!existsSync(path)) {
			missing.push(raw);
			continue;
		}
		if (statSync(path).isDirectory()) targets.push({ path, dir: true, langs: scanLangs(path) });
		else targets.push({ path, dir: false, langs: [langOf(path)].filter((lang): lang is Lang => lang !== undefined) });
	}
	return { targets, missing };
}

export type ChangedFiles = { files: string[] } | { error: string };

// Modified, added, and untracked files of the working tree, as absolute paths.
export async function changedFiles(cwd: string, signal?: AbortSignal): Promise<ChangedFiles> {
	try {
		const top = await run("git", ["rev-parse", "--show-toplevel"], { cwd, signal, timeoutMs: 10_000 });
		if (top.code !== 0) return { error: "not in a git repository" };
		const status = await run("git", ["status", "--porcelain", "-z", "-uall", "--no-renames"], { cwd, signal, timeoutMs: 30_000 });
		if (status.code !== 0) return { error: "git status failed" };
		const root = realPath(top.stdout.trim());
		const files: string[] = [];
		for (const entry of status.stdout.split("\0")) {
			if (entry.length < 4 || entry[0] === "D" || entry[1] === "D") continue;
			const file = join(root, entry.slice(3));
			if (existsSync(file) && statSync(file).isFile()) files.push(file);
		}
		return { files };
	} catch (error) {
		if ((error as Error).message === "aborted") throw error;
		return { error: "git is not available" };
	}
}

