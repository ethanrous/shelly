return {
	{
		"folke/tokyonight.nvim",
		lazy = false,
		priority = 1000,
		config = function()
			require("tokyonight").setup({
				transparent = false,
				on_colors = function(colors)
					colors.bg = "#0D1017"
					colors.bg_dark = "#0D1017"
					colors.bg_float = "#131621"
					colors.bg_popup = "#131621"
					colors.bg_search = "#131621"
					colors.bg_sidebar = "#131621"
					colors.bg_statusline = "#131621"
					colors.git = {
						add = "#449dab",
						change = "#6183bb",
						delete = "#473246",
					}
				end,
				on_highlights = function(hl, c)
					print("Setting highlights")
					hl.CursorLineNr.fg = c.blue
					hl.EndOfBuffer.fg = c.bg_statusline
					hl.StatusLine.fg = c.bg_statusline
					hl.DiffDelete.fg = c.git.delete
				end,
				styles = {
					comments = { italic = false },
					keywords = { italic = false },
				},
			})
			vim.cmd.colorscheme("tokyonight-moon")
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
		dependencies = { "nvim-tree/nvim-web-devicons" },
	},

	-- Highlight color codes with their code #ff00ff
	-- {
	-- 	"catgoose/nvim-colorizer.lua",
	-- 	event = "BufReadPre",
	-- 	config = function()
	-- 		require("colorizer").setup({
	-- 			filetypes = { "*" },
	-- 			user_default_options = {
	-- 				css_fn = true,
	-- 				css = true,
	-- 				tailwind = "both",
	-- 			},
	-- 		})
	-- 	end,
	-- },
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
