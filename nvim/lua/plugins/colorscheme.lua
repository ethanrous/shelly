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
