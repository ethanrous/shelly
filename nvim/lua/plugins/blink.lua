return {
	-- symbol_map = {
	-- 	Copilot = " ",
	-- 	Class = "󰆧 ",
	-- 	Color = "󰏘 ",
	-- 	Constant = "󰏿 ",
	-- 	Constructor = " ",
	-- 	Enum = " ",
	-- 	EnumMember = " ",
	-- 	Event = "",
	-- 	Field = " ",
	-- 	File = "󰈙 ",
	-- 	Folder = "󰉋 ",
	-- 	Function = "󰊕 ",
	-- 	Interface = " ",
	-- 	Keyword = "󰌋 ",
	-- 	Method = "󰊕 ",
	-- 	Module = " ",
	-- 	Operator = "󰆕 ",
	-- 	Property = " ",
	-- 	Reference = "󰈇 ",
	-- 	Snippet = " ",
	-- 	Struct = "󰆼 ",
	-- 	Text = "󰉿 ",
	-- 	TypeParameter = "󰉿 ",
	-- 	Unit = "󰑭",
	-- 	Value = "󰎠 ",
	-- 	Variable = "󰀫 ",
	-- },
	{
		"L3MON4D3/LuaSnip",
		-- follow latest release.
		version = "v2.*", -- Replace <CurrentMajor> by the latest released major (first number of latest release)
		-- install jsregexp (optional!).
		build = "make install_jsregexp",
		config = function()
			-- Load my snippets
			-- snip_loader.lazy_load()
			-- require("luasnip.loaders.from_lua").load({ paths = "~/shelly/nvim/snippets/" })
			require("../config.snippets")

			-- Im 100% sure this is bad, and it can be achieved in a better way
			-- but i couldn't find the proper way.
		end,
	},
	{
		"saghen/blink.cmp",
		lazy = false,
		version = "*",
		dependencies = {
			-- Autocompletion
			"onsails/lspkind.nvim",
			-- "rafamadriz/friendly-snippets",
			"Kaiser-Yang/blink-cmp-avante",
		},
		opts = {
			completion = {
				menu = {
					auto_show = function(ctx)
						return ctx.mode ~= "cmdline" or not vim.tbl_contains({ "/", "?" }, vim.fn.getcmdtype())
					end,
					border = "single",
					draw = {
						gap = 2,
						columns = { { "kind_icon" }, { "label", "label_description", gap = 1 } },
						components = {
							-- customize the drawing of kind icons
							kind_icon = {
								text = function(ctx)
									-- default kind icon
									local icon = ctx.kind_icon
									-- if LSP source, check for color derived from documentation
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
									-- default highlight group
									local highlight = "BlinkCmpKind" .. ctx.kind
									-- if LSP source, check for color derived from documentation
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
				documentation = { auto_show = true, auto_show_delay_ms = 0, window = { border = "single" } },
				list = { selection = { preselect = true, auto_insert = false } },
			},
			snippets = { preset = "luasnip" },
			cmdline = { enabled = false },
			sources = {
				default = { "avante", "lsp", "path", "snippets", "buffer" },
				providers = {
					avante = {
						module = "blink-cmp-avante",
						name = "Avante",
						opts = {
							-- options for blink-cmp-avante
						},
					},
				},
			},

			signature = {
				enabled = true,
				window = { border = "single" },
				trigger = {
					show_on_insert = true,
				},
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
		},
	},

	-- Automatic docstrings
	{
		"danymat/neogen",
		dependencies = "nvim-treesitter/nvim-treesitter",
		config = true,
		keys = {
			{
				"<leader>ds",
				function()
					require("neogen").generate()
				end,
				desc = "Generate [D]oc[S]tring",
			},
		},
	},
}
