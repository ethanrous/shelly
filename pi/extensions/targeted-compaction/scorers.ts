/**
 * Secondary scorers (laya sidecar, LLM digest) that fill in items the rules scorer left
 * undecided. Both are best-effort: a failure marks nothing and never throws except on abort.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Candidate } from "./rules.ts";
import type { ToolItem } from "./items.ts";

const LAYA_QUESTION_KEY = "still_needed";

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

/**
 * Laya's documented HTTP API (laya-serve, `POST /v1/systemone`) takes one `state` object plus a
 * map of typed questions about it and returns per-question answers. A `noul` question returns a
 * calibrated `P(true)`. There is no documented batch-of-states endpoint, so this asks one
 * question per item, sequentially, and stops at the first connection failure.
 */
export async function scoreWithLaya(
	items: readonly ToolItem[],
	goal: string,
	currentTurn: number,
	endpoint: string,
	threshold: number,
	signal: AbortSignal,
): Promise<{ candidates: Map<string, Candidate>; attempted: Set<string>; unreachable: boolean }> {
	const candidates = new Map<string, Candidate>();
	const attempted = new Set<string>();
	const url = `${endpoint.replace(/\/$/, "")}/v1/systemone`;

	for (const item of items) {
		const age = currentTurn - item.turnIndex;
		const state = {
			goal: goal.slice(0, 600),
			tool: item.toolName,
			args: JSON.stringify(item.input ?? {}).slice(0, 200),
			output_preview: item.preview.slice(0, 600),
			output_tokens: item.tokens,
			age_turns: age,
		};

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					state,
					questions: {
						[LAYA_QUESTION_KEY]: {
							type: "noul",
							instructions: "Is this tool output still needed to finish the current task?",
						},
					},
				}),
				signal,
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const body = (await response.json()) as { answers?: Record<string, { noul?: number }> };
			attempted.add(item.id);
			const pTrue = body.answers?.[LAYA_QUESTION_KEY]?.noul;
			if (typeof pTrue !== "number") continue;
			const pNo = 1 - pTrue;
			if (pNo >= threshold) candidates.set(item.id, { id: item.id, reason: `laya: p(not needed)=${pNo.toFixed(2)}`, tokens: item.tokens });
		} catch (error) {
			if (isAbortError(error)) throw error;
			// Connection failure: leave this and all remaining items unattempted so they're retried
			// once the sidecar is reachable again, instead of being scored "rules only" forever.
			return { candidates, attempted, unreachable: true };
		}
	}

	return { candidates, attempted, unreachable: false };
}

/** Asks a side model for a JSON array of item ids that are safe to drop. */
export async function scoreWithLlm(
	ctx: ExtensionContext,
	items: readonly ToolItem[],
	goal: string,
	model: { provider: string; id: string },
	signal: AbortSignal,
): Promise<{ candidates: Map<string, Candidate>; attempted: Set<string> }> {
	const candidates = new Map<string, Candidate>();
	const empty = { candidates, attempted: new Set<string>() };
	if (items.length === 0) return empty;

	const resolved = ctx.modelRegistry.find(model.provider, model.id);
	if (!resolved) return empty;

	const digest = items
		.map(item => {
			const args = item.input ? JSON.stringify(item.input).slice(0, 200) : "";
			const firstLine = item.preview.split("\n")[0]?.slice(0, 200) ?? "";
			return `- id=${item.id} tool=${item.toolName} args=${args} tokens=${item.tokens} first_line=${firstLine}`;
		})
		.join("\n");

	const prompt = `Goal: ${goal.slice(0, 2000)}

Candidate context items from an agent session:
${digest}

Return a JSON array of the "id" strings above that are safe to drop because they are no longer needed to finish the goal. Respond with only the JSON array.`;

	const attempted = new Set(items.map(item => item.id));
	try {
		const response = await ctx.modelRegistry.complete(
			resolved,
			{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
			{ maxTokens: 1024, signal, cacheRetention: "none" },
		);
		const text = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map(c => c.text)
			.join("");
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return { candidates, attempted };
		const ids: unknown = JSON.parse(match[0]);
		if (!Array.isArray(ids)) return { candidates, attempted };
		for (const id of ids) {
			if (typeof id !== "string") continue;
			const item = items.find(i => i.id === id);
			if (item) candidates.set(id, { id, reason: "llm: not needed for the current goal", tokens: item.tokens });
		}
	} catch (error) {
		if (isAbortError(error)) throw error;
		// The call itself failed (not just an unparsable reply): leave these items unattempted
		// so they're retried on the next scoring pass instead of being scored "rules only" forever.
		return empty;
	}

	return { candidates, attempted };
}
