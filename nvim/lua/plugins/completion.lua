vim.pack.add({
	{ src = "https://github.com/L3MON4D3/LuaSnip", version = vim.version.range("2") },
	"https://github.com/onsails/lspkind.nvim",
	{ src = "https://github.com/saghen/blink.cmp", version = vim.version.range("1") },
	"https://github.com/danymat/neogen",
})

require("blink.cmp").setup({
	fuzzy = { implementation = "prefer_rust_with_warning" },
	completion = {
		menu = {
			auto_show = function(ctx)
				return ctx.mode ~= "cmdline" or not vim.tbl_contains({ "/", "?" }, vim.fn.getcmdtype())
			end,
			border = "none",
			draw = {
				gap = 2,
				columns = { { "kind_icon" }, { "label", "label_description", gap = 1 } },
				components = {
					kind_icon = {
						text = function(ctx)
							local icon = ctx.kind_icon
							if ctx.item.source_name == "LSP" then
								local color_item = require("nvim-highlight-colors").format(
									ctx.item.documentation,
									{ kind = ctx.kind }
								)
								if color_item and color_item.abbr ~= "" then
									icon = color_item.abbr
								end
							end
							return icon .. ctx.icon_gap
						end,
						highlight = function(ctx)
							local highlight = "BlinkCmpKind" .. ctx.kind
							if ctx.item.source_name == "LSP" then
								local color_item = require("nvim-highlight-colors").format(
									ctx.item.documentation,
									{ kind = ctx.kind }
								)
								if color_item and color_item.abbr_hl_group then
									highlight = color_item.abbr_hl_group
								end
							end
							return highlight
						end,
					},
				},
			},
		},
		documentation = { auto_show = true, auto_show_delay_ms = 0, window = { border = "solid" } },
		list = { selection = { preselect = true, auto_insert = false } },
	},
	snippets = { preset = "luasnip" },
	cmdline = { enabled = false },
	sources = {
		default = { "lsp", "path", "snippets", "buffer" },
		providers = {
			snippets = { opts = { prefer_doc_trig = true } },
			path = {
				opts = {
					get_cwd = function()
						return vim.fn.getcwd()
					end,
				},
			},
		},
	},
	signature = {
		enabled = true,
		window = { border = "solid" },
		trigger = { show_on_insert = true },
	},
	keymap = {
		preset = "default",
		["<A-j>"] = { "select_next" },
		["<A-k>"] = { "select_prev" },
		["<A-l>"] = { "select_and_accept" },
		["<C-d>"] = { "show_documentation" },
		["<A-Tab>"] = {
			function()
				local copilot = require("copilot.suggestion")
				if copilot.is_visible() then
					copilot.accept()
				end
				return true
			end,
		},
		["<Tab>"] = {
			function(cmp)
				if cmp.snippet_active() then
					return cmp.accept()
				else
					return cmp.select_and_accept()
				end
			end,
			"snippet_forward",
			"fallback",
		},
		["<S-Tab>"] = { "snippet_backward", "fallback" },
	},
	opts_extend = { "sources.default" },
})

-- Neogen (automatic docstrings)
require("neogen").setup({})
vim.keymap.set("n", "<leader>ds", function()
	require("neogen").generate()
end, { desc = "Generate [D]oc[S]tring" })
