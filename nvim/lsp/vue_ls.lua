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
end

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

local vue_language_server_path = vim.fn.stdpath("data")
	.. "/mason/packages/vue-language-server/node_modules/@vue/language-server"
local tsserver_filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" }
local vue_plugin = {
	name = "@vue/typescript-plugin",
	location = vue_language_server_path,
	languages = { "vue" },
	configNamespace = "typescript",
}
local vtsls_config = {
	cmd = { "vtsls", "--stdio" },
	root_markers = { "tsconfig.json", "package.json", "jsconfig.json", ".git" },
	settings = {
		vtsls = {
			tsserver = {
				globalPlugins = {
					vue_plugin,
				},
			},
		},
	},
	filetypes = tsserver_filetypes,
	-- on_init = function(client, bufnr)
	-- 	if vim.bo[bufnr].filetype == "vue" then
	-- 		client.server_capabilities.semanticTokensProvider = nil
	-- 	end
	-- end,
}

-- ETHAN. If you are looking for completion issues with Vue files, add:
--     if client.name == 'vtsls' then
--   if #response.items == 0 then
--     -- if no items returned, mark as incomplete to try again
--     response.is_incomplete_backward = true
--     response.is_incomplete_forward = true
--   end
-- end

-- at

-- ~/.local/share/nvim/lazy/blink.cmp/lua/blink/cmp/sources/lsp/completion.lua:109
-- if line number has moved, its the client hacks section in the get_completion_for_client function

-- If you are on most recent `nvim-lspconfig`
local vue_ls_config = {}

-- nvim 0.11 or above
vim.lsp.config.vtsls = vtsls_config
vim.lsp.config.vue_ls = vue_ls_config
