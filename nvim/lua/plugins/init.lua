return {
	"nvim-lua/plenary.nvim", -- Necessary dependency
	"farmergreg/vim-lastplace", -- Remember last cursor place
	"nvim-lua/popup.nvim", -- Necessary dependency
	"christoomey/vim-tmux-navigator",
	-- "tpope/vim-sleuth", -- Automatically adjust tab size

	-- Case sensitive search and replace
	{
		"tpope/vim-abolish",
		event = "BufEnter",
	},

	-- Disable some features for big files
	{
		"LunarVim/bigfile.nvim",
		event = { "FileReadPre", "BufReadPre", "BufEnter" },
	},

	-- Markdown previewer
	{
		"MeanderingProgrammer/render-markdown.nvim",
		-- dependencies = { 'nvim-treesitter/nvim-treesitter', 'echasnovski/mini.nvim' }, -- if you use the mini.nvim suite
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			-- "echasnovski/mini.icons"
		}, -- if you use standalone mini plugins
		-- dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' }, -- if you prefer nvim-web-devicons
		---@module 'render-markdown'
		---@type render.md.UserConfig
		opts = {},
	},
	-- Highlights for
	-- TODO: test
	-- FIX: test
	-- HACK: test
	-- WARN: test
	{
		"folke/todo-comments.nvim",
		config = true,
		event = "BufEnter",
	},

	{
		"windwp/nvim-autopairs",
		event = "InsertEnter",
		-- config = function()
		-- 	require("nvim-autopairs").setup()
		-- 	local cmp = require("cmp")
		-- 	local cmp_autopairs = require("nvim-autopairs.completion.cmp")
		--
		-- 	cmp.event:on("confirm_done", cmp_autopairs.on_confirm_done())
		-- end,
		opts = {
			map_cr = true,
			enable_check_bracket_line = true,
		},
		-- use opts = {} for passing setup options
		-- this is equivalent to setup({}) function
	},
}
