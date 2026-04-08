vim.pack.add({ "https://github.com/stevearc/conform.nvim" })

local conform = require("conform")

conform.setup({
	log_level = vim.log.levels.DEBUG,
	formatters = {
		xml = { command = "prettier", args = { "--plugin=@prettier/plugin-xml", "$FILENAME" } },
		templ = { command = "templ fmt" },
		ruff = { command = "ruff", args = { "format" } },
	},
	formatters_by_ft = {
		javascript = { "prettier" },
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
		python = { "ruff_fix", "ruff_format" },
		go = { "gofmt", "goimports" },
		java = {},
	},
	format_after_save = {
		timeout_ms = 5000,
		lsp_format = "fallback",
		async = true,
	},
})

conform.formatters.shfmt = {
	prepend_args = { "-i", "4" },
}
