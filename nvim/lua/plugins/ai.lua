vim.pack.add({
	"https://github.com/olimorris/codecompanion.nvim",
	"https://github.com/OXY2DEV/markview.nvim",
})

-- CodeCompanion
require("codecompanion").setup({
	-- NOTE: The log_level is in `opts.opts`
	opts = { log_level = "DEBUG" },
})

vim.keymap.set({ "n", "v" }, "<LocalLeader>a", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

-- Markview
require("markview").setup({
	preview = {
		filetypes = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
	},
	max_length = 99999,
})
