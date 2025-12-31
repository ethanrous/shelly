local keymap = require("util.keymap")

function FindVueFileReferences()
	local filename = vim.fn.expand("%:t")
	if not filename:endsWith(".vue") then
		return
	end

	filename = filename:gsub("%.vue$", "")

	local telescope = require("telescope")
	telescope.extensions.live_grep_args.live_grep_args({
		default_text = '"<' .. filename .. '" -g *.vue -g !' .. filename .. ".vue",
	})
end

local function configure_diagnostics(virtual_lines)
	local cfg = {
		virtual_text = {
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
			format = function(diagnostic)
				local message = diagnostic.message
				if diagnostic.source == "ts-plugin" or diagnostic.source == "ts" then
					message = message:gsub("type '(.-)'.?", "type \n\n%1\n\n")
				end
				return message
			end,
		},
		signs = {
			text = {
				[vim.diagnostic.severity.ERROR] = " ×",
				[vim.diagnostic.severity.WARN] = " ▲",
				[vim.diagnostic.severity.HINT] = " •",
				[vim.diagnostic.severity.INFO] = " •",
			},
		},
	}

	if virtual_lines then
		cfg.virtual_lines = {
			{ current_line = true },
		}
		cfg.virtual_text = false
	else
		cfg.virtual_lines = false
	end

	vim.diagnostic.config(cfg)
end

local function set_global_keymaps(client, bufnr)
	local lsp = vim.lsp
	local builtin = require("telescope.builtin")

	-- Restart LSP
	keymap.set({
		key = "<leader>lr",
		cmd = function()
			vim.lsp.stop_client(vim.lsp.get_clients())
			vim.cmd("edit")
		end,
		desc = "Restart LSP server",
		bufnr = bufnr,
	})

	-- Go to definition
	keymap.set({
		key = "gd",
		-- cmd = lsp.buf.definition,
		cmd = require("telescope.builtin").lsp_definitions,
		desc = "Go to definition",
		bufnr = bufnr,
	})

	-- Go to type definition
	keymap.set({
		key = "gt",
		cmd = require("telescope.builtin").lsp_type_definitions,
		desc = "Go to type definition",
		bufnr = bufnr,
	})

	-- Go to references
	keymap.set({
		key = "gr",
		cmd = require("telescope.builtin").lsp_references,
		desc = "Go to references",
		bufnr = bufnr,
	})

	-- Show all workspace symbols
	keymap.set({
		key = "<leader>gs",
		cmd = require("telescope.builtin").lsp_document_symbols,
		desc = "Go workspace symbols",
		bufnr = bufnr,
	})

	-- Go to vue component references
	keymap.set({
		key = "<leader>vr",
		cmd = FindVueFileReferences,
		desc = "Go to references",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>P",
		cmd = require("config.helpers.tag-jump").parent,
		desc = "Go to parent",
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
	-- keymap.set({
	-- 	key = "<leader>gP",
	-- 	cmd = function()
	-- 		for _, cur_client in ipairs(vim.lsp.get_clients({ bufnr = bufnr })) do
	-- 			require("workspace-diagnostics").populate_workspace_diagnostics(cur_client, bufnr)
	-- 		end
	-- 		vim.notify("INFO: Diagnostic populated")
	-- 	end,
	-- 	desc = "Populate diagnostics for whole workspace",
	-- 	bufnr = bufnr,
	-- })

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
	-- keymap.set({
	-- 	key = "<C-k>",
	-- 	cmd = vim.lsp.buf.signature_help,
	-- 	desc = "Show signature help",
	-- 	bufnr = bufnr,
	-- })

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

	-- Show line diagnostics in a floating window
	keymap.set({
		key = "<leader>ld",
		cmd = vim.diagnostic.open_float,
		desc = "Show line diagnostics",
		bufnr = bufnr,
	})

	keymap.set({
		key = "<leader>lv",
		cmd = function()
			local config = vim.diagnostic.config()
			if config == nil then
				configure_diagnostics(false)
				return
			end

			print(vim.inspect(config))
			local new_virtual_lines = not config.virtual_lines
			print("Setting virtual_lines to " .. tostring(new_virtual_lines))
			configure_diagnostics(new_virtual_lines)
		end,
		desc = "Toggle virtual lines for diagnostics",
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
end

vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("lsp", { clear = true }),
	callback = function(args)
		local client = assert(vim.lsp.get_client_by_id(args.data.client_id))
		local bufnr = args.buf

		set_global_keymaps(client, bufnr)
		configure_diagnostics(true)
	end,
})
