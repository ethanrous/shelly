vim.loader.enable()

require("config")
require("util")
-- require("vim._core.ui2").enable()

vim.lsp.enable({
	"angularls",
	"bashls",
	"clangd",
	"cssls",
	"eslint",
	"go",
	"golangci_lint_ls",
	"html",
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
	"groovyls",
	"terraformls",
	"terraform_lsp",
	"tflint",
})
