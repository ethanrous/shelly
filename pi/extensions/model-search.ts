/**
 * Replaces the /model selector's fuzzy search with substring matching, newest version first.
 *
 * Every whitespace-separated query token must appear verbatim (case-insensitive) in
 * `provider/id name`. Matches are sorted by the version numbers in the model id, highest first:
 * claude-opus-5.5 > claude-opus-5 > claude-opus-4.8. An 8-digit date suffix breaks ties.
 */

import { ModelSelectorComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Item {
	provider: string;
	id: string;
	model: { name?: string };
}

/** Version parts and the date suffix of a model id, e.g. claude-opus-4-5-20251101 -> [4, 5], 20251101. */
function parseVersion(id: string): { parts: number[]; date: number } {
	const parts: number[] = [];
	let date = 0;
	for (const match of id.matchAll(/\d+/g)) {
		if (match[0].length === 8) date = Number(match[0]);
		else parts.push(Number(match[0]));
	}
	return { parts, date };
}

function compareNewestFirst(a: Item, b: Item): number {
	const va = parseVersion(a.id);
	const vb = parseVersion(b.id);
	for (let i = 0; i < Math.max(va.parts.length, vb.parts.length); i++) {
		const diff = (vb.parts[i] ?? -1) - (va.parts[i] ?? -1);
		if (diff !== 0) return diff;
	}
	return vb.date - va.date || a.id.localeCompare(b.id) || a.provider.localeCompare(b.provider);
}

function filterModels(this: any, query: string): void {
	const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) {
		this.filteredModels = this.activeModels;
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
	} else {
		const matches = (this.activeModels as Item[]).filter((item) => {
			const defaultText = this.isDefaultModel(item.model) ? " default" : "";
			const text = `${item.provider}/${item.id} ${item.model.name ?? ""}${defaultText}`.toLowerCase();
			return tokens.every((token) => text.includes(token));
		});
		this.filteredModels = matches.sort(compareNewestFirst);
		this.selectedIndex = 0;
	}
	this.updateList();
}

export default function modelSearchExtension(_pi: ExtensionAPI): void {
	(ModelSelectorComponent.prototype as any).filterModels = filterModels;
}
