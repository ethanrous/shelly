vim.lsp.config.ts_ls = {
	cmd = { "ruby-lsp" },
	filetypes = { "ruby", "eruby" },
	root_markers = { "Gemfile", "git" },
	init_options = {
		formatter = "auto",
	},
	single_file_support = true,
}

vim.lsp.enable("ruby_lsp")
