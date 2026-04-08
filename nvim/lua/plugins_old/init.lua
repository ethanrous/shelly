return {
	"nvim-lua/plenary.nvim", -- Necessary dependency
	"farmergreg/vim-lastplace", -- Remember last cursor place
	"nvim-lua/popup.nvim", -- Necessary dependency

	-- <C-{h/j/k/l}> between panes. Don't remove, even though no longer using tmux
	"christoomey/vim-tmux-navigator",

	-- Case sensitive search and replace
	{
		"tpope/vim-abolish",
		event = "BufEnter",
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
