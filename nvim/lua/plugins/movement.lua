vim.pack.add({ "git@github.com:yorickpeterse/nvim-jump.git" })

vim.keymap.set({ "n", "x", "o" }, "s", require("jump").start, { desc = "Jump to a word" })
