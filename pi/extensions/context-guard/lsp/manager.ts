import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	FALLBACK_BIN_DIRS,
	JDTLS_DATA_ROOT,
	JDTLS_XMX,
	LSP_IDLE_MS,
	LSP_MAX_SERVERS,
	LSP_READY_WAIT_MS,
	LSP_REQUEST_TIMEOUT_MS,
	MASON_BIN,
} from "../config.ts";
import { findExecutable } from "../proc.ts";
import { defaultServerRequest, JsonRpcConnection } from "./client.ts";

export type PreciseLang = "python" | "java";

export interface LspLocation {
	file: string;
	line: number;
	character: number;
}

export type PreciseResult =
	| { status: "ok"; server: string; locations: LspLocation[]; warning?: string }
	| { status: "loading"; server: string }
	| { status: "unavailable"; reason: string };

export interface ServerCommand {
	command: string;
	args: string[];
	env?: Record<string, string>;
	name: string;
}

export interface LspManagerOptions {
	resolveCommand?: (lang: PreciseLang, root: string) => ServerCommand | undefined;
	readyWaitMs?: number;
	requestTimeoutMs?: number;
	idleMs?: number;
	maxServers?: number;
}

export const ROOT_MARKERS: Readonly<Record<PreciseLang, readonly string[]>> = {
	python: ["pyproject.toml", "setup.py", "setup.cfg"],
	java: ["settings.gradle", "settings.gradle.kts", "pom.xml"],
};

const SERVER_BINARIES: Readonly<Record<PreciseLang, string>> = { python: "pyright-langserver", java: "jdtls" };
// jdtls answers initialize before importing the project; readiness is raced against readyWaitMs instead.
const INITIALIZE_TIMEOUT_MS = 10 * 60_000;
const SHUTDOWN_REQUEST_MS = 2000;
const SIGTERM_AFTER_MS = 5000;
const SIGKILL_AFTER_MS = 10_000;
const EXIT_SETTLE_MS = 1000;
const PYRIGHT_FILES_FOUND = /^(Found \d+ source files?|No source files found)/;
const PYRIGHT_SETTLE_MS = 5000;
const BUILD_FILE = /(?:\.gradle|\.gradle\.kts|\/pom\.xml)$/;

interface Server {
	key: string;
	name: string;
	child: ChildProcess;
	conn: JsonRpcConnection;
	ready: Promise<void>;
	exited: Promise<void>;
	isReady: boolean;
	dead: boolean;
	stopping: boolean;
	opened: Map<string, { version: number; text: string }>;
	lastUsed: number;
	idleTimer: NodeJS.Timeout | undefined;
	stderrTail: string;
	importStatus: string | undefined;
	buildErrors: Map<string, string>;
}

const delay = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms).unref();
	});

export function projectRoot(lang: PreciseLang, file: string): string {
	for (let dir = dirname(file); ; dir = dirname(dir)) {
		if (ROOT_MARKERS[lang].some((marker) => existsSync(join(dir, marker)))) return dir;
		if (existsSync(join(dir, ".git"))) return dir;
		if (dirname(dir) === dir) return dirname(file);
	}
}

export function defaultServerCommand(lang: PreciseLang, root: string): ServerCommand | undefined {
	const bin = findExecutable(SERVER_BINARIES[lang], process.env.PATH, [MASON_BIN, ...FALLBACK_BIN_DIRS]);
	if (!bin) return undefined;
	if (lang === "python") return { command: bin, args: ["--stdio"], name: "pyright" };
	const data = join(JDTLS_DATA_ROOT, createHash("sha1").update(root).digest("hex").slice(0, 16));
	return { command: bin, args: ["-data", data, `--jvm-arg=-Xmx${JDTLS_XMX}`], name: "jdtls" };
}

function initializeParams(root: string): unknown {
	const uri = pathToFileURL(root).href;
	return {
		processId: process.pid,
		clientInfo: { name: "pi-context-guard" },
		rootUri: uri,
		rootPath: root,
		workspaceFolders: [{ uri, name: basename(root) }],
		capabilities: {
			textDocument: { synchronization: { dynamicRegistration: false }, references: { dynamicRegistration: false } },
			workspace: { configuration: true, workspaceFolders: true },
			window: { workDoneProgress: true },
		},
	};
}

function toLocations(result: unknown): LspLocation[] {
	if (!Array.isArray(result)) return [];
	const locations: LspLocation[] = [];
	for (const item of result as Array<{ uri?: unknown; range?: { start?: { line?: unknown; character?: unknown } } }>) {
		const start = item?.range?.start;
		if (typeof item?.uri !== "string" || !item.uri.startsWith("file:")) continue;
		if (typeof start?.line !== "number" || typeof start.character !== "number") continue;
		locations.push({ file: fileURLToPath(item.uri), line: start.line, character: start.character });
	}
	return locations;
}

// jdtls reports ServiceReady even when the build import fails, so import problems travel with the results.
function recordImportProblem(server: Server, method: string, params: unknown): void {
	const p = params as
		| { type?: unknown; message?: unknown; uri?: unknown; diagnostics?: Array<{ severity?: unknown; message?: unknown }> }
		| undefined;
	if (method === "language/status" && p?.type === "ProjectStatus") {
		server.importStatus = p.message === "OK" ? undefined : `project import status ${String(p.message)}`;
	}
	if (method === "textDocument/publishDiagnostics" && typeof p?.uri === "string" && BUILD_FILE.test(p.uri)) {
		const error = p.diagnostics?.find((d) => d.severity === 1);
		if (error) server.buildErrors.set(p.uri, `build import failed: ${String(error.message).split("\n")[0]}`);
		else server.buildErrors.delete(p.uri);
	}
}

export class LspManager {
	private readonly servers = new Map<string, Server>();
	private readonly crashes = new Map<PreciseLang, number>();
	private readonly disabled = new Set<PreciseLang>();
	private readonly resolveCommand: (lang: PreciseLang, root: string) => ServerCommand | undefined;
	private readonly readyWaitMs: number;
	private readonly requestTimeoutMs: number;
	private readonly idleMs: number;
	private readonly maxServers: number;

	constructor(options: LspManagerOptions = {}) {
		this.resolveCommand = options.resolveCommand ?? defaultServerCommand;
		this.readyWaitMs = options.readyWaitMs ?? LSP_READY_WAIT_MS;
		this.requestTimeoutMs = options.requestTimeoutMs ?? LSP_REQUEST_TIMEOUT_MS;
		this.idleMs = options.idleMs ?? LSP_IDLE_MS;
		this.maxServers = options.maxServers ?? LSP_MAX_SERVERS;
	}

	get serverCount(): number {
		return this.servers.size;
	}

	async references(lang: PreciseLang, file: string, line: number, character: number): Promise<PreciseResult> {
		if (this.disabled.has(lang)) {
			return { status: "unavailable", reason: `precise mode is disabled for ${lang} after repeated server crashes` };
		}
		const root = projectRoot(lang, file);
		const existing = this.servers.get(`${lang}:${root}`);
		const server = existing && !existing.dead ? existing : this.start(lang, root);
		if (!server) {
			return { status: "unavailable", reason: `no ${SERVER_BINARIES[lang]} found on PATH or in ${MASON_BIN}` };
		}
		server.lastUsed = Date.now();
		clearTimeout(server.idleTimer);
		try {
			const state = await Promise.race([
				server.ready.then(
					() => "ready" as const,
					(error: Error) => error,
				),
				delay(this.readyWaitMs).then(() => "waiting" as const),
			]);
			if (state instanceof Error) return await this.failure(server, state);
			if (state === "waiting") return { status: "loading", server: server.name };
			try {
				const uri = pathToFileURL(file).href;
				const text = readFileSync(file, "utf8");
				const doc = server.opened.get(uri);
				if (!doc) {
					server.conn.notify("textDocument/didOpen", { textDocument: { uri, languageId: lang, version: 1, text } });
					server.opened.set(uri, { version: 1, text });
				} else if (doc.text !== text) {
					doc.version++;
					doc.text = text;
					server.conn.notify("textDocument/didChange", { textDocument: { uri, version: doc.version }, contentChanges: [{ text }] });
				}
				const result = await server.conn.request(
					"textDocument/references",
					{ textDocument: { uri }, position: { line, character }, context: { includeDeclaration: false } },
					this.requestTimeoutMs,
				);
				const warning = server.buildErrors.values().next().value ?? server.importStatus;
				return { status: "ok", server: server.name, locations: toLocations(result), ...(warning ? { warning } : {}) };
			} catch (error) {
				return await this.failure(server, error as Error);
			}
		} finally {
			if (!server.dead && !server.stopping) this.touch(server);
		}
	}

	async shutdownAll(): Promise<void> {
		await Promise.all([...this.servers.values()].map((server) => this.stop(server)));
	}

	// Waits briefly for a dying server's exit so crash accounting is current before the caller retries.
	private async failure(server: Server, error: Error): Promise<PreciseResult> {
		if (server.conn.isClosed) await Promise.race([server.exited.catch(() => {}), delay(EXIT_SETTLE_MS)]);
		return { status: "unavailable", reason: `${server.name}: ${error.message}` };
	}

	private start(lang: PreciseLang, root: string): Server | undefined {
		const command = this.resolveCommand(lang, root);
		if (!command) return undefined;
		if (this.servers.size >= this.maxServers) {
			const lru = [...this.servers.values()].sort((a, b) => a.lastUsed - b.lastUsed)[0];
			if (lru) void this.stop(lru);
		}
		const child = spawn(command.command, command.args, {
			cwd: root,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, ...command.env },
		});
		let markReady: () => void = () => {};
		const serviceReady = new Promise<void>((resolve) => {
			markReady = resolve;
		});
		const conn = new JsonRpcConnection(child.stdin, child.stdout, {
			onRequest: defaultServerRequest,
			onNotification: (method, params) => {
				const p = params as { type?: unknown; message?: unknown } | undefined;
				if (lang === "java" && method === "language/status" && p?.type === "ServiceReady") markReady();
				if (lang === "java") recordImportProblem(server, method, params);
				if (lang === "python" && method === "window/logMessage" && typeof p?.message === "string" && PYRIGHT_FILES_FOUND.test(p.message)) markReady();
			},
		});
		let rejectExited: (error: Error) => void = () => {};
		const server: Server = {
			key: `${lang}:${root}`,
			name: command.name,
			child,
			conn,
			ready: Promise.resolve(),
			exited: new Promise<void>((_, reject) => {
				rejectExited = reject;
			}),
			isReady: false,
			dead: false,
			stopping: false,
			opened: new Map(),
			lastUsed: Date.now(),
			idleTimer: undefined,
			stderrTail: "",
			importStatus: undefined,
			buildErrors: new Map(),
		};
		server.exited.catch(() => {});
		const onDead = (reason: Error) => {
			if (server.dead) return;
			server.dead = true;
			clearTimeout(server.idleTimer);
			if (this.servers.get(server.key) === server) this.servers.delete(server.key);
			if (!server.stopping) {
				const count = (this.crashes.get(lang) ?? 0) + 1;
				this.crashes.set(lang, count);
				if (count >= 2) this.disabled.add(lang);
			}
			conn.close(reason);
			rejectExited(reason);
		};
		child.stderr.on("data", (chunk: Buffer) => {
			server.stderrTail = (server.stderrTail + chunk.toString("utf8")).slice(-2000);
		});
		child.stderr.on("error", () => {});
		child.on("error", (error) => onDead(error));
		child.on("exit", (code, signal) => {
			const lastLine = server.stderrTail.trim().split("\n").pop();
			onDead(new Error(`${command.name} exited (${code ?? signal})${lastLine ? `: ${lastLine}` : ""}`));
		});
		server.ready = (async () => {
			await Promise.race([conn.request("initialize", initializeParams(root), INITIALIZE_TIMEOUT_MS), server.exited]);
			conn.notify("initialized", {});
			if (lang === "python") conn.notify("workspace/didChangeConfiguration", { settings: {} });
			await Promise.race([serviceReady, server.exited, ...(lang === "python" ? [delay(PYRIGHT_SETTLE_MS)] : [])]);
			server.isReady = true;
		})();
		server.ready.catch(() => {});
		this.servers.set(server.key, server);
		return server;
	}

	private touch(server: Server): void {
		server.lastUsed = Date.now();
		clearTimeout(server.idleTimer);
		server.idleTimer = setTimeout(() => void this.stop(server), this.idleMs);
		server.idleTimer.unref();
	}

	private async stop(server: Server): Promise<void> {
		server.stopping = true;
		clearTimeout(server.idleTimer);
		if (this.servers.get(server.key) === server) this.servers.delete(server.key);
		if (server.dead) return;
		const { child } = server;
		const exited = server.exited.catch(() => {});
		const term = setTimeout(() => child.kill("SIGTERM"), SIGTERM_AFTER_MS);
		const kill = setTimeout(() => child.kill("SIGKILL"), SIGKILL_AFTER_MS);
		try {
			await Promise.race([server.conn.request("shutdown", null, SHUTDOWN_REQUEST_MS), exited]);
			server.conn.notify("exit", null);
		} catch {
			// A server that cannot answer shutdown is stopped by signal.
		}
		await exited;
		clearTimeout(term);
		clearTimeout(kill);
	}
}
