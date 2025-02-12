Colors = {
	Base = "#232136",
	Surface = "#2a273f",
	Overlay = "#393552",
	Muted = "#6e6a86",
	Subtle = "#908caa",
	Text = "#e0def4",
	Love = "#eb6f92",
	Gold = "#f6c177",
	Rose = "#ea9a97",
	Pine = "#3e8fb0",
	PineMuted = "#345B78",
	Foam = "#9ccfd8",
	Iris = "#c4a7e7",
	HighlightLow = "#2a283e",
	HighlightMed = "#44415a",
	HighlightHigh = "#56526e",
}

-- vim.api.nvim_set_hl(0, "TelescopeMatching", { link = "another-group" })
-- 	TelescopeMatching = { fg = Text, bg = Pine },
-- 	TelescopeSelection = { fg = Foam, bg = Base, bold = true },
--
-- 	TelescopePromptPrefix = { fg = Subtle, bg = Surface },
-- 	TelescopePromptCounter = { fg = Subtle, bg = Surface },
-- 	TelescopePromptNormal = { fg = Subtle, bg = Surface },
-- 	TelescopePromptBorder = { bg = Surface, fg = Surface },
-- 	TelescopePromptTitle = { bg = Surface, fg = Subtle },
--
-- 	TelescopeResultsNormal = { bg = Surface, fg = Text },
-- 	TelescopeResultsBorder = { bg = Surface, fg = Surface },
-- 	TelescopeResultsTitle = { fg = Subtle },
-- 	TelescopeResultsVariable = { fg = Subtle },
-- 	Directory = { fg = Muted },
--
-- 	TelescopeSelectionCaret = { fg = Subtle, bg = Base },
--
-- 	TelescopePreviewNormal = { bg = Base },
-- 	TelescopePreviewBorder = { bg = Surface, fg = Surface },
-- 	TelescopePreviewTitle = { bg = Surface, fg = Subtle },
--
-- 	NormalFloat = { bg = Surface, fg = Subtle },
-- 	FloatBorder = { fg = Surface, bg = Surface },
-- 	LspSignatureActiveParameter = { fg = Text, bg = Pine, bold = true },
--
-- 	DapUIPlayPause = { fg = Pine, bg = Surface },
-- 	DapUIRestartNC = { fg = Pine, bg = Surface },
-- 	DapUIPlayPauseNC = { fg = Pine, bg = Surface },
-- 	DapUIStepOutNC = { fg = Pine, bg = Surface },
-- 	DapUIUnavailableNC = { fg = Subtle, bg = Surface },
--
-- 	HarpoonWindow = { fg = Pine, bg = Pine },
-- 	HarpoonBorder = { fg = Pine, bg = Pine },
--
-- 	OilDir = { fg = Foam },
-- }

return {
	{
		"rose-pine/neovim",
		enabled = false,
		name = "rose-pine",
		lazy = false,
		priority = 1000,
		config = function()
			require("rose-pine").setup({
				variant = "moon",
				dark_variant = "moon",
				groups = {
					border = "pine",
				},
			})
			vim.cmd("colorscheme rose-pine-moon")
		end,
	},
	-- Custom Popup windows for certian actions (rename, etc.)
	{
		"CosmicNvim/cosmic-ui",
		requires = { "MunifTanjim/nui.nvim", "nvim-lua/plenary.nvim" },
		config = function()
			require("cosmic-ui").setup()
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
