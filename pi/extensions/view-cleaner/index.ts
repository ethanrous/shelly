/**
 * Makes tool calls easier to read in the transcript.
 *
 * - When an assistant message ends, before pi runs, renders, persists, or resends it, rules in
 *   `clean.ts` shorten its tool calls without changing their behavior. The model sees the shorter
 *   form in later requests.
 * - The bash call row shows each top-level command on its own line. This only changes the display;
 *   the stored command is untouched.
 */

import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { cleanAssistantMessage } from "./clean.ts";
import { displayArgs } from "./command-lines.ts";

export default function (pi: ExtensionAPI) {
	pi.on("message_end", (event, ctx) => {
		if (!cleanAssistantMessage(event.message, { cwd: ctx.cwd, home: homedir() })) return undefined;
		return { message: event.message };
	});

	pi.registerToolRenderer((toolName, next) => {
		const stock = next();
		const renderCall = stock?.renderCall;
		if (toolName !== "bash" || !renderCall) return stock;
		return { ...stock, renderCall: (args, theme, context) => renderCall(displayArgs(args), theme, context) };
	});
}
