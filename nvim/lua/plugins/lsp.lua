vim.diagnostic.config({
	virtual_text = {
		hl_mode = "blend",
		format = function(diagnostic)
			local lines = vim.split(diagnostic.message, "\n")
			return lines[1]
		end,
		virt_text_pos = "eol",
		-- virt_text_win_col = 100,
	},
	signs = true,
	update_in_insert = true,
	float = {

		source = "always",
		border = "rounded",
		focusable = false,
	},
	severity_sort = true,
})

local toggle_inlay_hint = function()
	local is_enabled = vim.lsp.inlay_hint.is_enabled()
	vim.lsp.inlay_hint.enable(not is_enabled)
end

local ts_organize_imports = function()
	local params = {
		command = "_typescript.organizeImports",
		arguments = { vim.api.nvim_buf_get_name(0) },
		title = "",
	}
	vim.lsp.buf.execute_command(params)
end

-- LSP
local on_attach = function(client, bufnr)
	local opts = { buffer = bufnr, remap = false }

	vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
	vim.keymap.set("n", "gh", vim.lsp.buf.hover, opts)
	vim.keymap.set("n", "gt", vim.lsp.buf.type_definition, opts)
	vim.keymap.set("n", "<LEADER>r", vim.lsp.buf.rename, opts)
	-- vim.keymap.set("n", "<LEADER>f", function()
	-- 	vim.lsp.buf.format({ async = true })
	-- end, opts)
	vim.keymap.set("n", "ge", vim.diagnostic.open_float, opts)
	vim.keymap.set("n", "<LEADER>d", vim.diagnostic.open_float, { silent = true })
	vim.keymap.set({ "n", "i" }, "<A-d>", vim.diagnostic.goto_next, { silent = true })
	vim.keymap.set({ "n", "i" }, "<A-S-d>", vim.diagnostic.goto_prev, { silent = true })
	vim.keymap.set("n", "<LEADER>t", toggle_inlay_hint, opts)

	vim.keymap.set("n", "gs", require("nvim-navbuddy").open, { buffer = bufnr, remap = true })
end

local lsp = vim.lsp
local make_client_capabilities = lsp.protocol.make_client_capabilities
function lsp.protocol.make_client_capabilities()
	local caps = make_client_capabilities()
	if not (caps.workspace or {}).didChangeWatchedFiles then
		vim.notify("lsp capability didChangeWatchedFiles is already disabled", vim.log.levels.WARN)
	else
		caps.workspace.didChangeWatchedFiles = nil
	end

	return caps
end

return {
	-- LSP
	{
		"neovim/nvim-lspconfig",
		config = function()
			local navbuddy = require("nvim-navbuddy")
			require("mason").setup()
			require("mason-lspconfig").setup({
				ensure_installed = {
					"ts_ls",
					"gopls",
					"golangci_lint_ls",
					"lua_ls",
					"bashls",
					"cssls",
					"eslint",
					"html",
					"jsonls",
					"pyright",
					"yamlls",
					"svelte",
					"tailwindcss",
					"rust_analyzer",
				},
			})
			local capabilities = vim.lsp.protocol.make_client_capabilities()
			capabilities = require("cmp_nvim_lsp").default_capabilities(capabilities)

			require("mason-lspconfig").setup_handlers({
				function(server_name) -- default handler (optional)
					require("lspconfig")[server_name].setup({
						capabilities = capabilities,
						on_attach = on_attach,
					})
				end,
				["lua_ls"] = function()
					require("lspconfig")["lua_ls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
						settings = {
							Lua = {
								diagnostics = {
									globals = { "vim" },
									disable = { "missing-parameters", "missing-fields" },
								},
								hint = { enable = true },
								telemetry = { enable = false },
							},
						},
					})
				end,
				["golangci_lint_ls"] = function()
					require("lspconfig")["golangci_lint_ls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
					})
				end,
				["gopls"] = function()
					require("lspconfig")["gopls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
						settings = {
							gopls = {
								hints = {
									assignVariableTypes = true,
									compositeLiteralFields = true,
									compositeLiteralTypes = true,
									constantValues = true,
									functionTypeParameters = true,
									parameterNames = true,
									rangeVariableTypes = true,
								},
							},
						},
					})
				end,
				["clangd"] = function()
					require("lspconfig")["clangd"].setup({
						on_attach = function(client, bufnr)
							navbuddy.attach(client, bufnr)
						end,
					})
				end,
				["ts_ls"] = function()
					local inlayHints = {
						includeInlayEnumMemberValueHints = true,
						includeInlayFunctionLikeReturnTypeHints = true,
						includeInlayFunctionParameterTypeHints = true,
						includeInlayParameterNameHints = "all",
						includeInlayParameterNameHintsWhenArgumentMatchesName = true,
						includeInlayPropertyDeclarationTypeHints = true,
						includeInlayVariableTypeHints = false,
					}
					require("lspconfig")["ts_ls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
						settings = {
							javascript = {
								inlayHints = inlayHints,
							},
							typescript = {
								inlayHints = inlayHints,
							},
						},
						commands = {
							OrganizeImports = {
								ts_organize_imports,
								description = "Organize Imports",
							},
						},
					})
				end,
			})
		end,
		dependencies = {
			{
				"SmiteshP/nvim-navbuddy",
				dependencies = {
					"SmiteshP/nvim-navic",
					"MunifTanjim/nui.nvim",
				},
				opts = { lsp = { auto_attach = true } },
			},
			-- LSP Support
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
		},
		event = "BufEnter",
		opts = { inlay_hints = { enabled = true } },
	},

	-- Rust config
	-- {
	-- 	"mrcjkb/rustaceanvim",
	-- 	version = "^4",
	-- 	ft = { "rust" },
	-- },
}
