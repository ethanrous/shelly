import { spawn } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, delimiter, isAbsolute, join, relative, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import { AST_GREP_MIN_VERSION, FALLBACK_BIN_DIRS, FILE_BATCH_SIZE, SUBPROCESS_TIMEOUT_MS } from "./config.ts";

export const SGCONFIG = fileURLToPath(new URL("./sgconfig.yml", import.meta.url));

export interface RunOptions {
	cwd: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	// Receives stdout line by line instead of buffering it; RunResult.stdout is then empty.
	onStdoutLine?: (line: string) => void;
}

export interface RgOptions extends RunOptions {
	ignoreCase?: boolean;
}

export interface RunResult {
	stdout: string;
	stderr: string;
	code: number | null;
}

export interface SgPos {
	line: number;
	column: number;
}

export interface SgRange {
	start: SgPos;
	end: SgPos;
	startByte: number;
	endByte: number;
}

export interface SgNode extends SgRange {
	text: string;
}

export interface SgMatch extends SgRange {
	ruleId: string;
	file: string;
	meta: Record<string, SgNode>;
}

interface RawNode {
	text: string;
	range: { byteOffset: { start: number; end: number }; start: SgPos; end: SgPos };
}

interface RawMatch extends RawNode {
	file: string;
	ruleId: string;
	metaVariables?: { single?: Record<string, RawNode> };
}

const SG_REQUIRED = "ast-grep 0.51+ is required: brew install ast-grep";
const RG_REQUIRED = "ripgrep is required: brew install ripgrep";

export function findExecutable(name: string, pathEnv: string | undefined, extraDirs: readonly string[]): string | undefined {
	const dirs = [...(pathEnv ?? "").split(delimiter).filter(Boolean), ...extraDirs];
	for (const dir of dirs) {
		const candidate = join(dir, name);
		try {
			accessSync(candidate, constants.X_OK);
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			// Not present or not executable in this directory.
		}
	}
	return undefined;
}

const binaries = new Map<string, string | undefined>();

export function resolveBinary(name: string): string | undefined {
	if (!binaries.has(name)) binaries.set(name, findExecutable(name, process.env.PATH, FALLBACK_BIN_DIRS));
	return binaries.get(name);
}

export function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		if (options.signal?.aborted) {
			reject(new Error("aborted"));
			return;
		}
		const child = spawn(command, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		const decoder = new StringDecoder("utf8");
		const onLine = options.onStdoutLine;
		const timeoutMs = options.timeoutMs ?? SUBPROCESS_TIMEOUT_MS;
		let pending = "";
		let settled = false;
		const finish = (error: Error | undefined, code: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", onAbort);
			if (error) reject(error);
			else resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), code });
		};
		const kill = (error: Error) => {
			child.kill("SIGKILL");
			finish(error, null);
		};
		const emit = (text: string) => {
			pending += text;
			for (let newline = pending.indexOf("\n"); newline !== -1; newline = pending.indexOf("\n")) {
				const line = pending.slice(0, newline);
				pending = pending.slice(newline + 1);
				if (!line || settled) continue;
				try {
					onLine?.(line);
				} catch (error) {
					kill(error as Error);
				}
			}
		};
		const onAbort = () => kill(new Error("aborted"));
		const timer = setTimeout(() => kill(new Error(`${basename(command)} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
		options.signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (chunk: Buffer) => {
			if (onLine) emit(decoder.write(chunk));
			else stdout.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.stdout.on("error", () => {});
		child.stderr.on("error", () => {});
		child.on("error", (error) => finish(error, null));
		child.on("close", (code) => {
			if (onLine) emit(`${decoder.end()}\n`);
			finish(undefined, code);
		});
	});
}

export function parseVersion(output: string): [number, number, number] | undefined {
	const match = /(\d+)\.(\d+)\.(\d+)/.exec(output);
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function versionAtLeast(version: readonly number[], min: readonly number[]): boolean {
	for (let i = 0; i < min.length; i++) {
		const part = version[i] ?? 0;
		if (part !== min[i]) return part > min[i];
	}
	return true;
}

let toolCheck: Promise<string | undefined> | undefined;

async function checkTools(): Promise<string | undefined> {
	if (!resolveBinary("rg")) return RG_REQUIRED;
	const sg = resolveBinary("ast-grep");
	if (!sg) return SG_REQUIRED;
	try {
		const version = parseVersion((await run(sg, ["--version"], { cwd: process.cwd(), timeoutMs: 5000 })).stdout);
		return version && versionAtLeast(version, AST_GREP_MIN_VERSION) ? undefined : SG_REQUIRED;
	} catch {
		return SG_REQUIRED;
	}
}

// A failed check is not cached, so installing the tool takes effect on the next call.
export async function toolProblem(): Promise<string | undefined> {
	toolCheck ??= checkTools();
	const problem = await toolCheck;
	if (problem) {
		toolCheck = undefined;
		binaries.clear();
	}
	return problem;
}

export async function requireTools(): Promise<{ rg: string; sg: string }> {
	const problem = await toolProblem();
	if (problem) throw new Error(problem);
	return { rg: resolveBinary("rg") as string, sg: resolveBinary("ast-grep") as string };
}

function toRange(raw: RawNode): SgRange {
	return {
		start: raw.range.start,
		end: raw.range.end,
		startByte: raw.range.byteOffset.start,
		endByte: raw.range.byteOffset.end,
	};
}

// Keeps only the NAME capture's text; node and body text can be whole classes and is read from the file instead.
export function parseSgLine(line: string): SgMatch {
	const raw = JSON.parse(line) as RawMatch;
	const meta: Record<string, SgNode> = {};
	for (const [key, node] of Object.entries(raw.metaVariables?.single ?? {})) {
		meta[key] = { ...toRange(node), text: key === "NAME" ? node.text : "" };
	}
	return { ...toRange(raw), ruleId: raw.ruleId, file: raw.file, meta };
}

const firstLine = (text: string) => text.trim().split("\n")[0] ?? "";

export async function sgScan(rules: string, files: readonly string[], options: RunOptions): Promise<SgMatch[]> {
	if (files.length === 0) return [];
	const { sg } = await requireTools();
	const matches: SgMatch[] = [];
	for (let i = 0; i < files.length; i += FILE_BATCH_SIZE) {
		const batch = files.slice(i, i + FILE_BATCH_SIZE);
		const args = ["scan", "--config", SGCONFIG, "--inline-rules", rules, "--json=stream", "--", ...batch];
		const result = await run(sg, args, { ...options, onStdoutLine: (line) => matches.push(parseSgLine(line)) });
		if (result.code !== 0) throw new Error(`ast-grep failed (exit ${result.code}): ${firstLine(result.stderr)}`);
	}
	return matches;
}

// False outside a git repository or when git is missing.
async function gitIgnores(path: string, signal: AbortSignal | undefined): Promise<boolean> {
	const git = resolveBinary("git");
	if (!git) return false;
	try {
		return (await run(git, ["check-ignore", "-q", "--no-index", "--", path], { cwd: path, signal, timeoutMs: 5000 })).code === 0;
	} catch {
		return false;
	}
}

export interface RgScope {
	roots: readonly string[];
	regex: boolean;
	ignoreCase: boolean;
	globs: readonly string[];
}

export interface RgSearch extends RgScope {
	patterns: readonly string[];
}

export interface RgReplace extends RgScope {
	pattern: string;
	replacement: string;
	// Lets the pattern match across line breaks; single-line patterns behave the same either way.
	multiline: boolean;
}

// Calls onMatch once per match with its byte offset in the file and the matched and replacement bytes.
export type ReplaceMatchHandler = (file: string, offset: number, match: Buffer, replacement: Buffer) => void;

// Globs match paths relative to options.cwd. A gitignored directory root is searched in its own rg run with --no-ignore.
async function eachRootGroup(roots: readonly string[], options: RunOptions, fn: (roots: readonly string[], noIgnore: boolean) => Promise<void>): Promise<void> {
	const ignored: string[] = [];
	const plain: string[] = [];
	for (const root of roots) {
		const skipped = (await stat(root)).isDirectory() && (await gitIgnores(root, options.signal));
		(skipped ? ignored : plain).push(root);
	}
	if (plain.length > 0) await fn(plain, false);
	if (ignored.length > 0) await fn(ignored, true);
}

// Streams each matching line as file, 1-based line number, and text; throws with rg's stderr when it fails without matches.
export async function rgSearch(search: RgSearch, options: RunOptions, onMatch: (file: string, line: number, text: string) => void): Promise<void> {
	const patterns = search.patterns.flatMap((pattern) => ["-e", pattern]);
	const output = ["--line-number", "--with-filename", "--no-heading", "--null"];
	await eachRootGroup(search.roots, options, (roots, noIgnore) =>
		rgRunRoots(search, [...output, ...patterns], roots, noIgnore, options, (raw) => {
			const nul = raw.indexOf("\0");
			const colon = raw.indexOf(":", nul + 1);
			if (nul === -1 || colon === -1) return false;
			onMatch(resolve(options.cwd, raw.slice(0, nul)), Number(raw.slice(nul + 1, colon)), raw.slice(colon + 1));
			return true;
		}),
	);
}

interface JsonText {
	text?: string;
	bytes?: string;
}

interface JsonMatch {
	type: string;
	data: { path: JsonText; absolute_offset: number; submatches: { match: JsonText; replacement?: JsonText; start: number }[] };
}

const jsonBytes = (value: JsonText | undefined): Buffer => (value?.bytes !== undefined ? Buffer.from(value.bytes, "base64") : Buffer.from(value?.text ?? "", "utf8"));

// Streams every match of one pattern with rg's replacement; throws with rg's stderr when it fails without matches.
export async function rgReplace(search: RgReplace, options: RunOptions, onMatch: ReplaceMatchHandler): Promise<void> {
	// rg expands $ in replacements even with --fixed-strings.
	const replacement = search.regex ? search.replacement : search.replacement.replaceAll("$", "$$$$");
	const extra = ["--json", ...(search.multiline ? ["--multiline"] : []), `--replace=${replacement}`, "-e", search.pattern];
	await eachRootGroup(search.roots, options, (roots, noIgnore) =>
		rgRunRoots(search, extra, roots, noIgnore, options, (raw) => {
			const event = JSON.parse(raw) as JsonMatch;
			if (event.type !== "match") return false;
			const file = resolve(options.cwd, jsonBytes(event.data.path).toString("utf8"));
			for (const sub of event.data.submatches) onMatch(file, event.data.absolute_offset + sub.start, jsonBytes(sub.match), jsonBytes(sub.replacement));
			return true;
		}),
	);
}

export function cwdRelative(path: string, cwd: string): string {
	const rel = relative(cwd, path);
	if (rel === "") return ".";
	return rel.startsWith("..") || isAbsolute(rel) ? path : rel;
}

// Runs rg over roots; onLine returns true for a line that carried a match.
export async function rgRunRoots(
	scope: RgScope,
	extraArgs: readonly string[],
	roots: readonly string[],
	noIgnore: boolean,
	options: RunOptions,
	onLine: (line: string) => boolean,
): Promise<void> {
	const { rg } = await requireTools();
	const args = ["--no-config", "--color", "never", "--hidden", "-g", "!.git"];
	if (!scope.regex) args.push("--fixed-strings");
	if (scope.ignoreCase) args.push("--ignore-case");
	if (noIgnore) args.push("--no-ignore");
	for (const glob of scope.globs) args.push("-g", glob);
	args.push(...extraArgs);
	// Relative roots let globs with / match even when the working directory is reached through a symlink.
	args.push("--", ...roots.map((root) => cwdRelative(root, options.cwd)));
	let matched = false;
	const result = await run(rg, args, {
		...options,
		onStdoutLine: (raw) => {
			if (onLine(raw)) matched = true;
		},
	});
	if (result.code === 0 || result.code === 1 || matched) return;
	throw new Error(`rg failed: ${result.stderr.trim().replace(/^rg: /, "")}`);
}

export async function rgFiles(regex: string, root: string, globs: readonly string[], options: RgOptions): Promise<string[]> {
	const { rg } = await requireTools();
	const args = ["--no-config", "-l", "-w"];
	if (options.ignoreCase) args.push("-i");
	// rg prunes every subdirectory of an ignored root, such as a package in a virtualenv whose .gitignore is "*".
	if ((await stat(root)).isDirectory() && (await gitIgnores(root, options.signal))) args.push("--no-ignore");
	for (const glob of globs) args.push("-g", glob);
	args.push("-e", regex, "--", root);
	const result = await run(rg, args, options);
	if (result.code === 1) return [];
	if (result.code !== 0 && !result.stdout.trim()) throw new Error(`rg failed (exit ${result.code}): ${firstLine(result.stderr)}`);
	return result.stdout.split("\n").filter(Boolean).sort();
}
