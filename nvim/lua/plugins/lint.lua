vim.pack.add({ "https://github.com/mfussenegger/nvim-lint" })

-- Scoped by path instead of filetype=yaml so actionlint only ever runs
-- against workflow files, not every yaml file in a project.
vim.api.nvim_create_autocmd({ "BufWritePost", "BufReadPost", "InsertLeave" }, {
	group = vim.api.nvim_create_augroup("actionlint", { clear = true }),
	pattern = { "*/.github/workflows/*.yml", "*/.github/workflows/*.yaml" },
	callback = function()
		require("lint").try_lint("actionlint")
	end,
})
