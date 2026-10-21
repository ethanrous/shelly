import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GUIDELINE } from "./config.ts";
import { runDiagnostics } from "./run.ts";

export interface SchemaBuilder {
	Object(properties: Record<string, unknown>): unknown;
	String(options?: { description?: string }): unknown;
	Array(items: unknown, options?: { description?: string }): unknown;
	Optional(schema: unknown): unknown;
}

export function registerDiagnostics(pi: ExtensionAPI, Type: SchemaBuilder): void {
	pi.registerTool({
		name: "diagnostics",
		label: "Diagnostics",
		description:
			"Run the project's configured type checkers and linters (ty, ruff, tsc/vue-tsc, eslint, cargo clippy) on files or directories and return their diagnostics grouped by file. Defaults to the files changed in the git working tree.",
		promptSnippet: "Type-check and lint files with the project's own checkers (Python, TypeScript/JavaScript/Vue, Rust)",
		parameters: Type.Object({
			paths: Type.Optional(Type.Array(Type.String(), { description: "Files or directories, relative to the working directory or absolute. Defaults to the files changed in git." })),
		}),
		async execute(_id: string, params: { paths?: string[] }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
			return { content: [{ type: "text" as const, text: await runDiagnostics(params, { cwd: ctx.cwd, signal }) }], details: undefined };
		},
	} as never);

	pi.on("before_agent_start", async (event) => {
		const guidelines = event.systemPromptOptions.promptGuidelines;
		if (!guidelines.includes(GUIDELINE)) guidelines.push(GUIDELINE);
	});
}
