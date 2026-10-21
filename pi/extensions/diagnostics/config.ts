import type { Lang } from "./types.ts";

export const CHECK_TIMEOUT_MS = 120_000;
export const CONCURRENCY = 2;
export const MAX_DIAGNOSTICS = 100;
export const MAX_OUTPUT_BYTES = 16 * 1024;
export const MAX_MESSAGE_CHARS = 300;
export const MAX_ERROR_LINES = 3;
export const MAX_LISTED_PATHS = 10;
export const SCAN_ENTRY_LIMIT = 5000;
export const SCAN_SKIP_DIRS = new Set([".git", "node_modules", ".venv", "venv", "target", "dist", "build", "__pycache__", ".nuxt", ".output", ".next"]);

export const EXTENSION_LANGS: Record<string, Lang> = {
	".py": "python",
	".pyi": "python",
	".ts": "ts",
	".tsx": "ts",
	".mts": "ts",
	".cts": "ts",
	".js": "ts",
	".jsx": "ts",
	".mjs": "ts",
	".cjs": "ts",
	".vue": "ts",
	".rs": "rust",
};

export const PYTHON_ROOT_MARKERS = ["pyproject.toml", "ty.toml", "ruff.toml", ".ruff.toml"];
export const ESLINT_CONFIGS = [
	...["js", "mjs", "cjs", "ts", "mts", "cts"].map((ext) => `eslint.config.${ext}`),
	...[".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml"],
];
export const TSC_CONFIG_ERRORS = new Set(["TS5083", "TS5058", "TS6053", "TS18003"]);

export const GUIDELINE = "Use diagnostics to type-check or lint Python, TypeScript, JavaScript, Vue, and Rust files instead of running ty, ruff, tsc, eslint, or cargo through bash.";
