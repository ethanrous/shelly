local ts_config = require("util.lsp.typescript")
require("util.string")

local vue_plugin = ts_config.get_vue_plugin()

local js_ts_config = {
	updateImportsOnFileMove = { enabled = "always" },
	suggest = {
		completeFunctionCalls = true,
	},
	inlayHints = {
		enumMemberValues = { enabled = true },
		functionLikeReturnTypes = { enabled = true },
		parameterNames = { enabled = "all" },
		parameterTypes = { enabled = true },
		propertyDeclarationTypes = { enabled = true },
		variableTypes = { enabled = false },
	},
	tsserver = {
		maxTsServerMemory = 8192,
	},
}

vim.lsp.config.ts_ls = {
	cmd = { "typescript-language-server", "--stdio" },
	filetypes = {
		"javascript",
		"javascriptreact",
		"javascript.jsx",
		"typescript",
		"typescriptreact",
		"typescript.tsx",
		"vue",
	},
	root_markers = { "tsconfig.json", "jsconfig.json", "package.json", ".git" },

	init_options = {
		plugins = {
			vue_plugin,
		},
	},
	settings = {
		typescript = {
			inlayHints = {
				includeInlayParameterNameHints = "all",
				includeInlayParameterNameHintsWhenArgumentMatchesName = true,
				includeInlayFunctionParameterTypeHints = true,
				includeInlayVariableTypeHints = true,
				includeInlayVariableTypeHintsWhenTypeMatchesName = true,
				includeInlayPropertyDeclarationTypeHints = true,
				includeInlayFunctionLikeReturnTypeHints = true,
				includeInlayEnumMemberValueHints = true,
			},
		},
	},
}

local filetypes = {
	"javascript",
	"javascriptreact",
	"javascript.jsx",
	"typescript",
	"typescriptreact",
	"typescript.tsx",
	"vue",
}

vim.lsp.config.vtsls = {
	handlers = ts_config.handlers,
	enabled = ts_config.server_to_use == "vtsls",
	filetypes = ts_config.filetypes,
	settings = {
		complete_function_calls = true,
		vtsls = {
			enableMoveToFileCodeAction = true,
			autoUseWorkspaceTsdk = true,
			experimental = {
				completion = {
					enableServerSideFuzzyMatch = true,
				},
			},
			tsserver = {
				globalPlugins = {
					vue_plugin,
				},
			},
		},
		typescript = ts_config.vtsls_typescript_javascript_config,
		javascript = ts_config.vtsls_typescript_javascript_config,
	},
	on_attach = ts_config.on_attach,
}

local function get_clients(opts)
	local ret = vim.lsp.get_clients(opts)
	return opts and opts.filter and vim.tbl_filter(opts.filter, ret) or ret
end

vim.lsp.config.vue_ls = {
	before_init = function(_, config)
		-- This replaces nvim-lspconfig's before_init by also looking for typescript that is bundled with the package
		-- via Mason
		local typescript = require("mason-lspconfig.typescript")
		local install_dir = vim.fn.expand("$MASON/packages/vue-language-server")

		config.init_options.typescript.serverPath = typescript.resolve_tsserver(install_dir, config.root_dir)
		config.init_options.typescript.tsdk = typescript.resolve_tsdk(install_dir, config.root_dir)
	end,
	init_options = {
		vue = {
			hybridMode = true,
		},
		typescript = {
			tsserverRequestCommand = "tsserverRequest",
		},
	},
	on_init = function(client)
		client.handlers["tsserverRequest"] = function(_, result, context)
			local clients = get_clients({ bufnr = context.bufnr, name = ts_config.server_to_use })

			if #clients == 0 then
				return
			end
			local ts_client = clients[1]

			local params = {
				command = "typescript.tsserverRequest",
				-- First element is the arguments
				arguments = unpack(result),
			}

			local res = ts_client:request_sync("workspace/executeCommand", params)
			if res == nil or res.result == nil or res.err then
				return
			end
			return res.result.body
		end
	end,
	on_attach = function(client, _)
		client.server_capabilities.documentFormattingProvider = nil
	end,
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

-- TailwindCss
vim.lsp.config.tailwindcss = {
	-- cmd = { "tailwindcss-language-server", "--stdio" },
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
				css = "css",
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
	"vtsls",
	"vue_ls",
	"cssls",
	"tailwindcss",
	"htmlls",
	"eslint",
})

function Basename(String)
	local last = string.find(String, "/[^/]*$")
	if not last then
		return String
	end
	return string.sub(String, last + 1)
end

function FindVueFileReferences()
	local filename = vim.fn.expand("%:t")
	if not filename:endsWith(".vue") then
		return
	end

	filename = filename:gsub("%.vue$", "")

	local telescope = require("telescope")
	telescope.extensions.live_grep_args.live_grep_args({
		default_text = '"<' .. filename .. '" -g *.vue -g !' .. filename .. ".vue",
	})

	-- local bufnr = vim.api.nvim_get_current_buf()
	-- local uri = vim.uri_from_bufnr(bufnr)
	-- vim.lsp.buf_request(
	-- 	bufnr,
	-- 	"volar/client/findFileReference",
	-- 	{ textDocument = { uri = uri } },
	-- 	function(err, result, ctx, config)
	-- 		if err or result == nil then
	-- 			return
	-- 		else
	-- 			-- Convert the result to quickfix items
	-- 			local items = {}
	-- 			for _, ref in ipairs(result) do
	-- 				if Basename(ref.uri) == "components.d.ts" then
	-- 				else
	-- 					print(ref.uri)
	-- 					table.insert(items, {
	-- 						filename = vim.uri_to_fname(ref.uri),
	-- 						lnum = ref.range.start.line + 1,
	-- 						col = ref.range.start.character + 1,
	-- 						text = "Reference",
	-- 					})
	-- 				end
	-- 			end
	-- 			local pickers = require("telescope.pickers")
	-- 			local finders = require("telescope.finders")
	-- 			local conf = require("telescope.config").values
	--
	-- 			local opts = {}
	-- 			pickers
	-- 				.new(opts, {
	-- 					prompt_title = "Vue File References",
	-- 					results_title = "References",
	-- 					-- Use the items as the results
	-- 					finder = finders.new_table({
	-- 						results = items,
	-- 						entry_maker = function(entry)
	-- 							local ret = {
	-- 								value = entry,
	-- 								display = entry["filename"],
	-- 								ordinal = entry["filename"],
	-- 							}
	-- 							print("RET " .. vim.inspect(ret))
	-- 							return ret
	-- 						end,
	-- 					}),
	-- 					previewer = conf.qflist_previewer(opts),
	-- 					sorter = conf.generic_sorter(opts),
	-- 					push_cursor_on_edit = true,
	-- 					push_tagstack_on_edit = true,
	-- 					-- Use a custom function to open the file
	-- 					attach_mappings = function(_, map)
	-- 						map("i", "<CR>", function()
	-- 							local selection = require("telescope.actions.state").get_selected_entry()
	-- 							print(vim.inspect(selection[1]))
	-- 							if selection then
	-- 								vim.cmd("edit " .. selection[1])
	-- 								vim.fn.cursor(selection.lnum, selection.col)
	-- 							end
	-- 							return true
	-- 						end)
	-- 						return true
	-- 					end,
	-- 				})
	-- 				:find()
	-- 		end
	-- 	end
	-- )
end
