local keymap = require("util.keymap")

local function set_global_keymaps(client, bufnr)
	local lsp = vim.lsp

	-- Restart LSP
	keymap.set({
		key = "<leader>lr",
		cmd = ":LspRestart<CR>",
		desc = "Restart LSP server",
		bufnr = bufnr,
	})

	-- Go to definition
	keymap.set({
		key = "gd",
		cmd = lsp.buf.definition,
		desc = "Go to definition",
		bufnr = bufnr,
	})

	-- Go to type definition
	keymap.set({
		key = "gt",
		cmd = lsp.buf.type_definition,
		desc = "Go to type definition",
		bufnr = bufnr,
	})

	if client:supports_method("textDocument/declaration") then
		-- Go to declaration
		keymap.set({
			key = "gD",
			cmd = vim.lsp.buf.declaration,
			desc = "Go to declaration",
			bufnr = bufnr,
		})
	end

	-- Float diagnostics
	keymap.set({
		key = "<leader>D",
		cmd = ":Telescope diagnostics bufnr=0<CR>",
		desc = "Show diagnostics for current buffer",
		bufnr = bufnr,
	})

	-- Populate diagnostics for whole workspace
	keymap.set({
		key = "<leader>gP",
		cmd = function()
			for _, cur_client in ipairs(vim.lsp.get_clients({ bufnr = bufnr })) do
				require("workspace-diagnostics").populate_workspace_diagnostics(cur_client, bufnr)
			end
			vim.notify("INFO: Diagnostic populated")
		end,
		desc = "Populate diagnostics for whole workspace",
		bufnr = bufnr,
	})

	-- Show hover information
	keymap.set({
		key = "gh",
		cmd = vim.lsp.buf.hover,
		desc = "Show hover information",
		bufnr = bufnr,
	})

	-- Go to implementation
	keymap.set({
		key = "gi",
		cmd = ":Telescope lsp_implementations<CR>",
		desc = "Go to implementation",
		bufnr = bufnr,
	})

	-- Show signature help
	keymap.set({
		key = "<C-k>",
		cmd = vim.lsp.buf.signature_help,
		desc = "Show signature help",
		bufnr = bufnr,
	})

	-- Rename symbol
	keymap.set({
		key = "<leader>r",
		cmd = vim.lsp.buf.rename,
		desc = "Rename symbol",
		bufnr = bufnr,
	})

	-- Code actions
	keymap.set({
		key = "<leader>ca",
		cmd = vim.lsp.buf.code_action,
		desc = "Show code actions",
		bufnr = bufnr,
	})

	-- Go to references
	keymap.set({
		key = "gr",
		cmd = ":Telescope lsp_references<CR>",
		desc = "Go to references",
		bufnr = bufnr,
	})

	-- Show line diagnostics in a floating window
	keymap.set({
		key = "<leader>ld",
		cmd = vim.diagnostic.open_float,
		desc = "Show line diagnostics",
		bufnr = bufnr,
	})

	-- Go to previous diagnostic
	keymap.set({
		key = "gE",
		cmd = function()
			vim.diagnostic.jump({ count = -1 })
		end,
		desc = "Go to previous diagnostic",
		bufnr = bufnr,
	})

	-- Go to next diagnostic
	keymap.set({
		key = "ge",
		cmd = function()
			vim.diagnostic.jump({ count = 1 })
		end,
		desc = "Go to next diagnostic",
		bufnr = bufnr,
	})

	-- Format document
	keymap.set({
		key = "<leader>fa",
		cmd = function()
			vim.lsp.buf.format({ async = true })
		end,
		desc = "Format document",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>li",
		cmd = function()
			vim.cmd("checkhealth vim.lsp")
		end,
		desc = "Check health of LSP",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>lh",
		cmd = function()
			lsp.inlay_hint.enable(not lsp.inlay_hint.is_enabled({}))
		end,
		desc = "Check health of LSP",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>gt",
		cmd = ":Neotree<CR>",
		desc = "Open NeoTree",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>gs",
		cmd = ":Neotree document_symbols<CR>",
		desc = "Open NeoTree document_symbols",
		bufnr = bufnr,
	})
end

local function configure_diagnostics()
	vim.diagnostic.config({
		virtual_text = {
			enabled = true,
			prefix = function(diagnostic)
				if diagnostic.severity == vim.diagnostic.severity.ERROR then
					return "│×"
				elseif diagnostic.severity == vim.diagnostic.severity.WARN then
					return "│▲"
				else
					return "│•"
				end
			end,
			suffix = "│",
		},
		underline = true,
		update_in_insert = true, -- Update diagnostics in insert mode
		severity_sort = true, -- Sort by severity
		float = {
			border = "single", -- Match your diagnostic_float_opts style
			source = "if_many", -- Show source of diagnostic
		},
		signs = {
			text = {
				[vim.diagnostic.severity.ERROR] = " ×",
				[vim.diagnostic.severity.WARN] = " ▲",
				[vim.diagnostic.severity.HINT] = " •",
				[vim.diagnostic.severity.INFO] = " •",
			},
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
