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
 *
 * Compaction runs only when the conversation it can summarize is at least MIN_COMPACTABLE_TOKENS:
 * the model context minus system messages, the current summary, and `compaction.keepRecentTokens`
 * from ~/.pi/agent/settings.json. pi's `estimateTokens` counts 4 characters per token, so the
 * estimate is scaled to Copilot tokens by the ratio of the last request's reported prompt size to
 * the estimate of that same prompt.
 */

import {
  buildSessionContext,
  DEFAULT_COMPACTION_SETTINGS,
  estimateTokens,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROVIDER = "github-copilot";
const CACHE_TTL_MS =
  (process.env.PI_CACHE_RETENTION === "long" ? 60 : 5) * 60_000;
/** Below this many summarizable Copilot tokens, compaction saves little of the cache rewrite. */
const MIN_COMPACTABLE_TOKENS = 10_000;

type ContextMessage = Parameters<typeof estimateTokens>[0];

interface Usage {
  input?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

interface BranchEntry {
  type?: string;
  id?: string;
  parentId?: string | null;
  message?: {
    role?: string;
    provider?: string;
    timestamp?: number;
    stopReason?: string;
    usage?: Usage;
  };
}

type SessionEntries = Parameters<typeof buildSessionContext>[0];

/** Start time of the last Copilot request on the branch, or undefined if a compaction followed it. */
export function lastCopilotRequestAt(
  entries: readonly BranchEntry[],
): number | undefined {
  let last: number | undefined;
  for (const entry of entries) {
    if (entry.type === "compaction") last = undefined;
    const message = entry.message;
    if (
      entry.type === "message" &&
      message?.role === "assistant" &&
      message.provider === PROVIDER
    ) {
      last = message.timestamp;
    }
  }
  return last;
}

/** Prompt tokens Copilot reported for a request: uncached input plus cache reads and writes. */
function promptTokens(usage: Usage | undefined): number {
  return (
    (usage?.input ?? 0) + (usage?.cacheRead ?? 0) + (usage?.cacheWrite ?? 0)
  );
}

/** Last completed Copilot request on the branch with reported usage, or undefined if a compaction followed it. */
export function lastCopilotUsageEntry(
  entries: readonly BranchEntry[],
): BranchEntry | undefined {
  let last: BranchEntry | undefined;
  for (const entry of entries) {
    if (entry.type === "compaction") last = undefined;
    const message = entry.message;
    if (
      entry.type !== "message" ||
      message?.role !== "assistant" ||
      message.provider !== PROVIDER
    )
      continue;
    if (
      message.stopReason === "aborted" ||
      message.stopReason === "error" ||
      promptTokens(message.usage) === 0
    )
      continue;
    last = entry;
  }
  return last;
}

/** Copilot tokens per pi-estimated token, from the last Copilot request on the branch; 1 when unknown. */
export function copilotTokensPerEstimate(
  entries: SessionEntries,
  branch: readonly BranchEntry[],
): number {
  const request = lastCopilotUsageEntry(branch);
  if (!request?.parentId) return 1;
  const real = promptTokens(request.message?.usage);
  const estimated = buildSessionContext(
    entries,
    request.parentId,
  ).messages.reduce((sum, message) => sum + estimateTokens(message), 0);
  return estimated > 0 ? real / estimated : 1;
}

/** `compaction.keepRecentTokens` for `model` from pi's settings.json, honoring `modelOverrides`. */
export function loadKeepRecentTokens(
  model: string,
  settingsPath = join(
    process.env.HOME ?? homedir(),
    ".pi",
    "agent",
    "settings.json",
  ),
): number {
  try {
    const compaction =
      (
        JSON.parse(readFileSync(settingsPath, "utf8")) as {
          compaction?: Record<string, any>;
        }
      ).compaction ?? {};
    const value =
      compaction.modelOverrides?.[model]?.keepRecentTokens ??
      compaction.keepRecentTokens;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
  } catch {}
  return DEFAULT_COMPACTION_SETTINGS.keepRecentTokens;
}

/** Estimated tokens compaction can summarize: conversation messages beyond the kept recent tail. */
export function compactableTokens(
  messages: readonly ContextMessage[],
  keepRecentTokens: number,
): number {
  let total = 0;
  for (const message of messages) {
    if (message.role === "system" || message.role === "compactionSummary")
      continue;
    total += estimateTokens(message);
  }
  return Math.max(0, total - keepRecentTokens);
}

function compact(ctx: ExtensionContext): Promise<void> {
  return new Promise((resolve, reject) =>
    ctx.compact({ onComplete: () => resolve(), onError: reject }),
  );
}

function formatIdle(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

export default function copilotCacheCompactExtension(pi: ExtensionAPI): void {
  let lastRequestAt: number | undefined;

  pi.on("session_start", (_event, ctx) => {
    try {
      lastRequestAt = lastCopilotRequestAt(
        ctx.sessionManager.getBranch() as BranchEntry[],
      );
    } catch {
      lastRequestAt = undefined;
    }
  });

  pi.on("message_end", (event) => {
    const message = event.message as BranchEntry["message"];
    if (
      message?.role === "assistant" &&
      message.provider === PROVIDER &&
      typeof message.timestamp === "number"
    ) {
      lastRequestAt = message.timestamp;
    }
  });

  pi.on("session_compact", () => {
    lastRequestAt = undefined;
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension" || event.streamingBehavior !== undefined)
      return { action: "continue" };
    if (ctx.model?.provider !== PROVIDER || lastRequestAt === undefined)
      return { action: "continue" };
    const idle = Date.now() - lastRequestAt;
    if (idle < CACHE_TTL_MS) return { action: "continue" };
    const { sessionManager } = ctx;
    const messages = buildSessionContext(
      sessionManager.getEntries(),
      sessionManager.getLeafId(),
    ).messages;
    const estimated = compactableTokens(
      messages,
      loadKeepRecentTokens(`${ctx.model.provider}/${ctx.model.id}`),
    );
    const compactable = Math.round(
      estimated *
        copilotTokensPerEstimate(
          sessionManager.getEntries(),
          sessionManager.getBranch() as BranchEntry[],
        ),
    );
    const size = `${Math.round(compactable / 1000)}k`;
    if (compactable < MIN_COMPACTABLE_TOKENS) {
      if (ctx.hasUI) {
        const min = `${MIN_COMPACTABLE_TOKENS / 1000}k`;
        ctx.ui.notify(
          `Copilot cache expired (idle ${formatIdle(idle)}); not compacting: ${size} compactable tokens is under ${min}`,
          "info",
        );
      }
      return { action: "continue" };
    }

    if (ctx.hasUI) {
      ctx.ui.notify(
        `Copilot cache expired (idle ${formatIdle(idle)}); compacting ${size} tokens before sending`,
        "info",
      );
    }
    try {
      await compact(ctx);
    } catch (error) {
      if (ctx.hasUI) {
        const reason = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `Compaction failed (${reason}); sending without it`,
          "warning",
        );
      }
    }
    return { action: "continue" };
  });
}
