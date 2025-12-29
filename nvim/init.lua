vim.loader.enable()

require("config")
require("util")

-- Load all LSP's in "lua/config/lsp"
-- local lsp_path = vim.fn.stdpath("config") .. "/lsp"

-- First, explicitly load the global configuration
-- require("lsp.global")

-- -- Then load all other LSP configs
-- for _, file in ipairs(vim.fn.readdir(lsp_path)) do
-- 	if file:match("%.lua$") and file ~= "global.lua" then
-- 		local module_name = file:gsub("%.lua$", "")
-- 		require(module_name)
-- 	end
-- end

vim.cmd.colorscheme("tokyonight-moon")

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
