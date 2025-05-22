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
				end,
				on_highlights = function(hl, c)
					hl.CursorLineNr.fg = c.blue
				end,
				styles = {
					comments = { italic = false },
					keywords = { italic = false },
				},
			})
			vim.cmd.colorscheme("tokyonight-moon")
		end,
	},
	-- {
	-- 	"rose-pine/neovim",
	-- 	enabled = false,
	-- 	name = "rose-pine",
	-- 	lazy = false,
	-- 	priority = 1000,
	-- 	config = function()
	-- 		require("rose-pine").setup({
	-- 			variant = "moon",
	-- 			dark_variant = "moon",
	-- 			groups = {
	-- 				border = "pine",
	-- 			},
	-- 		})
	-- 		vim.cmd("colorscheme rose-pine-moon")
	-- 	end,
	-- },
	-- Custom Popup windows for certian actions (rename, etc.)
	-- {
	-- 	"CosmicNvim/cosmic-ui",
	-- 	requires = { "MunifTanjim/nui.nvim", "nvim-lua/plenary.nvim" },
	-- 	config = function()
	-- 		require("cosmic-ui").setup({
	-- 			-- default border to use
	-- 			-- 'single', 'double', 'rounded', 'solid', 'shadow'
	-- 			border_style = "solid",
	--
	-- 			-- rename popup settings
	-- 			rename = {
	-- 				border = {
	-- 					highlight = "CosmicPopupBorder",
	-- 					style = "single",
	-- 					title = " Rename ",
	-- 					title_align = "left",
	-- 					title_hl = "CosmicPopupBorder",
	-- 				},
	-- 				prompt = "> ",
	-- 				prompt_hl = "CosmicPopupBorder",
	-- 			},
	--
	-- 			code_actions = {
	-- 				min_width = nil,
	-- 				border = {
	-- 					bottom_hl = "FloatBorder",
	-- 					highlight = "FloatBorder",
	-- 					style = "single",
	-- 					title = "Code Actions",
	-- 					title_align = "center",
	-- 					title_hl = "FloatBorder",
	-- 				},
	-- 			},
	-- 		})
	-- 	end,
	-- },

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
	{
		"norcalli/nvim-colorizer.lua",
		config = function()
			require("colorizer").setup()
		end,
	},
}
