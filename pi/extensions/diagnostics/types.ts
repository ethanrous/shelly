export type Lang = "python" | "ts" | "rust";
export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
	file: string;
	line: number;
	column: number;
	severity: Severity;
	code: string;
	message: string;
}

export interface Target {
	path: string;
	dir: boolean;
	langs: Lang[];
}

export type Outcome =
	| { kind: "ok"; diagnostics: Diagnostic[]; dropped: number }
	| { kind: "failed"; reason: string }
	| { kind: "not-found"; looked: string[] }
	| { kind: "timeout"; seconds: number };

export interface JobContext {
	signal?: AbortSignal;
	timeoutMs: number;
}

export interface Job {
	label: string;
	root: string;
	covers: string[];
	run(ctx: JobContext): Promise<Outcome>;
}

export interface JobResult {
	label: string;
	root: string;
	outcome: Outcome;
}
