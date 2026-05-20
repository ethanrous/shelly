vim.pack.add({ "https://github.com/stevearc/conform.nvim" })

local conform = require("conform")

local eslint_path_prefixes = {
	vim.fn.expand("~/repos/newton/"),
}

local function file_matches_prefix(path, prefixes)
	for _, prefix in ipairs(prefixes) do
		if path:sub(1, #prefix) == prefix then
			return true
		end
	end
	return false
end

local function js_formatters(bufnr)
	local path = vim.api.nvim_buf_get_name(bufnr)
	if file_matches_prefix(path, eslint_path_prefixes) then
		return { "eslint" }
	end
	return { "prettier" }
end

conform.setup({
	log_level = vim.log.levels.DEBUG,
	formatters = {
		xml = { command = "prettier", args = { "--plugin=@prettier/plugin-xml", "$FILENAME" } },
		templ = { command = "templ fmt" },
		ruff = { command = "ruff", args = { "format" } },
		eslint = {
			command = require("conform.util").from_node_modules("eslint"),
			args = { "--fix", "$FILENAME" },
			stdin = false,
			cwd = require("conform.util").root_file({
				".eslintrc",
				".eslintrc.js",
				".eslintrc.cjs",
				".eslintrc.json",
				".eslintrc.yaml",
				".eslintrc.yml",
				"eslint.config.js",
				"eslint.config.mjs",
				"eslint.config.cjs",
				"eslint.config.ts",
				"package.json",
			}),
		},
	},
	formatters_by_ft = {
		javascript = js_formatters,
		typescript = js_formatters,
		javascriptreact = js_formatters,
		typescriptreact = js_formatters,
		vue = js_formatters,
		svelte = js_formatters,
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
