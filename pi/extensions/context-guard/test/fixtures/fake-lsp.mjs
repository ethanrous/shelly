import process from "node:process";

const mode = process.env.FAKE_LSP_MODE ?? "python";
let buffer = Buffer.alloc(0);

function send(message) {
	const body = Buffer.from(JSON.stringify(message), "utf8");
	process.stdout.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]));
}

function handle(message) {
	if (message.method === "initialize") {
		send({ jsonrpc: "2.0", id: message.id, result: { capabilities: { referencesProvider: true } } });
		if (mode === "java-broken") {
			send({ jsonrpc: "2.0", method: "language/status", params: { type: "ProjectStatus", message: "WARNING" } });
			send({
				jsonrpc: "2.0",
				method: "textDocument/publishDiagnostics",
				params: { uri: "file:///repo/buildSrc/build.gradle", diagnostics: [{ severity: 1, message: "The supplied phased action failed with an exception.\nBuild file ..." }] },
			});
		}
		if (mode === "java" || mode === "java-broken") {
			setTimeout(() => send({ jsonrpc: "2.0", method: "language/status", params: { type: "ServiceReady", message: "ServiceReady" } }), 20);
		}
		if (mode === "python" || mode === "crash") {
			setTimeout(() => send({ jsonrpc: "2.0", method: "window/logMessage", params: { type: 3, message: "Found 1 source file" } }), 20);
		}
		return;
	}
	if (message.method === "textDocument/references") {
		if (mode === "crash") process.exit(3);
		if (mode === "java-broken") {
			send({ jsonrpc: "2.0", id: message.id, result: [] });
			return;
		}
		const { textDocument, position } = message.params;
		send({
			jsonrpc: "2.0",
			id: message.id,
			result: [
				{ uri: textDocument.uri, range: { start: { line: position.line + 1, character: 4 }, end: { line: position.line + 1, character: 9 } } },
				{ uri: "jdt://contents/rt.jar/java.lang/String.class", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
			],
		});
		return;
	}
	if (message.method === "shutdown") {
		send({ jsonrpc: "2.0", id: message.id, result: null });
		return;
	}
	if (message.method === "exit") process.exit(0);
}

process.stdin.on("data", (chunk) => {
	buffer = Buffer.concat([buffer, chunk]);
	for (;;) {
		const end = buffer.indexOf("\r\n\r\n");
		if (end === -1) return;
		const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, end).toString("ascii"))[1]);
		if (buffer.length < end + 4 + length) return;
		const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString("utf8"));
		buffer = buffer.subarray(end + 4 + length);
		handle(message);
	}
});
