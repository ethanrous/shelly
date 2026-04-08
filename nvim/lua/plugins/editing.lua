vim.pack.add({
	"https://github.com/windwp/nvim-autopairs",
	"https://github.com/numToStr/Comment.nvim",
	"https://github.com/tpope/vim-abolish",
	"https://github.com/windwp/nvim-ts-autotag",
	"https://github.com/rmagatti/alternate-toggler",
	"https://github.com/folke/todo-comments.nvim",
	"https://github.com/tpope/vim-repeat",
})

-- Autopairs
require("nvim-autopairs").setup({
	map_cr = true,
	enable_check_bracket_line = true,
})

-- Comment.nvim (the classic tpope-style commenter; mini.comment handles commenting
-- via keybinds, but this plugin's operator-pending mappings are still wired in by
-- default when loaded — kept for parity with the previous config).
require("Comment").setup()

-- Alternate-toggler
require("alternate-toggler").setup({
	alternates = { ["=="] = "!=" },
})

-- Todo-comments
require("todo-comments").setup()

-- Treesitter auto-close/rename HTML tags
require("nvim-ts-autotag").setup({
	opts = { enable_close_on_slash = true },
})

-- vim-abolish and vim-repeat are pure vimscript plugins with no setup(); they
-- register their commands/mappings via plugin/*.vim. vim.pack installs plugins
-- under pack/*/opt/, which nvim does NOT auto-source at end of init, so we need
-- an explicit :packadd to load their plugin/ files.
vim.cmd("packadd vim-abolish")
vim.cmd("packadd vim-repeat")
