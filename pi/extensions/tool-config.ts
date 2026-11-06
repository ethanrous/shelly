/**
 * Defers rarely used extension tools and rewrites tool descriptions, as configured in
 * ~/.pi/agent/settings.json:
 *
 * - `deferredTools`: a list of `{ patterns, summary }` groups. A tool whose name matches a pattern
 *   (`*` matches any run of characters) gets `deferred` exposure: it is registered but not declared
 *   to the model until `tool_search` loads it, and codemode scripts can still call it. pi records a
 *   load in the transcript, so a loaded tool stays declared on that branch across resume and `/tree`.
 *   Each group with a deferred tool is listed in a `deferred_tools` system prompt section, since
 *   `tool_search` does not describe what it can find.
 * - `toolOverrides`: tool name to `{ description, parameters, promptGuidelines }`. `parameters` maps
 *   a dotted property path, such as `questions.prompt`, to that property's description; a path steps
 *   through array items. A path the schema does not have is ignored.
 *
 * Both are read from the definition objects other extensions pass to `registerTool()`, and no
 * extension API reaches another extension's definition. The extension therefore wraps
 * `ExtensionRunner.prototype.getAllRegisteredTools`, which pi calls whenever it rebuilds the tool
 * registry, and edits matching definitions there. pi runs every extension factory before it first
 * activates tools, so a new session never declares a tool before it is edited.
 */

import { ExtensionRunner, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DeferredGroup {
	/** Tool name globs; `*` matches any run of characters. */
	patterns: string[];
	/** One line telling the model what the group does, so it knows what to search for. */
	summary: string;
}

export interface ToolOverride {
	description?: string;
	parameters?: Record<string, string>;
	promptGuidelines?: string[];
}

export interface ToolConfig {
	deferredTools: DeferredGroup[];
	toolOverrides: Record<string, ToolOverride>;
}

const TOOL_SEARCH = "tool_search";
const SECTION = "deferred_tools";
const STATE_KEY = Symbol.for("shelly.defer-tools.groups");
const INNER_KEY = Symbol.for("shelly.defer-tools.inner-get-all-registered-tools");

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** `deferredTools` and `toolOverrides` from pi's settings.json; empty when unset or unreadable. */
export function loadToolConfig(settingsPath = join(process.env.HOME ?? homedir(), ".pi", "agent", "settings.json")): ToolConfig {
	try {
		const raw = JSON.parse(readFileSync(settingsPath, "utf8")) as { deferredTools?: unknown; toolOverrides?: unknown };
		const deferredTools = (Array.isArray(raw.deferredTools) ? raw.deferredTools : [])
			.map((group) => ({ patterns: strings(group?.patterns), summary: typeof group?.summary === "string" ? group.summary : "" }))
			.filter((group) => group.patterns.length > 0);
		const overrides = raw.toolOverrides && typeof raw.toolOverrides === "object" ? (raw.toolOverrides as Record<string, unknown>) : {};
		const toolOverrides: Record<string, ToolOverride> = {};
		for (const [name, value] of Object.entries(overrides)) {
			if (!value || typeof value !== "object") continue;
			const v = value as Record<string, unknown>;
			const override: ToolOverride = {};
			if (typeof v.description === "string") override.description = v.description;
			if (v.parameters && typeof v.parameters === "object") {
				override.parameters = Object.fromEntries(Object.entries(v.parameters).filter(([, text]) => typeof text === "string")) as Record<string, string>;
			}
			if (Array.isArray(v.promptGuidelines)) override.promptGuidelines = strings(v.promptGuidelines);
			toolOverrides[name] = override;
		}
		return { deferredTools, toolOverrides };
	} catch {
		return { deferredTools: [], toolOverrides: {} };
	}
}

function globToRegExp(glob: string): RegExp {
	const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`);
}

/** Index of the first group whose patterns match `name`, or -1. */
export function matchGroup(groups: readonly DeferredGroup[], name: string): number {
	return groups.findIndex((group) => group.patterns.some((pattern) => globToRegExp(pattern).test(name)));
}

/** System prompt text for the groups that have deferred tools, keyed by group index. */
export function renderSection(groups: readonly DeferredGroup[], counts: ReadonlyMap<number, number>): string {
	const lines = [...counts.keys()]
		.sort((a, b) => a - b)
		.map((index) => {
			const group = groups[index];
			const count = counts.get(index) ?? 0;
			return `- ${group.patterns.join(", ")} (${count} tool${count === 1 ? "" : "s"}): ${group.summary}`;
		});
	return [
		`Undeclared tools: call them from \`codemode\` (find them with \`searchTools()\`), or load them with \`${TOOL_SEARCH}\` to call them directly many times.`,
		...lines,
	].join("\n");
}

interface SchemaNode {
	description?: string;
	properties?: Record<string, SchemaNode>;
	items?: SchemaNode;
}

/** The schema node at a dotted property path, stepping through array items; undefined when absent. */
export function findProperty(schema: SchemaNode | undefined, path: string): SchemaNode | undefined {
	let node = schema;
	for (const segment of path.split(".")) {
		node = (node?.properties ?? node?.items?.properties)?.[segment];
		if (!node) return undefined;
	}
	return node;
}

interface Definition {
	name: string;
	exposure?: string;
	description?: string;
	parameters?: SchemaNode;
	promptGuidelines?: string[];
}

/** Applies `override` to `definition` in place. */
export function applyOverride(definition: Definition, override: ToolOverride): void {
	if (override.description !== undefined) definition.description = override.description;
	if (override.promptGuidelines !== undefined) definition.promptGuidelines = [...override.promptGuidelines];
	for (const [path, text] of Object.entries(override.parameters ?? {})) {
		const node = findProperty(definition.parameters, path);
		if (node) node.description = text;
	}
}

interface RegisteredTool {
	definition: Definition;
}

function currentConfig(): ToolConfig {
	return ((globalThis as Record<symbol, unknown>)[STATE_KEY] as ToolConfig | undefined) ?? { deferredTools: [], toolOverrides: {} };
}

function installWrapper(): void {
	const proto = ExtensionRunner.prototype as unknown as Record<string | symbol, any>;
	const inner = proto.getAllRegisteredTools[INNER_KEY] ?? proto.getAllRegisteredTools;
	const wrapped = function (this: unknown): RegisteredTool[] {
		const tools: RegisteredTool[] = inner.call(this);
		const { deferredTools, toolOverrides } = currentConfig();
		for (const { definition } of tools) {
			const override = toolOverrides[definition.name];
			if (override) applyOverride(definition, override);
			if ((definition.exposure ?? "direct") === "direct" && matchGroup(deferredTools, definition.name) >= 0) {
				definition.exposure = "deferred";
			}
		}
		return tools;
	};
	(wrapped as any)[INNER_KEY] = inner;
	proto.getAllRegisteredTools = wrapped;
}

export default function toolConfigExtension(pi: ExtensionAPI): void {
	(globalThis as Record<symbol, unknown>)[STATE_KEY] = loadToolConfig();
	installWrapper();

	/** Deferred tools per group index, counting only tools the configured groups match. */
	function deferredCounts(groups: readonly DeferredGroup[]): Map<number, number> {
		const counts = new Map<number, number>();
		for (const tool of pi.getAllTools()) {
			if (tool.exposure !== "deferred") continue;
			const index = matchGroup(groups, tool.name);
			if (index >= 0) counts.set(index, (counts.get(index) ?? 0) + 1);
		}
		return counts;
	}

	pi.on("before_agent_start", (event) => {
		const groups = currentConfig().deferredTools;
		const counts = deferredCounts(groups);
		if (counts.size > 0) event.systemPromptOptions.sections[SECTION] = renderSection(groups, counts);
	});
}
