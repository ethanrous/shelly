/**
 * Keeps the rendered chat on screen when the session is compacted.
 *
 * InteractiveMode handles a successful compaction_end by clearing the chat, re-rendering the
 * entries that remain in the model context, and appending the compaction summary. With the clear
 * and the re-render turned into no-ops for that one call, only the summary is appended below the
 * existing chat. The kept entries are already on screen, so nothing is drawn twice.
 */

import { InteractiveMode, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const INNER_KEY = Symbol.for("shelly.keep-chat-on-compaction.inner-handle-event");

function installWrapper(): void {
	const proto = InteractiveMode.prototype as any;
	const inner = proto.handleEvent[INNER_KEY] ?? proto.handleEvent;

	const wrapped = function (this: any, event: any) {
		const keepChat =
			event?.type === "compaction_end" && event.result && !event.aborted && this.isInitialized && this.chatContainer;
		if (!keepChat) return inner.call(this, event);

		// handleEvent runs the whole compaction_end case synchronously, before its first await.
		const chat = this.chatContainer;
		chat.clear = () => {};
		this.renderSessionEntries = () => {};
		try {
			return inner.call(this, event);
		} finally {
			delete chat.clear;
			delete this.renderSessionEntries;
		}
	};
	(wrapped as any)[INNER_KEY] = inner;
	proto.handleEvent = wrapped;
}

export default function keepChatOnCompactionExtension(_pi: ExtensionAPI): void {
	installWrapper();
}
