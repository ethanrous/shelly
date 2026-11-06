/**
 * Removes or delays system prompt sections and `rules` lines named in `promptTrim` in
 * ~/.pi/agent/settings.json:
 *
 * - `dropSections`: section names that are never sent.
 * - `dropRules`: lines of the `rules` section, without their leading "- ", that are never sent.
 * - `sectionDirs`: section name to directories; the section is sent only when cwd is inside one.
 * - `sectionsOnFirstUse`: section name to tool names; the section is not sent, and its latest text
 *   is appended to the first top-level tool result after one of those tools runs, directly or from
 *   a codemode script, once per compaction.
 *
 * Every change is made in `context_with_system`, so the session keeps the full sections and each
 * request is trimmed the same way, which keeps the cached prefix stable.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

export interface TrimSettings {
	dropSections: string[];
	dropRules: string[];
	sectionDirs: Record<string, string[]>;
	sectionsOnFirstUse: Record<string, string[]>;
}

const EMPTY: TrimSettings = { dropSections: [], dropRules: [], sectionDirs: {}, sectionsOnFirstUse: {} };

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringLists(value: unknown): Record<string, string[]> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value).map(([key, list]) => [key, strings(list)]));
}

/** `promptTrim` from pi's settings.json; empty when unset or unreadable. */
export function loadTrimSettings(settingsPath = join(process.env.HOME ?? homedir(), ".pi", "agent", "settings.json")): TrimSettings {
	try {
		const raw = (JSON.parse(readFileSync(settingsPath, "utf8")) as { promptTrim?: Record<string, unknown> }).promptTrim;
		if (!raw) return EMPTY;
		return {
			dropSections: strings(raw.dropSections),
			dropRules: strings(raw.dropRules),
			sectionDirs: stringLists(raw.sectionDirs),
			sectionsOnFirstUse: stringLists(raw.sectionsOnFirstUse),
		};
	} catch {
		return EMPTY;
	}
}

function expandHome(path: string): string {
	return path === "~" || path.startsWith("~/") ? join(process.env.HOME ?? homedir(), path.slice(2)) : path;
}

function isInside(cwd: string, dirs: readonly string[]): boolean {
	const here = resolve(cwd);
	return dirs.some((dir) => {
		const root = resolve(expandHome(dir));
		return here === root || here.startsWith(root + sep);
	});
}

function withoutRules(text: string, rules: ReadonlySet<string>): string {
	return text
		.split("\n")
		.filter((line) => !(line.startsWith("- ") && rules.has(line.slice(2))))
		.join("\n");
}

interface SystemMessage {
	role: "system";
	content?: unknown;
	sections?: Record<string, unknown>;
	toolsAdded?: unknown[];
	toolsRemoved?: unknown[];
}

/**
 * Applies `settings` to every system message. Text of first-use sections is written to `captured`.
 * Returns `messages` itself when nothing changes.
 */
export function trimMessages<T>(messages: readonly T[], settings: TrimSettings, cwd: string, captured: Map<string, string>): readonly T[] {
	const drop = new Set(settings.dropSections);
	const rules = new Set(settings.dropRules);
	let changed = false;
	const out: T[] = [];
	for (const message of messages) {
		const system = message as unknown as SystemMessage;
		if (system.role !== "system" || !system.sections) {
			out.push(message);
			continue;
		}
		const kept: Array<[string, unknown]> = [];
		let edited = false;
		for (const [name, value] of Object.entries(system.sections)) {
			if (name in settings.sectionsOnFirstUse) {
				if (typeof value === "string") captured.set(name, value);
				edited = true;
				continue;
			}
			const dirs = settings.sectionDirs[name];
			if (drop.has(name) || (dirs && !isInside(cwd, dirs))) {
				edited = true;
				continue;
			}
			if (name === "rules" && typeof value === "string" && rules.size > 0) {
				const trimmed = withoutRules(value, rules);
				if (trimmed !== value) edited = true;
				kept.push([name, trimmed]);
				continue;
			}
			kept.push([name, value]);
		}
		if (!edited) {
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

/** First-use sections whose text already appears in a tool result since the branch's last compaction. */
export function deliveredSections(entries: readonly unknown[], names: readonly string[]): Set<string> {
	const delivered = new Set<string>();
	for (const entry of entries) {
		const typed = entry as { type?: string; message?: { role?: string; content?: unknown } };
		if (typed.type === "compaction") {
			delivered.clear();
			continue;
		}
		if (typed.type !== "message" || typed.message?.role !== "toolResult" || !Array.isArray(typed.message.content)) continue;
		for (const block of typed.message.content as Array<{ type?: string; text?: unknown }>) {
			if (block.type !== "text" || typeof block.text !== "string") continue;
			for (const name of names) if (block.text.includes(`<${name}>`)) delivered.add(name);
		}
	}
	return delivered;
}

function countCompactions(entries: readonly unknown[]): number {
	return entries.filter((entry) => (entry as { type?: string }).type === "compaction").length;
}

export default function promptTrimExtension(pi: ExtensionAPI): void {
	let settings = loadTrimSettings();
	const captured = new Map<string, string>();
	const pending = new Set<string>();
	let delivered = new Set<string>();
	let compactions = 0;

	type Ctx = { sessionManager: { getBranch(): readonly unknown[] } };

	function rebuild(ctx: Ctx): void {
		const branch = ctx.sessionManager.getBranch();
		delivered = deliveredSections(branch, Object.keys(settings.sectionsOnFirstUse));
		compactions = countCompactions(branch);
		pending.clear();
	}

	function sync(ctx: Ctx): void {
		const count = countCompactions(ctx.sessionManager.getBranch());
		if (count === compactions) return;
		compactions = count;
		delivered.clear();
	}

	pi.on("session_start", (_event, ctx) => {
		settings = loadTrimSettings();
		rebuild(ctx);
	});
	pi.on("session_tree", (_event, ctx) => rebuild(ctx));
	pi.on("before_agent_start", () => {
		settings = loadTrimSettings();
	});

	pi.on("context_with_system", (event, ctx) => {
		try {
			sync(ctx);
			const messages = trimMessages(event.messages, settings, ctx.cwd, captured);
			return messages === event.messages ? undefined : { messages: [...messages] };
		} catch (error) {
			console.error(`[prompt-trim] ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	});

	pi.on("tool_result", (event) => {
		try {
			for (const [name, tools] of Object.entries(settings.sectionsOnFirstUse)) {
				if (tools.includes(event.toolName) && !delivered.has(name)) pending.add(name);
			}
			if (event.parentToolCallId || pending.size === 0) return undefined;
			const texts: string[] = [];
			for (const name of [...pending]) {
				const text = captured.get(name);
				if (text === undefined) continue;
				texts.push(text);
				pending.delete(name);
				delivered.add(name);
			}
			if (texts.length === 0) return undefined;
			const content = [...event.content, { type: "text" as const, text: texts.join("\n\n") }];
			return event.structuredContent === undefined ? { content } : { content, structuredContent: event.structuredContent };
		} catch (error) {
			console.error(`[prompt-trim] ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	});
}
