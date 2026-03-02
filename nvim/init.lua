vim.loader.enable()

require("config")
require("util")

-- vim.cmd.colorscheme("tokyonight")

vim.lsp.enable({
	"angularls",
	"bashls",
	"clangd",
	"cssls",
	"eslint",
	"go",
	"golangci_lint_ls",
	"gopls",
	"html",
	"htmlls",
	"jdtls",
	"jsonls",
	"lemminx",
	"lua_ls",
	"postgres_lsp",
	"pyright",
	"ruby_lsp",
	"ruff",
	"rust_analyzer",
	"tailwindcssls",
	"templ",
	"vtsls",
	"vue_ls",
	"yamlls",
	"copilot",
})
