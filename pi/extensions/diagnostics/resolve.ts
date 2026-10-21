import { accessSync, constants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

export interface ResolveOptions {
	// Directory under each project ancestor that holds local binaries, such as .venv/bin.
	localDir?: string;
	// Directories searched after the local ones and before PATH.
	envDirs?: string[];
	// Directories searched after PATH.
	extraDirs?: string[];
	env: NodeJS.ProcessEnv;
}

export type Resolved = { path: string } | { looked: string[] };

export function gitRoot(from: string): string | undefined {
	return findUp(from, [".git"], undefined, false);
}

// Directories from `from` up to `stop` (inclusive) or the filesystem root.
export function ancestors(from: string, stop?: string): string[] {
	const dirs = [from];
	while (dirs[dirs.length - 1] !== stop) {
		const parent = dirname(dirs[dirs.length - 1]);
		if (parent === dirs[dirs.length - 1]) break;
		dirs.push(parent);
	}
	return dirs;
}

export function findUp(from: string, names: string[], stop?: string, bounded = true): string | undefined {
	const top = bounded ? (stop ?? gitRoot(from)) : stop;
	return ancestors(from, top).find((dir) => names.some((name) => existsSync(join(dir, name))));
}

function executable(path: string): boolean {
	try {
		accessSync(path, constants.X_OK);
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

export function findLocal(name: string, root: string, localDir: string): string | undefined {
	for (const dir of ancestors(root, gitRoot(root))) {
		const candidate = join(dir, localDir, name);
		if (executable(candidate)) return candidate;
	}
	return undefined;
}

const tilde = (dir: string) => (dir.startsWith(homedir()) ? `~${dir.slice(homedir().length)}` : dir);

export function resolveBinary(name: string, root: string, options: ResolveOptions): Resolved {
	const local = options.localDir ? findLocal(name, root, options.localDir) : undefined;
	if (local) return { path: local };
	const pathDirs = (options.env.PATH ?? "").split(delimiter).filter(Boolean);
	for (const dir of [...(options.envDirs ?? []), ...pathDirs, ...(options.extraDirs ?? [])]) {
		if (executable(join(dir, name))) return { path: join(dir, name) };
	}
	const looked = [...(options.localDir ? [options.localDir] : []), ...(options.envDirs ?? []).map(tilde), "PATH", ...(options.extraDirs ?? []).map(tilde)];
	return { looked };
}
