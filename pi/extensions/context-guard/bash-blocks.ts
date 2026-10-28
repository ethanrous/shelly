import { definitionSearchParts } from "./definition-searches.ts";
import { fileSearchParts } from "./file-searches.ts";
import { lineReadParts } from "./line-reads.ts";
import { type BlockPart, blockMessage } from "./steering.ts";
import type { ToolContext } from "./tools.ts";

const settled = (check: Promise<BlockPart[]>) => check.catch((): BlockPart[] => []);

// One message for everything wrong with a bash command, or undefined when it may run.
export async function bashBlock(command: string, ctx: ToolContext): Promise<string | undefined> {
	const [reads, definitions] = await Promise.all([settled(lineReadParts(command, ctx)), settled(definitionSearchParts(command, ctx))]);
	const handled = new Set(definitions.flatMap((part) => part.subjects));
	const searches = await settled(fileSearchParts(command, ctx, handled));
	const parts = [...reads, ...definitions, ...searches];
	return parts.length === 0 ? undefined : blockMessage(parts, true);
}
