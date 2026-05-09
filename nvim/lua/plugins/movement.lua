vim.pack.add({
	"https://codeberg.org/andyg/leap.nvim",
	"git@github.com:yorickpeterse/nvim-jump.git",
	"https://github.com/christoomey/vim-tmux-navigator",
	"https://github.com/farmergreg/vim-lastplace",
})

-- Leap
local leap = require("leap")
leap.opts.equivalence_classes = { " \t\r\n", "([{", ")]}", "'\"`" }
-- vim.keymap.set({ "n", "x", "o" }, "f", "<Plug>(leap-forward)")
-- vim.keymap.set({ "n", "x", "o" }, "F", "<Plug>(leap-backward)")

-- nvim-jump
vim.keymap.set({ "n", "x", "o" }, "f", require("jump").start, { desc = "Jump to a word" })
