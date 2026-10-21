import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDiagnostics } from "./extension.ts";

export default function (pi: ExtensionAPI) {
	registerDiagnostics(pi, Type);
}
