vim.pack.add({
	"https://github.com/andweeb/presence.nvim",
	"https://github.com/amitds1997/remote-nvim.nvim",
	"https://github.com/stevearc/profile.nvim",
})

-- Discord rich presence
require("presence").setup({ auto_update = true })

-- Codesnap (screenshot code blocks).
-- Fully deferred to first <Leader>s keypress: codesnap.nvim's plugin/codesnap.lua
-- (auto-sourced when vim.pack adds the plugin) calls require("codesnap"), which
-- transitively loads codesnap/module.lua. That module appends a literal .so path
-- to package.cpath without a `?` placeholder, corrupting dlopen() for every
-- subsequent native lua module (notably blink.cmp's fuzzy matcher). Defer the
-- vim.pack.add itself so the plugin/codesnap.lua never runs at startup.
-- Equivalent to lazy.nvim's old `keys = {{...}}` lazy-load.
local codesnap_initialized = false
local function init_codesnap()
	if codesnap_initialized then
		return
	end
	vim.pack.add({ "https://github.com/mistricky/codesnap.nvim" })
	require("codesnap").setup({
		has_line_number = true,
		watermark = "",
		bg_padding = 0,
		has_breadcrumbs = true,
		show_workspace = true,
		code_font_family = "JetBrainsMono Nerd Font",
		mac_window_bar = false,
	})
	codesnap_initialized = true
end

vim.keymap.set("v", "<Leader>s", function()
	init_codesnap()
	vim.cmd("CodeSnap")
end, { desc = "Screenshot code snippet" })

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
