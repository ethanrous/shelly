vim.lsp.config.go = {
	cmd = { "gopls" },
	filetypes = { "go" },
	root_markers = {
		"go.mod",
		".git",
	},
	settings = {},
}

vim.lsp.config.golangci_lint_ls = {
	cmd = { "golangci-lint-langserver" },
	filetypes = { "go", "gomod" },
	init_options = {
		command = { "golangci-lint", "run", "--output.json.path=stdout", "--show-stats=false" },
	},
	root_markers = {
		".golangci.yml",
		".golangci.yaml",
		".golangci.toml",
		".golangci.json",
		"go.work",
		"go.mod",
		".git",
	},
}
