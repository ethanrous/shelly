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
local vue_ls_config = {
	cmd = { "vue-language-server", "--stdio" },
	filetypes = { "vue" },
	root_markers = { "package.json" },
	on_init = function(client)
		local retries = 0

		---@param _ lsp.ResponseError
		---@param result any
		---@param context lsp.HandlerContext
		local function typescriptHandler(_, result, context)
			local ts_client = vim.lsp.get_clients({ bufnr = context.bufnr, name = "ts_ls" })[1]
				or vim.lsp.get_clients({ bufnr = context.bufnr, name = "vtsls" })[1]
				or vim.lsp.get_clients({ bufnr = context.bufnr, name = "typescript-tools" })[1]

			if not ts_client then
				-- there can sometimes be a short delay until `ts_ls`/`vtsls` are attached so we retry for a few times until it is ready
				if retries <= 10 then
					retries = retries + 1
					vim.defer_fn(function()
						typescriptHandler(_, result, context)
					end, 100)
				else
					vim.notify(
						"Could not find `ts_ls`, `vtsls`, or `typescript-tools` lsp client required by `vue_ls`.",
						vim.log.levels.ERROR
					)
				end
				return
			end

			local param = unpack(result)
			local id, command, payload = unpack(param)
			ts_client:exec_cmd({
				title = "vue_request_forward", -- You can give title anything as it's used to represent a command in the UI, `:h Client:exec_cmd`
				command = "typescript.tsserverRequest",
				arguments = {
					command,
					payload,
				},
			}, { bufnr = context.bufnr }, function(_, r)
				local response_data = { { id, r and r.body } }
				---@diagnostic disable-next-line: param-type-mismatch
				client:notify("tsserver/response", response_data)
			end)
		end

		client.handlers["tsserver/request"] = typescriptHandler
	end,
}

-- nvim 0.11 or above
vim.lsp.config.vtsls = vtsls_config
vim.lsp.config.vue_ls = vue_ls_config
