import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A leading `cd <word>`, optionally redirected to /dev/null, followed by `&&`, `;`, or a newline.
 * The word is a quoted path, or a bare path that starts with `/`, `.`, `~`, `$HOME`, or `$PWD`.
 * Other relative paths are left alone because `CDPATH` can redirect them.
 */
const CD_PREFIX =
	/^\s*cd[ \t]+("[^"$`\\]*"|'[^']*'|(?:[/.~]|\$\{?(?:HOME|PWD)\}?)[^\s;&|<>()'"`$\\]*)(?:[ \t]*(?:[12]?>|&>)[ \t]*(?:\/dev\/null|&[12]))*[ \t]*(?:&&|;|\n)\s*/;

/** The directory a `cd` word names, or undefined when the shell would expand it some other way. */
function expand(word: string, cwd: string, home: string): string | undefined {
	if (word.startsWith('"') || word.startsWith("'")) return word.slice(1, -1);
	if (word === "~" || word.startsWith("~/")) return home + word.slice(1);
	if (word.startsWith("~")) return undefined;
	return word.replace(/^\$\{?HOME\}?/, home).replace(/^\$\{?PWD\}?/, cwd);
}

function sameDir(a: string, b: string): boolean {
	if (resolve(a) === resolve(b)) return true;
	try {
		return realpathSync(a) === realpathSync(b);
	} catch {
		return false;
	}
}

/** Removes leading `cd` commands into `cwd`, which every bash call already starts in. */
export function stripRedundantCd(command: string, cwd: string, home: string): string {
	let rest = command;
	for (let match = CD_PREFIX.exec(rest); match; match = CD_PREFIX.exec(rest)) {
		const dir = expand(match[1], cwd, home);
		if (dir === undefined || !sameDir(resolve(cwd, dir), cwd)) break;
		const next = rest.slice(match[0].length);
		if (next.trim() === "") break;
		rest = next;
	}
	return rest;
}
