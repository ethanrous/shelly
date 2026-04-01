return {
	{
		"folke/tokyonight.nvim",
		lazy = false,
		priority = 1000,
		config = function()
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
					hl.TelescopeNormal = {
						bg = c.bg_float,
						fg = c.fg_dark,
					}
					hl.TelescopeBorder = {
						bg = c.bg_float,
						fg = c.bg_float,
					}
					hl.TelescopePromptNormal = {
						bg = prompt,
					}
					hl.TelescopePromptBorder = {
						bg = prompt,
						fg = prompt,
					}
					hl.TelescopePromptTitle = {
						bg = prompt,
						fg = prompt,
					}
					hl.TelescopePreviewTitle = {
						bg = c.bg_float,
						fg = c.bg_float,
					}
					hl.TelescopeResultsTitle = {
						bg = c.bg_float,
						fg = c.bg_float,
					}
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
		end,
	},

	-- Illuminate words like the one you are hovering
	{
		"RRethy/vim-illuminate",
		config = function()
			require("illuminate").configure({
				delay = 0,
				should_enable = function(bufnr)
					local mode = vim.api.nvim_get_mode().mode
					return mode == "n" or mode == "i"
				end,
				min_count_to_highlight = 2,
				filetypes_denylist = {
					"NvimTree",
					"harpoon",
				},
			})
		end,
		event = "BufEnter",
	},

	{
		"nvim-lualine/lualine.nvim",
		event = "VeryLazy",
		dependencies = { "nvim-tree/nvim-web-devicons" },
	},
	{
		"brenoprata10/nvim-highlight-colors",
		config = function()
			require("nvim-highlight-colors").setup({
				render = "virtual",
				enable_named_colors = true,
				enable_tailwind = true,
				enable_hex = true,
				disable = { "NvimTree" },
			})
		end,
	},
}
