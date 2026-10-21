import { dirname } from "node:path";
import type { Lang, Target } from "../types.ts";

export const startDir = (target: Target) => (target.dir ? target.path : dirname(target.path));

// Targets of one language grouped by the project root found for each.
export function groupByRoot(targets: Target[], lang: Lang, findRoot: (dir: string) => string | undefined): Map<string, Target[]> {
	const groups = new Map<string, Target[]>();
	for (const target of targets) {
		if (!target.langs.includes(lang)) continue;
		const root = findRoot(startDir(target));
		if (root) groups.set(root, [...(groups.get(root) ?? []), target]);
	}
	return groups;
}

export const paths = (targets: Target[]) => targets.map((target) => target.path);
