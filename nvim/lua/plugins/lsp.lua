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

	vim.keymap.set("n", "gh", vim.lsp.buf.hover, opts)
	vim.keymap.set("n", "<LEADER>r", vim.lsp.buf.rename, opts)
	vim.keymap.set("n", "gE", vim.diagnostic.open_float, opts)
	vim.keymap.set("n", "ge", vim.diagnostic.goto_next, { silent = true })
	vim.keymap.set("n", "<LEADER>d", vim.diagnostic.open_float, { silent = true })
	vim.keymap.set({ "n", "i" }, "<A-S-d>", vim.diagnostic.goto_prev, { silent = true })
	vim.keymap.set("n", "<LEADER>t", toggle_inlay_hint, opts)

	vim.lsp.handlers["textDocument/hover"] = function(_, result, ctx, config)
		config = config or {}
		config.focus_id = ctx.method
		if not (result and result.contents) then
			return
		end
		local markdown_lines = vim.lsp.util.convert_input_to_markdown_lines(result.contents)
		markdown_lines = vim.lsp.util.trim_empty_lines(markdown_lines)
		if vim.tbl_isempty(markdown_lines) then
			return
		end
		return vim.lsp.util.open_floating_preview(markdown_lines, "markdown", config)
	end

	-- vim.keymap.set("n", "gs", require("nvim-navbuddy").open, { buffer = bufnr, remap = true })
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
				["bashls"] = function()
					require("lspconfig")["bashls"].setup({})
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
								referencesCodeLens = {
									enabled = true,
									includeImports = false,
								},
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

	-- Go config
	{
		"olexsmir/gopher.nvim",
		ft = "go",
		-- branch = "develop", -- if you want develop branch
		-- keep in mind, it might break everything
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			"mfussenegger/nvim-dap", -- (optional) only if you use `gopher.dap`
		},
		config = function()
			require("gopher").setup({
				gotag = {
					transform = "camelcase",
				},
			})
		end,
		-- (optional) will update plugin's deps on every update
		build = function()
			vim.cmd.GoInstallDeps()
		end,
		---@type gopher.Config
		opts = {},
	},
	{
		"ThePrimeagen/refactoring.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
		lazy = false,
		config = function()
			require("refactoring").setup()
		end,
	},
}
