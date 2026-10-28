import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { toolCall } from "./calls.ts";
import { CAP_EXEMPT_TOOLS, CAP_MAX_BYTES, CAP_MAX_LINES, SPILL_DIR_NAME, SPILL_RETENTION_MS } from "./config.ts";
import { isOutlinable } from "./languages.ts";

export interface TextSize {
	bytes: number;
	lines: number;
}

export interface CapRequest {
	toolName: string;
	toolCallId: string;
	input: Record<string, unknown>;
	text: string;
	details: unknown;
	structuredContent: unknown;
	cwd: string;
	sessionId: string;
	tmpRoot: string;
}

const MCP_FULL_OUTPUT = /\[Full output: (.+?) \(read it with offset\/limit\)\]/;
const BASH_EXIT_LINE = /Command exited with code (\d+)\s*$/;

export function measure(text: string): TextSize {
	const bytes = Buffer.byteLength(text, "utf8");
	if (text.length === 0) return { bytes, lines: 0 };
	let lines = 1;
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lines++;
	if (text.endsWith("\n")) lines--;
	return { bytes, lines };
}

export function exceedsCap(size: TextSize): boolean {
	return size.bytes > CAP_MAX_BYTES || size.lines > CAP_MAX_LINES;
}

// Skill files are loaded whole by the agent, so reads of them are never capped or replaced.
export const isSkillPath = (path: string): boolean => path.split(/[\\/]/).includes("skills");

export function isCapExempt(toolName: string, input: Record<string, unknown>): boolean {
	if (CAP_EXEMPT_TOOLS.has(toolName)) return true;
	return toolName === "read" && typeof input.path === "string" && isSkillPath(input.path);
}

export function existingFullOutputPath(toolName: string, details: unknown, text: string): string | undefined {
	if (toolName === "bash" && details && typeof details === "object") {
		const path = (details as { fullOutputPath?: unknown }).fullOutputPath;
		if (typeof path === "string" && path) return path;
	}
	return MCP_FULL_OUTPUT.exec(text)?.[1];
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const count = (n: number) => n.toLocaleString("en-US");

export function capNotice(size: TextSize, path: string, exitCode?: number): string {
	const exit = exitCode === undefined ? "" : `, bash exit code ${exitCode}`;
	return (
		`[Output too large for context: ${count(size.lines)} lines, ${formatBytes(size.bytes)}${exit}. Saved to ${path}.\n` +
		`Find text in it with ${toolCall("search", { pattern: "<text to find>", path })}, or view a slice with head -n N / tail -n N.]`
	);
}

export function readNotice(size: TextSize, displayPath: string): string {
	const head = `[${displayPath} is ${count(size.lines)} lines, ${formatBytes(size.bytes)}: too large to return whole. `;
	if (isOutlinable(displayPath)) {
		return `${head}List its structure with ${toolCall("outline", { path: displayPath })}, then read parts of it with read_symbol.]`;
	}
	return `${head}Find text in it with ${toolCall("search", { pattern: "<text to find>", path: displayPath })}, then read a range with offset/limit.]`;
}

export function spillPath(tmpRoot: string, sessionId: string, toolCallId: string): string {
	const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");
	return join(tmpRoot, SPILL_DIR_NAME, safe(sessionId), `${safe(toolCallId)}.txt`);
}

// Mirrors pi's path handling: a leading "@" is dropped and "~" is the home directory.
export function expandHome(path: string): string {
	const bare = path.startsWith("@") ? path.slice(1) : path;
	return bare === "~" || bare.startsWith("~/") ? join(homedir(), bare.slice(1)) : bare;
}

export async function measureFile(path: string): Promise<TextSize> {
	const { size } = await stat(path);
	let lines = 0;
	let last = 10;
	for await (const chunk of createReadStream(path)) {
		const buf = chunk as Buffer;
		for (let i = buf.indexOf(10); i !== -1; i = buf.indexOf(10, i + 1)) lines++;
		if (buf.length > 0) last = buf[buf.length - 1];
	}
	if (size > 0 && last !== 10) lines++;
	return { bytes: size, lines };
}

function bashExitCode(structuredContent: unknown, text: string): number | undefined {
	const code = (structuredContent as { exit_code?: unknown } | undefined)?.exit_code;
	if (typeof code === "number") return code;
	const match = BASH_EXIT_LINE.exec(text);
	return match ? Number(match[1]) : undefined;
}

export async function applyCap(req: CapRequest): Promise<string | undefined> {
	if (isCapExempt(req.toolName, req.input)) return undefined;
	const size = measure(req.text);
	if (!exceedsCap(size)) return undefined;
	try {
		if (req.toolName === "read") {
			if (typeof req.input.path !== "string") return undefined;
			const file = resolve(req.cwd, expandHome(req.input.path));
			return readNotice(await measureFile(file), req.input.path);
		}
		const exitCode = req.toolName === "bash" ? bashExitCode(req.structuredContent, req.text) : undefined;
		const reused = existingFullOutputPath(req.toolName, req.details, req.text);
		if (reused) return capNotice(await measureFile(reused), reused, exitCode);
		const path = spillPath(req.tmpRoot, req.sessionId, req.toolCallId);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, req.text, "utf8");
		return capNotice(size, path, exitCode);
	} catch {
		return undefined;
	}
}

export async function cleanupSpillDirs(tmpRoot: string, now: number): Promise<void> {
	const root = join(tmpRoot, SPILL_DIR_NAME);
	let entries: string[];
	try {
		entries = await readdir(root);
	} catch {
		return;
	}
	await Promise.all(
		entries.map(async (name) => {
			const dir = join(root, name);
			try {
				if (now - (await stat(dir)).mtimeMs > SPILL_RETENTION_MS) await rm(dir, { recursive: true, force: true });
			} catch {
				// A directory removed concurrently needs no cleanup.
			}
		}),
	);
}
