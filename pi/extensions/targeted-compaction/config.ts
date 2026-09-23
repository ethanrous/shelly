/**
 * Loads `targetedCompaction` settings from `~/.pi/agent/models.json`. Model-level settings
 * shallow-merge over provider-level settings, which shallow-merge over the defaults below.
 *
 * pi does not support a project-local models.json (only `~/.pi/agent/models.json`), so that's
 * the only file read here.
 */

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ScorerKind = "rules" | "laya" | "llm";

export interface TargetedCompactionConfig {
	enabled: boolean;
	flushAt: number;
	minSavings: number;
	protectTurns: number;
	bulkyTokens: number;
	bulkyAgeTurns: number;
	scorer: ScorerKind;
	layaEndpoint: string;
	layaThreshold: number;
	llmModel?: { provider: string; id: string };
}

export const DEFAULT_CONFIG: TargetedCompactionConfig = {
	enabled: false,
	flushAt: 0.55,
	minSavings: 0.1,
	protectTurns: 3,
	bulkyTokens: 2000,
	bulkyAgeTurns: 6,
	scorer: "rules",
	layaEndpoint: "http://127.0.0.1:8765",
	layaThreshold: 0.8,
};

interface ModelsJsonModel {
	id: string;
	targetedCompaction?: Partial<TargetedCompactionConfig>;
}

interface ModelsJsonProvider {
	targetedCompaction?: Partial<TargetedCompactionConfig>;
	models?: ModelsJsonModel[];
}

interface ModelsJson {
	providers?: Record<string, ModelsJsonProvider>;
}

async function readModelsJson(): Promise<ModelsJson> {
	const path = join(getAgentDir(), "models.json");
	try {
		const raw = await readFile(path, "utf8");
		return JSON.parse(raw) as ModelsJson;
	} catch {
		return {};
	}
}

export async function loadConfig(provider: string | undefined, modelId: string | undefined): Promise<TargetedCompactionConfig> {
	if (!provider) return { ...DEFAULT_CONFIG };
	const data = await readModelsJson();
	const providerEntry = data.providers?.[provider];
	const modelEntry = providerEntry?.models?.find(m => m.id === modelId);
	return {
		...DEFAULT_CONFIG,
		...providerEntry?.targetedCompaction,
		...modelEntry?.targetedCompaction,
	};
}
