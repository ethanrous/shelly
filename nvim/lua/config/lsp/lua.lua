vim.lsp.config.lua_ls = {
	cmd = { "lua-language-server" },
	filetypes = { "lua" },
	root_markers = {
		".luarc.json",
		".git",
		vim.uv.cwd(),
	},
	settings = {
		Lua = {
			telemetry = {
				enable = false,
			},
		},
	},
}
vim.lsp.enable("lua_ls")
