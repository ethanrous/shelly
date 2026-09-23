/**
 * Parses tool-call arguments that arrive as JSON text where the tool's schema
 * expects an array or object.
 *
 * Models behind the vLLM qwen3_xml parser write each parameter as raw text, so
 * an array parameter can reach pi as the string `[{"id": ...}]`. pi's own
 * coercion only handles primitives, and TypeBox then wraps the string in an
 * array, which fails with `questions.0: must be object`. This runs on the
 * assistant's `message_end`, before pi validates and executes the calls, and
 * replaces such strings with their parsed value when it has the expected type.
 * Nested properties and array items are handled the same way. A schema that
 * also accepts a string leaves the value alone.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Schema = {
	type?: string | string[];
	properties?: Record<string, Schema>;
	additionalProperties?: boolean | Schema;
	items?: Schema | Schema[];
	anyOf?: Schema[];
	oneOf?: Schema[];
	allOf?: Schema[];
};

type JsonType = "array" | "object" | "string" | "other";

function jsonType(value: unknown): JsonType {
	if (Array.isArray(value)) return "array";
	if (value !== null && typeof value === "object") return "object";
	if (typeof value === "string") return "string";
	return "other";
}

/** The JSON types a schema accepts, including those of its union branches. */
function acceptedTypes(schema: Schema): Set<string> {
	const types = new Set<string>();
	if (typeof schema.type === "string") types.add(schema.type);
	if (Array.isArray(schema.type)) for (const t of schema.type) types.add(t);
	if (!schema.type && schema.properties) types.add("object");
	if (!schema.type && schema.items) types.add("array");
	for (const branch of [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
		for (const t of acceptedTypes(branch)) types.add(t);
	}
	return types;
}

/** Parses `text`, unwrapping one extra level when the model double-encoded it. */
function parseJson(text: string): unknown {
	try {
		let parsed: unknown = JSON.parse(text);
		if (typeof parsed === "string") parsed = JSON.parse(parsed);
		return parsed;
	} catch {
		return undefined;
	}
}

/** Returns `value` with JSON-string arrays and objects parsed, or `value` itself when nothing changed. */
export function fixValue(value: unknown, schema: Schema | undefined): unknown {
	if (!schema || typeof schema !== "object") return value;
	const accepted = acceptedTypes(schema);

	let next = value;
	if (typeof next === "string" && !accepted.has("string") && (accepted.has("array") || accepted.has("object"))) {
		const parsed = parseJson(next.trim());
		if (accepted.has(jsonType(parsed))) next = parsed;
	}

	const branches = [schema, ...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])];

	if (Array.isArray(next)) {
		const itemSchema = branches.map(b => b.items).find(i => i && !Array.isArray(i)) as Schema | undefined;
		const tupleSchema = branches.map(b => b.items).find(Array.isArray) as Schema[] | undefined;
		let changed = next !== value;
		const items = next.map((item, i) => {
			const fixed = fixValue(item, tupleSchema ? tupleSchema[i] : itemSchema);
			if (fixed !== item) changed = true;
			return fixed;
		});
		return changed ? items : value;
	}

	if (jsonType(next) === "object") {
		const obj = next as Record<string, unknown>;
		let changed = next !== value;
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(obj)) {
			const propSchema =
				branches.map(b => b.properties?.[key]).find(Boolean) ??
				(branches.map(b => b.additionalProperties).find(a => a && typeof a === "object") as Schema | undefined);
			const fixed = fixValue(child, propSchema);
			if (fixed !== child) changed = true;
			out[key] = fixed;
		}
		return changed ? out : value;
	}

	return next;
}

interface ToolCallContent {
	type: string;
	name?: string;
	arguments?: unknown;
}

export default function (pi: ExtensionAPI) {
	pi.on("message_end", event => {
		const message = event.message as { role?: string; content?: unknown };
		if (message.role !== "assistant" || !Array.isArray(message.content)) return undefined;
		const calls = (message.content as ToolCallContent[]).filter(c => c?.type === "toolCall");
		if (calls.length === 0) return undefined;

		const schemas = new Map<string, Schema>(pi.getAllTools().map(t => [t.name, t.parameters as Schema]));
		let changed = false;
		const content = (message.content as ToolCallContent[]).map(part => {
			if (part?.type !== "toolCall" || !part.name) return part;
			const fixed = fixValue(part.arguments, schemas.get(part.name));
			if (fixed === part.arguments) return part;
			changed = true;
			return { ...part, arguments: fixed };
		});
		if (!changed) return undefined;
		return { message: { ...message, content } as typeof event.message };
	});
}
