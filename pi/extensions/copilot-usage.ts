/**
 * Shows GitHub Copilot credit usage in the status bar while a Copilot model is selected.
 *
 *   Copilot: +312 session · 22.6k/40k (56%) · resets Oct 1
 *
 * Usage comes from GET api.github.com/copilot_internal/user, authenticated with the OAuth token pi
 * stores in auth.json. Session usage is the change in credits_used since the first fetch of the
 * session, so concurrent Copilot use elsewhere on the account is included in it.
 */

import { type ExtensionAPI, type ExtensionContext, getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const STATUS_KEY = "copilot-usage";
const PROVIDER = "github-copilot";
const USAGE_URL = "https://api.github.com/copilot_internal/user";
const REFRESH_MS = 5 * 60_000;
/** GitHub's counter trails the end of a request slightly. */
const AFTER_TURN_DELAY_MS = 3_000;

interface Quota {
	entitlement: number;
	credits_used: number;
	percent_remaining: number;
	overage_count: number;
	unlimited: boolean;
}

export interface Usage {
	quota?: Quota;
	resetDate?: string;
}

export function parseUsage(body: unknown): Usage {
	const data = body as { quota_snapshots?: { premium_interactions?: Quota }; quota_reset_date?: string };
	return { quota: data.quota_snapshots?.premium_interactions, resetDate: data.quota_reset_date };
}

function formatCount(count: number): string {
	if (count < 1000) return String(Math.round(count));
	const thousands = count / 1000;
	if (count >= 100_000 || Number.isInteger(thousands)) return `${Math.round(thousands)}k`;
	return `${thousands.toFixed(1)}k`;
}

function formatResetDate(date: string): string {
	const [year, month, day] = date.split("-").map(Number);
	if (!year || !month || !day) return date;
	return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

export function formatStatus(usage: Usage, baseline: number | undefined): string {
	const quota = usage.quota;
	if (!quota) return "Copilot: no quota data";
	if (quota.unlimited) return "Copilot: unlimited";

	const session = baseline === undefined ? 0 : quota.credits_used - baseline;
	const percent = Math.round(100 - quota.percent_remaining);
	const overage = quota.overage_count > 0 ? ` +${formatCount(quota.overage_count)} over` : "";
	const warn = percent >= 90 ? " !" : percent >= 75 ? " ~" : "";
	const reset = usage.resetDate ? ` · resets ${formatResetDate(usage.resetDate)}` : "";
	return `Copilot: +${formatCount(session)} session · ${formatCount(quota.credits_used)}/${formatCount(quota.entitlement)} (${percent}%)${overage}${warn}${reset}`;
}

async function readToken(): Promise<string | undefined> {
	try {
		const auth = JSON.parse(await readFile(join(getAgentDir(), "auth.json"), "utf8"));
		return auth[PROVIDER]?.refresh ?? undefined;
	} catch {
		return undefined;
	}
}

export async function fetchUsage(token: string): Promise<Usage> {
	const response = await fetch(USAGE_URL, {
		headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return parseUsage(await response.json());
}

export default function copilotUsageExtension(pi: ExtensionAPI): void {
	let baseline: number | undefined;
	let latest: Usage | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	let delayed: ReturnType<typeof setTimeout> | undefined;
	let inFlight: Promise<void> | undefined;

	function usingCopilot(ctx: ExtensionContext): boolean {
		return ctx.model?.provider === PROVIDER;
	}

	function render(ctx: ExtensionContext, text?: string): void {
		if (!ctx.hasUI) return;
		if (!usingCopilot(ctx)) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		ctx.ui.setStatus(STATUS_KEY, text ?? (latest ? formatStatus(latest, baseline) : "Copilot: …"));
	}

	function refresh(ctx: ExtensionContext): Promise<void> {
		inFlight ??= (async () => {
			try {
				const token = await readToken();
				if (!token) {
					render(ctx, "Copilot: not logged in (run /login)");
					return;
				}
				latest = await fetchUsage(token);
				if (latest.quota && !latest.quota.unlimited) baseline ??= latest.quota.credits_used;
				render(ctx);
			} catch (error) {
				render(ctx, `Copilot: ${(error as Error).message}`);
			} finally {
				inFlight = undefined;
			}
		})();
		return inFlight;
	}

	function stopTimers(): void {
		if (timer) clearInterval(timer);
		if (delayed) clearTimeout(delayed);
		timer = undefined;
		delayed = undefined;
	}

	/** Polls only while a Copilot model is selected. */
	function sync(ctx: ExtensionContext): void {
		if (!usingCopilot(ctx)) {
			stopTimers();
			render(ctx);
			return;
		}
		render(ctx);
		void refresh(ctx);
		timer ??= setInterval(() => void refresh(ctx), REFRESH_MS);
	}

	pi.on("session_start", async (_event, ctx) => sync(ctx));
	pi.on("model_select", async (_event, ctx) => sync(ctx));

	pi.on("agent_end", async (_event, ctx) => {
		if (!usingCopilot(ctx)) return;
		if (delayed) clearTimeout(delayed);
		delayed = setTimeout(() => {
			delayed = undefined;
			void refresh(ctx);
		}, AFTER_TURN_DELAY_MS);
	});

	pi.on("session_shutdown", async () => stopTimers());

	pi.registerCommand("copilot-usage", {
		description: "Refresh Copilot usage in the status bar",
		handler: async (_args, ctx) => {
			await refresh(ctx);
			if (!usingCopilot(ctx) && latest) ctx.ui.notify(formatStatus(latest, baseline), "info");
		},
	});
}
