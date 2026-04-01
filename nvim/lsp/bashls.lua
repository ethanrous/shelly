---@brief
---
--- https://github.com/bash-lsp/bash-language-server
---
--- `bash-language-server` can be installed via `npm`:
--- ```sh
--- npm i -g bash-language-server
--- ```
---
--- Language server for bash, written using tree sitter in typescript.

---@type vim.lsp.Config
return {
	cmd = { "bash-language-server", "start" },
	settings = {
		bashIde = {
			-- Glob pattern for finding and parsing shell script files in the workspace.
			-- Used by the background analysis features across files.

			-- Prevent recursive scanning which will cause issues when opening a file
			-- directly in the home directory (e.g. ~/foo.sh).
			--
			-- Default upstream pattern is "**/*@(.sh|.inc|.bash|.command)".
			globPattern = vim.env.GLOB_PATTERN or "*@(.sh|.inc|.bash|.command)",
		},
	},
	filetypes = { "bash", "sh" },
	root_markers = { ".git" },

	-- Stop the language server from starting for certain filetypes (env files)
	on_attach = function(client, bufnr)
		local exclude_filetypes = { "env" }
		local ft = vim.api.nvim_buf_get_name(bufnr)
		if ft:match(".*.env") then
			ft = "env"
		end

		for _, excluded in ipairs(exclude_filetypes) do
			if ft == excluded then
				client:stop()
				return
			end
		end
	end,
}
