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

return {
	{
		"rose-pine/neovim",
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
		config = true,
		event = "VimEnter",
	},
}
