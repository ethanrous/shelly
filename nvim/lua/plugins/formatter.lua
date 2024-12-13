return {
	"stevearc/conform.nvim",
	lazy = false,
	config = function()
		local conform = require("conform")

		conform.setup({
			formatters_by_ft = {
				javascript = { "prettier" },
				typescript = { "prettier" },
				javascriptreact = { "prettier" },
				typescriptreact = { "prettier" },
				svelte = { "prettier" },
				css = { "prettier" },
				html = { "prettier" },
				json = { "prettier" },
				yaml = { "prettier" },
				markdown = { "prettier" },
				graphql = { "prettier" },
				bash = { "shfmt" },
				zsh = { "shfmt" },
				lua = { "stylua" },
				python = { "isort", "black" },
				go = { "gofmt", "goimports" },
			},
			format_on_save = {
				lsp_format = "fallback",
				timeout_ms = 500,
			},
		})

		conform.formatters.shfmt = {
			prepend_args = { "-i", "4" },
		}
	end,
}
