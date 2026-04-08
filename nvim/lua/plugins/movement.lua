vim.pack.add({
	{ src = "https://codeberg.org/andyg/leap.nvim" },
	"git@github.com:yorickpeterse/nvim-jump.git",
	"https://github.com/christoomey/vim-tmux-navigator",
	"https://github.com/farmergreg/vim-lastplace",
})

-- Source plugin/* files for plugins that rely on them.
-- vim.pack uses :packadd! which only adds to rtp; explicit :packadd is needed
-- to source plugin/init.lua and plugin/*.vim files.
vim.cmd.packadd("leap.nvim")
vim.cmd.packadd("nvim-jump")
vim.cmd.packadd("vim-tmux-navigator")
vim.cmd.packadd("vim-lastplace")

-- Leap
local leap = require("leap")
leap.opts.equivalence_classes = { " \t\r\n", "([{", ")]}", "'\"`" }
vim.keymap.set({ "n", "x", "o" }, "f", "<Plug>(leap-forward)")
vim.keymap.set({ "n", "x", "o" }, "F", "<Plug>(leap-backward)")

-- nvim-jump
vim.keymap.set({ "n", "x", "o" }, "s", require("jump").start, { desc = "Jump to a word" })
