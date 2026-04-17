local vue_language_server_path = vim.fn.exepath("vue-language-server")
if vue_language_server_path ~= "" then
	vue_language_server_path = vim.fn.resolve(vue_language_server_path)
	-- Navigate from the binary up to the package's node_modules/@vue/language-server
	vue_language_server_path = vim.fn.fnamemodify(vue_language_server_path, ":h:h")
end
local tsserver_filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" }
local vue_plugin = {
	name = "@vue/typescript-plugin",
	location = vue_language_server_path,
	languages = { "vue" },
	configNamespace = "typescript",
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

---@type vim.lsp.Config
return {
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
}
