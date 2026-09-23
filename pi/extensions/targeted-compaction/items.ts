/**
 * Extracts prunable items (tool results and thinking blocks) from a message list.
 *
 * Pure module: no pi imports besides types. A "turn" starts at a user message and runs
 * through the next user message, matching pi's own compaction terminology.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";

export type ItemKind = "tool" | "thinking";

interface BaseItem {
	id: string;
	kind: ItemKind;
	messageIndex: number;
	/** 1-based index of the user turn this item belongs to. */
	turnIndex: number;
	tokens: number;
}

export interface ToolItem extends BaseItem {
	kind: "tool";
	toolCallId: string;
	toolName: string;
	path?: string;
	input?: Record<string, unknown>;
	isError: boolean;
	contentHash: string;
	preview: string;
	textLength: number;
}

export interface ThinkingItem extends BaseItem {
	kind: "thinking";
	assistantTimestamp: number;
	blockIndex: number;
}

export type Item = ToolItem | ThinkingItem;

/** Same chars/4 heuristic pi itself uses for token estimates. */
export function estimateTokens(text: string): number {
	return text ? Math.ceil(text.length / 4) : 0;
}

/** Non-cryptographic hash, sufficient for exact-duplicate-output keying. */
function hashContent(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

function textOf(content: ReadonlyArray<{ type: string; text?: string }> | undefined): string {
	if (!content) return "";
	return content
		.filter(c => c.type === "text" && typeof c.text === "string")
		.map(c => c.text as string)
		.join("\n");
}

function pathOf(input: unknown): string | undefined {
	if (input && typeof input === "object" && typeof (input as Record<string, unknown>).path === "string") {
		return (input as Record<string, unknown>).path as string;
	}
	return undefined;
}

function preview(text: string): string {
	const lines = text.split("\n").filter(line => line.trim().length > 0);
	if (lines.length <= 2) return lines.join("\n");
	return `${lines[0]}\n...\n${lines[lines.length - 1]}`;
}

/** Total number of user turns represented in `messages`. */
export function currentTurnCount(messages: readonly AgentMessage[]): number {
	let turns = 0;
	for (const message of messages) {
		if ((message as { role?: string }).role === "user") turns++;
	}
	return turns;
}

export function extractItems(messages: readonly AgentMessage[]): Item[] {
	const items: Item[] = [];
	const toolCallInfo = new Map<string, { name: string; input: unknown }>();
	let turnIndex = 0;

	for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
		const message = messages[messageIndex] as { role?: string; [key: string]: unknown };
		if (message.role === "user") {
			turnIndex++;
			continue;
		}
		if (message.role === "assistant") {
			const content = (message.content as Array<Record<string, unknown>>) ?? [];
			const timestamp = message.timestamp as number;
			content.forEach((block, blockIndex) => {
				if (block.type === "toolCall") {
					toolCallInfo.set(block.id as string, { name: block.name as string, input: block.arguments });
				} else if (block.type === "thinking") {
					const text = (block.thinking as string) ?? "";
					items.push({
						id: `thinking:${timestamp}:${blockIndex}`,
						kind: "thinking",
						messageIndex,
						turnIndex,
						tokens: estimateTokens(text),
						assistantTimestamp: timestamp,
						blockIndex,
					});
				}
			});
			continue;
		}
		if (message.role === "toolResult") {
			const toolCallId = message.toolCallId as string;
			const call = toolCallInfo.get(toolCallId);
			const text = textOf(message.content as Array<{ type: string; text?: string }>);
			items.push({
				id: `tool:${toolCallId}`,
				kind: "tool",
				messageIndex,
				turnIndex,
				tokens: estimateTokens(text),
				toolCallId,
				toolName: (message.toolName as string) ?? call?.name ?? "unknown",
				path: pathOf(call?.input),
				input: (call?.input as Record<string, unknown>) ?? undefined,
				isError: Boolean(message.isError),
				contentHash: hashContent(text),
				preview: preview(text),
				textLength: text.length,
			});
		}
	}

	return items;
}
