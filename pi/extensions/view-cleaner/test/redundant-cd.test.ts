import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripRedundantCd } from "../redundant-cd.ts";

const home = "/Users/me";
const cwd = "/Users/me/repo";
const strip = (command: string) => stripRedundantCd(command, cwd, home);

test("strips cd into cwd before && ; and newline", () => {
	assert.equal(strip("cd /Users/me/repo && git status"), "git status");
	assert.equal(strip("cd /Users/me/repo; git status"), "git status");
	assert.equal(strip("cd /Users/me/repo\ngit status"), "git status");
	assert.equal(strip("  cd /Users/me/repo/  &&  ls -la"), "ls -la");
});

test("expands quotes, tilde, $HOME, $PWD, and dot paths", () => {
	assert.equal(strip('cd "/Users/me/repo" && ls'), "ls");
	assert.equal(strip("cd '/Users/me/repo' && ls"), "ls");
	assert.equal(strip("cd ~/repo && ls"), "ls");
	assert.equal(strip("cd $HOME/repo && ls"), "ls");
	assert.equal(strip("cd ${HOME}/repo && ls"), "ls");
	assert.equal(strip("cd $PWD && ls"), "ls");
	assert.equal(strip("cd . && ls"), "ls");
	assert.equal(strip("cd ../repo && ls"), "ls");
});

test("strips cd redirected to /dev/null", () => {
	assert.equal(strip("cd /Users/me/repo 2>/dev/null; ls"), "ls");
	assert.equal(strip("cd /Users/me/repo >/dev/null 2>&1 && ls"), "ls");
	assert.equal(strip("cd /Users/me/repo &> /dev/null && ls"), "ls");
	assert.equal(strip("cd /Users/me/repo 2>err.log && ls"), "cd /Users/me/repo 2>err.log && ls");
});

test("strips repeated prefixes and stops at the first other cd", () => {
	assert.equal(strip("cd /Users/me/repo && cd /Users/me/repo && ls"), "ls");
	assert.equal(strip("cd /Users/me/repo && cd sub && ls"), "cd sub && ls");
});

test("keeps cd into other directories", () => {
	assert.equal(strip("cd /Users/me/other && ls"), "cd /Users/me/other && ls");
	assert.equal(strip("cd /Users/me && ls"), "cd /Users/me && ls");
	assert.equal(strip("cd sub && ls"), "cd sub && ls");
});

test("keeps forms whose meaning is not a plain no-op", () => {
	assert.equal(strip("cd /Users/me/repo || exit 1"), "cd /Users/me/repo || exit 1");
	assert.equal(strip("cd /Users/me/repo | cat"), "cd /Users/me/repo | cat");
	assert.equal(strip("cd /Users/me/repo & ls"), "cd /Users/me/repo & ls");
	assert.equal(strip("(cd /Users/me/repo && ls)"), "(cd /Users/me/repo && ls)");
	assert.equal(strip("cd -P /Users/me/repo && ls"), "cd -P /Users/me/repo && ls");
	assert.equal(strip("cd ~other/repo && ls"), "cd ~other/repo && ls");
	assert.equal(strip("cd '~/repo' && ls"), "cd '~/repo' && ls");
	assert.equal(strip('cd "$DIR" && ls'), 'cd "$DIR" && ls');
	assert.equal(strip("cd $(git rev-parse --show-toplevel) && ls"), "cd $(git rev-parse --show-toplevel) && ls");
});

test("keeps a command that is only the cd", () => {
	assert.equal(strip("cd /Users/me/repo"), "cd /Users/me/repo");
	assert.equal(strip("cd /Users/me/repo;"), "cd /Users/me/repo;");
	assert.equal(strip("cd /Users/me/repo && "), "cd /Users/me/repo && ");
});

test("matches a symlinked path to its target", () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "view-cleaner-")));
	const real = join(root, "real");
	mkdirSync(real);
	symlinkSync(real, join(root, "link"));
	assert.equal(stripRedundantCd(`cd ${join(root, "link")} && ls`, real, home), "ls");
});
