import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import {
	defaultServerRequest,
	encodeMessage,
	type JsonRpcMessage,
	JsonRpcConnection,
	MessageReader,
	MethodNotFoundError,
} from "../lsp/client.ts";

test("encodeMessage writes a byte-accurate Content-Length", () => {
	const buf = encodeMessage({ jsonrpc: "2.0", id: 1, result: "é" });
	const text = buf.toString("utf8");
	const body = '{"jsonrpc":"2.0","id":1,"result":"é"}';
	assert.equal(text, `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
});

test("MessageReader handles split and merged frames", () => {
	const a = encodeMessage({ jsonrpc: "2.0", id: 1, result: "é" });
	const b = encodeMessage({ jsonrpc: "2.0", method: "x", params: {} });
	const reader = new MessageReader();
	assert.deepEqual(reader.push(a.subarray(0, 5)), []);
	assert.deepEqual(reader.push(Buffer.concat([a.subarray(5), b.subarray(0, 30)])), [
		{ jsonrpc: "2.0", id: 1, result: "é" },
	]);
	assert.deepEqual(reader.push(b.subarray(30)), [{ jsonrpc: "2.0", method: "x", params: {} }]);
});

test("MessageReader accepts extra headers", () => {
	const body = '{"jsonrpc":"2.0","method":"m"}';
	const frame = `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
	assert.deepEqual(new MessageReader().push(Buffer.from(frame)), [{ jsonrpc: "2.0", method: "m" }]);
});

function pair() {
	const toServer = new PassThrough();
	const toClient = new PassThrough();
	const fromClient = new MessageReader();
	const received: JsonRpcMessage[] = [];
	toServer.on("data", (chunk: Buffer) => received.push(...fromClient.push(chunk)));
	const send = (msg: JsonRpcMessage) => toClient.write(encodeMessage(msg));
	return { toServer, toClient, received, send };
}

test("request resolves with the matching response", async () => {
	const { toServer, toClient, received, send } = pair();
	const conn = new JsonRpcConnection(toServer, toClient, { onRequest: () => null, onNotification: () => {} });
	const pending = conn.request("textDocument/references", { a: 1 }, 1000);
	await new Promise((r) => setImmediate(r));
	assert.equal(received[0].method, "textDocument/references");
	send({ jsonrpc: "2.0", id: received[0].id, result: [1, 2] });
	assert.deepEqual(await pending, [1, 2]);
});

test("request rejects on an error response", async () => {
	const { toServer, toClient, received, send } = pair();
	const conn = new JsonRpcConnection(toServer, toClient, { onRequest: () => null, onNotification: () => {} });
	const pending = conn.request("x", {}, 1000);
	await new Promise((r) => setImmediate(r));
	send({ jsonrpc: "2.0", id: received[0].id, error: { code: -32600, message: "bad" } });
	await assert.rejects(pending, /bad/);
});

test("request times out", async () => {
	const { toServer, toClient } = pair();
	const conn = new JsonRpcConnection(toServer, toClient, { onRequest: () => null, onNotification: () => {} });
	await assert.rejects(conn.request("slow", {}, 20), /slow timed out after 20ms/);
});

test("close rejects pending requests and later requests", async () => {
	const { toServer, toClient } = pair();
	const conn = new JsonRpcConnection(toServer, toClient, { onRequest: () => null, onNotification: () => {} });
	const pending = conn.request("x", {}, 1000);
	conn.close(new Error("server exited"));
	await assert.rejects(pending, /server exited/);
	await assert.rejects(conn.request("y", {}, 1000), /connection closed/);
	assert.equal(conn.isClosed, true);
});

test("notifications and server requests reach the handlers", async () => {
	const { toServer, toClient, received, send } = pair();
	const notes: string[] = [];
	new JsonRpcConnection(toServer, toClient, {
		onRequest: (method, params) => defaultServerRequest(method, params),
		onNotification: (method) => notes.push(method),
	});
	send({ jsonrpc: "2.0", method: "language/status", params: { type: "ServiceReady" } });
	send({ jsonrpc: "2.0", id: 7, method: "workspace/configuration", params: { items: [{}, {}] } });
	send({ jsonrpc: "2.0", id: 8, method: "unknown/thing", params: {} });
	await new Promise((r) => setTimeout(r, 20));
	assert.deepEqual(notes, ["language/status"]);
	assert.deepEqual(received.find((m) => m.id === 7)?.result, [null, null]);
	assert.equal(received.find((m) => m.id === 8)?.error?.code, -32601);
});

test("defaultServerRequest", () => {
	assert.deepEqual(defaultServerRequest("workspace/configuration", { items: [1] }), [null]);
	assert.equal(defaultServerRequest("client/registerCapability", {}), null);
	assert.equal(defaultServerRequest("window/workDoneProgress/create", {}), null);
	assert.throws(() => defaultServerRequest("nope", {}), MethodNotFoundError);
});
