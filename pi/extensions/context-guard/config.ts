import { homedir } from "node:os";
import { join } from "node:path";

export const CAP_MAX_BYTES = 16 * 1024;
export const CAP_MAX_LINES = 400;
export const OUTLINE_FIRST_MIN_LINES = 400;
export const FIND_SYMBOL_LIMIT = 50;
export const REFERENCES_LIMIT = 60;
export const NEAR_MATCH_LIMIT = 5;
export const SIGNATURE_MAX_CHARS = 160;
export const SKELETON_COMMENT_MAX_LINES = 20;
export const SUBPROCESS_TIMEOUT_MS = 30_000;
export const FILE_BATCH_SIZE = 2000;
export const HINT_INTERVAL_CALLS = 10;
export const SPILL_DIR_NAME = "pi-tool-output";
export const SPILL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const AST_GREP_MIN_VERSION: readonly [number, number] = [0, 51];

export const LSP_READY_WAIT_MS = 20_000;
export const LSP_REQUEST_TIMEOUT_MS = 30_000;
export const LSP_IDLE_MS = 10 * 60_000;
export const LSP_MAX_SERVERS = 2;
export const JDTLS_XMX = "8G";
export const MASON_BIN = join(homedir(), ".local/share/nvim/mason/bin");
export const JDTLS_DATA_ROOT = join(homedir(), ".cache/pi-context-guard/jdtls");
export const FALLBACK_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

export const OWN_TOOLS = ["find_symbol", "read_symbol", "outline", "find_references"] as const;

// Subagent result tools carry the report the agent asked for, so they are never capped.
export const CAP_EXEMPT_TOOLS: ReadonlySet<string> = new Set<string>([
	...OWN_TOOLS,
	"edit",
	"write",
	"Agent",
	"SubagentWorkflow",
	"get_subagent_result",
	"steer_subagent",
]);
