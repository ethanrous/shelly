/**
 * Shows elapsed time and token count on the collapsed thinking label.
 *
 *   ⠋ Thinking... 42.1s (1.3k tokens)     while the model is thinking
 *   Thought for 11.2s (756 tokens)        once thinking has ended
 *   Thought (~756 tokens)                 for messages that were not streamed in this process
 *
 * AssistantMessageComponent reads `hiddenThinkingLabel` on every updateContent() call, so the
 * label is set per component right before the wrapped updateContent() runs.
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { AssistantMessageComponent, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;
const INNER_KEY = Symbol.for("shelly.thinking-stats.inner-update-content");

interface ThinkingStats {
	/** Total duration of finished thinking spans. */
	elapsedMs: number;
	/** Start of the thinking span in progress. Undefined when the model is not thinking. */
	spanStart?: number;
	/** Time of the latest thinking_end in the span in progress. */
	lastEnd?: number;
	/** Estimated token count of the streamed thinking text. */
	tokens: number;
}

/** One token per word or punctuation character. Independent of how the server batches tokens into deltas. */
const TOKEN_REGEX = /\w+|[^\s\w]/g;

function estimateTokens(text: string): number {
	return text ? (text.match(TOKEN_REGEX)?.length ?? 0) : 0;
}

/** Stats per assistant message, keyed by message.timestamp. */
const statsByMessage = new Map<number, ThinkingStats>();
/** Components rendering the messages that are currently thinking, keyed by message.timestamp. */
const liveComponents = new Map<number, WeakRef<any>>();
let theme: ExtensionContext["ui"]["theme"] | undefined;
let spinnerFrame = 0;
let ticker: ReturnType<typeof setInterval> | undefined;

function formatDuration(ms: number): string {
	const seconds = ms / 1000;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

function formatCount(count: number): string {
	if (count < 1000) return String(count);
	if (count < 100_000) return `${(count / 1000).toFixed(1)}k`;
	return `${Math.round(count / 1000)}k`;
}

function thinkingCharCount(message: AssistantMessage): number {
	let chars = 0;
	for (const block of message.content) {
		if (block.type === "thinking") chars += block.thinking.trim().length;
	}
	return chars;
}

/** Estimated from the streamed deltas when available, otherwise 4 characters per token. */
function formatTokens(message: AssistantMessage, stats: ThinkingStats | undefined): string {
	if (stats && stats.tokens > 0) return `${formatCount(stats.tokens)} tokens`;
	return `~${formatCount(Math.ceil(thinkingCharCount(message) / 4))} tokens`;
}

function buildLabel(message: AssistantMessage): string | undefined {
	if (thinkingCharCount(message) === 0) return undefined;

	const stats = statsByMessage.get(message.timestamp);
	const tokens = formatTokens(message, stats);
	if (!stats) return `Thought (${tokens})`;

	if (stats.spanStart === undefined) return `Thought for ${formatDuration(stats.elapsedMs)} (${tokens})`;

	const elapsed = stats.elapsedMs + Date.now() - stats.spanStart;
	const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
	const text = `Thinking... ${formatDuration(elapsed)} (${tokens})`;
	// The caller wraps the label in the dim thinkingText color. Colors set here take precedence.
	return theme ? `${theme.fg("accent", frame)} ${theme.fg("text", text)}` : `${frame} ${text}`;
}

/**
 * Wraps whatever updateContent() is currently installed, including replacements made by other
 * extensions. Safe to call repeatedly.
 */
function installWrapper(): void {
	const proto = AssistantMessageComponent.prototype as any;
	const inner = proto.updateContent[INNER_KEY] ?? proto.updateContent;

	const wrapped = function (this: any, message: AssistantMessage, ...rest: unknown[]) {
		try {
			const label = message?.role === "assistant" ? buildLabel(message) : undefined;
			if (label !== undefined) {
				this.hiddenThinkingLabel = label;
				if (statsByMessage.get(message.timestamp)?.spanStart !== undefined) {
					liveComponents.set(message.timestamp, new WeakRef(this));
				}
			}
		} catch {
			// Fall through to the default label.
		}
		return inner.call(this, message, ...rest);
	};
	(wrapped as any)[INNER_KEY] = inner;
	proto.updateContent = wrapped;
}

function uninstallWrapper(): void {
	const proto = AssistantMessageComponent.prototype as any;
	const inner = proto.updateContent[INNER_KEY];
	if (inner) proto.updateContent = inner;
}

function stopTicker(): void {
	if (ticker) clearInterval(ticker);
	ticker = undefined;
}

/** Redraws the label of every message that is thinking. The working loader drives the repaint. */
function tick(): void {
	spinnerFrame++;
	for (const [key, ref] of liveComponents) {
		const component = ref.deref();
		if (!component || statsByMessage.get(key)?.spanStart === undefined) {
			liveComponents.delete(key);
			continue;
		}
		const hidden = component.thinkingVisibilityOverrides?.get(0) ?? component.hideThinkingBlock;
		if (hidden && component.lastMessage) component.updateContent(component.lastMessage);
	}
	if (liveComponents.size === 0) stopTicker();
}

function startTicker(): void {
	ticker ??= setInterval(tick, SPINNER_INTERVAL_MS);
}

function finishSpan(key: number): void {
	const stats = statsByMessage.get(key);
	if (!stats || stats.spanStart === undefined) return;
	stats.elapsedMs += (stats.lastEnd ?? Date.now()) - stats.spanStart;
	stats.spanStart = undefined;
	stats.lastEnd = undefined;
}

export default function thinkingStatsExtension(pi: ExtensionAPI): void {
	installWrapper();

	// Runs after every extension has loaded, so the wrapper ends up outermost.
	pi.on("session_start", async (_event, ctx) => {
		theme = ctx.ui.theme;
		installWrapper();
	});

	pi.on("message_update", async (event, ctx) => {
		theme = ctx.ui.theme;
		const message = event.message;
		if (message.role !== "assistant") return;

		const type = event.assistantMessageEvent.type;
		if (type === "thinking_start" || type === "thinking_delta") {
			let stats = statsByMessage.get(message.timestamp);
			if (!stats) {
				stats = { elapsedMs: 0, tokens: 0 };
				statsByMessage.set(message.timestamp, stats);
			}
			stats.spanStart ??= Date.now();
			stats.lastEnd = undefined;
			if (type === "thinking_delta") stats.tokens += estimateTokens(event.assistantMessageEvent.delta ?? "");
			startTicker();
		} else if (type === "thinking_end") {
			// Another thinking block may follow, so the span stays open until other content arrives.
			// Some providers send thinking_end after the answer has started; the span is closed by then.
			const stats = statsByMessage.get(message.timestamp);
			if (stats?.spanStart !== undefined) stats.lastEnd = Date.now();
		} else if (type !== "start") {
			finishSpan(message.timestamp);
		}
	});

	pi.on("message_end", async (event) => {
		if (event.message.role === "assistant") finishSpan(event.message.timestamp);
	});

	pi.on("agent_end", async () => {
		for (const key of statsByMessage.keys()) finishSpan(key);
	});

	pi.on("session_shutdown", async () => {
		stopTicker();
		liveComponents.clear();
		uninstallWrapper();
	});
}
