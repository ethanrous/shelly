-- from https://github.com/RayGuo-ergou/dotfiles/blob/main/nvim/lua/ergou/util/init.lua

---@class ethanrous.util.lsp
---@field public typescript ethanrous.util.lsp.typescript
---@field public eslint ethanrous.util.lsp.eslint
---@field public cspell ethanrous.util.lsp.cspell
---@field public tsformat ethanrous.util.lsp.tsformat
---@field public servers ethanrous.util.lsp.servers
local M = {}

---@class LspClientFilterOpts: vim.lsp.get_clients.Filter
---@field public filter fun(client: vim.lsp.Client):boolean

setmetatable(M, {
	__index = function(t, k)
		---@diagnostic disable-next-line: no-unknown
		t[k] = require("ethanrous.util.lsp." .. k)
		return t[k]
	end,
})

M.action = setmetatable({}, {
	__index = function(_, action)
		return function()
			vim.lsp.buf.code_action({
				apply = true,
				context = {
					only = { action },
					diagnostics = {},
				},
			})
		end
	end,
})

---@param opts? LspClientFilterOpts
function M.get_clients(opts)
	local ret = vim.lsp.get_clients(opts)
	return opts and opts.filter and vim.tbl_filter(opts.filter, ret) or ret
end

local function config_servers()
	local servers = ethanrous.lsp.servers.get()
	local native_servers = ethanrous.lsp.servers.get_native()
	local capabilities = vim.lsp.protocol.make_client_capabilities()
	-- TODO: check cmp exist
	capabilities = vim.tbl_deep_extend("force", capabilities, require("cmp_nvim_lsp").default_capabilities())

	for server_name, server in pairs(servers) do
		server.capabilities = vim.tbl_deep_extend("force", {}, capabilities, server.capabilities or {})
		vim.lsp.config(server_name, server)
	end

	for server_name, server in pairs(native_servers) do
		-- Disable entirely if not enabled
		if server.enabled ~= false then
			server.capabilities = vim.tbl_deep_extend("force", {}, capabilities, server.capabilities or {})
			vim.lsp.config(server_name, server)
			vim.lsp.enable(server_name)
		end
	end
end

function M.setup()
	config_servers()
	vim.api.nvim_create_autocmd("LspAttach", {
		group = vim.api.nvim_create_augroup("lsp-attach", { clear = true }),
		callback = function(event)
			local bufnr = event.buf
			local client = vim.lsp.get_client_by_id(event.data.client_id)

			if not client then
				return
			end

			local client_name = client.name
			local file_type = vim.bo[bufnr].filetype
			if
				not (file_type == "vue" and vim.list_contains(M.typescript.servers, client_name))
				and client:supports_method("textDocument/documentSymbol")
			then
				require("nvim-navic").attach(client, bufnr)
			end

			if client:supports_method("textDocument/inlayHint") and vim.g.auto_inlay_hint then
				vim.lsp.inlay_hint.enable()
			end

			---@see doc :h vim.lsp.document_color
			if client:supports_method("textDocument/documentColor") then
				vim.lsp.document_color.enable(true, bufnr, {
					style = "virtual",
				})
			end
		end,
	})
end

return M
