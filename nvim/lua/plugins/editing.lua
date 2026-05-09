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

-- Comment.nvim is installed but intentionally NOT setup() — calling setup
-- would register its default mappings, which include `gb{motion}` as a
-- blockwise comment operator and would shadow the user's `gb -> <C-o>`
-- jumplist binding from config/keyboard.lua. mini.comment handles the
-- actual commenting workflow; Comment.nvim is kept on disk only because
-- the previous lazy.nvim spec also had it installed-but-not-configured.


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
