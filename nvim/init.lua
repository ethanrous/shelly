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
	"clangd",
	"gopls",
	"rust_analyzer",
	"vtsls",
	"vue_ls",
	"tailwindcssls",
	"htmlls",
	"jsonls",
	"lua_ls",
	"eslint",
	"go",
	"golangci_lint_ls",
	"templ",
	"ruby_lsp",
	"jdtls",
	"lemminx",
	"html",
	"cssls",
	"pyright",
	"postgres_lsp",
})
