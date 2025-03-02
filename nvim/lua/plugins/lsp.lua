-- LSP
local on_attach = function(_, bufnr)
	local opts = { buffer = bufnr, remap = false }

	vim.keymap.set("n", "gh", require("noice.lsp").hover, opts)
	vim.keymap.set("n", "<LEADER>r", function()
		require("cosmic-ui").rename({
			win_options = {
				winhighlight = "Normal:CosmicPopupInput",
			},
		})
	end, opts)

	local diagnostic_float_opts = {
		border = "single",
	}
	vim.keymap.set("n", "gE", function()
		vim.diagnostic.open_float(diagnostic_float_opts)
	end)
	vim.keymap.set("n", "ge", function()
		vim.diagnostic.goto_next(diagnostic_float_opts)
	end, { silent = true })
	vim.keymap.set({ "n", "i" }, "<A-S-d>", vim.diagnostic.goto_prev, { silent = true })

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
end

-- LSP
return {
	{
		-- LSP Support
		"WhoIsSethDaniel/mason-tool-installer.nvim",
		dependencies = {
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
			"neovim/nvim-lspconfig",

			"SmiteshP/nvim-navbuddy",
			"SmiteshP/nvim-navic",
			"MunifTanjim/nui.nvim",
			"davidmh/cspell.nvim",
			"nvimtools/none-ls.nvim",
			"nvimtools/none-ls-extras.nvim",

			"folke/lazydev.nvim",
		},
		config = function()
			local lspconfig = require("lspconfig")
			require("nvim-navbuddy")
			require("mason").setup({})
			require("mason-tool-installer").setup({
				ensure_installed = {
					-- Go
					"gopls",
					"golangci_lint_ls",
					--
					-- Lua
					"lua_ls",
					-- Bash
					"bashls",

					"jsonls",
					"pyright",
					"yamlls",
					"svelte",

					-- Rust
					"rust_analyzer",

					-- Java
					"jdtls",

					-- HTML
					"html",
					-- JavaScript/TypeScript
					-- "ts_ls",
					"vtsls",
					"volar",
					"tailwindcss",
					"eslint",
					"cssls",
					"cssmodules-language-server",

					-- C/C++
					"clangd",
				},
			})
			local capabilities = vim.lsp.protocol.make_client_capabilities()

			require("lazydev").setup({
				library = vim.api.nvim_get_runtime_file("", true),
			})

			require("mason-lspconfig").setup({
				automatic_installation = true,
				handlers = {
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
					["volar"] = function()
						lspconfig["volar"].setup({
							-- filetypes = {"typescript", "javascript", "javascriptreact", "typescriptreact", "vue",},
							init_options = {
								typescript = {
									-- tsdk = "/Users/erousseau/.local/share/nvim/mason/packages/vue-language-server/node_modules/typescript/lib",
									tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
								},
								vue = {
									hybridMode = false,
								},
								languageFeatures = {
									implementation = true,
									references = true,
									definition = true,
									typeDefinition = true,
									callHierarchy = true,
									hover = true,
									rename = true,
									renameFileRefactoring = true,
									signatureHelp = true,
									codeAction = true,
									workspaceSymbol = true,
									diagnostics = true,
									semanticTokens = true,
									completion = {
										defaultTagNameCase = "both",
										defaultAttrNameCase = "kebabCase",
										getDocumentNameCasesRequest = false,
										getDocumentSelectionRequest = false,
									},
								},
							},
							settings = {
								typescript = {
									inlayHints = {
										enumMemberValues = {
											enabled = true,
										},
										functionLikeReturnTypes = {
											enabled = true,
										},
										propertyDeclarationTypes = {
											enabled = true,
										},
										parameterTypes = {
											enabled = true,
											suppressWhenArgumentMatchesName = true,
										},
										variableTypes = {
											enabled = true,
										},
									},
								},
							},
						})
					end,
					["vtsls"] = function()
						require("lspconfig").vtsls.setup({
							filetypes = {
								"javascript",
								"javascriptreact",
								"javascript.jsx",
								"typescript",
								"typescriptreact",
								"typescript.tsx",
							},
							{ "vtsls", "--stdio" },

							on_attach = on_attach,
						})
					end,
					["cssmodules_ls"] = function()
						require("lspconfig").cssmodules_ls.setup({
							filetypes = {
								"javascriptreact",
								"javascript.jsx",
								"typescriptreact",
								"typescript.tsx",
							},

							on_attach = function(client)
								client.server_capabilities.definitionProvider = false
								on_attach(client)
							end,
						})
					end,
					-- ["ts_ls"] = function()
					-- 	local mason_packages = vim.fn.stdpath("data") .. "/mason/packages"
					-- 	local volar_path = mason_packages .. "/vue-language-server/node_modules/@vue/language-server"
					--
					-- 	require("lspconfig").ts_ls.setup({
					-- 		filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact" },
					-- 		init_options = {
					-- 			plugins = {
					-- 				{
					-- 					name = "@vue/typescript-plugin",
					-- 					location = volar_path,
					-- 					languages = { "vue" },
					-- 				},
					-- 			},
					-- 		},
					-- 		settings = {
					-- 			typescript = {
					-- 				inlayHints = {
					-- 					includeInlayParameterNameHints = "all",
					-- 					includeInlayParameterNameHintsWhenArgumentMatchesName = true,
					-- 					includeInlayFunctionParameterTypeHints = true,
					-- 					includeInlayVariableTypeHints = true,
					-- 					includeInlayVariableTypeHintsWhenTypeMatchesName = true,
					-- 					includeInlayPropertyDeclarationTypeHints = true,
					-- 					includeInlayFunctionLikeReturnTypeHints = true,
					-- 					includeInlayEnumMemberValueHints = true,
					-- 				},
					-- 			},
					-- 		},
					-- 	})
					-- end,
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
				},
			})
		end,
	},
	{
		"mfussenegger/nvim-jdtls",
	},
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
}
