/**
 * Defers rarely used extension tools so their declarations are not sent on every request.
 *
 * A tool whose name matches a group in DEFERRED_GROUPS gets `deferred` exposure: it is registered
 * but not declared to the model until the built-in `tool_search` tool loads it. pi records a load
 * in the transcript, so a loaded tool stays declared on that branch across resume and `/tree`.
 *
 * Exposure is read from the definition object the registering extension passed to
 * `registerTool()`, and no extension API reaches another extension's definition. The extension
 * therefore wraps `ExtensionRunner.prototype.getAllRegisteredTools`, which pi calls whenever it
 * rebuilds the tool registry, and sets `exposure` on matching definitions that use the default
 * `direct` exposure. pi runs every extension factory before it first activates tools, so a
 * matching tool is never declared in a new session. A resumed session keeps the tools its
 * transcript declares.
 *
 * Each group with at least one deferred tool is listed in a `deferred_tools` system prompt
 * section, since `tool_search` does not describe what it can find. `tool_search` itself is
 * enabled by `"defaultTools": ["+tool_search"]` in settings.json.
 */

import { ExtensionRunner, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface DeferredGroup {
	/** Tool name globs; `*` matches any run of characters. */
	patterns: string[];
	/** One line telling the model what the group does, so it knows what to search for. */
	summary: string;
}

export const DEFERRED_GROUPS: DeferredGroup[] = [
	{
		patterns: ["browser_*"],
		summary:
			"Browser automation (pi-browser-use): open pages, click, type, fill forms, take screenshots and snapshots, inspect console and network.",
	},
	{
		patterns: ["SubagentWorkflow"],
		summary: "Subagent workflows: run a script that orchestrates many subagents, such as parallel fan-out with verification.",
	},
	{
		patterns: ["skill_manage"],
		summary: "Saved skills: create, patch, update, view, or delete reusable procedures stored as pi skills.",
	},
	{
		patterns: ["memory_remove"],
		summary: "Persistent memory: remove an outdated or wrong memory entry.",
	},
	{
		patterns: ["ddtoolsets", "ddconfig"],
		summary: "Datadog setup: show or switch the Datadog organization and connection, and enable or disable Datadog MCP toolsets.",
	},
	{
		patterns: ["source_check"],
		summary: "Web source checking: gather cited web passages about a claim for review.",
	},
];

const TOOL_SEARCH = "tool_search";
const SECTION = "deferred_tools";
const STATE_KEY = Symbol.for("shelly.defer-tools.groups");
const INNER_KEY = Symbol.for("shelly.defer-tools.inner-get-all-registered-tools");

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
		`These tools are registered but not declared. Call them from a \`codemode\` script (find them with \`searchTools()\`), or load them with \`${TOOL_SEARCH}\` only when you will call them directly many times:`,
		...lines,
	].join("\n");
}

interface RegisteredTool {
	definition: { name: string; exposure?: string };
}

function currentGroups(): DeferredGroup[] {
	return ((globalThis as Record<symbol, unknown>)[STATE_KEY] as DeferredGroup[] | undefined) ?? [];
}

function installWrapper(): void {
	const proto = ExtensionRunner.prototype as unknown as Record<string | symbol, any>;
	const inner = proto.getAllRegisteredTools[INNER_KEY] ?? proto.getAllRegisteredTools;
	const wrapped = function (this: unknown): RegisteredTool[] {
		const tools: RegisteredTool[] = inner.call(this);
		const groups = currentGroups();
		for (const { definition } of tools) {
			if ((definition.exposure ?? "direct") === "direct" && matchGroup(groups, definition.name) >= 0) {
				definition.exposure = "deferred";
			}
		}
		return tools;
	};
	(wrapped as any)[INNER_KEY] = inner;
	proto.getAllRegisteredTools = wrapped;
}

export default function deferToolsExtension(pi: ExtensionAPI): void {
	(globalThis as Record<symbol, unknown>)[STATE_KEY] = DEFERRED_GROUPS;
	installWrapper();

	/** Deferred tools per group index, counting only tools this extension's groups match. */
	function deferredCounts(): Map<number, number> {
		const counts = new Map<number, number>();
		for (const tool of pi.getAllTools()) {
			if (tool.exposure !== "deferred") continue;
			const index = matchGroup(DEFERRED_GROUPS, tool.name);
			if (index >= 0) counts.set(index, (counts.get(index) ?? 0) + 1);
		}
		return counts;
	}

	pi.on("before_agent_start", (event) => {
		const counts = deferredCounts();
		if (counts.size > 0) event.systemPromptOptions.sections[SECTION] = renderSection(DEFERRED_GROUPS, counts);
	});
}
