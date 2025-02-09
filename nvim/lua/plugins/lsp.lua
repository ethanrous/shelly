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
		-- vim.notify("lsp capability didChangeWatchedFiles is already disabled", vim.log.levels.WARN)
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
			local lspconfig = require("lspconfig")
			require("nvim-navbuddy")
			require("mason").setup()
			require("mason-lspconfig").setup({
				ensure_installed = {
					"gopls",
					"golangci_lint_ls",
					"lua_ls",
					"bashls",
					"html",
					"jsonls",
					"pyright",
					"yamlls",
					"svelte",
					"rust_analyzer",

					"jdtls",

					"ts_ls",
					"tailwindcss",
					"volar",
					"eslint",
					"cssls",
					"clangd",
				},
			})
			local capabilities = vim.lsp.protocol.make_client_capabilities()

			require("mason-lspconfig").setup_handlers({
				function(server_name) -- default handler (optional)
					lspconfig[server_name].setup({
						capabilities = capabilities,
						on_attach = on_attach,
					})
				end,
				["lua_ls"] = function()
					lspconfig["lua_ls"].setup({
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
					lspconfig["bashls"].setup({
						on_attach = on_attach,
					})
				end,
				["cssls"] = function()
					lspconfig["cssls"].setup({
						settings = {
							less = {
								validate = true,
							},
							scss = {
								validate = true,
								lint = {
									unknownAtRules = "ignore",
								},
							},
							css = {
								validate = true,
							},
						},
					})
				end,
				["golangci_lint_ls"] = function()
					lspconfig["golangci_lint_ls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
					})
				end,
				["gopls"] = function()
					lspconfig["gopls"].setup({
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
					lspconfig["ts_ls"].setup({
						capabilities = capabilities,
						on_attach = on_attach,
						filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" },
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
						init_options = {
							plugins = { -- I think this was my breakthrough that made it work
								{
									name = "@vue/typescript-plugin",
									location = vim.fn.stdpath("data")
										.. "/mason/packages/vue-language-server/node_modules/@vue/language-server",
									languages = { "vue" },
								},
							},
						},
					})
					lspconfig["volar"].setup({})
					lspconfig["cssmodules_ls"].setup({
						-- provide your on_attach to bind keymappings
						-- on_attach = custom_on_attach,
						on_attach = function(client)
							-- avoid accepting `definitionProvider` responses from this LSP
							-- client.server_capabilities.definitionProvider = false
						end,
						init_options = {
							camelCase = false,
						},
					})
				end,
				["clangd"] = function()
					lspconfig["clangd"].setup({
						on_attach = on_attach,
						cmd = {
							"clangd",
							"-j=8",
							"--background-index",
							"--suggest-missing-includes",
							"--clang-tidy",
							"--header-insertion=iwyu",
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
			"davidmh/cspell.nvim",
			"nvimtools/none-ls.nvim",
			"nvimtools/none-ls-extras.nvim",
		},
		event = "BufEnter",
		opts = {
			inlay_hints = { enabled = true },
			servers = {
				clangd = {
					mason = false,
				},
			},
		},
	},
	{ "mfussenegger/nvim-jdtls" },

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
