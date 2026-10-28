const value = (item: unknown): string => (Array.isArray(item) ? `[${item.map(value).join(", ")}]` : JSON.stringify(item));

// A tool call as written for the model to paste: the tool name and its JSON arguments, e.g. read_symbol {"path": "a.py", "line": 12}.
export function toolCall(tool: string, args: Record<string, unknown>): string {
	const fields = Object.entries(args)
		.filter(([, item]) => item !== undefined)
		.map(([key, item]) => `${JSON.stringify(key)}: ${value(item)}`);
	return `${tool} {${fields.join(", ")}}`;
}
