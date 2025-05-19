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
			"mason-org/mason-lspconfig.nvim",
			"neovim/nvim-lspconfig",
		},
		config = function()
			require("mason").setup()
			require("mason-lspconfig").setup({
				ensure_installed = {
					"vimls",

					-- Go
					"gopls",
					"golangci_lint_ls",
					--
					-- Lua
					"lua_ls",
					-- Bash
					"bashls",

					-- JSON
					"jsonls",

					-- Python
					"pyright",

					-- YAML
					"yamlls",

					-- Rust
					"rust_analyzer",

					-- Java
					-- "jdtls",
					-- "gradle_ls",

					-- HTML
					"html",
					-- JavaScript/TypeScript
					"ts_ls",

					"vtsls",
					"vuels",
					-- "volar",
					"tailwindcss",
					"eslint",
					"cssls",
					-- "cssmodules-language-server",

					-- C/C++
					"clangd",

					-- Docker
					-- "hadolint",
				},
				automatic_installation = true,
				automatic_enable = false,
			})
		end,
	},
	{
		"artemave/workspace-diagnostics.nvim",
	},
}

-- LSP
-- return {
-- 	{
-- 		-- LSP Support
-- 		"WhoIsSethDaniel/mason-tool-installer.nvim",
-- 		dependencies = {
-- 			"williamboman/mason.nvim",
-- 			"williamboman/mason-lspconfig.nvim",
-- 			"neovim/nvim-lspconfig",
--
-- 			"SmiteshP/nvim-navbuddy",
-- 			"SmiteshP/nvim-navic",
-- 			"MunifTanjim/nui.nvim",
-- 			"davidmh/cspell.nvim",
-- 			"nvimtools/none-ls.nvim",
-- 			"nvimtools/none-ls-extras.nvim",
--
-- 			"folke/lazydev.nvim",
-- 		},
-- 		config = function()
-- 			local lspconfig = require("lspconfig")
-- 			require("nvim-navbuddy")
-- 			require("mason").setup({})
-- 			require("mason-tool-installer").setup({
-- 				ensure_installed = {
-- 					-- Go
-- 					"gopls",
-- 					"golangci_lint_ls",
-- 					--
-- 					-- Lua
-- 					"lua_ls",
-- 					-- Bash
-- 					"bashls",
--
-- 					"jsonls",
-- 					"pyright",
-- 					"yamlls",
-- 					"svelte",
--
-- 					-- Rust
-- 					"rust_analyzer",
--
-- 					-- Java
-- 					"jdtls",
-- 					"gradle_ls",
--
-- 					-- HTML
-- 					"html",
-- 					-- JavaScript/TypeScript
-- 					-- "ts_ls",
-- 					"vtsls",
-- 					"volar",
-- 					"tailwindcss",
-- 					"eslint",
-- 					"cssls",
-- 					"cssmodules-language-server",
--
-- 					-- C/C++
-- 					"clangd",
--
-- 					-- Docker
-- 					"hadolint",
-- 				},
-- 			})
-- 			local capabilities = vim.lsp.protocol.make_client_capabilities()
--
-- 			require("lazydev").setup({
-- 				library = vim.api.nvim_get_runtime_file("", true),
-- 			})
--
-- 			require("mason-lspconfig").setup({
-- 				automatic_installation = true,
-- 				handlers = {
-- 					function(server_name) -- default handler (optional)
-- 						lspconfig[server_name].setup({
-- 							capabilities = capabilities,
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 					["lua_ls"] = function()
-- 						lspconfig["lua_ls"].setup({
-- 							capabilities = capabilities,
-- 							on_attach = on_attach,
-- 							settings = {
-- 								Lua = {
-- 									diagnostics = {
-- 										globals = { "vim" },
-- 										disable = { "missing-parameters", "missing-fields" },
-- 									},
-- 									hint = { enable = true },
-- 									telemetry = { enable = false },
-- 								},
-- 							},
-- 						})
-- 					end,
-- 					["bashls"] = function()
-- 						lspconfig["bashls"].setup({
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 					["cssls"] = function()
-- 						lspconfig["cssls"].setup({
-- 							settings = {
-- 								less = {
-- 									validate = true,
-- 								},
-- 								scss = {
-- 									validate = true,
-- 									lint = {
-- 										unknownAtRules = "ignore",
-- 									},
-- 								},
-- 								css = {
-- 									validate = true,
-- 								},
-- 							},
-- 						})
-- 					end,
-- 					["golangci_lint_ls"] = function()
-- 						lspconfig["golangci_lint_ls"].setup({
-- 							capabilities = capabilities,
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 					["gopls"] = function()
-- 						lspconfig["gopls"].setup({
-- 							capabilities = capabilities,
-- 							on_attach = on_attach,
-- 							settings = {
-- 								gopls = {
-- 									hints = {
-- 										assignVariableTypes = true,
-- 										compositeLiteralFields = true,
-- 										compositeLiteralTypes = true,
-- 										constantValues = true,
-- 										functionTypeParameters = true,
-- 										parameterNames = true,
-- 										rangeVariableTypes = true,
-- 									},
-- 								},
-- 							},
-- 						})
-- 					end,
-- 					["volar"] = function()
-- 						lspconfig["volar"].setup({
-- 							-- filetypes = {"typescript", "javascript", "javascriptreact", "typescriptreact", "vue",},
-- 							init_options = {
-- 								typescript = {
-- 									-- tsdk = "/Users/erousseau/.local/share/nvim/mason/packages/vue-language-server/node_modules/typescript/lib",
-- 									tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
-- 								},
-- 								vue = {
-- 									hybridMode = false,
-- 								},
-- 								languageFeatures = {
-- 									implementation = true,
-- 									references = true,
-- 									definition = true,
-- 									typeDefinition = true,
-- 									callHierarchy = true,
-- 									hover = true,
-- 									rename = true,
-- 									renameFileRefactoring = true,
-- 									signatureHelp = true,
-- 									codeAction = true,
-- 									workspaceSymbol = true,
-- 									diagnostics = true,
-- 									semanticTokens = true,
-- 									completion = {
-- 										defaultTagNameCase = "both",
-- 										defaultAttrNameCase = "kebabCase",
-- 										getDocumentNameCasesRequest = false,
-- 										getDocumentSelectionRequest = false,
-- 									},
-- 								},
-- 							},
-- 							settings = {
-- 								typescript = {
-- 									inlayHints = {
-- 										enumMemberValues = {
-- 											enabled = true,
-- 										},
-- 										functionLikeReturnTypes = {
-- 											enabled = true,
-- 										},
-- 										propertyDeclarationTypes = {
-- 											enabled = true,
-- 										},
-- 										parameterTypes = {
-- 											enabled = true,
-- 											suppressWhenArgumentMatchesName = true,
-- 										},
-- 										variableTypes = {
-- 											enabled = true,
-- 										},
-- 									},
-- 								},
-- 							},
-- 						})
-- 					end,
-- 					["vtsls"] = function()
-- 						require("lspconfig").vtsls.setup({
-- 							filetypes = {
-- 								"javascript",
-- 								"javascriptreact",
-- 								"javascript.jsx",
-- 								"typescript",
-- 								"typescriptreact",
-- 								"typescript.tsx",
-- 							},
-- 							{ "vtsls", "--stdio" },
--
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 					["cssmodules_ls"] = function()
-- 						require("lspconfig").cssmodules_ls.setup({
-- 							filetypes = {
-- 								"javascriptreact",
-- 								"javascript.jsx",
-- 								"typescriptreact",
-- 								"typescript.tsx",
-- 							},
--
-- 							on_attach = function(client)
-- 								client.server_capabilities.definitionProvider = false
-- 								on_attach(client)
-- 							end,
-- 						})
-- 					end,
-- 					["clangd"] = function()
-- 						lspconfig["clangd"].setup({
-- 							on_attach = on_attach,
-- 							cmd = {
-- 								"clangd",
-- 								"-j=8",
-- 								"--background-index",
-- 								"--suggest-missing-includes",
-- 								"--clang-tidy",
-- 								"--header-insertion=iwyu",
-- 							},
-- 						})
-- 					end,
-- 					["gradle_ls"] = function()
-- 						lspconfig["gradle_ls"].setup({})
-- 					end,
-- 					dockerls = function()
-- 						lspconfig["dockerls"].setup({
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 					docker_compose_language_service = function()
-- 						lspconfig["docker_compose_language_service"].setup({
-- 							on_attach = on_attach,
-- 						})
-- 					end,
-- 				},
-- 			})
-- 		end,
-- 	},
-- 	{
-- 		"dmmulroy/ts-error-translator.nvim",
-- 		config = function()
-- 			require("ts-error-translator").setup()
-- 		end,
-- 	},
-- 	{
-- 		"mfussenegger/nvim-jdtls",
-- 	},
-- 	-- Go config
-- 	{
-- 		"olexsmir/gopher.nvim",
-- 		ft = "go",
-- 		-- branch = "develop", -- if you want develop branch
-- 		-- keep in mind, it might break everything
-- 		dependencies = {
-- 			"nvim-lua/plenary.nvim",
-- 			"nvim-treesitter/nvim-treesitter",
-- 			"mfussenegger/nvim-dap", -- (optional) only if you use `gopher.dap`
-- 		},
-- 		config = function()
-- 			require("gopher").setup({
-- 				gotag = {
-- 					transform = "camelcase",
-- 				},
-- 			})
-- 		end,
-- 		-- (optional) will update plugin's deps on every update
-- 		build = function()
-- 			vim.cmd.GoInstallDeps()
-- 		end,
-- 		---@type gopher.Config
-- 		opts = {},
-- 	},
-- }
