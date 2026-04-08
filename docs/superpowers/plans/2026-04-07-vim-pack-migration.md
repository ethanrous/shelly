# vim.pack Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lazy.nvim with Neovim 0.12's built-in `vim.pack` for managing all ~70 plugins, reorganizing them into logical, well-named files with keybinds co-located alongside the plugins they control.

**Architecture:** Migrate incrementally by renaming the current `lua/plugins/` to `lua/plugins_old/` (keeps lazy.nvim working during migration), then building up a fresh `lua/plugins/` directory file-by-file with `vim.pack.add` specs + setup calls + keybinds in the same file. Each migration task moves one logical group, deletes the corresponding `plugins_old/` files, and verifies nvim still launches cleanly. At the end, delete `config/lazy.lua`, `plugins_old/`, `lazy-lock.json`, and uninstall lazy.nvim from disk.

**Tech Stack:** Neovim 0.12+ (for `vim.pack`), Lua, Git.

---

## Background: vim.pack essentials

Key differences from lazy.nvim the engineer must understand before editing anything:

- **No `lazy`, `event`, `ft`, `cmd`, or `keys` fields.** The user does not want lazy loading. All plugins load at startup.
- **No `config`/`opts`.** After `vim.pack.add({ ... })`, you must manually `require("plugin").setup(opts)` in the same file.
- **No `dependencies`.** Dependencies are plain entries in the same spec list — order within the list is fine since vim.pack adds them all to `runtimepath` together, but **order between files** matters: a file using `require("plenary")` must load after the file that `vim.pack.add`s plenary.
- **`build` hooks replaced by `PackChanged` autocmd.** For plugins with a `build` step (codesnap `make`, LuaSnip `make install_jsregexp`, telescope-fzf-native `make`, treesitter `:TSUpdate`), register a single autocmd in `lua/plugins/init.lua` **before** any `vim.pack.add` call.
- **`load = false` is the default during init.lua sourcing.** Plugin `plugin/*.vim` files are sourced at the end of startup automatically (Neovim's standard `load-plugins` phase picks up plugins that have been `:packadd!`ed). Lua modules are available for `require()` immediately after `add()` returns.
- **Branch/tag via `version` field.** String = branch/tag/commit. `vim.version.range("2")` = latest `2.x.y` semver tag.
- **Install location:** `~/.local/share/nvim/site/pack/core/opt/<plugin-name>/`. Plugin name is the last URL path segment (e.g. `todo-comments.nvim`).
- **Lockfile:** `~/.config/nvim/nvim-pack-lock.json` — already exists (tracks `nvim-jump`) and will be committed to the repo.

---

## File structure (final)

After migration, `lua/plugins/` will contain exactly these 21 files:

```
lua/plugins/
  init.lua         -- Registers PackChanged build hooks, then requires every plugin module in dependency order
  core.lua         -- plenary, popup, nui, nvim-web-devicons (shared deps, load first)
  colorscheme.lua  -- tokyonight (applied before other UI)
  treesitter.lua   -- nvim-treesitter + context + textobjects + ts-context-commentstring + rainbow-delimiters
  lsp.lua          -- mason, workspace-diagnostics, lazydev
  completion.lua   -- LuaSnip, lspkind, blink.cmp, neogen
  copilot.lua      -- copilot.lua, copilot-lsp
  telescope.lua    -- telescope + live-grep-args + ui-select + fzf-native + fzy-native + undo + smart-open + sqlite
  git.lua          -- diffview, gitsigns, neogit
  explorer.lua     -- oil
  harpoon.lua      -- harpoon (branch harpoon2)
  statusline.lua   -- lualine
  ui.lua           -- noice, snacks, indent-blankline, nvim-highlight-colors, vim-illuminate
  mini.lua         -- mini.ai/splitjoin/bracketed/notify/comment/move/surround/misc
  editing.lua      -- nvim-autopairs, Comment, vim-abolish, nvim-ts-autotag, alternate-toggler, todo-comments, vim-repeat
  movement.lua     -- leap, nvim-jump, vim-tmux-navigator, vim-lastplace
  dap.lua          -- nvim-dap + dap-ui + dap-python + dap-go + dap-virtual-text + nvim-nio + FixCursorHold + neotest + neotest-python + neotest-go
  formatter.lua    -- conform
  quickfix.lua     -- quicker, nvim-bqf
  ai.lua           -- codecompanion, markview
  misc.lua         -- presence, codesnap, remote-nvim, profile
```

**Plugins intentionally dropped:** `faster.nvim` (was `enabled = false`), commented-out `distant.nvim`, `neo-tree`, `nvim-tree`, `sidekick`, `avante`. Orphan `plugins/ftplugin/java.lua` (sits under `lua/` which is not nvim's ftplugin path → dead code) also deleted.

**`dap-go.lua` (top-level)** is a duplicate of the dap-go config already inside `dap.lua`. It is folded into the new `dap.lua` during Task 20.

---

## Before you start: install confirmation behavior

Each task that introduces new plugins will trigger a `vim.pack` confirmation buffer on the **first** launch of nvim that sees them. Headless nvim (`nvim --headless -c 'qa'`) cannot respond to that buffer and will appear to hang or produce noise.

**The workflow per task is therefore always:**

1. Make the code edits.
2. Run `nvim` **interactively** once. If a confirmation buffer pops up listing new plugins, approve it with `:w` and quit with `:qa`. If no buffer appears, everything is already installed — quit with `:qa`.
3. Re-run the headless smoke test (`nvim --headless -c 'qa' 2>&1`) to confirm a clean startup.
4. Commit.

The per-task smoke-test steps below assume Step 2 has already happened. If a smoke test hangs, interrupt and run interactively first.

---

## Task 0: Baseline — verify nothing is broken before we start

**Files:** none

- [ ] **Step 1: Capture the current working state**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output (no errors). If there ARE errors on the current `main`, stop and report — the migration cannot proceed on a broken baseline.

- [ ] **Step 2: Confirm the plugin count we are migrating**

Run: `ls /Users/erousseau/shelly/nvim/lua/plugins/*.lua | wc -l`
Expected: `25` or similar — a non-zero number roughly matching the file list above. This is just a sanity check.

- [ ] **Step 3: Confirm `vim.pack` is available**

Run: `nvim --headless -c 'lua print(type(vim.pack) == "table" and type(vim.pack.add) == "function")' -c 'qa!' 2>&1`
Expected: `true` in the output. If `false`, the nvim version is too old and the migration cannot proceed.

---

## Task 1: Rename `plugins/` → `plugins_old/` and point lazy at the new path

**Files:**
- Rename: `nvim/lua/plugins/` → `nvim/lua/plugins_old/`
- Modify: `nvim/lua/config/lazy.lua`

**Rationale:** Lazy currently loads specs via `import = "plugins"`. By renaming and updating that import string, lazy keeps working with the exact same files under a new module name. This frees up `lua/plugins/` to become the vim.pack home.

- [ ] **Step 1: Rename the directory with git**

Run: `cd /Users/erousseau/shelly && git mv nvim/lua/plugins nvim/lua/plugins_old`
Expected: no output. `git status` should show all files as renamed.

- [ ] **Step 2: Update `config/lazy.lua` to import the renamed module**

Edit `nvim/lua/config/lazy.lua`. Change:

```lua
require("lazy").setup({
	{ import = "plugins" },
}, {
```

to:

```lua
require("lazy").setup({
	{ import = "plugins_old" },
}, {
```

- [ ] **Step 3: Smoke-test nvim still launches**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output. If any plugin errors, a file still references `require("plugins.xxx")` — fix before continuing.

- [ ] **Step 4: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins_old nvim/lua/config/lazy.lua
git commit -m "chore(nvim): rename plugins/ to plugins_old/ for vim.pack migration"
```

---

## Task 2: Scaffold the new `plugins/` directory and loader

**Files:**
- Create: `nvim/lua/plugins/init.lua`
- Modify: `nvim/lua/config/init.lua`

**Rationale:** Creates the new loader skeleton. The loader registers the `PackChanged` build-hook autocmd **before** any `vim.pack.add` call, then requires each plugin module (currently none). Wiring it into `config/init.lua` ahead of `config.lazy` lets both systems run side-by-side during the migration.

- [ ] **Step 1: Create the new loader**

Create `nvim/lua/plugins/init.lua` with this exact content:

```lua
-- Entry point for vim.pack-managed plugins.
-- Registers build hooks, then requires every plugin module in dependency order.

-- Build hooks for plugins that used lazy.nvim's `build = ...`.
-- Must be registered BEFORE any vim.pack.add() call so install-time hooks fire.
local function run_build(cwd, cmd)
	vim.system(cmd, { cwd = cwd }):wait()
end

local build_hooks = {
	["LuaSnip"] = function(path)
		run_build(path, { "make", "install_jsregexp" })
	end,
	["codesnap.nvim"] = function(path)
		run_build(path, { "make" })
	end,
	["telescope-fzf-native.nvim"] = function(path)
		run_build(path, { "make" })
	end,
	["nvim-treesitter"] = function(_)
		-- TSUpdate must run inside nvim after the plugin is loaded, not via shell.
		-- Schedule it for after init finishes so the ex command is available.
		vim.schedule(function()
			pcall(vim.cmd, "TSUpdate")
		end)
	end,
}

vim.api.nvim_create_autocmd("PackChanged", {
	group = vim.api.nvim_create_augroup("plugins-build-hooks", { clear = true }),
	callback = function(ev)
		local kind = ev.data.kind
		if kind ~= "install" and kind ~= "update" then
			return
		end
		local hook = build_hooks[ev.data.spec.name]
		if hook then
			hook(ev.data.path)
		end
	end,
})

-- Load order matters: files that provide shared deps (plenary, web-devicons, nui)
-- must load before any file that consumes them.
-- Every require is commented out initially — each subsequent task uncomments
-- exactly one line as it creates that module.
-- require("plugins.core")
-- require("plugins.colorscheme")
-- require("plugins.treesitter")
-- require("plugins.lsp")
-- require("plugins.completion")
-- require("plugins.copilot")
-- require("plugins.telescope")
-- require("plugins.git")
-- require("plugins.explorer")
-- require("plugins.harpoon")
-- require("plugins.statusline")
-- require("plugins.ui")
-- require("plugins.mini")
-- require("plugins.editing")
-- require("plugins.movement")
-- require("plugins.dap")
-- require("plugins.formatter")
-- require("plugins.quickfix")
-- require("plugins.ai")
-- require("plugins.misc")
```

- [ ] **Step 2: Wire the new loader into `config/init.lua`**

Edit `nvim/lua/config/init.lua`. Current content:

```lua
require("config.settings")
require("config.keyboard")
require("config.highlight")
require("config.lazy")
require("config.helpers")
require("config.snippets")
require("config.lsp")
```

Add a `require("plugins")` line immediately before `require("config.lazy")`:

```lua
require("config.settings")
require("config.keyboard")
require("config.highlight")
require("plugins")
require("config.lazy")
require("config.helpers")
require("config.snippets")
require("config.lsp")
```

- [ ] **Step 3: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output. The new `plugins/init.lua` only registers an autocmd — no plugin modules are required yet, so nothing breaks.

- [ ] **Step 4: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/init.lua nvim/lua/config/init.lua
git commit -m "feat(nvim): scaffold vim.pack loader with build hooks"
```

---

## Task 3: Migrate core dependencies (plenary, popup, nui, web-devicons)

**Files:**
- Create: `nvim/lua/plugins/core.lua`
- Delete: (partial) `nvim/lua/plugins_old/init.lua` — remove only the `plenary.nvim` and `popup.nvim` entries

**Rationale:** These four are dependencies many later plugins consume via `require()`. They must load first. `plenary`, `popup`, and `nui` expose lua modules; `nvim-web-devicons` exposes a lua module and is required by lualine/oil/telescope/noice. No setup calls are strictly needed for plenary or popup.

- [ ] **Step 1: Create `nvim/lua/plugins/core.lua`**

```lua
-- Shared dependencies used by many other plugins. Must load before them.
vim.pack.add({
	"https://github.com/nvim-lua/plenary.nvim",
	"https://github.com/nvim-lua/popup.nvim",
	"https://github.com/MunifTanjim/nui.nvim",
	"https://github.com/nvim-tree/nvim-web-devicons",
})

require("nvim-web-devicons").setup({})
```

- [ ] **Step 2: Uncomment `require("plugins.core")` in `plugins/init.lua`**

Edit `nvim/lua/plugins/init.lua` and uncomment only that one line.

- [ ] **Step 3: Remove plenary and popup from `plugins_old/init.lua`**

Edit `nvim/lua/plugins_old/init.lua`. Delete these two lines from the returned table:

```lua
	"nvim-lua/plenary.nvim", -- Necessary dependency
	"nvim-lua/popup.nvim", -- Necessary dependency
```

Leave the other entries in place — they will be migrated in later tasks.

nui.nvim is pulled in as a transitive dependency by noice and remote-nvim in the old lazy specs, so there is nothing to remove from those files yet.

- [ ] **Step 4: Trigger the first install interactively**

On the first task that calls `vim.pack.add` for a not-yet-installed plugin, vim.pack shows a confirmation buffer. Headless nvim cannot respond to it, so run nvim **interactively** once: `nvim`. A confirmation buffer will appear listing the four plugins to install. Write it with `:w` to approve, then `:qa`.

Subsequent `nvim --headless` runs in later tasks will succeed without prompting because the plugins are already on disk.

- [ ] **Step 5: Verify the install**

Run: `ls ~/.local/share/nvim/site/pack/core/opt/`
Expected: a list containing `plenary.nvim`, `popup.nvim`, `nui.nvim`, `nvim-web-devicons`, `nvim-jump`.

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output (plugins already installed; no confirmation buffer this time).

- [ ] **Step 6: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/core.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/init.lua nvim/nvim-pack-lock.json
git commit -m "feat(nvim): migrate core deps (plenary, popup, nui, web-devicons) to vim.pack"
```

---

## Task 4: Migrate colorscheme (tokyonight)

**Files:**
- Create: `nvim/lua/plugins/colorscheme.lua`
- Modify: `nvim/lua/plugins_old/theme.lua` — remove the tokyonight entry only

**Rationale:** Colorscheme must apply early so subsequent UI plugins pick up its highlight groups. `theme.lua` currently bundles tokyonight + vim-illuminate + lualine + nvim-highlight-colors; the remaining three will be migrated in later tasks (statusline, ui).

- [ ] **Step 1: Create `nvim/lua/plugins/colorscheme.lua`**

```lua
vim.pack.add({ "https://github.com/folke/tokyonight.nvim" })

require("tokyonight").setup({
	transparent = false,
	style = "moon",
	light_style = "day",
	on_colors = function(colors)
		if vim.opt.background:get() == "dark" then
			colors.bg = "#0D1017"
			colors.bg_dark = "#0D1017"
			colors.bg_float = "#131621"
			colors.bg_popup = "#131621"
			colors.bg_search = "#131621"
			colors.bg_sidebar = "#131621"
			colors.bg_statusline = "#131621"
		else
			colors.bg = "#eff1f5"
			colors.bg_float = "#e6e9ef"
		end
	end,
	on_highlights = function(hl, c)
		hl.CursorLineNr.fg = c.blue
		hl.EndOfBuffer.fg = c.bg_statusline
		hl.StatusLine.fg = c.bg_statusline
		hl.DiffDelete.fg = c.git.delete

		local prompt = c.bg_float
		hl.TelescopeNormal = { bg = c.bg_float, fg = c.fg_dark }
		hl.TelescopeBorder = { bg = c.bg_float, fg = c.bg_float }
		hl.TelescopePromptNormal = { bg = prompt }
		hl.TelescopePromptBorder = { bg = prompt, fg = prompt }
		hl.TelescopePromptTitle = { bg = prompt, fg = prompt }
		hl.TelescopePreviewTitle = { bg = c.bg_float, fg = c.bg_float }
		hl.TelescopeResultsTitle = { bg = c.bg_float, fg = c.bg_float }
	end,
	styles = {
		comments = { italic = false },
		keywords = { italic = false },
	},
})

if vim.opt.background:get() == "dark" then
	vim.cmd.colorscheme("tokyonight-moon")
else
	vim.cmd.colorscheme("tokyonight-day")
end
```

- [ ] **Step 2: Remove tokyonight from `plugins_old/theme.lua`**

Edit `nvim/lua/plugins_old/theme.lua`. Delete the entire `{ "folke/tokyonight.nvim", ... }` table (lines 2–71 in the current file) including its trailing comma. The file should still return a table with the remaining three specs (vim-illuminate, lualine, nvim-highlight-colors).

- [ ] **Step 3: Uncomment `require("plugins.colorscheme")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output. `nvim --headless -c 'lua print(vim.g.colors_name)' -c 'qa!' 2>&1` should print `tokyonight-moon` (or `-day`).

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/colorscheme.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/theme.lua nvim/nvim-pack-lock.json
git commit -m "feat(nvim): migrate tokyonight to vim.pack"
```

---

## Task 5: Migrate treesitter (parser + context + textobjects + ts-context-commentstring + rainbow-delimiters)

**Files:**
- Create: `nvim/lua/plugins/treesitter.lua`
- Delete: `nvim/lua/plugins_old/treesitter.lua`

**Rationale:** Treesitter must be available before any plugin that consumes it (neogen, codecompanion, mini.comment's context-aware commentstring, neotest). It uses the `main` branch for both nvim-treesitter and nvim-treesitter-textobjects (new non-nvim-lspconfig-style API). `:TSUpdate` runs via the build hook registered in Task 2.

- [ ] **Step 1: Create `nvim/lua/plugins/treesitter.lua`**

```lua
vim.pack.add({
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
	"https://github.com/nvim-treesitter/nvim-treesitter-context",
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter-textobjects", version = "main" },
	"https://github.com/JoosepAlviste/nvim-ts-context-commentstring",
	"https://github.com/HiPhish/rainbow-delimiters.nvim",
})

-- Treesitter core (main branch API)
require("nvim-treesitter").setup({})
require("nvim-treesitter").install({
	"lua",
	"javascript",
	"typescript",
	"fish",
	"bash",
	"dockerfile",
	"java",
	"ruby",
	"go",
	"html",
	"json",
	"markdown",
	"markdown_inline",
	"python",
	"scala",
	"scss",
	"css",
	"regex",
	"vim",
	"yaml",
	"tsx",
	"rust",
})

vim.treesitter.language.register("tsx", { "javascript", "typescript.tsx" })

vim.api.nvim_create_autocmd("FileType", {
	callback = function(args)
		pcall(vim.treesitter.start, args.buf)
	end,
})

-- Treesitter context (sticky header for current scope)
require("treesitter-context").setup({ max_lines = 10 })

-- Treesitter context commentstring (JSX-aware commentstrings etc.)
require("ts_context_commentstring").setup({ enable_autocmd = false })

-- Treesitter text objects (move/select by @function, @class, ...)
require("nvim-treesitter-textobjects").setup({
	select = { lookahead = true },
	move = { set_jumps = true },
})

local select_textobject = function(query)
	return function()
		require("nvim-treesitter-textobjects.select").select_textobject(query, "textobjects")
	end
end

local goto_next = function(query)
	return function()
		require("nvim-treesitter-textobjects.move").goto_next_start(query, "textobjects")
	end
end

local goto_prev = function(query)
	return function()
		require("nvim-treesitter-textobjects.move").goto_previous_start(query, "textobjects")
	end
end

-- Select keymaps
vim.keymap.set({ "x", "o" }, "aa", select_textobject("@parameter.outer"), { desc = "Select outer part of a parameter/argument" })
vim.keymap.set({ "x", "o" }, "ia", select_textobject("@parameter.inner"), { desc = "Select inner part of a parameter/argument" })
vim.keymap.set({ "x", "o" }, "ai", select_textobject("@conditional.outer"), { desc = "Select outer part of a conditional" })
vim.keymap.set({ "x", "o" }, "ii", select_textobject("@conditional.inner"), { desc = "Select inner part of a conditional" })
vim.keymap.set({ "x", "o" }, "al", select_textobject("@loop.outer"), { desc = "Select outer part of a loop" })
vim.keymap.set({ "x", "o" }, "il", select_textobject("@loop.inner"), { desc = "Select inner part of a loop" })
vim.keymap.set({ "x", "o" }, "af", select_textobject("@call.outer"), { desc = "Select outer part of a function call" })
vim.keymap.set({ "x", "o" }, "if", select_textobject("@call.inner"), { desc = "Select inner part of a function call" })
vim.keymap.set({ "x", "o" }, "am", select_textobject("@function.outer"), { desc = "Select outer part of a method/function definition" })
vim.keymap.set({ "x", "o" }, "im", select_textobject("@function.inner"), { desc = "Select inner part of a method/function definition" })
vim.keymap.set({ "x", "o" }, "ac", select_textobject("@class.outer"), { desc = "Select outer part of a class" })
vim.keymap.set({ "x", "o" }, "ic", select_textobject("@class.inner"), { desc = "Select inner part of a class" })

-- Move keymaps
vim.keymap.set({ "n", "x", "o" }, "]f", goto_next("@call.outer"), { desc = "Next function call start" })
vim.keymap.set({ "n", "x", "o" }, "]m", goto_next("@function.outer"), { desc = "Next method/function def start" })
vim.keymap.set({ "n", "x", "o" }, "]c", goto_next("@class.outer"), { desc = "Next class start" })
vim.keymap.set({ "n", "x", "o" }, "]i", goto_next("@conditional.outer"), { desc = "Next conditional start" })
vim.keymap.set({ "n", "x", "o" }, "]l", goto_next("@loop.outer"), { desc = "Next loop start" })
vim.keymap.set({ "n", "x", "o" }, "[f", goto_prev("@call.outer"), { desc = "Prev function call start" })
vim.keymap.set({ "n", "x", "o" }, "[m", goto_prev("@function.outer"), { desc = "Prev method/function def start" })
vim.keymap.set({ "n", "x", "o" }, "[c", goto_prev("@class.outer"), { desc = "Prev class start" })
vim.keymap.set({ "n", "x", "o" }, "[i", goto_prev("@conditional.outer"), { desc = "Prev conditional start" })
vim.keymap.set({ "n", "x", "o" }, "[l", goto_prev("@loop.outer"), { desc = "Prev loop start" })

-- Rainbow delimiters
require("rainbow-delimiters.setup").setup({ blacklist = { "xml" } })
```

- [ ] **Step 2: Delete `plugins_old/treesitter.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/treesitter.lua`

- [ ] **Step 3: Uncomment `require("plugins.treesitter")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output. `:TSUpdate` will run asynchronously the first time parsers install — that may print progress, which is acceptable during the first interactive launch.

Also verify textobjects keymaps are defined:
Run: `nvim --headless -c 'lua print(vim.fn.maparg("aa", "x"))' -c 'qa!' 2>&1`
Expected: non-empty output mentioning the textobject callback.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/treesitter.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/treesitter.lua
git commit -m "feat(nvim): migrate treesitter suite to vim.pack"
```

---

## Task 6: Migrate LSP base (mason, workspace-diagnostics, lazydev)

**Files:**
- Create: `nvim/lua/plugins/lsp.lua`
- Delete: `nvim/lua/plugins_old/lsp.lua`
- Modify: `nvim/lua/plugins_old/snacks.lua` — remove the `lazydev.nvim` entry only

**Rationale:** `lazydev.nvim` was tucked into the old `snacks.lua` but is conceptually LSP-adjacent (lua-language-server library paths). Move it next to mason and workspace-diagnostics. Its original `ft = "lua"` lazy-loading is dropped per the plan goal.

- [ ] **Step 1: Create `nvim/lua/plugins/lsp.lua`**

```lua
vim.pack.add({
	"https://github.com/mason-org/mason.nvim",
	"https://github.com/artemave/workspace-diagnostics.nvim",
	"https://github.com/folke/lazydev.nvim",
})

require("mason").setup()

require("lazydev").setup({
	library = {
		-- Load luvit types when the `vim.uv` word is found
		{ path = "${3rd}/luv/library", words = { "vim%.uv" } },
	},
})

-- workspace-diagnostics has no global setup; it's consumed via
-- require("workspace-diagnostics").populate_workspace_diagnostics(client, bufnr)
-- from LspAttach, which can be wired in later if needed.
```

- [ ] **Step 2: Delete `plugins_old/lsp.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/lsp.lua`

- [ ] **Step 3: Remove lazydev from `plugins_old/snacks.lua`**

Edit `nvim/lua/plugins_old/snacks.lua`. Delete the entire `{ "folke/lazydev.nvim", ... }` table (lines 74–84 in the current file) including its trailing comma.

- [ ] **Step 4: Uncomment `require("plugins.lsp")` in `plugins/init.lua`**

- [ ] **Step 5: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify mason command exists: `nvim --headless -c 'lua print(vim.fn.exists(":Mason"))' -c 'qa!' 2>&1`
Expected: `2` (command exists).

- [ ] **Step 6: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/lsp.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/snacks.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/lsp.lua
git commit -m "feat(nvim): migrate LSP base (mason, workspace-diagnostics, lazydev) to vim.pack"
```

---

## Task 7: Migrate completion (LuaSnip, lspkind, blink.cmp, neogen)

**Files:**
- Create: `nvim/lua/plugins/completion.lua`
- Delete: `nvim/lua/plugins_old/blink.lua`

**Rationale:** blink.cmp needs LuaSnip and lspkind on runtimepath before its setup runs. They are batched in a single `vim.pack.add` so all three are RTP-resolved together. LuaSnip's `build = "make install_jsregexp"` is handled by the `PackChanged` hook registered in Task 2 under the key `"LuaSnip"`. neogen defines a keybind that is kept here so keybinds stay with their plugin.

- [ ] **Step 1: Create `nvim/lua/plugins/completion.lua`**

```lua
vim.pack.add({
	{ src = "https://github.com/L3MON4D3/LuaSnip", version = vim.version.range("2") },
	"https://github.com/onsails/lspkind.nvim",
	{ src = "https://github.com/saghen/blink.cmp", version = vim.version.range("1") },
	"https://github.com/danymat/neogen",
})

require("blink.cmp").setup({
	fuzzy = { implementation = "prefer_rust_with_warning" },
	completion = {
		menu = {
			auto_show = function(ctx)
				return ctx.mode ~= "cmdline" or not vim.tbl_contains({ "/", "?" }, vim.fn.getcmdtype())
			end,
			border = "none",
			draw = {
				gap = 2,
				columns = { { "kind_icon" }, { "label", "label_description", gap = 1 } },
				components = {
					kind_icon = {
						text = function(ctx)
							local icon = ctx.kind_icon
							if ctx.item.source_name == "LSP" then
								local color_item = require("nvim-highlight-colors").format(
									ctx.item.documentation,
									{ kind = ctx.kind }
								)
								if color_item and color_item.abbr ~= "" then
									icon = color_item.abbr
								end
							end
							return icon .. ctx.icon_gap
						end,
						highlight = function(ctx)
							local highlight = "BlinkCmpKind" .. ctx.kind
							if ctx.item.source_name == "LSP" then
								local color_item = require("nvim-highlight-colors").format(
									ctx.item.documentation,
									{ kind = ctx.kind }
								)
								if color_item and color_item.abbr_hl_group then
									highlight = color_item.abbr_hl_group
								end
							end
							return highlight
						end,
					},
				},
			},
		},
		documentation = { auto_show = true, auto_show_delay_ms = 0, window = { border = "solid" } },
		list = { selection = { preselect = true, auto_insert = false } },
	},
	snippets = { preset = "luasnip" },
	cmdline = { enabled = false },
	sources = {
		default = { "lsp", "path", "snippets", "buffer" },
		providers = {
			snippets = { opts = { prefer_doc_trig = true } },
			path = {
				opts = {
					get_cwd = function()
						return vim.fn.getcwd()
					end,
				},
			},
		},
	},
	signature = {
		enabled = true,
		window = { border = "solid" },
		trigger = { show_on_insert = true },
	},
	keymap = {
		preset = "default",
		["<A-j>"] = { "select_next" },
		["<A-k>"] = { "select_prev" },
		["<A-l>"] = { "select_and_accept" },
		["<C-d>"] = { "show_documentation" },
		["<A-Tab>"] = {
			function()
				local copilot = require("copilot.suggestion")
				if copilot.is_visible() then
					copilot.accept()
				end
				return true
			end,
		},
		["<Tab>"] = {
			function(cmp)
				if cmp.snippet_active() then
					return cmp.accept()
				else
					return cmp.select_and_accept()
				end
			end,
			"snippet_forward",
			"fallback",
		},
		["<S-Tab>"] = { "snippet_backward", "fallback" },
	},
	opts_extend = { "sources.default" },
})

-- Neogen (automatic docstrings)
require("neogen").setup({})
vim.keymap.set("n", "<leader>ds", function()
	require("neogen").generate()
end, { desc = "Generate [D]oc[S]tring" })
```

- [ ] **Step 2: Delete `plugins_old/blink.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/blink.lua`

- [ ] **Step 3: Uncomment `require("plugins.completion")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output. If LuaSnip's `jsregexp` build fails, it logs a warning but nvim still starts — not a blocker.

Verify blink is active: `nvim --headless -c 'lua print(require("blink.cmp") ~= nil)' -c 'qa!' 2>&1`
Expected: `true`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/completion.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/blink.lua
git commit -m "feat(nvim): migrate completion (LuaSnip, lspkind, blink.cmp, neogen) to vim.pack"
```

---

## Task 8: Migrate Copilot (copilot.lua, copilot-lsp)

**Files:**
- Create: `nvim/lua/plugins/copilot.lua`
- Modify: `nvim/lua/plugins_old/llm.lua` — remove only the `copilot.lua` entry

**Rationale:** Copilot was bundled into `llm.lua` alongside codecompanion and markview. Split it out: copilot is AI-*inline-completion*, while codecompanion/markview are migrated together under `ai.lua` (Task 21).

- [ ] **Step 1: Create `nvim/lua/plugins/copilot.lua`**

```lua
vim.pack.add({
	"https://github.com/zbirenbaum/copilot.lua",
	"https://github.com/copilotlsp-nvim/copilot-lsp",
})

require("copilot").setup({
	filetypes = { ["*"] = true },
	copilot_model = "gpt-41-copilot",
	suggestion = {
		enabled = true,
		auto_trigger = true,
		keymap = {
			accept = false,
			accept_word = false,
			accept_line = false,
			next = false,
			prev = false,
			dismiss = false,
		},
	},
	server_opts_overrides = {
		settings = {
			advanced = { inlineSuggestCount = 1 },
		},
	},
})
```

- [ ] **Step 2: Remove copilot.lua and copilot-lsp from `plugins_old/llm.lua`**

Edit `nvim/lua/plugins_old/llm.lua`. Delete the entire `{ "zbirenbaum/copilot.lua", ... }` table (lines 2–46 in the current file) including its trailing comma. The file should still return a table with codecompanion and markview (and the large commented-out blocks for sidekick/avante).

- [ ] **Step 3: Uncomment `require("plugins.copilot")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output (a Copilot auth warning is acceptable).

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/copilot.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/llm.lua nvim/nvim-pack-lock.json
git commit -m "feat(nvim): migrate copilot.lua to vim.pack"
```

---

## Task 9: Migrate Telescope (+ all extensions)

**Files:**
- Create: `nvim/lua/plugins/telescope.lua`
- Delete: `nvim/lua/plugins_old/telescope.lua`

**Rationale:** Telescope + its 7 extension plugins must all load before any plugin that calls `require("telescope")` (neogit, remote-nvim). sqlite.lua is a smart-open dep. telescope-fzf-native's `make` build is handled by the hook in Task 2. smart-open tracks the `0.2.x` branch.

- [ ] **Step 1: Create `nvim/lua/plugins/telescope.lua`**

```lua
vim.pack.add({
	"https://github.com/nvim-telescope/telescope.nvim",
	"https://github.com/nvim-telescope/telescope-live-grep-args.nvim",
	"https://github.com/nvim-telescope/telescope-ui-select.nvim",
	"https://github.com/nvim-telescope/telescope-fzf-native.nvim",
	"https://github.com/nvim-telescope/telescope-fzy-native.nvim",
	"https://github.com/debugloop/telescope-undo.nvim",
	{ src = "https://github.com/danielfalk/smart-open.nvim", version = "0.2.x" },
	"https://github.com/kkharji/sqlite.lua",
})

local telescope = require("telescope")
local actions = require("telescope.actions")
local builtin = require("telescope.builtin")
local lga_actions = require("telescope-live-grep-args.actions")

-- Allow for more space for the fnames
local picker_config = {}
for b, _ in pairs(builtin) do
	picker_config[b] = { fname_width = 80 }
end

telescope.setup({
	pickers = vim.tbl_extend("force", picker_config, {
		lsp_references = { fname_width = 80 },
	}),
	extensions = {
		live_grep_args = {
			auto_quoting = true,
			file_ignore_patterns = { "node_modules", "pnpm-lock.yaml", "package-lock.json" },
			additional_args = function(_)
				return { "--hidden", "--glob", "!.git" }
			end,
			hidden = true,
			mappings = {
				i = {
					["<C-k>"] = lga_actions.quote_prompt(),
					["<C-i>"] = lga_actions.quote_prompt({ postfix = " --iglob " }),
				},
			},
		},
		["ui-select"] = {
			require("telescope.themes").get_dropdown({}),
		},
		smart_open = {
			ignore_patterns = {
				"*.git/*", "*debug/*", "*.pdf", "*.ico", "*.class", "*~", "~:",
				"*.jar", "*.node", "*.lock", "*.gz", "*.zip", "*.7z", "*.rar",
				"*.lzma", "*.bz2", "*.rlib", "*.rmeta", "*.DS_Store", "*.cur",
				"*.png", "*.jpeg", "*.jpg", "*.gif", "*.bmp", "*.avif", "*.heif",
				"*.jxl", "*.tif", "*.tiff", "*.ttf", "*.otf", "*.woff*", "*.sfd",
				"*.pcf", "*.svg", "*.ser", "*.wasm", "*.pack", "*.pyc", "*.apk",
				"*.bin", "*.dll", "*.pdb", "*.db", "*.so", "*.spl", "*.min.js",
				"*.min.gzip.js", "*.doc", "*.swp", "*.bak", "*.ctags", "*.ppt",
				"*.xls",
			},
		},
		undo = {},
	},
	defaults = {
		borderchars = { "─", "│", "─", "│", "┌", "┐", "┘", "└" },
		sorting_strategy = "ascending",
		layout_strategy = "vertical",
		layout_config = {
			horizontal = { prompt_position = "top", width = 0.90, height = 0.90, preview_width = 0.9 },
			vertical = { width = 0.95, height = 0.95, preview_width = 0.9 },
		},
		vimgrep_arguments = {
			"rg", "--color=never", "--no-heading", "--with-filename",
			"--line-number", "--column", "--smart-case",
			"--ignore-file", ".gitignore",
			"--ignore-file", ".git/",
			"--ignore-file", "swag/",
			"--ignore-file", "docs/",
		},
		mappings = {
			i = {
				["<esc>"] = actions.close,
				["<C-c>"] = false,
				["<C-h>"] = "which_key",
				["<A-j>"] = "move_selection_next",
				["<A-k>"] = "move_selection_previous",
				["<A-e>"] = "move_selection_previous",
				["<C-u>"] = false,
			},
		},
	},
})

telescope.load_extension("live_grep_args")
telescope.load_extension("ui-select")
telescope.load_extension("smart_open")
telescope.load_extension("undo")
telescope.load_extension("fzf")

-- Keybinds
vim.keymap.set("n", "gi", function()
	builtin.lsp_implementations()
end, { silent = true })

vim.keymap.set("n", "gr", function()
	builtin.lsp_references({ include_declaration = false })
end, { silent = true })

local function get_diffview_search_dirs()
	local ok, lib = pcall(require, "diffview.lib")
	if not ok then
		return nil
	end
	local view = lib.get_current_view()
	if not view or not view.files then
		return nil
	end

	local paths = {}
	local seen = {}
	for _, entry in view.files:iter() do
		local layout = entry.layout
		if not layout then
			goto continue
		end
		for _, win in ipairs({ layout.a, layout.b }) do
			if not (win and win.file and win.file.bufnr) then
				goto next_win
			end
			local bufnr = win.file.bufnr
			if not vim.api.nvim_buf_is_valid(bufnr) then
				goto next_win
			end
			local name = vim.api.nvim_buf_get_name(bufnr)
			if name == "" or seen[name] then
				goto next_win
			end
			seen[name] = true
			if vim.fn.filereadable(name) == 1 then
				paths[#paths + 1] = name
			else
				local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
				local tmpfile = vim.fn.tempname()
				vim.fn.writefile(lines, tmpfile)
				paths[#paths + 1] = tmpfile
			end
			::next_win::
		end
		::continue::
	end
	if #paths == 0 then
		return nil
	end
	return paths
end

vim.keymap.set("n", "<leader>fg", function()
	local dirs = get_diffview_search_dirs()
	telescope.extensions.live_grep_args.live_grep_args({ search_dirs = dirs })
end, { silent = true })

vim.keymap.set("n", "<leader>tc", function()
	builtin.resume({ cache_index = 1 })
end)

vim.keymap.set("v", "<leader>fg", function()
	local dirs = get_diffview_search_dirs()
	builtin.grep_string({ search_dirs = dirs })
end, { silent = true })

vim.keymap.set("n", "<leader>gh", function()
	builtin.highlights()
end, { silent = true })

vim.keymap.set("n", "<leader>gp", function()
	builtin.diagnostics({ show_all = true, severity = { "Error" } })
end, { silent = true })

vim.keymap.set("n", "<leader>gP", function()
	builtin.diagnostics({ show_all = true, severity = { "Error", "Warn" } })
end, { silent = true })

vim.keymap.set("n", "gt", function()
	builtin.lsp_type_definitions()
end, { silent = true })

vim.keymap.set({ "i", "n" }, "<A-f>", function()
	builtin.current_buffer_fuzzy_find()
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<A-e>", function()
	require("telescope").extensions.smart_open.smart_open({ cwd_only = true })
end, { silent = true, desc = "Smart open files" })

vim.keymap.set("n", "<leader>u", "<cmd>Telescope undo<cr>", { desc = "undo history" })
```

- [ ] **Step 2: Delete `plugins_old/telescope.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/telescope.lua`

- [ ] **Step 3: Uncomment `require("plugins.telescope")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify extensions loaded: `nvim --headless -c 'lua print(vim.inspect(vim.tbl_keys(require("telescope").extensions)))' -c 'qa!' 2>&1`
Expected: output includes `live_grep_args`, `ui-select`, `smart_open`, `undo`, `fzf`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/telescope.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/telescope.lua
git commit -m "feat(nvim): migrate telescope + extensions to vim.pack"
```

---

## Task 10: Migrate Git (diffview, gitsigns, neogit)

**Files:**
- Create: `nvim/lua/plugins/git.lua`
- Delete: `nvim/lua/plugins_old/git.lua`

- [ ] **Step 1: Create `nvim/lua/plugins/git.lua`**

```lua
vim.pack.add({
	"https://github.com/sindrets/diffview.nvim",
	"https://github.com/lewis6991/gitsigns.nvim",
	"https://github.com/NeogitOrg/neogit",
})

-- Diffview
local diff_actions = require("diffview.actions")
require("diffview").setup({
	keymaps = {
		view = {
			{
				"n",
				"gf",
				function()
					local tab_nmbr = vim.fn.tabpagenr()
					diff_actions.goto_file_edit()
					vim.cmd("tabclose " .. tab_nmbr)
				end,
				{ desc = "Open the file in the previous tabpage" },
			},
		},
	},
})

vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
	require("diffview").open({})
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>dm", function()
	local branch = "main"
	local result = vim.fn.system("git branch | grep master")
	if result ~= "" then
		branch = "master"
	end
	result = vim.fn.system("git branch | grep devel")
	if result ~= "" then
		branch = "devel"
	end
	require("diffview").open({ "origin/" .. branch .. "..." })
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>gf", function()
	vim.cmd("DiffviewFileHistory %")
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
	require("diffview").close()
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>bc", function()
	local line = vim.fn.line(".")
	local cmd = "git blame -L " .. line .. "," .. line .. " " .. vim.fn.expand("%")
	local output = vim.fn.system(cmd)
	local spaceIndex = string.find(output, " ")
	if spaceIndex == 0 then
		print("No commit hash found")
		return
	end
	local commitHash = string.sub(output, 0, spaceIndex - 1)
	require("diffview").open({ commitHash .. "~.." .. commitHash })
end, { silent = true })

-- Gitsigns
local gitsigns = require("gitsigns")
gitsigns.setup({
	preview_config = { border = "solid" },
	current_line_blame = true,
	current_line_blame_opts = {
		virt_text_pos = "eol",
		virt_text_priority = 0,
	},
})

vim.keymap.set({ "n" }, "]h", function()
	gitsigns.nav_hunk("next")
end, { silent = true })
vim.keymap.set({ "n" }, "[h", function()
	gitsigns.nav_hunk("prev")
end, { silent = true })
vim.keymap.set({ "n" }, "<leader>hh", function()
	gitsigns.preview_hunk_inline()
end, { silent = true })
vim.keymap.set({ "n" }, "<leader>hH", function()
	gitsigns.preview_hunk()
end, { silent = true })
vim.keymap.set({ "o", "x" }, "ih", gitsigns.select_hunk)
vim.keymap.set({ "n" }, "<leader>bl", function()
	gitsigns.blame_line({ full = true })
end)
vim.keymap.set({ "n" }, "<leader>hr", function()
	gitsigns.reset_hunk()
end)
vim.keymap.set({ "n" }, "<leader>gb", gitsigns.blame)

-- Neogit (no eager setup call — it's configured on-first-open via the keymap)
vim.keymap.set({ "n", "v" }, "<leader>gg", function()
	if Close_win_if_open("NeogitStatus") then
		return
	end
	Close_win_if_open("fugitiveblame")
	require("neogit").open({ kind = "vsplit" })
end, { silent = true })
```

- [ ] **Step 2: Delete `plugins_old/git.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/git.lua`

- [ ] **Step 3: Uncomment `require("plugins.git")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/git.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/git.lua
git commit -m "feat(nvim): migrate diffview/gitsigns/neogit to vim.pack"
```

---

## Task 11: Migrate file explorer (oil)

**Files:**
- Create: `nvim/lua/plugins/explorer.lua`
- Delete: `nvim/lua/plugins_old/oil.lua`

- [ ] **Step 1: Create `nvim/lua/plugins/explorer.lua`**

```lua
vim.pack.add({ "https://github.com/stevearc/oil.nvim" })

local oil = require("oil")
oil.setup({
	show_hidden = true,
	use_default_keymaps = false,
	delete_to_trash = true,
	skip_confirm_for_simple_edits = true,
	default_file_explorer = false,
	keymaps = {
		["g?"] = "actions.show_help",
		["I"] = "actions.toggle_hidden",
		["<CR>"] = "actions.select",
		["-"] = "actions.parent",
		["_"] = "actions.open_cwd",
		["R"] = "actions.refresh",
		["<LEADER>n"] = "actions.close",
		["S"] = function()
			require("oil.actions").select_split.callback()
			require("oil.actions").close.callback()
		end,
		["H"] = function()
			local Path = require("plenary.path")
			local entry = oil.get_cursor_entry()
			local filename = entry and entry.name
			local dir = oil.get_current_dir()
			local listItem = {
				context = { row = 1, col = 0 },
				value = Path:new(dir .. filename):make_relative(vim.fn.getcwd()),
			}
			require("harpoon"):list():add(listItem)
		end,
	},
})

vim.keymap.set("n", "<LEADER>n", "<Cmd>Oil<CR>", { noremap = true, silent = true, desc = "Open Oil" })
```

- [ ] **Step 2: Delete `plugins_old/oil.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/oil.lua`

- [ ] **Step 3: Uncomment `require("plugins.explorer")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/explorer.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/oil.lua
git commit -m "feat(nvim): migrate oil to vim.pack"
```

---

## Task 12: Migrate harpoon

**Files:**
- Create: `nvim/lua/plugins/harpoon.lua`
- Delete: `nvim/lua/plugins_old/harpoon.lua`

**Rationale:** Harpoon tracks the `harpoon2` branch (not default). The large BufEnter autocmd in `config/helpers.lua` that manipulates harpoon on every buffer enter is NOT moved — it is editor-level behavior layered on top of harpoon, not a harpoon config. Leave `config/helpers.lua` alone.

- [ ] **Step 1: Create `nvim/lua/plugins/harpoon.lua`**

```lua
local const = require("config/const")

vim.pack.add({ { src = "https://github.com/ThePrimeagen/harpoon", version = "harpoon2" } })

local harpoon = require("harpoon")
harpoon.setup()

vim.keymap.set("n", "<A-a>", function()
	if harpoon.ui.win_id ~= nil then
		vim.api.nvim_feedkeys("k", "n", false)
	end
end)

vim.keymap.set("n", "<A-d>", function()
	if harpoon.ui.win_id ~= nil then
		vim.api.nvim_feedkeys("j", "n", false)
		return
	end

	harpoon.ui:toggle_quick_menu(harpoon:list(), {
		border = const.BORDER_STYLE,
	})
	vim.api.nvim_feedkeys("j", "n", false)
	vim.o.cursorline = true
end)

vim.keymap.set("n", "<A-w>", function()
	local h_list = harpoon:list()
	h_list:select(h_list._index)
end)

vim.keymap.set({ "i", "n" }, "<A-s>", function()
	if harpoon.ui.win_id ~= nil then
		vim.api.nvim_feedkeys("\x0d", "m", false)
		return
	end

	if harpoon:list()._length > 1 then
		harpoon:list():select(2)
		return
	end

	local key = vim.api.nvim_replace_termcodes("<C-^>", true, false, true)
	vim.api.nvim_feedkeys(key, "n", false)
end)
```

- [ ] **Step 2: Delete `plugins_old/harpoon.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/harpoon.lua`

- [ ] **Step 3: Uncomment `require("plugins.harpoon")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/harpoon.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/harpoon.lua
git commit -m "feat(nvim): migrate harpoon to vim.pack"
```

---

## Task 13: Migrate statusline (lualine)

**Files:**
- Create: `nvim/lua/plugins/statusline.lua`
- Delete: `nvim/lua/plugins_old/statusline.lua`
- Modify: `nvim/lua/plugins_old/theme.lua` — remove only the duplicate `lualine.nvim` entry

**Rationale:** Old `theme.lua` has a second skeletal `{ "nvim-lualine/lualine.nvim", event = "VeryLazy", dependencies = { "nvim-tree/nvim-web-devicons" } }` spec. Delete that duplicate. The real lualine config lives in `plugins_old/statusline.lua` and that is what gets migrated.

- [ ] **Step 1: Create `nvim/lua/plugins/statusline.lua`**

```lua
vim.pack.add({ "https://github.com/nvim-lualine/lualine.nvim" })

local function fugitive_head()
	return " " .. vim.fn.FugitiveHead()
end

local get_location = function()
	if vim.v.hlsearch == 0 then
		local cursor = vim.api.nvim_win_get_cursor(0)
		return string.format("%d:%d", cursor[1], cursor[2])
	end

	local search = vim.fn.searchcount()
	return string.format("%d/%d", search.current, search.total)
end

local fugitive_blame = {
	sections = {
		lualine_c = { fugitive_head },
	},
	filetypes = { "fugitive", "fugitiveblame" },
}

local get_recording_macro = function()
	if vim.fn.reg_recording() ~= "" then
		return "%#StatusLineDiagnosticError#" .. "" .. vim.fn.reg_recording()
	end
	return ""
end

local function lint_progress()
	return ""
end

local colors = {
	white = Get_hl_hex("PreProc", "fg"),
	border = Get_hl_hex("Conceal", "fg"),
	background = Get_hl_hex("StatusLineNc", "bg"),
}

require("lualine").setup({
	inactive_sections = {
		lualine_a = {},
		lualine_b = {},
		lualine_c = {},
		lualine_x = {},
		lualine_y = {},
		lualine_z = {},
	},
	sections = {
		lualine_a = {
			{
				"filename",
				path = 1,
				symbols = {
					modified = " ",
					readonly = "",
					unnamed = "No name",
					newfile = "New file",
				},
			},
			{ "branch", icon = { "", align = "right" } },
		},
		lualine_b = {},
		lualine_c = {},
		lualine_x = {},
		lualine_y = {},
		lualine_z = {
			lint_progress,
			get_location,
			get_recording_macro,
			"diagnostics",
			"vim.bo.filetype",
			{ "diff", symbols = { added = "+", modified = "~", removed = "-" } },
		},
	},
	options = {
		icons_enabled = true,
		globalstatus = true,
		disabled_filetypes = { "alpha" },
		component_separators = " │ ",
		section_separators = "",
		theme = {
			normal = {
				a = { bg = colors.background, fg = colors.white },
				b = { bg = colors.background, fg = colors.white },
				c = { bg = colors.background, fg = colors.white },
			},
		},
	},
	extensions = {
		"nvim-tree",
		"neo-tree",
		"mason",
		"lazy",
		"fzf",
		"avante",
		fugitive_blame,
		"oil",
		"nvim-dap-ui",
		"quickfix",
		"fugitive",
	},
})
```

> Note: `Get_hl_hex` is a global defined in `config/highlight.lua`. That file is sourced before `plugins/init.lua` (per `config/init.lua`'s ordering after Task 2), so it is available here. If a runtime error reports it as nil, confirm the load order in `config/init.lua`: `require("config.highlight")` must come before `require("plugins")`.

- [ ] **Step 2: Delete `plugins_old/statusline.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/statusline.lua`

- [ ] **Step 3: Remove duplicate lualine entry from `plugins_old/theme.lua`**

Edit `nvim/lua/plugins_old/theme.lua`. Delete this block (currently lines 93–97):

```lua
	{
		"nvim-lualine/lualine.nvim",
		event = "VeryLazy",
		dependencies = { "nvim-tree/nvim-web-devicons" },
	},
```

- [ ] **Step 4: Uncomment `require("plugins.statusline")` in `plugins/init.lua`**

- [ ] **Step 5: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 6: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/statusline.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/theme.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/statusline.lua
git commit -m "feat(nvim): migrate lualine to vim.pack"
```

---

## Task 14: Migrate UI (noice, snacks, indent-blankline, nvim-highlight-colors, vim-illuminate)

**Files:**
- Create: `nvim/lua/plugins/ui.lua`
- Delete: `nvim/lua/plugins_old/snacks.lua`
- Delete: `nvim/lua/plugins_old/blankline.lua`
- Modify: `nvim/lua/plugins_old/theme.lua` — remove vim-illuminate and nvim-highlight-colors entries
- Delete: `nvim/lua/plugins_old/theme.lua` (should be empty after the removal above — delete if so)

**Rationale:** Consolidate all general UI-enhancement plugins into one file. After removing tokyonight, lualine, illuminate, and highlight-colors, `theme.lua` has no entries left and should be deleted entirely.

- [ ] **Step 1: Create `nvim/lua/plugins/ui.lua`**

```lua
local const = require("config/const")

vim.pack.add({
	"https://github.com/folke/noice.nvim",
	"https://github.com/folke/snacks.nvim",
	"https://github.com/lukas-reineke/indent-blankline.nvim",
	"https://github.com/brenoprata10/nvim-highlight-colors",
	"https://github.com/RRethy/vim-illuminate",
})

-- Snacks
require("snacks").setup({
	styles = {
		scratch = {
			width = 0.75,
			height = 0.85,
			border = const.BORDER_STYLE,
		},
	},
	input = { enabled = true },
	indent = {
		animate = { enabled = false },
		chunk = {
			enabled = true,
			hl = "SnacksIndentChunk",
		},
	},
})

vim.keymap.set("n", "<leader>.", function()
	Snacks.scratch()
end, { desc = "Toggle Scratch Buffer" })

vim.keymap.set("n", "<leader>s.", function()
	Snacks.scratch.select()
end, { desc = "Select Scratch Buffer" })

vim.keymap.set("n", "<leader>j.", function()
	Snacks.scratch({ ft = "json" })
end, { desc = "Open a json scratch buffer" })

vim.keymap.set("n", "<leader>sn", function()
	local scratchName = vim.fn.input("Enter scratch buffer name: ")
	if scratchName == "" then
		print("A name is required")
		return
	end
	local scratchFt = vim.fn.input("Enter scratch buffer filetype: ")
	local opts = { name = scratchName }
	if scratchFt ~= "" then
		opts.ft = scratchFt
	end
	Snacks.scratch(opts)
end, { desc = "Open a new named json scratch buffer" })

-- Noice
require("noice").setup({
	routes = {
		{
			filter = {
				event = "lsp",
				kind = "progress",
				cond = function(message)
					local client = vim.tbl_get(message.opts, "progress", "client")
					if client == "pyright" then
						return true
					end
					if client ~= "jdtls" then
						return false
					end
					local content = vim.tbl_get(message.opts, "progress", "message")
					if content == nil then
						return false
					end
					return string.find(content, "Validate") or string.find(content, "Publish")
				end,
			},
			opts = { skip = true },
		},
	},
	lsp = {
		override = {
			["vim.lsp.util.convert_input_to_markdown_lines"] = true,
			["vim.lsp.util.stylize_markdown"] = true,
		},
		signature = { enabled = false, throttle = 0 },
		hover = { silent = true },
	},
	cmdline = {
		enabled = true,
		view = "cmdline",
		format = { cmdline = { pattern = "^:", icon = ":", lang = "vim" } },
	},
	messages = {
		enabled = true,
		view = "notify",
		view_error = "notify",
		view_warn = "notify",
		view_history = "messages",
		view_search = false,
	},
	commands = {
		all = {
			view = "popup",
			opts = {
				border = { style = const.BORDER_STYLE },
				size = { width = 0.9, height = 0.9 },
			},
			filter = {},
			filter_opts = {},
		},
	},
	views = {
		virtualtext = false,
		hover = {
			relative = "cursor",
			anchor = "SW",
			position = { row = -1, col = 0 },
			border = { style = const.BORDER_STYLE },
			size = { max_width = 80 },
		},
		cmdline_popup = {
			anchor = "NW",
			position = { row = "35%", col = "50%" },
			border = { style = const.BORDER_STYLE },
			size = { width = 60, height = "auto" },
		},
		popup = {
			border = {
				style = const.BORDER_STYLE,
				padding = { 0, 1 },
				size = { max_width = 80, max_height = 60 },
			},
		},
		vsplit = { size = "50%" },
		cmdline_popupmenu = {
			anchor = "NW",
			position = { row = "55%", col = "50%" },
			size = { width = 60, height = 15, max_height = 15 },
			border = { style = const.BORDER_STYLE },
		},
	},
})

vim.keymap.set({ "v", "n" }, "<leader>sh", function()
	require("noice").cmd("all")
end, { silent = true })

-- Indent-blankline
do
	local highlight = {
		"RainbowRed", "RainbowYellow", "RainbowBlue", "RainbowOrange",
		"RainbowGreen", "RainbowViolet", "RainbowCyan",
	}
	local hooks = require("ibl.hooks")
	hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
		vim.api.nvim_set_hl(0, "RainbowRed", { fg = "#E06C75" })
		vim.api.nvim_set_hl(0, "RainbowYellow", { fg = "#E5C07B" })
		vim.api.nvim_set_hl(0, "RainbowBlue", { fg = "#61AFEF" })
		vim.api.nvim_set_hl(0, "RainbowOrange", { fg = "#D19A66" })
		vim.api.nvim_set_hl(0, "RainbowGreen", { fg = "#98C379" })
		vim.api.nvim_set_hl(0, "RainbowViolet", { fg = "#C678DD" })
		vim.api.nvim_set_hl(0, "RainbowCyan", { fg = "#56B6C2" })
	end)
	require("ibl").setup({ indent = { highlight = highlight }, scope = { enabled = false } })
end

-- Highlight colors (renders hex/tailwind color swatches in buffers)
require("nvim-highlight-colors").setup({
	render = "virtual",
	enable_named_colors = true,
	enable_tailwind = true,
	enable_hex = true,
	disable = { "NvimTree" },
})

-- Illuminate (highlight other occurrences of word under cursor)
require("illuminate").configure({
	delay = 0,
	should_enable = function(bufnr)
		local mode = vim.api.nvim_get_mode().mode
		return mode == "n" or mode == "i"
	end,
	min_count_to_highlight = 2,
	filetypes_denylist = { "NvimTree", "harpoon" },
})
```

- [ ] **Step 2: Delete `plugins_old/snacks.lua`, `plugins_old/blankline.lua`, and `plugins_old/theme.lua`**

```bash
rm /Users/erousseau/shelly/nvim/lua/plugins_old/snacks.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/blankline.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/theme.lua
```

- [ ] **Step 3: Uncomment `require("plugins.ui")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/ui.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/snacks.lua nvim/lua/plugins_old/blankline.lua nvim/lua/plugins_old/theme.lua
git commit -m "feat(nvim): migrate noice/snacks/ibl/highlight-colors/illuminate to vim.pack"
```

---

## Task 15: Migrate mini.nvim modules

**Files:**
- Create: `nvim/lua/plugins/mini.lua`
- Delete: `nvim/lua/plugins_old/mini.lua`

**Rationale:** All `echasnovski/mini.*` modules live here. `leap.nvim` (previously bundled in old `mini.lua`) is migrated separately into `movement.lua` in Task 16.

- [ ] **Step 1: Create `nvim/lua/plugins/mini.lua`**

```lua
vim.pack.add({
	"https://github.com/echasnovski/mini.ai",
	"https://github.com/echasnovski/mini.splitjoin",
	"https://github.com/echasnovski/mini.bracketed",
	"https://github.com/echasnovski/mini.notify",
	"https://github.com/echasnovski/mini.comment",
	"https://github.com/echasnovski/mini.move",
	"https://github.com/echasnovski/mini.surround",
	"https://github.com/echasnovski/mini.misc",
})

-- Better a/i movements
require("mini.ai").setup()

-- Switch between single-line and multiline statements
local splitjoin = require("mini.splitjoin")
splitjoin.setup()
vim.keymap.set("n", "<leader>ts", function()
	splitjoin.toggle()
end, { silent = true, desc = "Toggle between single-line and multiline statements" })

-- Bracketed movement
require("mini.bracketed").setup()

-- Notifications (override vim.notify)
local notify = require("mini.notify")
notify.setup({
	lsp_progress = { enable = false },
	window = { config = { border = "solid" } },
})
vim.notify = notify.make_notify({
	ERROR = { duration = 5000 },
	WARN = { duration = 4000 },
	INFO = { duration = 2000 },
})

-- Comment (with treesitter-aware commentstring)
require("mini.comment").setup({
	options = {
		custom_commentstring = function()
			local ok, cs = pcall(require("ts_context_commentstring.internal").calculate_commentstring)
			return ok and cs or vim.bo.commentstring
		end,
	},
})

-- Move lines
require("mini.move").setup({
	mappings = {
		left = "H",
		right = "L",
		down = "J",
		up = "K",
		line_left = "",
		line_right = "",
		line_down = "J",
		line_up = "K",
	},
})

-- Surround
require("mini.surround").setup({ n_lines = 50 })

-- Misc (zoom window)
require("mini.misc").setup({})
vim.keymap.set("n", "<leader>wz", function()
	require("mini.misc").zoom()
end, { silent = true })
```

- [ ] **Step 2: Delete `plugins_old/mini.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/mini.lua`

- [ ] **Step 3: Uncomment `require("plugins.mini")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/mini.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/mini.lua
git commit -m "feat(nvim): migrate mini.* modules to vim.pack"
```

---

## Task 16: Migrate editing plugins (autopairs, Comment, vim-abolish, autotag, alternate-toggler, todo-comments, vim-repeat)

**Files:**
- Create: `nvim/lua/plugins/editing.lua`
- Delete: `nvim/lua/plugins_old/autotag.lua`
- Delete: `nvim/lua/plugins_old/comment.lua`
- Modify: `nvim/lua/plugins_old/init.lua` — remove vim-abolish, todo-comments, nvim-autopairs entries
- Delete: `nvim/lua/plugins_old/init.lua` if empty after the removal (it still has vim-tmux-navigator which gets removed in Task 17; keep for now)

**Rationale:** Collects lightweight editing enhancements in one file. `vim-repeat` was only a dependency of leap in the old config — it also happens to be useful for general `.`-repeating of mapped commands, so it lives with the other editing plugins.

- [ ] **Step 1: Create `nvim/lua/plugins/editing.lua`**

```lua
vim.pack.add({
	"https://github.com/windwp/nvim-autopairs",
	"https://github.com/numToStr/Comment.nvim",
	"https://github.com/tpope/vim-abolish",
	"https://github.com/windwp/nvim-ts-autotag",
	"https://github.com/rmagatti/alternate-toggler",
	"https://github.com/folke/todo-comments.nvim",
	"https://github.com/tpope/vim-repeat",
})

-- Autopairs
require("nvim-autopairs").setup({
	map_cr = true,
	enable_check_bracket_line = true,
})

-- Comment.nvim (the classic tpope-style commenter; mini.comment handles commenting
-- via keybinds, but this plugin's operator-pending mappings are still wired in by
-- default when loaded — kept for parity with the previous config).
require("Comment").setup()

-- Alternate-toggler
require("alternate-toggler").setup({
	alternates = { ["=="] = "!=" },
})

-- Todo-comments
require("todo-comments").setup()

-- Treesitter auto-close/rename HTML tags
require("nvim-ts-autotag").setup({
	opts = { enable_close_on_slash = true },
})

-- vim-abolish has no setup(); it registers :Subvert and friends via plugin/*.vim
-- which nvim sources automatically at end of init.

-- vim-repeat similarly self-registers.
```

- [ ] **Step 2: Delete `plugins_old/autotag.lua` and `plugins_old/comment.lua`**

```bash
rm /Users/erousseau/shelly/nvim/lua/plugins_old/autotag.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/comment.lua
```

- [ ] **Step 3: Remove migrated entries from `plugins_old/init.lua`**

Edit `nvim/lua/plugins_old/init.lua`. Delete:
- The `"tpope/vim-abolish"` block (with its `event = "BufEnter"`)
- The `"folke/todo-comments.nvim"` block
- The `"windwp/nvim-autopairs"` block

Only `"farmergreg/vim-lastplace"` and `"christoomey/vim-tmux-navigator"` should remain in the file (those get migrated in Task 17).

- [ ] **Step 4: Uncomment `require("plugins.editing")` in `plugins/init.lua`**

- [ ] **Step 5: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify :Abolish command is registered (vim-abolish plugin/*.vim sourced): `nvim --headless -c 'lua print(vim.fn.exists(":Abolish"))' -c 'qa!' 2>&1`
Expected: `2`.

- [ ] **Step 6: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/editing.lua nvim/lua/plugins/init.lua nvim/lua/plugins_old/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/autotag.lua nvim/lua/plugins_old/comment.lua
git commit -m "feat(nvim): migrate editing plugins to vim.pack"
```

---

## Task 17: Migrate movement (leap, nvim-jump, vim-tmux-navigator, vim-lastplace)

**Files:**
- Modify: `nvim/lua/plugins/movement.lua` (currently contains only nvim-jump — extend it)
- Delete: `nvim/lua/plugins_old/init.lua` (should be empty after removing tmux-navigator and vim-lastplace)

**Rationale:** `plugins/movement.lua` already exists from the pre-migration experiment with nvim-jump. Extend it to the full set. `leap.nvim` lives at codeberg.org, not github — note the different URL. `vim-tmux-navigator` and `vim-lastplace` are plain vim plugins that register themselves via `plugin/*.vim`.

- [ ] **Step 1: Rewrite `nvim/lua/plugins/movement.lua`**

Replace the current 3-line content with:

```lua
vim.pack.add({
	{ src = "https://codeberg.org/andyg/leap.nvim" },
	"https://github.com/tpope/vim-repeat", -- leap dep; also listed in editing.lua, vim.pack dedupes
	"git@github.com:yorickpeterse/nvim-jump.git",
	"https://github.com/christoomey/vim-tmux-navigator",
	"https://github.com/farmergreg/vim-lastplace",
})

-- Leap
local leap = require("leap")
leap.opts.equivalence_classes = { " \t\r\n", "([{", ")]}", "'\"`" }
vim.keymap.set({ "n", "x", "o" }, "f", "<Plug>(leap-forward)")
vim.keymap.set({ "n", "x", "o" }, "F", "<Plug>(leap-backward)")

-- nvim-jump
vim.keymap.set({ "n", "x", "o" }, "s", require("jump").start, { desc = "Jump to a word" })

-- vim-tmux-navigator: self-registers <C-h/j/k/l> window-nav mappings via plugin/*.vim
-- vim-lastplace: self-registers BufRead autocmds via plugin/*.vim
```

Note: `vim-repeat` is listed in both `editing.lua` and `movement.lua`. vim.pack deduplicates by plugin name, so the second `add` is a no-op. Including it here makes movement.lua self-documenting about leap's dependency.

- [ ] **Step 2: Delete `plugins_old/init.lua`**

After Task 16 it only contains plenary (deleted in Task 3), popup (deleted in Task 3), vim-tmux-navigator, vim-lastplace. Now that the last two are migrated:

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/init.lua`

- [ ] **Step 3: Uncomment `require("plugins.movement")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify leap-forward key: `nvim --headless -c 'lua print(vim.fn.maparg("f", "n"))' -c 'qa!' 2>&1`
Expected: output containing `leap-forward`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/movement.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/init.lua
git commit -m "feat(nvim): migrate movement plugins (leap, nvim-jump, tmux-nav, lastplace) to vim.pack"
```

---

## Task 18: Migrate DAP suite (nvim-dap + ui + python + go + virtual-text + neotest)

**Files:**
- Create: `nvim/lua/plugins/dap.lua`
- Delete: `nvim/lua/plugins_old/dap.lua`
- Delete: `nvim/lua/plugins_old/dap-go.lua` (duplicate of dap-go config already in dap.lua)

- [ ] **Step 1: Create `nvim/lua/plugins/dap.lua`**

```lua
vim.pack.add({
	"https://github.com/mfussenegger/nvim-dap",
	"https://github.com/mfussenegger/nvim-dap-python",
	"https://github.com/leoluz/nvim-dap-go",
	"https://github.com/rcarriga/nvim-dap-ui",
	"https://github.com/theHamsta/nvim-dap-virtual-text",
	"https://github.com/nvim-neotest/nvim-nio",
	"https://github.com/antoinemadec/FixCursorHold.nvim",
	"https://github.com/nvim-neotest/neotest",
	"https://github.com/nvim-neotest/neotest-python",
	"https://github.com/nvim-neotest/neotest-go",
})

-- DAP core
local dap = require("dap")
dap.set_log_level("TRACE")

require("dap-python").setup("uv")
require("dap-go").setup({
	dap_configurations = {
		{
			type = "go",
			name = "Debug (Build Flags)",
			request = "launch",
			program = "...",
			buildFlags = require("dap-go").get_build_flags,
		},
	},
})

vim.api.nvim_set_hl(0, "DapBreakpointColor", { fg = "#ffffff", bg = "NONE" })
vim.api.nvim_set_hl(0, "DapBreakpointStoppedColor", { fg = "#FF0000", bg = "NONE" })
vim.fn.sign_define("DapBreakpoint", { text = "B", texthl = "DapBreakpointColor", linehl = "", numhl = "" })
vim.fn.sign_define("DapStopped", { text = "→", texthl = "DapBreakpointStoppedColor", linehl = "", numhl = "" })

dap.configurations.python = {
	{
		type = "python",
		request = "launch",
		name = "Launch file",
		program = function()
			return "${file}"
		end,
		console = "integratedTerminal",
		pythonPath = function()
			return vim.fn.getcwd() .. "/.venv/bin/python3"
		end,
		justMyCode = false,
		args = function()
			local args_string = vim.fn.input("Arguments: ")
			if args_string and args_string ~= "" then
				local args = vim.split(args_string, " +")
				args = vim.tbl_filter(function(arg)
					return arg ~= ""
				end, args)
				return args
			end
			return {}
		end,
	},
	{
		type = "python",
		request = "launch",
		name = "Pytest: Current File",
		module = "pytest",
		console = "integratedTerminal",
		pythonPath = function()
			return vim.fn.getcwd() .. "/.venv/bin/python3"
		end,
		justMyCode = false,
		args = { "${file}" },
	},
}

table.insert(dap.configurations.go, {
	type = "delve",
	name = "Debug weblens",
	request = "launch",
	mode = "exec",
	console = "integratedTerminal",
	program = "${workspaceFolder}/_build/bin/weblens_debug",
})

local last_config = nil

---@param session dap.Session
dap.listeners.after.event_initialized["store_config"] = function(session)
	last_config = session.config
end

-- DAP UI
local dapui = require("dapui")
dapui.setup({
	controls = { enabled = false },
	layouts = {
		{
			elements = {
				{ id = "scopes", size = 0.25 },
				{ id = "breakpoints", size = 0.25 },
				{ id = "stacks", size = 0.25 },
				{ id = "watches", size = 0.25 },
			},
			position = "left",
			size = 0.4,
		},
		{
			elements = { { id = "console", size = 1 } },
			position = "bottom",
			size = 0.3,
		},
	},
})

dap.listeners.before.attach.dapui_config = function()
	dapui.open()
end
dap.listeners.before.launch.dapui_config = function()
	dapui.open()
end

-- DAP virtual text
require("nvim-dap-virtual-text").setup({
	virt_text_win_col = 80,
	highlight_changed_variables = true,
	clear_on_continue = true,
	all_references = true,
	virt_text_pos = "inline",
})

-- DAP keymaps
vim.keymap.set("n", "<leader>db", function()
	dap.toggle_breakpoint()
end, { silent = true })

vim.keymap.set("n", "<leader>dB", function()
	dap.toggle_breakpoint(vim.fn.input("Breakpoint condition: "))
end, { silent = true })

vim.keymap.set("n", "<leader>dc", function()
	dap.continue()
end, { silent = true })
vim.keymap.set("n", "<A-S-c>", function()
	dap.run_to_cursor()
end, { silent = true })

vim.keymap.set("n", "<leader>dr", function()
	if last_config then
		dap.run(last_config)
	else
		dap.run_last()
	end
end, { silent = true })

vim.keymap.set("n", "<A-n>", function()
	dap.step_over()
end, { silent = true })
vim.keymap.set("n", "<A-o>", function()
	dap.up()
end, { silent = true })
vim.keymap.set("n", "<A-O>", function()
	dap.step_out()
end, { silent = true })
vim.keymap.set("n", "<A-i>", function()
	dap.down()
end, { silent = true })
vim.keymap.set("n", "<A-I>", function()
	dap.step_into()
end, { silent = true })

vim.keymap.set("n", "<leader>du", function()
	dapui.toggle({ reset = true, layout = 1 })
end, { noremap = true, silent = true })

vim.keymap.set("n", "dh", function()
	dapui.eval()
end, { noremap = true, silent = true })

vim.keymap.set("n", "<leader>dU", function()
	dapui.toggle({ reset = true, layout = 2 })
end, { noremap = true, silent = true })

-- Neotest
require("neotest").setup({
	adapters = {
		require("neotest-python")({ dap = { justMyCode = false } }),
		require("neotest-go")({}),
	},
})

vim.keymap.set("n", "<leader>tt", function()
	require("neotest").run.run({ strategy = "dap" })
end, { silent = true })

vim.keymap.set("n", "<leader>tf", function()
	require("neotest").run.run({ vim.fn.expand("%"), strategy = "dap" })
end, { silent = true })

vim.keymap.set("n", "<leader>tp", function()
	require("neotest").output_panel.toggle()
end, { silent = true })

vim.keymap.set("n", "<leader>tr", function()
	require("neotest").summary.toggle()
end, { silent = true })
```

- [ ] **Step 2: Delete `plugins_old/dap.lua` and `plugins_old/dap-go.lua`**

```bash
rm /Users/erousseau/shelly/nvim/lua/plugins_old/dap.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/dap-go.lua
```

- [ ] **Step 3: Uncomment `require("plugins.dap")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/dap.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/dap.lua nvim/lua/plugins_old/dap-go.lua
git commit -m "feat(nvim): migrate DAP + neotest suite to vim.pack"
```

---

## Task 19: Migrate formatter (conform)

**Files:**
- Create: `nvim/lua/plugins/formatter.lua`
- Delete: `nvim/lua/plugins_old/formatter.lua`

- [ ] **Step 1: Create `nvim/lua/plugins/formatter.lua`**

```lua
vim.pack.add({ "https://github.com/stevearc/conform.nvim" })

local conform = require("conform")

conform.setup({
	log_level = vim.log.levels.DEBUG,
	formatters = {
		xml = { command = "prettier", args = { "--plugin=@prettier/plugin-xml", "$FILENAME" } },
		templ = { command = "templ fmt" },
		ruff = { command = "ruff", args = { "format" } },
	},
	formatters_by_ft = {
		javascript = { "prettier" },
		typescript = { "prettier" },
		javascriptreact = { "prettier" },
		typescriptreact = { "prettier" },
		vue = { "prettier" },
		svelte = { "prettier" },
		css = { "prettier" },
		xml = { "xml" },
		html = { "prettier" },
		tmpl = { "templ" },
		htmlangular = { "prettier" },
		json = { "prettier" },
		yaml = { "prettier" },
		markdown = { "prettier" },
		graphql = { "prettier" },
		sh = { "shfmt" },
		bash = { "shfmt" },
		zsh = { "shfmt" },
		lua = { "stylua" },
		python = { "ruff_fix", "ruff_format" },
		go = { "gofmt", "goimports" },
		java = {},
	},
	format_after_save = {
		timeout_ms = 5000,
		lsp_format = "fallback",
		async = true,
	},
})

conform.formatters.shfmt = {
	prepend_args = { "-i", "4" },
}
```

- [ ] **Step 2: Delete `plugins_old/formatter.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/formatter.lua`

- [ ] **Step 3: Uncomment `require("plugins.formatter")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/formatter.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/formatter.lua
git commit -m "feat(nvim): migrate conform to vim.pack"
```

---

## Task 20: Migrate quickfix (quicker, nvim-bqf)

**Files:**
- Create: `nvim/lua/plugins/quickfix.lua`
- Delete: `nvim/lua/plugins_old/quicker.lua`

- [ ] **Step 1: Create `nvim/lua/plugins/quickfix.lua`**

```lua
vim.pack.add({
	"https://github.com/stevearc/quicker.nvim",
	"https://github.com/kevinhwang91/nvim-bqf",
})

require("quicker").setup({
	borders = {
		vert = " ╎ ",
		strong_header = "━",
		strong_cross = "╋",
		strong_end = "┫",
		soft_header = "╌",
		soft_cross = "╂",
		soft_end = "┨",
	},
})

vim.api.nvim_set_hl(0, "QuickFixHeaderHard", { link = "Conceal" })
vim.api.nvim_set_hl(0, "QuickFixLineNr", { link = "@variable" })

-- nvim-bqf self-registers via plugin/*.lua at end of init.
```

- [ ] **Step 2: Delete `plugins_old/quicker.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/quicker.lua`

- [ ] **Step 3: Uncomment `require("plugins.quickfix")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/quickfix.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/quicker.lua
git commit -m "feat(nvim): migrate quicker + nvim-bqf to vim.pack"
```

---

## Task 21: Migrate AI (codecompanion, markview)

**Files:**
- Create: `nvim/lua/plugins/ai.lua`
- Delete: `nvim/lua/plugins_old/llm.lua`
- Modify: `nvim/lua/config/keyboard.lua` — remove the CodeCompanion keymaps (they move into `ai.lua`)

**Rationale:** Completes the migration of `llm.lua` (copilot was already extracted in Task 8). CodeCompanion's three keymaps currently live in `config/keyboard.lua` lines 141-143 and must move here to satisfy the "keybinds live with their plugin" constraint.

- [ ] **Step 1: Create `nvim/lua/plugins/ai.lua`**

```lua
vim.pack.add({
	"https://github.com/olimorris/codecompanion.nvim",
	"https://github.com/OXY2DEV/markview.nvim",
})

-- CodeCompanion
require("codecompanion").setup({
	-- NOTE: The log_level is in `opts.opts`
	opts = { log_level = "DEBUG" },
})

vim.keymap.set(
	{ "n", "v" },
	"<LocalLeader>a",
	"<cmd>CodeCompanionChat Toggle<cr>",
	{ noremap = true, silent = true }
)
vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

-- Markview
require("markview").setup({
	preview = {
		filetypes = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
	},
	max_length = 99999,
})
```

- [ ] **Step 2: Delete `plugins_old/llm.lua`**

Run: `rm /Users/erousseau/shelly/nvim/lua/plugins_old/llm.lua`

- [ ] **Step 3: Remove CodeCompanion keymaps from `config/keyboard.lua`**

Edit `nvim/lua/config/keyboard.lua`. Delete these three lines (currently 140–143):

```lua
-- Code Companion --
-- vim.keymap.set({ "n", "v" }, "<C-a>", "<cmd>CodeCompanionActions<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "<LocalLeader>a", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })
```

- [ ] **Step 4: Uncomment `require("plugins.ai")` in `plugins/init.lua`**

- [ ] **Step 5: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify the keymap moved correctly:
Run: `nvim --headless -c 'lua print(vim.fn.maparg("ga", "v"))' -c 'qa!' 2>&1`
Expected: output mentioning `CodeCompanionChat Add`.

- [ ] **Step 6: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/ai.lua nvim/lua/plugins/init.lua nvim/lua/config/keyboard.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/llm.lua
git commit -m "feat(nvim): migrate codecompanion + markview to vim.pack"
```

---

## Task 22: Migrate misc (presence, codesnap, remote-nvim, profile) and delete disabled plugins

**Files:**
- Create: `nvim/lua/plugins/misc.lua`
- Delete: `nvim/lua/plugins_old/discord.lua`
- Delete: `nvim/lua/plugins_old/codesnap.lua`
- Delete: `nvim/lua/plugins_old/distant.lua`
- Delete: `nvim/lua/plugins_old/profile.lua`
- Delete: `nvim/lua/plugins_old/faster.lua`

**Rationale:** Final plugin file. Drops `faster.nvim` (was `enabled = false`) and the commented-out `distant.nvim` chunk. `remote-nvim.nvim` is what actually lives inside the old `distant.lua`. `codesnap`'s `build = "make"` is handled by the hook registered in Task 2.

- [ ] **Step 1: Create `nvim/lua/plugins/misc.lua`**

```lua
vim.pack.add({
	"https://github.com/andweeb/presence.nvim",
	"https://github.com/mistricky/codesnap.nvim",
	"https://github.com/amitds1997/remote-nvim.nvim",
	"https://github.com/stevearc/profile.nvim",
})

-- Discord rich presence
require("presence").setup({ auto_update = true })

-- Codesnap (screenshot code blocks)
require("codesnap").setup({
	has_line_number = true,
	watermark = "",
	bg_padding = 0,
	has_breadcrumbs = true,
	show_workspace = true,
	code_font_family = "JetBrainsMono Nerd Font",
	mac_window_bar = false,
})

vim.keymap.set("v", "<Leader>s", "<Cmd>CodeSnap<CR>", { desc = "Screenshot code snippet" })

-- Remote-nvim
require("remote-nvim").setup()

-- Profile.nvim
local profile = require("profile")
profile.instrument_autocmds()

vim.keymap.set("n", "<f4>", function()
	if profile.is_recording() then
		profile.stop()
		vim.ui.input(
			{ prompt = "Save profile to:", completion = "file", default = "profile.json" },
			function(filename)
				if filename then
					profile.export(filename)
					vim.notify(("Wrote %s"):format(filename))
				end
			end
		)
	else
		local profileName = vim.fn.input("Enter profile name (or leave empty for full): ")
		vim.notify("Starting recording")
		profile.start(profileName .. "*")
	end
end)
```

- [ ] **Step 2: Delete the five old files**

```bash
rm /Users/erousseau/shelly/nvim/lua/plugins_old/discord.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/codesnap.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/distant.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/profile.lua
rm /Users/erousseau/shelly/nvim/lua/plugins_old/faster.lua
```

- [ ] **Step 3: Uncomment `require("plugins.misc")` in `plugins/init.lua`**

- [ ] **Step 4: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify everything migrated — `plugins_old/` should now only contain `ftplugin/java.lua`:
Run: `find /Users/erousseau/shelly/nvim/lua/plugins_old -type f`
Expected: one line, `plugins_old/ftplugin/java.lua`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/plugins/misc.lua nvim/lua/plugins/init.lua nvim/nvim-pack-lock.json
git rm nvim/lua/plugins_old/discord.lua nvim/lua/plugins_old/codesnap.lua nvim/lua/plugins_old/distant.lua nvim/lua/plugins_old/profile.lua nvim/lua/plugins_old/faster.lua
git commit -m "feat(nvim): migrate misc plugins (presence, codesnap, remote-nvim, profile) to vim.pack"
```

---

## Task 23: Remove lazy.nvim and dead `plugins_old/`

**Files:**
- Delete: `nvim/lua/config/lazy.lua`
- Delete: `nvim/lua/plugins_old/` (entire directory including orphan `ftplugin/java.lua`)
- Delete: `nvim/lazy-lock.json`
- Modify: `nvim/lua/config/init.lua` — remove `require("config.lazy")`
- Delete (on disk, not git): `~/.local/share/nvim/lazy/`

**Rationale:** All plugins are migrated. Lazy is unused. The orphan `plugins_old/ftplugin/java.lua` sits under `lua/` which is NOT nvim's ftplugin path, so it is dead code — delete. The plugin directories lazy created in `~/.local/share/nvim/lazy/` remain on disk and should be cleaned up.

- [ ] **Step 1: Remove lazy wiring from `config/init.lua`**

Edit `nvim/lua/config/init.lua`. Delete the `require("config.lazy")` line. Final content:

```lua
require("config.settings")
require("config.keyboard")
require("config.highlight")
require("plugins")
require("config.helpers")
require("config.snippets")
require("config.lsp")
```

- [ ] **Step 2: Delete `config/lazy.lua`, `plugins_old/`, and `lazy-lock.json`**

```bash
rm /Users/erousseau/shelly/nvim/lua/config/lazy.lua
rm -r /Users/erousseau/shelly/nvim/lua/plugins_old
rm /Users/erousseau/shelly/nvim/lazy-lock.json
```

- [ ] **Step 3: Smoke-test**

Run: `nvim --headless -c 'qa' 2>&1`
Expected: empty output.

Verify lazy is truly gone: `nvim --headless -c 'lua print(package.loaded["lazy"])' -c 'qa!' 2>&1`
Expected: `nil`.

- [ ] **Step 4: Clean up lazy's install directory on disk**

```bash
rm -rf ~/.local/share/nvim/lazy
```

This directory is not tracked by git; it is lazy.nvim's plugin install location. After deleting, nvim will not attempt to recreate it because `config/lazy.lua` is gone.

- [ ] **Step 5: Commit**

```bash
cd /Users/erousseau/shelly
git add nvim/lua/config/init.lua
git rm nvim/lua/config/lazy.lua nvim/lazy-lock.json
git rm -r nvim/lua/plugins_old
git commit -m "chore(nvim): remove lazy.nvim after vim.pack migration"
```

---

## Task 24: Final full-surface verification

**Files:** none (verification only)

**Rationale:** With all code changes committed, walk through a checklist of plugin functionality that a headless `:qa` cannot exercise.

- [ ] **Step 1: Launch nvim interactively and confirm it starts without error**

Run: `nvim`

In the status area, you should see no error banners. Run `:messages` — expect no `E...` errors.

- [ ] **Step 2: Verify plugin count matches expectation**

Run inside nvim: `:lua print(#vim.pack.get())`
Expected: approximately 70 (one entry per `vim.pack.add` spec, deduped).

- [ ] **Step 3: Exercise each critical plugin via its keymap or command**

Walk the checklist. For each item, perform the action and confirm it does the expected thing. If any fails, stop and debug before completing the task.

- Colorscheme: `:colorscheme` prints `tokyonight-moon`.
- Telescope: `<leader>fg` opens live grep.
- Oil: `<leader>n` opens oil buffer.
- Harpoon: `<A-d>` opens the harpoon menu.
- Gitsigns: open a file in a git repo; `]h` jumps to next hunk.
- Diffview: `<leader>gd` opens diffview.
- Neogit: `<leader>gg` opens neogit.
- Treesitter: `:Inspect` on a code file shows treesitter highlight groups.
- blink.cmp: In insert mode in a lua file, start typing `vim.`; completion menu appears.
- Copilot: `:Copilot status` reports enabled (auth may be required).
- DAP: `<leader>db` toggles breakpoint sign.
- Conform: `<leader>FF` formats a buffer.
- Noice: `:Noice` opens message history.
- Snacks scratch: `<leader>.` opens scratch buffer.
- Leap: `f` in normal mode triggers leap-forward.
- nvim-jump: `s` in normal mode triggers jump.
- Neotest: `<leader>tr` toggles summary.
- Quicker: populate quickfix (e.g. `:vimgrep /foo/ **/*`); `:copen` shows quicker-styled list.
- Mini.surround: `ysiw"` surrounds a word with quotes.
- Mini.move: visual-line `J` moves lines down.
- CodeCompanion: `<LocalLeader>a` toggles the chat.
- Codesnap: visually select code; `<leader>s` attempts to snap.

- [ ] **Step 4: Verify lockfile is tracked**

Run: `git status nvim/nvim-pack-lock.json`
Expected: clean (lockfile is committed).

Run: `git log --oneline nvim/nvim-pack-lock.json | head -5`
Expected: one or more commits showing lockfile updates during migration.

- [ ] **Step 5: Final commit if any cleanup was needed during verification**

If Step 3 revealed a bug, fix it, then commit. Otherwise this task produces no new commits.

---

## Notes for the engineer

- **Install prompts on first run.** vim.pack shows an interactive confirmation buffer when installing new plugins on a fresh machine. Headless smoke tests pass `confirm = false` implicitly for background runs, but an interactive first launch after each task may show "Install N plugins? (y/n)". Answer yes. On CI/automation, prefer `vim.pack.add({...}, { confirm = false })` — but do NOT bake `confirm = false` into the production config, since the current plan assumes interactive first-time installs on dev machines.

- **If a plugin fails to install** (network, auth, deleted repo), vim.pack logs to `~/.local/state/nvim/log/nvim-pack.log`. Check it before retrying.

- **The `Get_hl_hex` global** in `plugins/statusline.lua` is defined by `config/highlight.lua`. That file must be required BEFORE `plugins/` in `config/init.lua`. Task 2 Step 3 already orders it correctly — do not reorder.

- **Editor-behavior autocmds in `config/helpers.lua`** (the harpoon BufEnter handler, the conform format-on-save BufLeave handler) reference plugins but are NOT plugin config — they are user-level editor behavior. They stay in `config/helpers.lua` and do not move.

- **`plugins/ftplugin/java.lua`** is orphan dead code. It lives under `lua/plugins/` where neither lazy nor nvim-ftplugin would auto-source it. Task 23 deletes it as part of the `plugins_old/` cleanup.

- **Do not hand-edit `nvim-pack-lock.json`.** It is managed by vim.pack.

- **If you need to freeze a plugin at a specific revision**, set its `version` field to the commit hash in the appropriate plugin file.

- **Per vim.pack docs**, `vim.pack.update()` is the interactive update flow. It is not part of the migration but will be the user's day-to-day update command going forward (replacing `:Lazy update`).
