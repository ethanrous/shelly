/**
 * Gives the self-hosted `lucy` models a flat `edit` tool schema.
 *
 * Their vLLM server parses tool calls with the qwen3_xml parser, where the model
 * writes each parameter as raw text between <parameter=NAME> tags. An
 * array-of-objects parameter therefore has to be hand-written as a JSON literal,
 * and on long payloads the model breaks the escaping, so the argument reaches
 * pi as a string that fails validation. String parameters never go through that
 * step. This rewrites pi's `edit` tool in the outgoing request to
 * `{path, oldText, newText}`, all strings, for those providers only. pi's
 * built-in edit tool still accepts that shape and turns it into a single-entry
 * `edits` array before validation, so the tool itself is unchanged.
 *
 * `/lucy-strict` toggles `strict: true` on the rewritten tool. vLLM constrains
 * arguments with structured outputs only for strict tools and only when the
 * parser supports it; the toggle exists so that can be tried per session.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDERS = new Set(["lucy", "lucy-vllm"]);

const FLAT_EDIT_DESCRIPTION =
	"Edit a single file by replacing one exact, unique region of its text. oldText must match the original file exactly and only once. For several separate changes in one file, make one edit call per change.";

const FLAT_EDIT_PARAMETERS = {
	type: "object",
	properties: {
		path: { type: "string", description: "Path to the file to edit (relative or absolute)" },
		oldText: {
			type: "string",
			description: "Exact text to replace. It must be unique in the file. Keep it as small as possible while still unique; do not pad with large unchanged regions.",
		},
		newText: { type: "string", description: "Replacement text." },
	},
	required: ["path", "oldText", "newText"],
	additionalProperties: false,
};

/** pi's built-in edit guidelines, and how they read once the tool has no `edits[]`. */
const PROMPT_REWRITES: ReadonlyArray<[string, string]> = [
	["Use edit for precise changes (edits[].oldText must match exactly)", "Use edit for precise changes (oldText must match exactly)"],
	[
		"When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls",
		"When changing multiple separate locations in one file, make one edit call per location",
	],
	[
		"Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.",
		"Each edit is applied to the file as it is at that moment; merge nearby changes into one edit.",
	],
	["Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.", "Keep oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions."],
	["edits[].oldText", "oldText"],
	["edits[].newText", "newText"],
];

interface FunctionTool {
	type?: string;
	function?: { name?: string; description?: string; parameters?: unknown; strict?: boolean };
}

interface ChatMessage {
	role?: string;
	content?: unknown;
}

/** The parts of an OpenAI chat-completions body this file touches. */
interface ChatPayload {
	tools?: FunctionTool[];
	messages?: ChatMessage[];
}

function rewriteText(text: string): string {
	let out = text;
	for (const [from, to] of PROMPT_REWRITES) out = out.replaceAll(from, to);
	return out;
}

/**
 * Returns a copy of `payload` with the `edit` tool flattened and the system
 * prompt's edit guidance reworded, or undefined when the payload has no edit
 * tool.
 */
export function flattenEditTool(payload: unknown, strict: boolean): ChatPayload | undefined {
	if (!payload || typeof payload !== "object") return undefined;
	const body = payload as ChatPayload;
	if (!Array.isArray(body.tools)) return undefined;
	const index = body.tools.findIndex(t => t?.type === "function" && t.function?.name === "edit");
	if (index < 0) return undefined;

	const tools = body.tools.slice();
	tools[index] = {
		...tools[index],
		function: {
			...tools[index].function,
			description: FLAT_EDIT_DESCRIPTION,
			parameters: FLAT_EDIT_PARAMETERS,
			strict,
		},
	};

	const messages = Array.isArray(body.messages)
		? body.messages.map(m => {
				if (m?.role !== "system" && m?.role !== "developer") return m;
				if (typeof m.content === "string") return { ...m, content: rewriteText(m.content) };
				if (Array.isArray(m.content)) {
					return {
						...m,
						content: m.content.map((part: { type?: string; text?: string }) =>
							part?.type === "text" && typeof part.text === "string" ? { ...part, text: rewriteText(part.text) } : part,
						),
					};
				}
				return m;
			})
		: body.messages;

	return { ...body, tools, messages };
}

export default function (pi: ExtensionAPI) {
	let strict = false;

	pi.on("before_provider_request", (event, ctx: ExtensionContext) => {
		const provider = ctx.model?.provider;
		if (!provider || !PROVIDERS.has(provider)) return undefined;
		return flattenEditTool(event.payload, strict);
	});

	pi.registerCommand("lucy-strict", {
		description: "Toggle strict: true on the flattened edit tool sent to lucy models",
		handler: async (_args, ctx) => {
			strict = !strict;
			ctx.ui.notify(`lucy edit tool strict mode ${strict ? "on" : "off"}`, "info");
		},
	});
}
