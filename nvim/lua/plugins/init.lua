-- Entry point for vim.pack-managed plugins.
-- Registers build hooks, then requires every plugin module in dependency order.

-- vim.pack.add defaults `load = false` during init.lua sourcing, which works
-- like `:packadd!` — adds the plugin to runtimepath but does NOT source its
-- plugin/* or ftdetect/* files. That breaks any plugin whose behavior depends
-- on plugin/* scripts running, including:
--   - nvim-treesitter (filetype-to-parser mapping in plugin/filetypes.lua,
--     query predicates in plugin/query_predicates.lua — without these,
--     syntax highlighting silently fails for non-trivial filetypes)
--   - pure-vimscript plugins (vim-abolish, vim-tmux-navigator, vim-lastplace,
--     vim-repeat, leap.nvim, nvim-bqf)
--   - many lua plugins that register commands/autocmds via plugin/*.lua
-- Wrap vim.pack.add to default load = true so all our plugin files get the
-- sane behavior without sprinkling explicit packadd calls everywhere.
do
	local original_add = vim.pack.add
	vim.pack.add = function(specs, opts)
		opts = opts or {}
		if opts.load == nil then
			opts.load = true
		end
		return original_add(specs, opts)
	end
end

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
require("plugins.core")
require("plugins.colorscheme")
require("plugins.treesitter")
require("plugins.lsp")
require("plugins.completion")
require("plugins.copilot")
require("plugins.telescope")
require("plugins.git")
require("plugins.explorer")
require("plugins.harpoon")
require("plugins.statusline")
require("plugins.ui")
require("plugins.mini")
require("plugins.editing")
require("plugins.movement")
require("plugins.dap")
require("plugins.formatter")
require("plugins.quickfix")
require("plugins.ai")
require("plugins.misc")
