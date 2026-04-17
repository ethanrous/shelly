vim.pack.add({
	"https://github.com/mason-org/mason.nvim",
	"https://github.com/artemave/workspace-diagnostics.nvim",
	"https://github.com/folke/lazydev.nvim",
})

require("mason").setup()

require("lazydev").setup({
	library = {
		-- Load luvit types when the `vim.uv` word is found
		{ path = "${3rd}/luv/library", words = { "vim%.uv" } },
	},
})

-- workspace-diagnostics has no global setup; it's consumed via
-- require("workspace-diagnostics").populate_workspace_diagnostics(client, bufnr)
-- from LspAttach, which can be wired in later if needed.
