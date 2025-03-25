function Format_hunks()
	local ignore_filetypes = { "lua" }
	local format = require("conform").format

	if vim.tbl_contains(ignore_filetypes, vim.bo.filetype) then
		vim.notify("formatting entire file", vim.log.levels.INFO, { title = "Shelly Conform" })

		format({ async = false, lsp_fallback = true })
		return
	end

	local hunks = require("gitsigns").get_hunks()
	if hunks == nil then
		return
	end

	local function format_range()
		if next(hunks) == nil then
			-- vim.notify("done formatting git hunks", "info", { title = "formatting" })
			return
		end
		local hunk = nil
		while next(hunks) ~= nil and (hunk == nil or hunk.type == "delete") do
			hunk = table.remove(hunks)
		end

		if hunk ~= nil and hunk.type ~= "delete" then
			local start = hunk.added.start
			local last = start + hunk.added.count
			-- nvim_buf_get_lines uses zero-based indexing -> subtract from last
			local last_hunk_line = vim.api.nvim_buf_get_lines(0, last - 2, last - 1, true)[1]
			local range = { start = { start, 0 }, ["end"] = { last - 1, last_hunk_line:len() } }
			format({ range = range, async = false, lsp_fallback = true }, function()
				format_range()
			end)
		end
	end

	format_range()
	vim.api.nvim_command("silent write")
end

return {
	"stevearc/conform.nvim",
	lazy = false,
	config = function()
		local conform = require("conform")

		conform.setup({
			formatters_by_ft = {
				javascript = { "prettier" },
				typescript = { "eslint" },
				javascriptreact = { "prettier" },
				typescriptreact = { "prettier" },
				vue = { "prettier" },
				svelte = { "prettier" },
				css = { "prettier" },
				html = { "prettier" },
				json = { "prettier" },
				yaml = { "prettier" },
				markdown = { "prettier" },
				graphql = { "prettier" },
				sh = { "shfmt" },
				bash = { "shfmt" },
				zsh = { "shfmt" },
				lua = { "stylua" },
				python = { "isort", "black" },
				go = { "gofmt", "goimports" },
			},

			format_on_save = {
				timeout_ms = 1000,
				lsp_format = "fallback",
			},
		})

		-- vim.api.nvim_create_autocmd("BufWritePre", {
		-- 	pattern = "*",
		-- 	callback = function(args)
		-- 		format_hunks()
		-- 	end,
		-- })
		conform.formatters.shfmt = {
			prepend_args = { "-i", "4" },
		}
	end,
}
