/**
 * Rule-based candidate scorer. Pure module: no pi imports besides types.
 *
 * Every rule only ever adds a candidate; nothing here removes one. `protectTurns` is
 * enforced up front so no rule needs to repeat that check itself.
 */

import type { Item, ThinkingItem, ToolItem } from "./items.ts";

export interface Candidate {
	id: string;
	reason: string;
	tokens: number;
}

export interface RulesConfig {
	protectTurns: number;
	bulkyTokens: number;
	bulkyAgeTurns: number;
	/** Whether old thinking blocks may be pruned (only safe for some provider APIs). */
	allowThinkingPrune: boolean;
}

/** Outputs this small cost about as much as their stub, so pruning them saves nothing. */
const MIN_PRUNE_TOKENS = 64;

export function scoreRules(items: readonly Item[], currentTurn: number, config: RulesConfig): Map<string, Candidate> {
	const candidates = new Map<string, Candidate>();
	const isProtected = (item: Item): boolean => currentTurn - item.turnIndex < config.protectTurns;
	const mark = (item: Item, reason: string): void => {
		if (isProtected(item) || item.tokens < MIN_PRUNE_TOKENS) return;
		if (!candidates.has(item.id)) candidates.set(item.id, { id: item.id, reason, tokens: item.tokens });
	};

	const toolItems = items.filter((item): item is ToolItem => item.kind === "tool");

	markSupersededReads(toolItems, mark);
	markDuplicateOutputs(toolItems, mark);
	markFailedThenSucceeded(toolItems, mark);
	markBulkyOld(toolItems, currentTurn, config, mark);
	if (config.allowThinkingPrune) markOldThinking(items, isProtected, mark);

	return candidates;
}

/** The line range a `read` covers, or "all" for a full read. */
function readRange(item: ToolItem): string {
	const offset = item.input?.offset;
	const limit = item.input?.limit;
	return offset === undefined && limit === undefined ? "all" : `${offset ?? ""}:${limit ?? ""}`;
}

/** Rule 1: a `read` superseded by a later `write` of the path, or a later read of the same range or the whole file. */
function markSupersededReads(toolItems: readonly ToolItem[], mark: (item: ToolItem, reason: string) => void): void {
	for (const item of toolItems) {
		if (item.toolName !== "read" || !item.path || item.isError) continue;
		const range = readRange(item);
		const superseded = toolItems.some(
			later =>
				later.messageIndex > item.messageIndex &&
				later.path === item.path &&
				!later.isError &&
				(later.toolName === "write" || (later.toolName === "read" && (readRange(later) === "all" || readRange(later) === range))),
		);
		if (superseded) mark(item, `superseded read of ${item.path}`);
	}
}

/** Rule 2: exact duplicate tool outputs, keeping only the latest occurrence. */
function markDuplicateOutputs(toolItems: readonly ToolItem[], mark: (item: ToolItem, reason: string) => void): void {
	const byHash = new Map<string, ToolItem[]>();
	for (const item of toolItems) {
		if (item.textLength === 0) continue;
		const list = byHash.get(item.contentHash) ?? [];
		list.push(item);
		byHash.set(item.contentHash, list);
	}
	for (const list of byHash.values()) {
		if (list.length < 2) continue;
		const sorted = [...list].sort((a, b) => a.messageIndex - b.messageIndex);
		for (const item of sorted.slice(0, -1)) mark(item, "duplicate output, superseded by an identical later result");
	}
}

/** What a call acts on: its path when it has one, otherwise its full input. */
function targetOf(item: ToolItem): string {
	return item.path ?? JSON.stringify(item.input ?? {});
}

/** Rule 3: a failed call followed later by a successful call of the same tool on the same target. */
function markFailedThenSucceeded(toolItems: readonly ToolItem[], mark: (item: ToolItem, reason: string) => void): void {
	for (const item of toolItems) {
		if (!item.isError) continue;
		const target = targetOf(item);
		const retried = toolItems.some(
			later => later.messageIndex > item.messageIndex && !later.isError && later.toolName === item.toolName && targetOf(later) === target,
		);
		if (retried) mark(item, `${item.toolName} failed, later succeeded`);
	}
}

/** Rule 4: outputs bigger than `bulkyTokens`, older than `bulkyAgeTurns`. */
function markBulkyOld(
	toolItems: readonly ToolItem[],
	currentTurn: number,
	config: RulesConfig,
	mark: (item: ToolItem, reason: string) => void,
): void {
	for (const item of toolItems) {
		const age = currentTurn - item.turnIndex;
		if (item.tokens > config.bulkyTokens && age >= config.bulkyAgeTurns) {
			mark(item, `bulky (${item.tokens} tokens) and ${age} turns old`);
		}
	}
}

/** Rule 5: thinking blocks outside the protected window. */
function markOldThinking(items: readonly Item[], isProtected: (item: Item) => boolean, mark: (item: Item, reason: string) => void): void {
	for (const item of items) {
		if (item.kind !== "thinking") continue;
		const thinking = item as ThinkingItem;
		if (!isProtected(thinking)) mark(thinking, "old thinking block");
	}
}
