vim.pack.add({
	"https://github.com/stevearc/quicker.nvim",
	"https://github.com/kevinhwang91/nvim-bqf",
})

require("quicker").setup({
	borders = {
		vert = " ╎ ",
		strong_header = "━",
		strong_cross = "╋",
		strong_end = "┫",
		soft_header = "╌",
		soft_cross = "╂",
		soft_end = "┨",
	},
})

vim.api.nvim_set_hl(0, "QuickFixHeaderHard", { link = "Conceal" })
vim.api.nvim_set_hl(0, "QuickFixLineNr", { link = "@variable" })

-- nvim-bqf has a plugin/bqf.vim file that registers its autocmds.
-- vim.pack uses :packadd! which doesn't source plugin/, so do it explicitly.
vim.cmd.packadd("nvim-bqf")
