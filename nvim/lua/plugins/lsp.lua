-- LSP
return {
	-- {
	-- 	"mason-org/mason.nvim",
	-- 	config = function()
	-- 		require("mason").setup()
	--
	-- 		vim.keymap.set("n", "gh", require("noice.lsp").hover)
	-- 		vim.keymap.set("n", "<LEADER>r", function()
	-- 			require("cosmic-ui").rename({
	-- 				win_options = {
	-- 					winhighlight = "Normal:CosmicPopupInput",
	-- 				},
	-- 			})
	-- 		end)
	--
	-- 		local diagnostic_float_opts = {
	-- 			border = "single",
	-- 		}
	-- 		vim.keymap.set("n", "gE", function()
	-- 			vim.diagnostic.open_float(diagnostic_float_opts)
	-- 		end)
	--
	-- 		vim.keymap.set("n", "ge", function()
	-- 			vim.diagnostic.jump({ count = 1, float = true })
	-- 		end, { silent = true })
	--
	-- 		vim.keymap.set("n", "<LEADER>li", function()
	-- 			vim.cmd("checkhealth vim.lsp")
	-- 		end, { silent = true })
	-- 	end,
	-- },
	{
		"mason-org/mason.nvim",
		dependencies = {
			-- "mason-org/mason-lspconfig.nvim",
			-- "neovim/nvim-lspconfig",
		},
		config = function()
			require("mason").setup()
			-- require("mason-lspconfig").setup({
			-- 	ensure_installed = {
			-- 		"vimls",
			--
			-- 		-- Go
			-- 		"gopls",
			-- 		"golangci_lint_ls",
			-- 		--
			-- 		-- Lua
			-- 		"lua_ls",
			-- 		-- Bash
			-- 		"bashls",
			--
			-- 		-- JSON
			-- 		"jsonls",
			--
			-- 		-- Python
			-- 		"pyright",
			--
			-- 		-- YAML
			-- 		"yamlls",
			--
			-- 		-- Rust
			-- 		"rust_analyzer",
			--
			-- 		-- Java
			-- 		"jdtls",
			-- 		"gradle_ls",
			--
			-- 		-- HTML
			-- 		"html",
			-- 		-- JavaScript/TypeScript
			-- 		"ts_ls",
			-- 		"vue_ls",
			-- 		"angularls",
			--
			-- 		-- "vtsls",
			--
			-- 		"tailwindcss",
			-- 		"eslint",
			-- 		"cssls",
			-- 		-- "cssmodules-language-server",
			--
			-- 		-- C/C++
			-- 		"clangd",
			--
			-- 		-- Docker
			-- 		-- "hadolint",
			--
			-- 		-- Ruby
			-- 		"ruby_lsp",
			-- 	},
			-- 	automatic_installation = true,
			-- 	automatic_enable = false,
			-- })
		end,
	},
	{
		"artemave/workspace-diagnostics.nvim",
	},
}
