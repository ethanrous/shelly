import { spawn } from "node:child_process";

export interface RunResult {
	stdout: string;
	stderr: string;
	code: number | null;
	timedOut: boolean;
}

export interface RunOptions {
	cwd: string;
	signal?: AbortSignal;
	timeoutMs: number;
}

export function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		if (options.signal?.aborted) {
			reject(new Error("aborted"));
			return;
		}
		const child = spawn(command, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let settled = false;
		const finish = (error: Error | undefined, code: number | null, timedOut = false) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", onAbort);
			if (error) reject(error);
			else resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), code, timedOut });
		};
		const onAbort = () => {
			child.kill("SIGKILL");
			finish(new Error("aborted"), null);
		};
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			finish(undefined, null, true);
		}, options.timeoutMs);
		options.signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.stdout.on("error", () => {});
		child.stderr.on("error", () => {});
		child.on("error", (error) => finish(error, null));
		child.on("close", (code) => finish(undefined, code));
	});
}
