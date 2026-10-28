/**
 * Injects glob-gated instruction files into the system prompt when the session
 * writes matching files.
 *
 * pi's stock loader only recognizes fixed filenames (AGENTS.md, CLAUDE.md) and never
 * parses frontmatter, so markdown files kept under a project's .github/instructions/
 * tree with an `applyTo:` directive are ignored. This reads a global root
 * (~/.pi/agent/instructions) plus the .github/instructions of cwd, of every ancestor of
 * cwd, and of every ancestor of each written file, so a write in a worktree outside cwd
 * picks up that worktree's files. A file's `applyTo` globs are relative to the directory
 * holding its .github folder. A file without `applyTo` applies from the first turn. Globs
 * are gitignore-flavored: `**` spans zero or more directories, and a pattern with no `/`
 * matches the basename at any depth.
 *
 * Only successful write, edit, and replace calls count as touching a file; reads do not.
 * Each matched file becomes its own named system prompt section. pi sends a section
 * change as an update appended to the end of the transcript, so a newly matched file
 * costs only its own text and leaves the cached prompt prefix intact. A section stays
 * active until the next compaction, and the active set is rebuilt from the branch's system
 * messages on session start so a resumed session does not re-send them. A file with the same
 * body as an active section, such as the same file in another worktree, is not added again.
 *
 * A compaction rewrites the prompt cache and keeps the current sections in its base prompt.
 * After one, every section is dropped from outgoing requests until a later write matches its
 * file again, which re-adds it under a new name at the end of the transcript.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_TOUCHED = 20_000;

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

export interface ParsedInstruction {
	/** `applyTo` patterns; undefined means the file applies unconditionally. */
	applyTo?: string[];
	body: string;
}

function unquote(value: string): string {
	const v = value.trim();
	if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
		return v.slice(1, -1);
	}
	return v;
}

/** Splits `"a,b"`, `[a, b]`, or bare `a,b` forms into dequoted items. */
function splitInlineList(value: string): string[] {
	let v = value.trim();
	if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1);
	else if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
		v = v.slice(1, -1);
	}
	return v
		.split(",")
		.map((item) => unquote(item))
		.filter((item) => item.length > 0);
}

/** Extracts the `applyTo` directive and body from frontmatter-delimited markdown. */
export function parseInstructionContent(content: string): ParsedInstruction {
	const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
	if (lines[0]?.trim() !== "---") {
		return { body: content };
	}
	let end = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---" || lines[i].trim() === "...") {
			end = i;
			break;
		}
		if (i > 32) break; // no closing fence within 32 lines: not frontmatter
	}
	if (end === -1) {
		return { body: content };
	}

	let applyTo: string[] | undefined;
	for (let i = 1; i < end; i++) {
		const match = lines[i].match(/^applyTo:\s*(.*)$/);
		if (!match) continue;
		const rest = match[1].trim();
		if (rest) {
			applyTo = splitInlineList(rest);
		} else {
			const block: string[] = [];
			for (let j = i + 1; j < end; j++) {
				const item = lines[j].match(/^\s+-\s+(.+)$/);
				if (!item) break;
				block.push(unquote(item[1]));
			}
			applyTo = block;
		}
		break;
	}
	return { applyTo, body: lines.slice(end + 1).join("\n") };
}

// ---------------------------------------------------------------------------
// Glob matching (gitignore-flavored, self-contained)
// ---------------------------------------------------------------------------

export type Matcher = (relPath: string) => boolean;

/** Char-wildcard match within a single path segment: `*` and `?`, no `/`. */
function segmentMatches(pattern: string, value: string): boolean {
	let pi = 0;
	let vi = 0;
	let star = -1;
	let mark = 0;
	while (vi < value.length) {
		if (pi < pattern.length && (pattern[pi] === "?" || pattern[pi] === value[vi])) {
			pi++;
			vi++;
		} else if (pi < pattern.length && pattern[pi] === "*") {
			star = pi++;
			mark = vi;
		} else if (star !== -1) {
			pi = star + 1;
			vi = ++mark;
		} else {
			return false;
		}
	}
	while (pi < pattern.length && pattern[pi] === "*") pi++;
	return pi === pattern.length;
}

/**
 * Segment-wise match where a `**` segment consumes zero or more whole path segments.
 * Memoized because the zero-consumption branch re-enters with the same pattern index.
 */
function matchSegments(pattern: string[], segments: string[]): boolean {
	const memo = new Map<number, boolean>();
	function rec(pi: number, si: number): boolean {
		if (pi === pattern.length) return si === segments.length;
		const key = pi * 65536 + si;
		const cached = memo.get(key);
		if (cached !== undefined) return cached;
		let result: boolean;
		if (pattern[pi] === "**") {
			result = rec(pi + 1, si) || (si < segments.length && rec(pi, si + 1));
		} else {
			result = si < segments.length && segmentMatches(pattern[pi], segments[si]) && rec(pi + 1, si + 1);
		}
		memo.set(key, result);
		return result;
	}
	return rec(0, 0);
}

/** Compiles one `applyTo` glob into a matcher over slash-separated relative paths. */
export function compileApplyTo(pattern: string): Matcher {
	const raw = pattern.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
	if (!raw) return () => false;
	if (!raw.includes("/")) {
		return (relPath: string) => segmentMatches(raw, relPath.split("/").pop() ?? "");
	}
	const patternSegments = raw.split("/");
	return (relPath: string) => matchSegments(patternSegments, relPath.split("/"));
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

interface Discovered {
	/** Directory containing the `.github` folder the instructions live under. */
	root: string;
	abs: string;
	body: string;
	matchers: Matcher[];
	/** True when the file carries no usable `applyTo` and applies unconditionally. */
	unconditional: boolean;
}

function toPosix(path: string): string {
	return sep === "/" ? path : path.split(sep).join("/");
}

/** Recursively collects markdown under `instrDir`; `root` is the base directory for `applyTo` globs. */
function collectFrom(instrDir: string, root: string, seen: Set<string>, out: Array<{ root: string; abs: string }>): void {
	const stack: string[] = [instrDir];
	while (stack.length > 0) {
		const current = stack.pop()!;
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				stack.push(join(current, entry.name));
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				const abs = join(current, entry.name);
				if (!seen.has(abs)) {
					seen.add(abs);
					out.push({ root, abs });
				}
			}
		}
	}
}

const INSTRUCTIONS_DIR = join(".github", "instructions");

/** Lists markdown under the global instructions dir, cwd's ancestor chain, and each extra root's `.github/instructions`. */
function findInstructionFiles(cwd: string, roots: Iterable<string>): Array<{ root: string; abs: string }> {
	const seen = new Set<string>();
	const out: Array<{ root: string; abs: string }> = [];
	const home = process.env.HOME;
	if (home) collectFrom(join(home, ".pi", "agent", "instructions"), home, seen, out);
	let dir = cwd;
	while (true) {
		collectFrom(join(dir, INSTRUCTIONS_DIR), dir, seen, out);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	for (const root of roots) collectFrom(join(root, INSTRUCTIONS_DIR), root, seen, out);
	const depth = (d: string) => d.split(sep).filter(Boolean).length;
	return out.sort((a, b) => depth(b.root) - depth(a.root) || a.abs.localeCompare(b.abs));
}

/** mtime/size fingerprint of every instruction file; undefined when none exist. */
function fingerprint(files: ReadonlyArray<{ abs: string }>): string | undefined {
	const parts: string[] = [];
	for (const { abs } of files) {
		try {
			const st = statSync(abs);
			parts.push(`${abs}:${st.mtimeMs}:${st.size}`);
		} catch {
			parts.push(`${abs}:gone`);
		}
	}
	return parts.length > 0 ? parts.join("|") : undefined;
}

/** Reads and parses every instruction file, compiling its `applyTo` globs. */
function loadInstructions(files: ReadonlyArray<{ root: string; abs: string }>): Discovered[] {
	const found: Discovered[] = [];
	for (const { root, abs } of files) {
		let content: string;
		try {
			content = readFileSync(abs, "utf8");
		} catch {
			continue;
		}
		const parsed = parseInstructionContent(content);
		found.push({
			root,
			abs,
			body: parsed.body,
			matchers: (parsed.applyTo ?? []).map(compileApplyTo),
			unconditional: parsed.applyTo === undefined || parsed.applyTo.length === 0,
		});
	}
	return found;
}

/** Directories between `file` and the filesystem root that hold `.github/instructions`, skipping directories in `checked`. */
export function instructionRootsAbove(file: string, checked: Set<string>, isDir: (path: string) => boolean = isDirectory): string[] {
	const roots: string[] = [];
	let dir = dirname(file);
	while (!checked.has(dir)) {
		checked.add(dir);
		if (isDir(join(dir, INSTRUCTIONS_DIR))) roots.push(dir);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return roots;
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Touch tracking and injection
// ---------------------------------------------------------------------------

interface CacheEntry {
	fingerprint: string;
	discovered: Discovered[];
}

const SECTION_PREFIX = "instructions-";

function gatesPass(discovered: Discovered, touched: ReadonlySet<string>): boolean {
	if (discovered.unconditional) return true;
	for (const abs of touched) {
		const rel = toPosix(relative(discovered.root, abs));
		if (rel.startsWith("..") || rel === "") continue;
		if (discovered.matchers.some((matcher) => matcher(rel))) return true;
	}
	return false;
}

/**
 * Stable section name for an instruction file; matches pi's `^[a-z][a-z0-9_-]*$` rule.
 * `generation` is the number of compactions on the branch, so a file re-added after a compaction gets a new name.
 */
export function sectionName(root: string, abs: string, generation = 0): string {
	const slug = toPosix(relative(root, abs))
		.toLowerCase()
		.replace(/\.instructions\.md$|\.md$/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	const hash = createHash("sha1").update(abs).digest("hex").slice(0, 6);
	return `${SECTION_PREFIX}${slug}-${hash}${generation > 0 ? `-g${generation}` : ""}`;
}

function renderSection(discovered: Discovered): string {
	return `<project_instructions path="${discovered.abs}">\n${discovered.body}\n</project_instructions>`;
}

const WRITE_TOOLS = new Set(["write", "edit", "replace"]);

/** Absolute paths a successful write, edit, or replace call wrote. */
export function writtenPaths(
	event: { toolName?: string; input?: Record<string, unknown>; details?: unknown; isError?: boolean },
	cwd: string,
): string[] {
	if (event.isError || !WRITE_TOOLS.has(event.toolName ?? "")) return [];
	const files = event.toolName === "replace" ? (event.details as { files?: unknown } | undefined)?.files : [event.input?.path];
	if (!Array.isArray(files)) return [];
	return files
		.filter((path): path is string => typeof path === "string" && path.length > 0)
		.map((path) => (path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(2)) : path))
		.map((path) => (isAbsolute(path) ? path : resolve(cwd, path)));
}

export interface BranchSections {
	/** Sections added since the last compaction and not removed since, with their instruction file paths. */
	active: Map<string, string | undefined>;
	/** Instruction file paths of every section the branch ever added. */
	paths: Set<string>;
	compactions: number;
}

/** Instruction sections recorded in the branch's system messages. */
export function branchSections(entries: readonly unknown[]): BranchSections {
	const active = new Map<string, string | undefined>();
	const paths = new Set<string>();
	let compactions = 0;
	for (const entry of entries) {
		const typed = entry as { type?: string; message?: { role?: string; sections?: Record<string, unknown> } };
		if (typed.type === "compaction") {
			compactions++;
			active.clear();
			continue;
		}
		if (typed.type !== "message" || typed.message?.role !== "system") continue;
		for (const [name, value] of Object.entries(typed.message.sections ?? {})) {
			if (!name.startsWith(SECTION_PREFIX)) continue;
			if (value === null) {
				active.delete(name);
				continue;
			}
			const path = typeof value === "string" ? value.match(/^<project_instructions path="([^"]+)">/)?.[1] : undefined;
			active.set(name, path);
			if (path !== undefined) paths.add(path);
		}
	}
	return { active, paths, compactions };
}

interface SystemMessage {
	role: "system";
	content?: unknown;
	sections?: Record<string, unknown>;
	toolsAdded?: unknown[];
	toolsRemoved?: unknown[];
}

/**
 * Removes this extension's sections that are not in `active` from every system message, and drops
 * system messages left empty. Returns `messages` itself when nothing changes.
 */
export function stripInactiveSections<T>(messages: readonly T[], active: ReadonlySet<string>): readonly T[] {
	let changed = false;
	const out: T[] = [];
	for (const message of messages) {
		const system = message as unknown as SystemMessage;
		if (system.role !== "system" || !system.sections) {
			out.push(message);
			continue;
		}
		const entries = Object.entries(system.sections);
		const kept = entries.filter(([name]) => !name.startsWith(SECTION_PREFIX) || active.has(name));
		if (kept.length === entries.length) {
			out.push(message);
			continue;
		}
		changed = true;
		const hasContent = typeof system.content === "string" ? system.content.length > 0 : Array.isArray(system.content) && system.content.length > 0;
		if (kept.length === 0 && !hasContent && !system.toolsAdded?.length && !system.toolsRemoved?.length) continue;
		out.push({ ...system, sections: Object.fromEntries(kept) } as unknown as T);
	}
	return changed ? out : messages;
}

/** The directory holding the `.github` folder of an instruction file, or undefined for a file outside one. */
export function rootOfInstructionFile(abs: string): string | undefined {
	const marker = `${sep}${INSTRUCTIONS_DIR}${sep}`;
	const index = abs.lastIndexOf(marker);
	return index > 0 ? abs.slice(0, index) : undefined;
}

function bodyKey(body: string): string {
	return createHash("sha1").update(body).digest("hex");
}

export default function instructionFilesExtension(pi: ExtensionAPI): void {
	const cache = new Map<string, CacheEntry>();
	const touched = new Set<string>();
	const roots = new Set<string>();
	const checked = new Set<string>();
	let active = new Set<string>();
	let generation = 0;
	let cwd: string | undefined;

	type Ctx = { sessionManager: { getBranch(): readonly unknown[] } };

	function rebuild(ctx: Ctx): void {
		touched.clear();
		roots.clear();
		checked.clear();
		try {
			const state = branchSections(ctx.sessionManager.getBranch());
			active = new Set(state.active.keys());
			generation = state.compactions;
			for (const path of state.paths) {
				const root = rootOfInstructionFile(path);
				if (root !== undefined) roots.add(root);
			}
		} catch (error) {
			active = new Set();
			generation = 0;
			console.error(`[instruction-files] ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/** Starts over after a compaction, so only files matched by later writes come back. */
	function sync(ctx: Ctx): void {
		const compactions = ctx.sessionManager.getBranch().filter((entry) => (entry as { type?: string }).type === "compaction").length;
		if (compactions === generation) return;
		if (compactions < generation) return rebuild(ctx);
		generation = compactions;
		active.clear();
		touched.clear();
	}

	pi.on("session_start", (_event, ctx) => rebuild(ctx));
	pi.on("session_tree", (_event, ctx) => rebuild(ctx));

	pi.on("before_agent_start", (event, ctx) => {
		try {
			sync(ctx);
			const dir: string = event.systemPromptOptions.cwd;
			cwd = dir;
			const files = findInstructionFiles(dir, roots);
			const fp = fingerprint(files);
			if (fp === undefined) return;
			const hit = cache.get(fp);
			const discovered = hit ? hit.discovered : loadInstructions(files);
			cache.clear();
			cache.set(fp, { fingerprint: fp, discovered });
			const named = discovered.map((d) => ({ d, name: sectionName(d.root, d.abs, generation) }));
			const shown = new Set<string>();
			for (const { d, name } of named) {
				if (!active.has(name)) continue;
				shown.add(bodyKey(d.body));
				event.systemPromptOptions.sections[name] = renderSection(d);
			}
			for (const { d, name } of named) {
				if (active.has(name) || !gatesPass(d, touched)) continue;
				const key = bodyKey(d.body);
				if (shown.has(key)) continue;
				shown.add(key);
				active.add(name);
				event.systemPromptOptions.sections[name] = renderSection(d);
			}
		} catch (error) {
			console.error(`[instruction-files] ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	// A compaction keeps the current sections in its base prompt; this drops the ones not re-added since.
	pi.on("context_with_system", (event, ctx) => {
		try {
			sync(ctx);
			const messages = stripInactiveSections(event.messages, active);
			return messages === event.messages ? undefined : { messages: [...messages] };
		} catch (error) {
			console.error(`[instruction-files] ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	});

	pi.on("tool_result", (event) => {
		try {
			for (const path of writtenPaths(event as Parameters<typeof writtenPaths>[0], cwd ?? process.cwd())) {
				touched.add(path);
				for (const root of instructionRootsAbove(path, checked)) roots.add(root);
				const own = rootOfInstructionFile(path);
				if (own !== undefined) roots.add(own);
			}
			if (touched.size > MAX_TOUCHED) {
				for (const oldest of [...touched].slice(0, MAX_TOUCHED / 2)) touched.delete(oldest);
			}
		} catch {
			// touch tracking is best-effort; never fail the tool call
		}
	});
}
