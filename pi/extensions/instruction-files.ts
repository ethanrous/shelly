/**
 * Injects glob-gated instruction files into the system prompt when the session
 * actually touches matching files.
 *
 * pi's stock loader only recognizes fixed filenames (AGENTS.md, CLAUDE.md) and never
 * parses frontmatter, so markdown files kept under a project's .github/instructions/
 * tree with an `applyTo:` directive — e.g. workspace/python-conventions.instructions.md
 * restricted to Python sources — are silently ignored. This walks a global root
 * (~/.pi/agent/instructions, synced from the dotfiles repo) plus cwd and every ancestor
 * directory's .github/instructions — the same inheritance walk pi does for AGENTS.md,
 * deepest scope first — and reads each file's `applyTo` directive. On every `before_agent_start` it appends the files whose globs
 * match paths the session has accessed through read/edit/write-style tool calls to
 * `systemPromptOptions.contextFiles`, where pi renders them as
 * `<project_instructions path="...">` blocks, indistinguishable from AGENTS.md content.
 * A file without `applyTo` applies unconditionally from the first turn. Globs are
 * gitignore-flavored: `**` spans zero or more directories, and a pattern with no `/`
 * matches the basename at any depth.
 *
 * Matching runs against touched paths rather than the whole repo: a monorepo-root
 * session pays only for the conventions of the part it is working in (a few KB, not
 * tens of thousands of tokens), and a convention lands from the turn after the first
 * relevant file access, which is what "loads whenever a .py file is in play" means in
 * practice. Per turn the extension only stats the instruction files; content is
 * re-read and re-globbed solely when one of them changed.
 */

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
	sig: string;
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

/** Lists markdown under the global instructions dir plus every `.github/instructions` in cwd's ancestor chain. */
function findInstructionFiles(cwd: string): Array<{ root: string; abs: string }> {
	const seen = new Set<string>();
	const out: Array<{ root: string; abs: string }> = [];
	const home = process.env.HOME;
	if (home) collectFrom(join(home, ".pi", "agent", "instructions"), home, seen, out);
	let dir = cwd;
	while (true) {
		collectFrom(join(dir, ".github", "instructions"), dir, seen, out);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	const depth = (d: string) => d.split(sep).filter(Boolean).length;
	return out.sort((a, b) => depth(b.root) - depth(a.root) || a.abs.localeCompare(b.abs));
}

/** mtime/size fingerprint of every instruction file; undefined when none exist. */
function fingerprint(cwd: string): string | undefined {
	const parts: string[] = [];
	for (const { abs } of findInstructionFiles(cwd)) {
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
function loadInstructions(cwd: string): Discovered[] {
	const found: Discovered[] = [];
	for (const { root, abs } of findInstructionFiles(cwd)) {
		let content: string;
		try {
			content = readFileSync(abs, "utf8");
		} catch {
			continue;
		}
		const st = statSync(abs);
		const parsed = parseInstructionContent(content);
		found.push({
			root,
			abs,
			body: parsed.body,
			matchers: (parsed.applyTo ?? []).map(compileApplyTo),
			unconditional: parsed.applyTo === undefined || parsed.applyTo.length === 0,
			sig: `${st.mtimeMs}:${st.size}`,
		});
	}
	return found;
}

// ---------------------------------------------------------------------------
// Touch tracking and injection
// ---------------------------------------------------------------------------

interface ContextFile {
	path: string;
	content: string;
}

interface CacheEntry {
	fingerprint: string;
	discovered: Discovered[];
}

function gatesPass(discovered: Discovered, touched: ReadonlySet<string>): boolean {
	if (discovered.unconditional) return true;
	for (const abs of touched) {
		const rel = toPosix(relative(discovered.root, abs));
		if (rel.startsWith("..") || rel === "") continue;
		if (discovered.matchers.some((matcher) => matcher(rel))) return true;
	}
	return false;
}

export default function instructionFilesExtension(pi: ExtensionAPI): void {
	const cache = new Map<string, CacheEntry>();
	const touched = new Set<string>();
	let cwd: string | undefined;

	pi.on("before_agent_start", (event) => {
		try {
			cwd = event.systemPromptOptions.cwd;
			const fp = fingerprint(cwd);
			if (fp === undefined) return;
			const hit = cache.get(cwd);
			const discovered = hit && hit.fingerprint === fp ? hit.discovered : loadInstructions(cwd);
			cache.set(cwd, { fingerprint: fp, discovered });
			const files: ContextFile[] = [];
			for (const d of discovered) {
				if (gatesPass(d, touched)) files.push({ path: d.abs, content: d.body });
			}
			if (files.length > 0) {
				event.systemPromptOptions.contextFiles.push(...files);
			}
		} catch (error) {
			console.error(`[instruction-files] ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	pi.on("tool_call", (event) => {
		try {
			const raw = (event as { input?: { path?: unknown } }).input?.path;
			if (typeof raw !== "string" || raw.length === 0) return;
			const expanded = raw.startsWith("~/") ? join(process.env.HOME ?? "", raw.slice(2)) : raw;
			touched.add(isAbsolute(expanded) ? expanded : resolve(cwd ?? process.cwd(), expanded));
			if (touched.size > MAX_TOUCHED) {
				for (const oldest of touched.keys().slice(0, MAX_TOUCHED / 2)) touched.delete(oldest);
			}
		} catch {
			// touch tracking is best-effort; never fail the tool call
		}
	});
}
