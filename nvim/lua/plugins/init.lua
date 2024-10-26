return {
	"nvim-lua/plenary.nvim", -- Necessary dependency
	"nvim-tree/nvim-web-devicons", -- Cool icons
	"farmergreg/vim-lastplace", -- Remember last cursor place
	"nvim-lua/popup.nvim", -- Necessary dependency
	"christoomey/vim-tmux-navigator",
	"tpope/vim-sleuth", -- Automatically adjust tab size

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
		"iamcco/markdown-preview.nvim",
		cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
		build = "cd app && yarn install",
		init = function()
			vim.g.mkdp_filetypes = { "markdown" }
		end,
		ft = { "markdown" },
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
		config = function()
			require("nvim-autopairs").setup()
			local cmp = require("cmp")
			local cmp_autopairs = require("nvim-autopairs.completion.cmp")

			cmp.event:on("confirm_done", cmp_autopairs.on_confirm_done())
		end,
		opts = {
			enable_check_bracket_line = true,
		},
		-- use opts = {} for passing setup options
		-- this is equivalent to setup({}) function
	},
}
