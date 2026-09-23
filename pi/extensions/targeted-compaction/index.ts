/**
 * Prunes redundant/bulky/stale context items while the main model works, then applies all
 * pending candidates in one step once usage crosses a threshold, so the next request pays
 * exactly one cache-miss reprefill instead of a full summarizing compaction. Delays (does not
 * replace) pi-blackhole's compaction. See README.md for the full design.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPruning, currentTurnFromContext, PruneManager } from "./state.ts";

const STATUS_KEY = "targeted-compaction";

const manager = new PruneManager();

function updateStatus(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(STATUS_KEY, manager.statusText());
}

function notEnabled(ctx: ExtensionContext): void {
	ctx.ui.notify("targeted-compaction: not enabled for this model (set targetedCompaction.enabled in models.json)", "info");
}

async function handlePruneCommand(args: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	const [sub, ...rest] = args.trim().split(/\s+/).filter(Boolean);

	switch (sub ?? "status") {
		case "status": {
			if (!manager.config.enabled) return notEnabled(ctx);
			const usage = ctx.getContextUsage();
			const usageText = usage?.percent != null ? `${usage.percent.toFixed(1)}% of ${usage.contextWindow.toLocaleString()} tokens` : "unknown";
			ctx.ui.notify(`${manager.statusText()} · scorer=${manager.effectiveScorer} · usage=${usageText}`, "info");
			return;
		}
		case "show":
			ctx.ui.notify(manager.describeCandidates(), "info");
			return;
		case "now": {
			if (!manager.config.enabled) return notEnabled(ctx);
			const record = manager.flush(pi, currentTurnFromContext(ctx), "manual");
			ctx.ui.notify(record ? `Flushed ${record.ids.length} items (~${record.tokens} tokens)` : "Nothing to flush", "info");
			updateStatus(ctx);
			return;
		}
		case "undo": {
			const batch = manager.undo(pi);
			ctx.ui.notify(batch ? `Restored ${batch.ids.length} items` : "Nothing to undo", "info");
			updateStatus(ctx);
			return;
		}
		case "scorer": {
			const value = rest[0];
			if (value !== "rules" && value !== "laya" && value !== "llm") {
				ctx.ui.notify("Usage: /prune scorer <rules|laya|llm>", "warning");
				return;
			}
			manager.setScorerOverride(value);
			ctx.ui.notify(`targeted-compaction: scorer set to ${value} for this session`, "info");
			return;
		}
		default:
			ctx.ui.notify(`Unknown /prune subcommand: ${sub}. Use status, show, now, undo, or scorer.`, "warning");
	}
}

export default function targetedCompactionExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		manager.restore(ctx);
		await manager.refreshConfig(ctx);
		updateStatus(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		manager.restore(ctx);
		updateStatus(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		await manager.refreshConfig(ctx);
		updateStatus(ctx);
	});

	pi.on("context", async (event, _ctx) => {
		if (!manager.config.enabled || manager.applied.size === 0) return;
		return { messages: applyPruning(event.messages, manager.applied) };
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!manager.config.enabled) return;
		manager.checkFalsePositive(currentTurnFromContext(ctx), event.toolName, event.input);
	});

	pi.on("turn_end", async (_event, ctx) => {
		if (!manager.config.enabled) return;
		manager.score(ctx).catch(() => {
			// Scoring is best-effort; a failed background run just leaves items unscored.
		});
		manager.maybeFlush(pi, ctx, currentTurnFromContext(ctx));
		updateStatus(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!manager.config.enabled) return;
		manager.maybeFlush(pi, ctx, currentTurnFromContext(ctx));
		updateStatus(ctx);
	});

	pi.on("session_compact", async (_event, ctx) => {
		manager.dropStale(pi, ctx);
		updateStatus(ctx);
	});

	pi.registerCommand("prune", {
		description: "Show or control targeted-compaction pruning (status|show|now|undo|scorer)",
		handler: (args, ctx) => handlePruneCommand(args, ctx, pi),
	});
}
