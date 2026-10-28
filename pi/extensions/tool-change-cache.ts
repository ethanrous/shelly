/**
 * Keeps the Anthropic prompt cache when a request ends with many native tool changes.
 *
 * With native mid-conversation tool changes, the tools a `tool_search` call loads go out as
 * `tool_addition` blocks in a system message at the end of the next request, and pi puts its only
 * conversation cache breakpoint on the last of them. Anthropic looks for an earlier cache entry at
 * most 20 blocks before a breakpoint, so loading more than about 15 tools at once leaves the
 * previous request's entry out of reach and re-bills most of the conversation. This extension adds
 * a breakpoint on the message before that system message, which sits a few blocks after the
 * previous entry.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Anthropic rejects requests with more cache breakpoints than this. */
const MAX_BREAKPOINTS = 4;
const TOOL_CHANGES = new Set(["tool_addition", "tool_removal"]);
const CACHEABLE = new Set(["text", "image", "document", "tool_result"]);

interface Block {
	type?: string;
	text?: string;
	cache_control?: unknown;
}

interface Message {
	role?: string;
	content?: unknown;
}

function blocks(value: unknown): Block[] {
	return Array.isArray(value) ? value.filter((item): item is Block => typeof item === "object" && item !== null) : [];
}

function countBreakpoints(payload: { system?: unknown; tools?: unknown; messages?: unknown }): number {
	const all = [...blocks(payload.system), ...blocks(payload.tools), ...blocks(payload.messages).flatMap((m) => blocks((m as Message).content))];
	return all.filter((block) => block.cache_control !== undefined).length;
}

/** Adds a cache breakpoint before a trailing system message of tool changes. Returns whether it changed the payload. */
export function markBeforeToolChanges(payload: unknown): boolean {
	if (typeof payload !== "object" || payload === null) return false;
	const request = payload as { system?: unknown; tools?: unknown; messages?: unknown };
	if (!Array.isArray(request.messages) || request.messages.length < 2) return false;
	const messages = request.messages as Message[];
	const last = messages[messages.length - 1];
	const lastBlocks = blocks(last.content);
	if (last.role !== "system" || !lastBlocks.some((block) => TOOL_CHANGES.has(block.type ?? ""))) return false;
	const control = lastBlocks[lastBlocks.length - 1]?.cache_control;
	if (control === undefined || countBreakpoints(request) >= MAX_BREAKPOINTS) return false;

	const previous = messages[messages.length - 2];
	if (typeof previous.content === "string") {
		if (previous.content.trim() === "") return false;
		previous.content = [{ type: "text", text: previous.content, cache_control: control }];
		return true;
	}
	const previousBlocks = blocks(previous.content);
	const target = previousBlocks[previousBlocks.length - 1];
	if (!target || target.cache_control !== undefined || !CACHEABLE.has(target.type ?? "")) return false;
	target.cache_control = control;
	return true;
}

export default function toolChangeCacheExtension(pi: ExtensionAPI): void {
	pi.on("before_provider_request", (event) => (markBeforeToolChanges(event.payload) ? event.payload : undefined));
}
