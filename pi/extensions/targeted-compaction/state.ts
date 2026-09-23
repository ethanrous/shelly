/**
 * Stateful orchestration: scoring, the applied set, flush/undo, persistence, and the
 * false-positive log. This is the only module that touches pi's runtime (ctx, pi.appendEntry,
 * fs). Everything scoring-related delegates to the pure modules.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_CONFIG, loadConfig, type ScorerKind, type TargetedCompactionConfig } from "./config.ts";
import { currentTurnCount, estimateTokens, extractItems, type Item, type ToolItem } from "./items.ts";
import { scoreRules, type Candidate, type RulesConfig } from "./rules.ts";
import { scoreWithLaya, scoreWithLlm } from "./scorers.ts";

const CUSTOM_TYPE = "targeted-compaction";
const FALSE_POSITIVE_TURN_WINDOW = 5;

interface PersistedFlushBatch {
	ids: string[];
	tokens: number;
	timestamp: number;
	turnIndex: number;
}

interface PersistedState {
	applied: string[];
	flushBatches: PersistedFlushBatch[];
	scorerOverride?: ScorerKind;
}

interface FlushSignature {
	toolName: string;
	signature: string;
	scorer: string;
	reported: boolean;
}

interface FlushRecord extends PersistedFlushBatch {
	signatures: Map<string, FlushSignature>;
}

function formatTokenCount(tokens: number): string {
	if (tokens < 1000) return String(tokens);
	return `${(tokens / 1000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
}

function scorerOf(reason: string): string {
	if (reason.startsWith("laya:")) return "laya";
	if (reason.startsWith("llm:")) return "llm";
	return "rules";
}

function toolSignature(toolName: string, input: unknown): string {
	const path = input && typeof input === "object" && typeof (input as Record<string, unknown>).path === "string" ? (input as Record<string, unknown>).path : undefined;
	return typeof path === "string" ? `${toolName}:${path}` : `${toolName}:${JSON.stringify(input ?? {})}`;
}

function lastUserText(messages: readonly AgentMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { role?: string; content?: unknown };
		if (m.role !== "user") continue;
		const content = m.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.filter((c: { type?: string }) => c.type === "text")
				.map((c: { text?: string }) => c.text ?? "")
				.join("\n");
		}
	}
	return "";
}

export function currentTurnFromContext(ctx: ExtensionContext): number {
	return currentTurnCount(messagesFromContext(ctx));
}

function messagesFromContext(ctx: ExtensionContext): AgentMessage[] {
	const entries = ctx.sessionManager.buildContextEntries();
	const messages: AgentMessage[] = [];
	for (const entry of entries) {
		if (entry.type === "message") messages.push(entry.message);
	}
	return messages;
}

/**
 * Rewrites `messages` using only the `applied` set: pruned tool results become one-line stubs,
 * pruned thinking blocks are dropped. Pure and deterministic in (messages, applied) so the
 * provider-facing prefix stays byte-identical across requests for a given applied set.
 */
export function applyPruning(messages: readonly AgentMessage[], applied: ReadonlySet<string>): AgentMessage[] {
	if (applied.size === 0) return messages as AgentMessage[];

	const toolCallInfo = new Map<string, { name: string; input: unknown }>();
	for (const message of messages) {
		const m = message as { role?: string; content?: unknown };
		if (m.role !== "assistant") continue;
		for (const block of (m.content as Array<Record<string, unknown>>) ?? []) {
			if (block.type === "toolCall") toolCallInfo.set(block.id as string, { name: block.name as string, input: block.arguments });
		}
	}

	return messages.map(message => {
		const m = message as Record<string, unknown>;
		if (m.role === "toolResult") {
			const id = `tool:${m.toolCallId as string}`;
			if (!applied.has(id)) return message;
			return { ...m, content: [stubFor(m, toolCallInfo)], details: undefined } as AgentMessage;
		}
		if (m.role === "assistant") {
			const timestamp = m.timestamp as number;
			const content = (m.content as Array<Record<string, unknown>>) ?? [];
			const filtered = content.filter((block, index) => !(block.type === "thinking" && applied.has(`thinking:${timestamp}:${index}`)));
			if (filtered.length === content.length) return message;
			return { ...m, content: filtered } as AgentMessage;
		}
		return message;
	});
}

function stubFor(toolResult: Record<string, unknown>, toolCallInfo: Map<string, { name: string; input: unknown }>): { type: "text"; text: string } {
	const toolName = (toolResult.toolName as string) ?? "tool";
	const call = toolCallInfo.get(toolResult.toolCallId as string);
	const path =
		call?.input && typeof call.input === "object" ? (call.input as Record<string, unknown>).path : undefined;
	const text = ((toolResult.content as Array<{ type: string; text?: string }>) ?? [])
		.filter(c => c.type === "text")
		.map(c => c.text ?? "")
		.join("\n");
	const lines = text ? text.split("\n").length : 0;
	const tokens = estimateTokens(text);
	const label = typeof path === "string" ? `${toolName} ${path}` : toolName;
	return { type: "text", text: `[pruned by targeted-compaction: ${label}, ${lines} lines, ~${formatTokenCount(tokens)} tokens. Re-run the tool if you need it.]` };
}

export class PruneManager {
	config: TargetedCompactionConfig = { ...DEFAULT_CONFIG };
	candidates = new Map<string, Candidate>();
	applied = new Set<string>();

	private scorerOverride: ScorerKind | undefined;
	private flushBatches: FlushRecord[] = [];
	private secondaryScored = new Set<string>();
	private lastItemsById = new Map<string, Item>();
	private abortController: AbortController | undefined;
	private layaWarned = false;

	get effectiveScorer(): ScorerKind {
		return this.scorerOverride ?? this.config.scorer;
	}

	setScorerOverride(scorer: ScorerKind | undefined): void {
		this.scorerOverride = scorer;
	}

	async refreshConfig(ctx: ExtensionContext): Promise<void> {
		this.config = await loadConfig(ctx.model?.provider, ctx.model?.id);
	}

	/** Restores applied/flush-history state from this branch's custom entries. Candidates are recomputed, not restored. */
	restore(ctx: ExtensionContext): void {
		this.candidates.clear();
		this.applied.clear();
		this.flushBatches = [];
		this.secondaryScored.clear();
		this.scorerOverride = undefined;
		this.layaWarned = false;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue;
			const data = entry.data as PersistedState | undefined;
			if (!data) continue;
			this.applied = new Set(data.applied ?? []);
			this.flushBatches = (data.flushBatches ?? []).map(batch => ({ ...batch, signatures: new Map() }));
			this.scorerOverride = data.scorerOverride;
		}
	}

	private persist(pi: ExtensionAPI): void {
		const data: PersistedState = {
			applied: [...this.applied],
			flushBatches: this.flushBatches.map(({ ids, tokens, timestamp, turnIndex }) => ({ ids, tokens, timestamp, turnIndex })),
			scorerOverride: this.scorerOverride,
		};
		pi.appendEntry(CUSTOM_TYPE, data);
	}

	private async log(record: Record<string, unknown>): Promise<void> {
		try {
			const dir = join(getAgentDir(), "targeted-compaction");
			await mkdir(dir, { recursive: true });
			await appendFile(join(dir, "log.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
		} catch {
			// Best-effort logging; must never affect pruning behavior.
		}
	}

	/** Scores newly seen items in the background. Aborts any scoring run still in flight. */
	async score(ctx: ExtensionContext): Promise<void> {
		if (!this.config.enabled) return;
		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;
		const { signal } = controller;

		try {
			const messages = messagesFromContext(ctx);
			const items = extractItems(messages);
			this.lastItemsById = new Map(items.map(item => [item.id, item]));
			const currentTurn = currentTurnCount(messages);
			const goal = lastUserText(messages);
			const allowThinkingPrune = ctx.model?.api === "openai-completions";

			const rulesConfig: RulesConfig = {
				protectTurns: this.config.protectTurns,
				bulkyTokens: this.config.bulkyTokens,
				bulkyAgeTurns: this.config.bulkyAgeTurns,
				allowThinkingPrune,
			};
			const ruleCandidates = scoreRules(items, currentTurn, rulesConfig);

			const merged = new Map(ruleCandidates);
			for (const [id, candidate] of this.candidates) {
				if (!merged.has(id) && this.secondaryScored.has(id)) merged.set(id, candidate);
			}
			this.candidates = merged;
			if (signal.aborted) return;

			const scorer = this.effectiveScorer;
			if (scorer === "rules") return;

			const isProtected = (item: Item): boolean => currentTurn - item.turnIndex < this.config.protectTurns;
			const unscored = items.filter(
				(item): item is ToolItem =>
					item.kind === "tool" && !this.candidates.has(item.id) && !this.secondaryScored.has(item.id) && !isProtected(item),
			);
			if (unscored.length === 0) return;

			if (scorer === "laya") {
				const { candidates: found, attempted, unreachable } = await scoreWithLaya(
					unscored,
					goal,
					currentTurn,
					this.config.layaEndpoint,
					this.config.layaThreshold,
					signal,
				);
				for (const id of attempted) this.secondaryScored.add(id);
				for (const [id, candidate] of found) this.candidates.set(id, candidate);
				if (unreachable) this.notifyLayaUnreachableOnce(ctx);
			} else if (scorer === "llm" && this.config.llmModel) {
				const { candidates: found, attempted } = await scoreWithLlm(ctx, unscored, goal, this.config.llmModel, signal);
				for (const id of attempted) this.secondaryScored.add(id);
				for (const [id, candidate] of found) this.candidates.set(id, candidate);
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") return;
			throw error;
		}
	}

	private notifyLayaUnreachableOnce(ctx: ExtensionContext): void {
		if (this.layaWarned) return;
		this.layaWarned = true;
		ctx.ui.notify("targeted-compaction: laya sidecar unreachable, falling back to rules only", "warning");
	}

	unappliedSavings(): number {
		let sum = 0;
		for (const [id, candidate] of this.candidates) if (!this.applied.has(id)) sum += candidate.tokens;
		return sum;
	}

	/** Checks the flush threshold and flushes if crossed. Returns whether a flush happened. */
	maybeFlush(pi: ExtensionAPI, ctx: ExtensionContext, currentTurn: number): boolean {
		if (!this.config.enabled) return false;
		const usage = ctx.getContextUsage();
		if (!usage || usage.percent === null || usage.contextWindow <= 0) return false;
		if (usage.percent < this.config.flushAt * 100) return false;
		if (this.unappliedSavings() < this.config.minSavings * usage.contextWindow) return false;
		return Boolean(this.flush(pi, currentTurn, "threshold"));
	}

	flush(pi: ExtensionAPI, currentTurn: number, reason: string): FlushRecord | undefined {
		const toApply = [...this.candidates.entries()].filter(([id]) => !this.applied.has(id));
		if (toApply.length === 0) return undefined;

		const signatures = new Map<string, FlushSignature>();
		let tokens = 0;
		for (const [id, candidate] of toApply) {
			this.applied.add(id);
			tokens += candidate.tokens;
			const item = this.lastItemsById.get(id);
			if (item?.kind === "tool") {
				signatures.set(id, {
					toolName: item.toolName,
					signature: toolSignature(item.toolName, item.input),
					scorer: scorerOf(candidate.reason),
					reported: false,
				});
			}
		}

		const record: FlushRecord = { ids: toApply.map(([id]) => id), tokens, timestamp: Date.now(), turnIndex: currentTurn, signatures };
		this.flushBatches.push(record);
		this.persist(pi);
		void this.log({ type: "flush", reason, ids: record.ids, tokens, scorer: this.effectiveScorer, timestamp: record.timestamp });
		return record;
	}

	undo(pi: ExtensionAPI): FlushRecord | undefined {
		const batch = this.flushBatches.pop();
		if (!batch) return undefined;
		for (const id of batch.ids) this.applied.delete(id);
		this.persist(pi);
		return batch;
	}

	/** Detects a false positive: a tool call matching a recently pruned item's name+args. */
	checkFalsePositive(currentTurn: number, toolName: string, input: unknown): void {
		const signature = toolSignature(toolName, input);
		for (const batch of this.flushBatches) {
			if (currentTurn - batch.turnIndex > FALSE_POSITIVE_TURN_WINDOW) continue;
			for (const [id, info] of batch.signatures) {
				if (info.reported || info.toolName !== toolName || info.signature !== signature) continue;
				info.reported = true;
				void this.log({ type: "false_positive", id, toolName, scorer: info.scorer, timestamp: Date.now() });
			}
		}
	}

	/** Drops applied/candidate ids for items a real compaction has already summarized away. */
	dropStale(pi: ExtensionAPI, ctx: ExtensionContext): void {
		const messages = messagesFromContext(ctx);
		const liveIds = new Set(extractItems(messages).map(item => item.id));
		let changed = false;
		for (const id of [...this.applied]) {
			if (!liveIds.has(id)) {
				this.applied.delete(id);
				changed = true;
			}
		}
		for (const id of [...this.candidates.keys()]) {
			if (!liveIds.has(id)) this.candidates.delete(id);
		}
		if (changed) this.persist(pi);
	}

	statusText(): string | undefined {
		if (!this.config.enabled) return undefined;
		const unapplied = [...this.candidates.keys()].filter(id => !this.applied.has(id));
		const markedTokens = unapplied.reduce((sum, id) => sum + (this.candidates.get(id)?.tokens ?? 0), 0);
		return `prune: ${unapplied.length} marked ~${formatTokenCount(markedTokens)} · ${this.applied.size} applied`;
	}

	describeCandidates(limit = 20): string {
		const unapplied = [...this.candidates.entries()].filter(([id]) => !this.applied.has(id));
		if (unapplied.length === 0) return "No candidates marked.";
		const lines = unapplied.slice(0, limit).map(([id, c]) => `${id} - ${c.reason} (~${formatTokenCount(c.tokens)} tokens)`);
		const more = unapplied.length > limit ? `\n... and ${unapplied.length - limit} more` : "";
		return lines.join("\n") + more;
	}
}
