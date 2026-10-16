import type { Readable, Writable } from "node:stream";

export type JsonRpcId = number | string;

export interface JsonRpcMessage {
	jsonrpc: "2.0";
	id?: JsonRpcId | null;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export interface ConnectionHandlers {
	onRequest(method: string, params: unknown): unknown | Promise<unknown>;
	onNotification(method: string, params: unknown): void;
}

export class MethodNotFoundError extends Error {}

const HEADER_END = Buffer.from("\r\n\r\n", "ascii");

export function encodeMessage(msg: JsonRpcMessage): Buffer {
	const body = Buffer.from(JSON.stringify(msg), "utf8");
	return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

export class MessageReader {
	private buffer = Buffer.alloc(0);

	push(chunk: Buffer): JsonRpcMessage[] {
		this.buffer = this.buffer.length > 0 ? Buffer.concat([this.buffer, chunk]) : chunk;
		const messages: JsonRpcMessage[] = [];
		for (;;) {
			const headerEnd = this.buffer.indexOf(HEADER_END);
			if (headerEnd === -1) break;
			const header = this.buffer.subarray(0, headerEnd).toString("ascii");
			const length = /Content-Length:\s*(\d+)/i.exec(header);
			const bodyStart = headerEnd + HEADER_END.length;
			if (!length) {
				this.buffer = this.buffer.subarray(bodyStart);
				continue;
			}
			const bodyEnd = bodyStart + Number(length[1]);
			if (this.buffer.length < bodyEnd) break;
			messages.push(JSON.parse(this.buffer.subarray(bodyStart, bodyEnd).toString("utf8")) as JsonRpcMessage);
			this.buffer = this.buffer.subarray(bodyEnd);
		}
		return messages;
	}
}

interface Pending {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

export class JsonRpcConnection {
	private readonly input: Writable;
	private readonly handlers: ConnectionHandlers;
	private readonly reader = new MessageReader();
	private readonly pending = new Map<JsonRpcId, Pending>();
	private nextId = 1;
	private closed = false;

	constructor(input: Writable, output: Readable, handlers: ConnectionHandlers) {
		this.input = input;
		this.handlers = handlers;
		output.on("data", (chunk: Buffer) => {
			for (const message of this.reader.push(chunk)) this.dispatch(message);
		});
		output.on("close", () => this.close(new Error("connection closed")));
		output.on("error", (error: Error) => this.close(error));
		input.on("error", (error: Error) => this.close(error));
	}

	get isClosed(): boolean {
		return this.closed;
	}

	request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
		if (this.closed) return Promise.reject(new Error("connection closed"));
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`${method} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			timer.unref();
			this.pending.set(id, { resolve, reject, timer });
			this.write({ jsonrpc: "2.0", id, method, params });
		});
	}

	notify(method: string, params: unknown): void {
		this.write({ jsonrpc: "2.0", method, params });
	}

	close(reason: Error): void {
		if (this.closed) return;
		this.closed = true;
		for (const entry of this.pending.values()) {
			clearTimeout(entry.timer);
			entry.reject(reason);
		}
		this.pending.clear();
	}

	private write(message: JsonRpcMessage): void {
		if (!this.closed) this.input.write(encodeMessage(message));
	}

	private dispatch(message: JsonRpcMessage): void {
		if (message.method !== undefined) {
			if (message.id === undefined || message.id === null) this.handlers.onNotification(message.method, message.params);
			else void this.answer(message.id, message.method, message.params);
			return;
		}
		if (message.id === undefined || message.id === null) return;
		const entry = this.pending.get(message.id);
		if (!entry) return;
		this.pending.delete(message.id);
		clearTimeout(entry.timer);
		if (message.error) entry.reject(new Error(`${message.error.code}: ${message.error.message}`));
		else entry.resolve(message.result);
	}

	private async answer(id: JsonRpcId, method: string, params: unknown): Promise<void> {
		try {
			const result = await this.handlers.onRequest(method, params);
			this.write({ jsonrpc: "2.0", id, result: result ?? null });
		} catch (error) {
			const code = error instanceof MethodNotFoundError ? -32601 : -32603;
			this.write({ jsonrpc: "2.0", id, error: { code, message: (error as Error).message } });
		}
	}
}

export function defaultServerRequest(method: string, params: unknown): unknown {
	switch (method) {
		case "workspace/configuration":
			return ((params as { items?: unknown[] } | undefined)?.items ?? []).map(() => null);
		case "client/registerCapability":
		case "client/unregisterCapability":
		case "window/workDoneProgress/create":
			return null;
		default:
			throw new MethodNotFoundError(`method not found: ${method}`);
	}
}
