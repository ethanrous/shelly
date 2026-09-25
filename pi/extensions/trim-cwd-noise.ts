/**
 * Trims redundant references to the current working directory out of
 * tool-call arguments before they're re-serialized into the provider
 * request. Two patterns, same root cause:
 *
 * 1. `cd <current-dir> &&`/`;` prefixes on bash commands, e.g.
 *    `cd /Users/erousseau/shelly && ls -la` or `cd ~/shelly && ls -la`.
 * 2. Absolute (or `~`-based) paths on `read`/`write`/`edit`/`grep`/`find`/`ls`
 *    calls that point inside the cwd, e.g.
 *    `edit ~/repos/os-localization/tests/test_html.py` instead of
 *    `edit tests/test_html.py`.
 *
 * Models frequently spell things out in full even though pi already runs
 * with a fixed working directory. Since the full conversation history —
 * including every past assistant tool call — gets resent on every
 * subsequent request, that redundancy gets paid for in tokens again and
 * again as the session grows. This can't stop the model from *generating*
 * the verbose form on the turn it writes it, but it prevents that form from
 * being repeated in every future request by rewriting it out of the
 * `context` event's message copy, which only affects what's sent to the
 * provider — not the persisted session history or what actually executed on
 * the turn it was written.
 *
 * Both rewrites are conservative: a `cd` is only stripped when its target
 * resolves to the exact cwd pi is already running in, and a path is only
 * relativized when it resolves to the cwd itself or somewhere nested under
 * it. A `cd` into a subdirectory, a sibling repo, or a path outside the cwd
 * (which would need an uglier `../..` relative form) is left untouched.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as os from "node:os";
import * as path from "node:path";

interface ToolCallContent {
	type: string;
	name?: string;
	arguments?: unknown;
}

interface AssistantLikeMessage {
	role?: string;
	content?: unknown;
}

// --- cd stripping (bash) ------------------------------------------------

const CD_PREFIX = /^\s*cd\s+((?:"[^"]*")|(?:'[^']*')|(?:\S+))\s*(?:&&|;)\s*([\s\S]*)$/;

function unquote(target: string): string {
	if (target.length >= 2) {
		const first = target[0];
		const last = target[target.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return target.slice(1, -1);
		}
	}
	return target;
}

function expandHome(target: string, home: string): string {
	if (target === "~") return home;
	if (target.startsWith("~/")) return path.join(home, target.slice(2));
	return target;
}

function resolveTarget(target: string, cwd: string, home: string): string {
	const expanded = expandHome(target, home);
	if (path.isAbsolute(expanded)) return path.resolve(expanded);
	return path.resolve(cwd, expanded);
}

/** Strips one leading `cd <cwd> &&`/`;` from `command`, if present. Recurses to catch chained `cd`s. */
export function stripRedundantCd(command: string, cwd: string, home: string = os.homedir()): string {
	const match = command.match(CD_PREFIX);
	if (!match) return command;

	const target = unquote(match[1]);
	const rest = match[2];
	const resolved = resolveTarget(target, cwd, home);

	if (resolved !== path.resolve(cwd)) return command;
	if (rest.trim() === "") return command; // nothing left to run; leave the bare `cd` alone

	return stripRedundantCd(rest, cwd, home);
}

// --- path relativizing (read/write/edit/grep/find/ls) -------------------

/** Tool names whose sole (or main) path-like argument is called `path`. */
const PATH_ARG_TOOLS = new Set(["read", "write", "edit", "grep", "find", "ls"]);

/**
 * Rewrites `p` relative to `cwd` when it names the cwd itself or something
 * nested under it. Returns `undefined` when `p` is already relative, or
 * resolves outside the cwd (where a relative form would need `..` segments
 * and isn't clearly shorter or clearer).
 */
export function relativizeUnderCwd(p: string, cwd: string, home: string = os.homedir()): string | undefined {
	const expanded = expandHome(p, home);
	if (!path.isAbsolute(expanded)) return undefined;

	const resolvedCwd = path.resolve(cwd);
	const resolved = path.resolve(expanded);
	const rel = path.relative(resolvedCwd, resolved);

	if (rel === "") return ".";
	if (rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
	return rel;
}

export default function (pi: ExtensionAPI) {
	pi.on("context", (event, ctx) => {
		const home = os.homedir();
		let changed = false;

		for (const message of event.messages as AssistantLikeMessage[]) {
			if (message.role !== "assistant" || !Array.isArray(message.content)) continue;

			for (const block of message.content as ToolCallContent[]) {
				if (block?.type !== "toolCall" || !block.name) continue;
				const args = block.arguments as Record<string, unknown> | undefined;
				if (!args) continue;

				if (block.name === "bash" && typeof args.command === "string") {
					const stripped = stripRedundantCd(args.command, ctx.cwd, home);
					if (stripped !== args.command) {
						args.command = stripped;
						changed = true;
					}
					continue;
				}

				if (PATH_ARG_TOOLS.has(block.name) && typeof args.path === "string") {
					const relativized = relativizeUnderCwd(args.path, ctx.cwd, home);
					if (relativized !== undefined && relativized !== args.path) {
						args.path = relativized;
						changed = true;
					}
				}
			}
		}

		if (!changed) return undefined;
		return { messages: event.messages };
	});
}
