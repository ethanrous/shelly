/**
 * Compacts a GitHub Copilot session before sending a prompt when the provider's prompt cache
 * has expired.
 *
 * Copilot keeps a Claude prompt cache for 5 minutes after the request that last used it, or for
 * 1 hour when pi runs with PI_CACHE_RETENTION=long, and bills a cache miss as a full rewrite of
 * the context. When the user submits a prompt after that window, the context is compacted first,
 * so the rewrite covers the compacted context instead of the full transcript. The prompt is held
 * until compaction finishes and then sent unchanged.
 *
 * The idle time is measured from the start of the last Copilot request, which is the assistant
 * message's `timestamp`. It is rebuilt from the branch on session start, so a resumed session
 * is also compacted before its first prompt.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "github-copilot";
const CACHE_TTL_MS = (process.env.PI_CACHE_RETENTION === "long" ? 60 : 5) * 60_000;
/** Below this size a cache rewrite is cheap and compaction saves little. */
const MIN_CONTEXT_TOKENS = 100_000;

interface BranchEntry {
	type?: string;
	message?: { role?: string; provider?: string; timestamp?: number };
}

/** Start time of the last Copilot request on the branch, or undefined if a compaction followed it. */
export function lastCopilotRequestAt(entries: readonly BranchEntry[]): number | undefined {
	let last: number | undefined;
	for (const entry of entries) {
		if (entry.type === "compaction") last = undefined;
		const message = entry.message;
		if (entry.type === "message" && message?.role === "assistant" && message.provider === PROVIDER) {
			last = message.timestamp;
		}
	}
	return last;
}

function compact(ctx: ExtensionContext): Promise<void> {
	return new Promise((resolve, reject) => ctx.compact({ onComplete: () => resolve(), onError: reject }));
}

function formatIdle(ms: number): string {
	const minutes = Math.floor(ms / 60_000);
	return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

export default function copilotCacheCompactExtension(pi: ExtensionAPI): void {
	let lastRequestAt: number | undefined;

	pi.on("session_start", (_event, ctx) => {
		try {
			lastRequestAt = lastCopilotRequestAt(ctx.sessionManager.getBranch() as BranchEntry[]);
		} catch {
			lastRequestAt = undefined;
		}
	});

	pi.on("message_end", (event) => {
		const message = event.message as BranchEntry["message"];
		if (message?.role === "assistant" && message.provider === PROVIDER && typeof message.timestamp === "number") {
			lastRequestAt = message.timestamp;
		}
	});

	pi.on("session_compact", () => {
		lastRequestAt = undefined;
	});

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension" || event.streamingBehavior !== undefined) return { action: "continue" };
		if (ctx.model?.provider !== PROVIDER || lastRequestAt === undefined) return { action: "continue" };
		const idle = Date.now() - lastRequestAt;
		if (idle < CACHE_TTL_MS) return { action: "continue" };
		const tokens = ctx.getContextUsage()?.tokens;
		if (tokens == null || tokens < MIN_CONTEXT_TOKENS) return { action: "continue" };

		if (ctx.hasUI) {
			const size = `${Math.round(tokens / 1000)}k`;
			ctx.ui.notify(`Copilot cache expired (idle ${formatIdle(idle)}); compacting ${size} tokens before sending`, "info");
		}
		try {
			await compact(ctx);
		} catch (error) {
			if (ctx.hasUI) {
				const reason = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Compaction failed (${reason}); sending without it`, "warning");
			}
		}
		return { action: "continue" };
	});
}
