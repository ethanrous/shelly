# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`shelly` is a personal dotfiles repository. It installs itself by symlinking its contents into `~/.config` and by appending a source line to `~/.{zsh,bash}rc`. There is no build step, no test suite, and no package manager — editing a file in-place is the development loop. After changes, run `sync` (an alias for `$SHELLY/shell/common/auto-loader.bash`) in an open shell to re-source everything.

The repo expects `$SHELLY` to be set to the repo root; this is done by `shell/common/auto-loader.bash` based on the path of the file that sourced it.

## Bootstrap / setup

The README documents the user-facing bootstrap:

```
curl -fsSL https://raw.githubusercontent.com/ethanrous/shelly/main/zsh/bootstrap.zsh | zsh
```

After cloning, the actual wiring is done by `shell/{zsh,bash}/setup.{zsh,bash}`. These scripts are idempotent: they create `~/.zshrc`/`~/.bashrc` if missing, symlink `~/.config/nvim → $SHELLY/nvim`, and hard-link `wezterm/wezterm.lua` into `~/.config/wezterm/`.

There is a submodule at `shell/zsh/plugins/zsh-vi-mode` — remember `git submodule update --init` when cloning fresh.

## Shell config architecture (the non-obvious part)

The shell config uses a three-layer sourcing model driven by `$SHELL_NAME` (which the user's rc file exports as `zsh` or `bash`):

1. **`shell/common/auto-loader.bash`** — the single entrypoint. Computes `$SHELLY` from its own path, then sources:
   - every file in `shell/common/source/*` (shell-agnostic aliases/functions like `ls`, `e`, `search`, `add_to_path`),
   - `shell/$SHELL_NAME/main` (the shell-specific entrypoint, which in turn sources everything in `shell/$SHELL_NAME/source/*`),
   - `shell/common/machines/$(hostname)` if it exists — this is where per-machine overrides live. If missing, the loader offers to create it.
2. **`shell/$SHELL_NAME/main`** — loops over `shell/$SHELL_NAME/source/*` and sources each file. This is where shell-specific things live (zsh prompt in `shell/zsh/source/ethan`, git aliases in `shell/{zsh,bash}/source/zsh_git`, etc.).
3. **Machine files** at `shell/common/machines/<hostname>` are sourced last so they can override anything.

Implications when editing:
- A new alias/function that works in both shells goes in `shell/common/source/ethan`. Shell-specific things (zsh prompt, vi-mode, completions) go under `shell/$SHELL_NAME/source/`.
- To trace what gets sourced, run `dbg` (toggles `SHELLY_DEBUG=true`) and then `sync` — the loader prints each file it sources.
- `sync` re-runs the full auto-loader in the current shell; prefer it over `source ~/.zshrc` because it also re-sources common files and the machine file.
- `ls` and `e` are overridden as shell functions (see `shell/common/source/ethan`), so scripts in this repo that call `ls` get `eza` if installed. Use `/bin/ls` or `/usr/bin/ls` to bypass.

## Pi config (`pi/`)

`pi/` mirrors the user-editable files of the pi agent at `~/.pi/agent/` and is symlinked in by `setup.{zsh,bash}` via the same `symlinkInto` helper used for Claude:

- `pi/settings.json` → `~/.pi/agent/settings.json`
- `pi/AGENTS.md` → `~/.pi/agent/AGENTS.md`
- `pi/mcp.json` → `~/.pi/agent/mcp.json`
- `pi/models.json` → `~/.pi/agent/models.json` (custom `lucy` provider; deliberately contains **no** API key — the key lives in `~/.pi/agent/auth.json` under `lucy`, which is per-machine and never committed)
- `pi/keybindings.json` → `~/.pi/agent/keybindings.json` (user keybindings, e.g. the Alt+T/Ctrl+T thinking toggle)
- `pi/hermes-memory-config.json` → `~/.pi/agent/hermes-memory-config.json` (pi-hermes-memory extension settings)
- `pi/web-search.json` → `~/.pi/agent/web-search.json` (pi-web-access settings)
- `pi/pi-blackhole-config.json` → `~/.pi/agent/pi-blackhole/pi-blackhole-config.json` (pi-blackhole compaction and memory settings; the rest of `~/.pi/agent/pi-blackhole/` is per-session runtime state and stays per-machine)
- `pi/extensions/` → `~/.pi/agent/extensions/` (local pi extensions; the whole dir is one symlink and pi auto-discovers `*.ts` in it, so adding an extension needs no setup-script or `settings.json` change)

Local extensions in `pi/extensions/`. The first two patch pi internals, so a pi upgrade can silently disable them; the fallback is pi's stock behavior. The repo has no `node_modules`, so editor diagnostics about unresolved `@earendil-works/*` imports are expected; pi resolves them at load time. Apply edits with `/reload` in pi.

- `thinking-stats.ts` - puts a spinner, elapsed time, and token count on the collapsed thinking label (`Thinking... 42.1s (1.3k tokens)`, then `Thought for 11.2s (756 tokens)`). It wraps `AssistantMessageComponent.prototype.updateContent` and sets `hiddenThinkingLabel` per component. The `pi-thinking-tail` package replaces the same method outright, so the wrapper is re-installed on `session_start` to stay outermost.
- `keep-chat-on-compaction.ts` - keeps the full rendered chat on screen across compactions; only the model context is compacted. It wraps `InteractiveMode.prototype.handleEvent` and, for a successful `compaction_end`, turns `chatContainer.clear` and `renderSessionEntries` into no-ops for that one call, so pi only appends the `[compaction]` block. `/reload`, `/resume`, and tree navigation still rebuild the chat from the compacted context.
- `copilot-usage.ts` - status-bar item (`Copilot: +312 session · 22.6k/40k (56%) · resets Oct 1`) shown only while the selected model's provider is `github-copilot`. Reads the OAuth token from `~/.pi/agent/auth.json` and calls `GET api.github.com/copilot_internal/user`; the session figure is the change in `credits_used` since the first fetch of the session, so concurrent Copilot use elsewhere on the account counts too. Refreshes 3s after each turn and every 5 min; `/copilot-usage` forces one.
- `lucy-flat-edit.ts` - for the `lucy`/`lucy-vllm` providers only, rewrites the `edit` tool in the outgoing request (`before_provider_request`) to a flat `{path, oldText, newText}` schema and rewords the system prompt's `edits[]` guidance. The vLLM qwen3_xml parser passes an array parameter through as hand-written JSON text, which the 27B breaks on long payloads; string parameters skip that step. pi's built-in edit tool converts the flat shape back to `edits` before validation, so nothing changes for other models. `/lucy-strict` toggles `strict: true` on that tool (off by default) to test whether the server enforces the schema with structured outputs.
- `targeted-compaction/` - scores redundant/bulky/stale context items (superseded reads, duplicate outputs, failed-then-retried calls, old bulky tool output, old thinking blocks) while the model works, then prunes them into one-line stubs in a single batch once context usage crosses a threshold, so pi-blackhole's summarizing compaction is delayed and each flush costs exactly one cache-miss reprefill. Config lives under `targetedCompaction` in `models.json` (enabled on `lucy`); see `targeted-compaction/README.md` for the full design, an optional `laya` sidecar scorer, and `/prune`.

Everything else under `~/.pi/agent/` is deliberately **not** symlinked and stays per-machine: `auth.json` (auth secrets), `models-store.json`, `mcp-*.json` caches, `sessions/`, `missions/`, `npm/` (installed packages, ~150MB), `bin/` (downloaded binaries), `run-history.jsonl`. New packages referenced by `settings.json`'s `packages` list are reinstalled by pi on the target machine.

When adding a new item to sync: drop it under `pi/`, then add a `symlinkInto` line in **both** `shell/zsh/setup.zsh` and `shell/bash/setup.bash`.

## Neovim config (`nvim/`)

- Entrypoint: `nvim/init.lua` → `require("config")` → `nvim/lua/config/init.lua` which loads `settings`, `keyboard`, `highlight`, `lazy`, `helpers`, `snippets`, `lsp` in that order.
- `init.lua` also calls `vim.lsp.enable({...})` with a list of LSP server names. Each name corresponds to a file in `nvim/lsp/<name>.lua` that holds that server's config (this is Neovim 0.11+ native LSP config, *not* nvim-lspconfig). To add a new LSP: create `nvim/lsp/<name>.lua` **and** add `"<name>"` to the list in `init.lua`.
- Global LSP keymaps (`gd`, `gr`, `<leader>r`, `<leader>ca`, diagnostics navigation with `ge`/`gE`, etc.) are set in `nvim/lua/config/lsp.lua` via an `LspAttach` autocmd — this is the single place to change them.
- Plugins are managed by **lazy.nvim** (see `nvim/lua/config/lazy.lua`), which imports everything under `nvim/lua/plugins/`. One file per plugin. `lazy-lock.json` is committed.
- There is also a second, separate plugin manager in use: Neovim's builtin `vim.pack` — see `nvim/nvim-pack-lock.json` (currently tracks `nvim-jump`). Don't confuse it with `lazy-lock.json`.
- Sessions auto-save to `~/.config/nvim/session/` when launched via the `e` shell function with no args; `e <path>` is a plain `nvim` passthrough.

## Terminal emulator config

`wezterm/wezterm.lua` is the only terminal emulator config still in use. `setup.{zsh,bash}` hard-links it into `~/.config/wezterm/`. (Historical note: `tmux/` and `alacritty/` directories used to live at the top level with `-$(uname)` platform suffixes — they've been removed. The `vim-tmux-navigator` nvim plugin is intentionally kept for its `<C-{h/j/k/l}>` pane bindings.)

## Claude Code config (`claude/`)

`claude/` mirrors a subset of `~/.claude/` and is symlinked in by `setup.{zsh,bash}` via a `symlinkInto` helper:

- `claude/settings.json` → `~/.claude/settings.json`
- `claude/CLAUDE.md` → `~/.claude/CLAUDE.md` (global user instructions)
- `claude/commands/` → `~/.claude/commands/` (custom slash commands)
- `claude/skills/` → `~/.claude/skills/` (the whole dir is one symlink, so every skill under `claude/skills/` syncs — adding a skill needs no setup-script change)

Everything else in `~/.claude/` is deliberately **not** symlinked and stays per-machine. That includes: `projects/` (per-project state and memory), `sessions/`, `history.jsonl`, `plugins/` (installed plugin cache), `settings.local.json`, `cache/`, `telemetry/`, `shell-snapshots/`, and similar runtime dirs. `~/.claude.json` is also left alone — it's mostly startup/migration/onboarding state even though it contains `mcpServers`.

When adding a new **top-level** item to sync: drop it under `claude/`, then add a `symlinkInto` line in **both** `shell/zsh/setup.zsh` and `shell/bash/setup.bash`. Adding a new skill is the exception — just drop it under `claude/skills/`; the directory symlink already covers it.

`symlinkInto` is idempotent — it short-circuits if the destination is already a symlink pointing at the right source. On a fresh machine where the destination already exists as a real dir, it will `rm -rf` first (matching the aggressive style of the rest of the setup script), so don't run setup on a machine with unsynced local Claude config you care about.

## Git workflow notes specific to this repo

`shell/zsh/source/zsh_git` defines short git helpers that are in use daily (`gs`, `gc`, `gb`, `gp`, `gl`, `grb`, `gwrk`, `git_wip`, etc.). If you're asked to change git behavior in the user's shell, that's the file.

Commits on `main` are frequently tagged `WIP` and pushed directly — this is a personal config repo, not a product.
