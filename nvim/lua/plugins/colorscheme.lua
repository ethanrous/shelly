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

		-- Diff: changed lines get a near-invisible tint so that DiffText (the
		-- actual changed tokens) is the only strong signal on the line. The
		-- deleted/filler hatch drops to a dim texture instead of a red slab.
		local d = vim.opt.background:get() == "dark"
				and {
					add = "#0f2019",
					change = "#111827",
					delete = "#211318",
					text = "#2b4f73",
					filler = "#3b4261",
					guide = "#242938",
				}
			or {
				add = "#e2efe6",
				change = "#e6ebf5",
				delete = "#f6e3e7",
				text = "#b8d4ee",
				filler = "#b6bcca",
				guide = "#dcdfe6",
			}

		hl.DiffAdd = { bg = d.add }
		hl.DiffChange = { bg = d.change }
		hl.DiffDelete = { bg = d.delete, fg = d.filler }
		hl.DiffText = { bg = d.text }
		hl.DiffviewDiffDeleteDim = { fg = d.filler, bg = "NONE" }
		hl.IblDiff = { fg = d.guide }

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
