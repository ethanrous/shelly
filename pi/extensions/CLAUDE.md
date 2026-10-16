# pi extensions

Local pi extensions, symlinked to `~/.pi/agent/extensions/`. pi loads each top-level `*.ts` file and each subdirectory that has an `index.ts`, so adding one needs no setup-script or `settings.json` change. Apply edits with `/reload` in pi.

The repo has no `node_modules`, so editor diagnostics about unresolved `@earendil-works/*` imports are expected; pi resolves them at load time.

Extensions that patch pi internals, such as wrapping a class prototype exported by `@earendil-works/pi-coding-agent`, can be silently disabled by a pi upgrade; the fallback is pi's stock behavior.

An extension with a `test/` directory keeps its pi imports in `index.ts`, so the other modules run under `node --test 'pi/extensions/<name>/test/*.test.ts'` without pi.
