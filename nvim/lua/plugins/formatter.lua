return {
	"stevearc/conform.nvim",
	lazy = false,
	config = function()
		local conform = require("conform")

		conform.setup({
			log_level = vim.log.levels.DEBUG,
			formatters = {
				xml = { command = "prettier", args = { "--plugin=@prettier/plugin-xml", "$FILENAME" } },
				templ = { command = "templ fmt" },
			},
			formatters_by_ft = {
				javascript = { "prettier" },
				-- typescript = { "eslint_d", "prettier", stop_after_first = true },
				typescript = { "prettier" },
				javascriptreact = { "prettier" },
				typescriptreact = { "prettier" },
				vue = { "prettier" },
				svelte = { "prettier" },
				css = { "prettier" },
				xml = { "xml" },
				html = { "prettier" },
				tmpl = { "templ" },
				htmlangular = { "prettier" },
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
				java = {},
			},

			-- format_on_save = {
			-- 	timeout_ms = 50000,
			-- 	lsp_format = "fallback",
			-- 	async = true,
			-- },
			format_after_save = {
				timeout_ms = 5000,
				lsp_format = "fallback",
				async = true,
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
