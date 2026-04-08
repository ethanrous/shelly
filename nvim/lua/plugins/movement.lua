-- lazy.nvim clobbers packpath; restore site dir so vim.pack can find installs.
vim.opt.packpath:prepend(vim.fn.stdpath("data") .. "/site")

vim.pack.add({ "git@github.com:yorickpeterse/nvim-jump.git" })

vim.keymap.set({ "n", "x", "o" }, "s", require("jump").start, { desc = "Jump to a word" })

-- Return empty spec list so lazy.nvim's `import = "plugins"` accepts this file.
-- This whole file is rewritten in Task 17 of the vim.pack migration plan.
return {}
