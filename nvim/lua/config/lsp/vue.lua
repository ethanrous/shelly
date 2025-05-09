-- -- vim.lsp.config.volar = {
-- -- 	-- cmd = { "vls" },
-- -- 	-- filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" },
-- -- 	cmd = { "vue-language-server", "--stdio" },
-- -- 	filetypes = { "vue" },
-- -- 	root_markers = {
-- -- 		"package.json",
-- -- 		"vue.config.js",
-- -- 		"vue.config.ts",
-- -- 		".git",
-- -- 	},
-- -- 	init_options = {
-- -- 		typescript = {
-- -- 			-- tsdk = "/Users/erousseau/.local/share/nvim/mason/packages/vue-language-server/node_modules/typescript/lib",
-- -- 			tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
-- -- 		},
-- -- 		vue = {
-- -- 			hybridMode = false,
-- -- 		},
-- -- 		languageFeatures = {
-- -- 			implementation = true,
-- -- 			references = true,
-- -- 			definition = true,
-- -- 			typeDefinition = true,
-- -- 			callHierarchy = true,
-- -- 			hover = true,
-- -- 			rename = true,
-- -- 			renameFileRefactoring = true,
-- -- 			signatureHelp = true,
-- -- 			codeAction = true,
-- -- 			workspaceSymbol = true,
-- -- 			diagnostics = true,
-- -- 			semanticTokens = true,
-- -- 			completion = {
-- -- 				defaultTagNameCase = "both",
-- -- 				defaultAttrNameCase = "kebabCase",
-- -- 				getDocumentNameCasesRequest = false,
-- -- 				getDocumentSelectionRequest = false,
-- -- 			},
-- -- 		},
-- -- 	},
-- -- 	settings = {
-- -- 		typescript = {
-- -- 			inlayHints = {
-- -- 				enumMemberValues = {
-- -- 					enabled = true,
-- -- 				},
-- -- 				functionLikeReturnTypes = {
-- -- 					enabled = true,
-- -- 				},
-- -- 				propertyDeclarationTypes = {
-- -- 					enabled = true,
-- -- 				},
-- -- 				parameterTypes = {
-- -- 					enabled = true,
-- -- 					suppressWhenArgumentMatchesName = true,
-- -- 				},
-- -- 				variableTypes = {
-- -- 					enabled = true,
-- -- 				},
-- -- 			},
-- -- 		},
-- -- 	},
-- -- }
-- -- vim.lsp.enable("volar")
--
-- -- vim.lsp.config.vuels = {}
-- -- vim.lsp.enable("vuels")
--
-- -- vim.lsp.config.vuels = {
-- -- 	init_options = {
-- -- 		vue = {
-- -- 			hybridMode = false,
-- -- 		},
-- -- 	},
-- -- }
-- -- vim.lsp.enable("volar")
-- local lspconfig = require("lspconfig")
-- -- local on_attach = require("plugins.configs.lspconfig").on_attach
-- -- local capabilities = require("plugins.configs.lspconfig").capabilities
--
-- lspconfig.ts_ls.setup({
-- 	-- on_attach = on_attach,
-- 	-- capabilities = capabilities,
-- 	init_options = {
-- 		plugins = { -- I think this was my breakthrough that made it work
-- 			{
-- 				name = "@vue/typescript-plugin",
-- 				location = "/usr/local/lib/node_modules/@vue/language-server",
-- 				languages = { "vue" },
-- 			},
-- 		},
-- 	},
-- 	filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" },
-- })
-- lspconfig.volar.setup({
-- 	cmd = { "pnpm", "vue-language-server", "--stdio" },
-- 	init_options = {
-- 		typescript = {
-- 			-- tsdk = "/Users/erousseau/.local/share/nvim/mason/packages/vue-language-server/node_modules/typescript/lib",
-- 			tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
-- 		},
-- 		vue = {
-- 			hybridMode = false,
-- 		},
-- 	},
-- })
-- local servers = { "html", "cssls", "eslint" }
--
-- for _, lsp in ipairs(servers) do
-- 	lspconfig[lsp].setup({
-- 		-- on_attach = on_attach,
-- 		-- capabilities = capabilities,
-- 	})
-- end
--
-- -- vim.lsp.config.vtsls = {
-- -- 	filetypes = {
-- -- 		"javascript",
-- -- 		"javascriptreact",
-- -- 		"javascript.jsx",
-- -- 		"typescript",
-- -- 		"typescriptreact",
-- -- 		"typescript.tsx",
-- -- 	},
-- -- 	cmd = { "vtsls", "--stdio" },
-- -- }
-- -- vim.lsp.enable("vtsls")
--
-- -- vim.lsp.enable("volar")
-- -- vim.lsp.enable("tailwindcss")
-- --

vim.lsp.config.ts_ls = {
	cmd = { "typescript-language-server", "--stdio" },
	filetypes = {
		"javascript",
		"javascriptreact",
		"javascript.jsx",
		"typescript",
		"typescriptreact",
		"typescript.tsx",
	},
	root_markers = { "tsconfig.json", "jsconfig.json", "package.json", ".git" },

	init_options = {
		hostInfo = "neovim",
	},
}
-- }}}

-- Volar {{{
vim.lsp.config.volar = {
	filetypes = { "typescript", "javascript", "vue" },
	init_options = {
		typescript = {
			tsdk = "/Users/erousseau/.local/share/nvim/mason/packages/vue-language-server/node_modules/typescript/lib",
			-- tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
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
}

-- CSSls {{{
vim.lsp.config.cssls = {
	cmd = { "vscode-css-language-server", "--stdio" },
	filetypes = { "css", "scss" },
	root_markers = { "package.json", ".git" },
	init_options = {
		provideFormatter = true,
	},
}
-- }}}

-- TailwindCss {{{
vim.lsp.config.tailwindcssls = {
	cmd = { "tailwindcss-language-server", "--stdio" },
	filetypes = {
		"ejs",
		"html",
		"css",
		"scss",
		"javascript",
		"javascriptreact",
		"typescript",
		"typescriptreact",
		"vue",
	},
	root_markers = {
		"tailwind.config.js",
		"tailwind.config.cjs",
		"tailwind.config.mjs",
		"tailwind.config.ts",
		"postcss.config.js",
		"postcss.config.cjs",
		"postcss.config.mjs",
		"postcss.config.ts",
		"package.json",
		"node_modules",
	},
	settings = {
		tailwindCSS = {
			classAttributes = { "class", "className", "class:list", "classList", "ngClass" },
			includeLanguages = {
				eelixir = "html-eex",
				eruby = "erb",
				htmlangular = "html",
				templ = "html",
			},
			lint = {
				cssConflict = "warning",
				invalidApply = "error",
				invalidConfigPath = "error",
				invalidScreen = "error",
				invalidTailwindDirective = "error",
				invalidVariant = "error",
				recommendedVariantOrder = "warning",
			},
			validate = true,
		},
	},
}
-- }}}

-- HTML {{{
vim.lsp.config.htmlls = {
	cmd = { "vscode-html-language-server", "--stdio" },
	filetypes = { "html" },
	root_markers = { "package.json", ".git" },

	init_options = {
		configurationSection = { "html", "css", "javascript" },
		embeddedLanguages = {
			css = true,
			javascript = true,
		},
		provideFormatter = true,
	},
}
-- }}}

vim.lsp.enable({
	-- "ts_ls",
	"cssls",
	"tailwindcssls",
	"htmlls",
	"eslint",
	"volar",
})
