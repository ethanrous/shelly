local util = require("util")

local function set_global_keymaps(client, bufnr)
	-- Restart LSP
	util.set_keymap({
		key = "<leader>lr",
		cmd = ":LspRestart<CR>",
		desc = "Restart LSP server",
		bufnr = bufnr,
	})

	-- Go to definition
	util.set_keymap({
		key = "gd",
		cmd = require("telescope.builtin").lsp_definitions,
		desc = "Go to definition",
		bufnr = bufnr,
	})

	-- Go to type definition
	util.set_keymap({
		key = "gt",
		cmd = ":Telescope lsp_type_definitions<CR>",
		desc = "Go to type definition",
		bufnr = bufnr,
	})

	if client:supports_method("textDocument/declaration") then
		-- Go to declaration
		util.set_keymap({
			key = "gD",
			cmd = vim.lsp.buf.declaration,
			desc = "Go to declaration",
			bufnr = bufnr,
		})
	end

	-- Float diagnostics
	util.set_keymap({
		key = "<leader>D",
		cmd = ":Telescope diagnostics bufnr=0<CR>",
		desc = "Show diagnostics for current buffer",
		bufnr = bufnr,
	})

	-- Show hover information
	util.set_keymap({
		key = "gh",
		cmd = vim.lsp.buf.hover,
		desc = "Show hover information",
		bufnr = bufnr,
	})

	-- Go to implementation
	util.set_keymap({
		key = "gi",
		cmd = ":Telescope lsp_implementations<CR>",
		desc = "Go to implementation",
		bufnr = bufnr,
	})

	-- Show signature help
	util.set_keymap({
		key = "<C-k>",
		cmd = vim.lsp.buf.signature_help,
		desc = "Show signature help",
		bufnr = bufnr,
	})

	-- Rename symbol
	util.set_keymap({
		key = "<leader>r",
		cmd = vim.lsp.buf.rename,
		desc = "Rename symbol",
		bufnr = bufnr,
	})

	-- Code actions
	util.set_keymap({
		key = "<leader>ca",
		cmd = vim.lsp.buf.code_action,
		desc = "Show code actions",
		bufnr = bufnr,
	})

	-- Go to references
	util.set_keymap({
		key = "gr",
		cmd = ":Telescope lsp_references<CR>",
		desc = "Go to references",
		bufnr = bufnr,
	})

	-- Show line diagnostics in a floating window
	util.set_keymap({
		key = "<leader>ld",
		cmd = vim.diagnostic.open_float,
		desc = "Show line diagnostics",
		bufnr = bufnr,
	})

	-- Go to previous diagnostic
	util.set_keymap({
		key = "[d",
		cmd = function()
			vim.diagnostic.jump({ count = -1 })
		end,
		desc = "Go to previous diagnostic",
		bufnr = bufnr,
	})

	-- Go to next diagnostic
	util.set_keymap({
		key = "]d",
		cmd = function()
			vim.diagnostic.jump({ count = 1 })
		end,
		desc = "Go to next diagnostic",
		bufnr = bufnr,
	})

	-- Format document
	util.set_keymap({
		key = "<leader>fa",
		cmd = function()
			vim.lsp.buf.format({ async = true })
		end,
		desc = "Format document",
		bufnr = bufnr,
	})
end

local function configure_diagnostics()
	vim.diagnostic.config({
		virtual_text = { current_line = true },
		underline = true,
		update_in_insert = true,
		severity_sort = true,
		signs = {
			text = {
				[vim.diagnostic.severity.ERROR] = "",
				[vim.diagnostic.severity.WARN] = "",
				[vim.diagnostic.severity.INFO] = "",
				[vim.diagnostic.severity.HINT] = "",
			},
		},
		float = {
			border = "rounded",
			source = "if_many",
		},
	})
end

vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("global.lsp", { clear = true }),
	callback = function(args)
		local client = assert(vim.lsp.get_client_by_id(args.data.client_id))
		local bufnr = args.buf

		set_global_keymaps(client, bufnr)
		configure_diagnostics()
	end,
})

-- vim.lsp.config("*", {
-- 	capabilities = require("cmp_nvim_lsp").default_capabilities(),
-- })
