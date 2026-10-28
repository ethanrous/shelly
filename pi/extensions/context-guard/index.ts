import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { registerContextGuard } from "./extension.ts";

export default function (pi: ExtensionAPI) {
	registerContextGuard(pi, Type, { mutate: withFileMutationQueue });
}
