import { stripRedundantCd } from "./redundant-cd.ts";

export interface CleanContext {
	cwd: string;
	home: string;
}

type Args = Record<string, unknown>;

/** Rewrites a tool call's arguments in place and returns whether it changed them. */
type ToolCallRule = (args: Args, ctx: CleanContext) => boolean;

const bashRedundantCd: ToolCallRule = (args, ctx) => {
	if (typeof args.command !== "string") return false;
	const command = stripRedundantCd(args.command, ctx.cwd, ctx.home);
	if (command === args.command) return false;
	args.command = command;
	return true;
};

const TOOL_CALL_RULES: Record<string, ToolCallRule[]> = {
	bash: [bashRedundantCd],
};

interface ContentPart {
	type?: string;
	name?: string;
	arguments?: unknown;
}

/**
 * Applies the rules to each tool call of an assistant message, editing the `arguments` objects in
 * place. The TUI's tool rows hold references to those objects, so in-place edits also update the
 * rows already on screen. Returns whether anything changed.
 */
export function cleanAssistantMessage(message: { role?: string; content?: unknown }, ctx: CleanContext): boolean {
	if (message.role !== "assistant" || !Array.isArray(message.content)) return false;
	let changed = false;
	for (const part of message.content as ContentPart[]) {
		if (part?.type !== "toolCall" || !part.name) continue;
		const args = part.arguments;
		if (typeof args !== "object" || args === null || Array.isArray(args)) continue;
		for (const rule of TOOL_CALL_RULES[part.name] ?? []) {
			if (rule(args as Args, ctx)) changed = true;
		}
	}
	return changed;
}
