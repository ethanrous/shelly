return {
	-- Autocompletion
	-- {
	-- 	"hrsh7th/nvim-cmp",
	-- 	lazy = false,
	-- 	config = function()
	-- 		require("luasnip.loaders.from_vscode").lazy_load()
	-- 		local luasnip = require("luasnip")
	-- 		local cmp = require("cmp")
	--
	-- 		local copilot = require("copilot.suggestion")
	-- 		vim.g.copilot_no_tab_map = true
	--
	-- 		local lspkind = require("lspkind")
	-- 		local formatting = {
	-- 			-- Taken from stevearc
	-- 			format = lspkind.cmp_format({
	-- 				mode = "symbol",
	-- 				symbol_map = {
	-- 					Copilot = " ",
	-- 					Class = "󰆧 ",
	-- 					Color = "󰏘 ",
	-- 					Constant = "󰏿 ",
	-- 					Constructor = " ",
	-- 					Enum = " ",
	-- 					EnumMember = " ",
	-- 					Event = "",
	-- 					Field = " ",
	-- 					File = "󰈙 ",
	-- 					Folder = "󰉋 ",
	-- 					Function = "󰊕 ",
	-- 					Interface = " ",
	-- 					Keyword = "󰌋 ",
	-- 					Method = "󰊕 ",
	-- 					Module = " ",
	-- 					Operator = "󰆕 ",
	-- 					Property = " ",
	-- 					Reference = "󰈇 ",
	-- 					Snippet = " ",
	-- 					Struct = "󰆼 ",
	-- 					Text = "󰉿 ",
	-- 					TypeParameter = "󰉿 ",
	-- 					Unit = "󰑭",
	-- 					Value = "󰎠 ",
	-- 					Variable = "󰀫 ",
	-- 				},
	-- 				menu = {
	-- 					nvim_lsp = "[LSP]",
	-- 					luasnip = "[snip]",
	-- 					buffer = "[buf]",
	-- 					nvim_lua = "[api]",
	-- 					path = "[path]",
	-- 				},
	-- 			}),
	-- 		}
	--
	-- 		cmp.setup({
	-- 			preselect = cmp.PreselectMode.Item,
	-- 			formatting = formatting,
	-- 			completion = {
	-- 				completeopt = "menu,menuone,noinsert,preview",
	-- 			},
	-- 			snippet = {
	-- 				expand = function(args)
	-- 					require("luasnip").lsp_expand(args.body)
	-- 				end,
	-- 			},
	-- 			sources = {
	-- 				{ name = "nvim_lsp" },
	-- 				{ name = "luasnip" },
	-- 				{ name = "path" },
	-- 				{ name = "buffer" },
	-- 				{ name = "nvim_lsp_signature_help" },
	-- 			},
	-- 			mapping = {
	-- 				["<A-k>"] = cmp.mapping.select_prev_item({ behavior = cmp.SelectBehavior.Select }),
	-- 				["<A-j>"] = cmp.mapping.select_next_item({ behavior = cmp.SelectBehavior.Select }),
	-- 				["<A-Tab>"] = cmp.mapping(function(fallback)
	-- 					if copilot.is_visible() then
	-- 						copilot.accept()
	-- 					elseif luasnip.expand_or_jumpable() then
	-- 						luasnip.expand_or_jump()
	-- 					else
	-- 						fallback()
	-- 					end
	-- 				end, {
	-- 					"i",
	-- 					"s",
	-- 				}),
	-- 				["<A-l>"] = cmp.mapping(function(fallback)
	-- 					if cmp.visible() then
	-- 						cmp.confirm()
	-- 					else
	-- 						fallback()
	-- 					end
	-- 				end, { "i", "s" }), --cmp.mapping.confirm({ select = true }),
	-- 			},
	-- 		})
	--
	-- 		-- Copilot stuff
	-- 		cmp.event:on("menu_opened", function()
	-- 			vim.b.copilot_suggestion_hidden = false
	-- 		end)
	--
	-- 		cmp.event:on("menu_closed", function()
	-- 			vim.b.copilot_suggestion_hidden = false
	-- 		end)
	-- 	end,
	-- 	dependencies = {
	-- 		-- Autocompletion
	-- 		"hrsh7th/cmp-nvim-lsp",
	-- 		"hrsh7th/cmp-buffer",
	-- 		"hrsh7th/cmp-path",
	-- 		"onsails/lspkind.nvim",
	--
	-- 		-- Snippets
	-- 		"L3MON4D3/LuaSnip",
	-- 		"saadparwaiz1/cmp_luasnip",
	-- 		"rafamadriz/friendly-snippets",
	-- 	},
	-- 	event = "InsertEnter",
	-- },
	{
		"saghen/blink.cmp",
		lazy = false,
		dependencies = {
			-- Autocompletion
			"onsails/lspkind.nvim",

			-- Snippets
			-- "L3MON4D3/LuaSnip",
		},
		version = "v0.7.6",
		opts = {
			keymap = {
				["<A-j>"] = {
					"select_next",
				},
				["<A-k>"] = {
					"select_prev",
				},
				["<A-l>"] = {
					"accept",
				},
				["<A-Tab>"] = {
					function(cmp)
						local copilot = require("copilot.suggestion")
						if copilot.is_visible() then
							copilot.accept()
						end
					end,
				},
			},
			sources = {
				default = { "lsp", "path", "buffer" },
				-- optionally disable cmdline completions
				-- cmdline = {},
			},
			signature = {
				enabled = true,
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

	-- Lua stuff
	{
		"folke/lazydev.nvim",
		ft = "lua", -- only load on lua files
		opts = {
			library = {
				-- See the configuration section for more details
				-- Load luvit types when the `vim.uv` word is found
				{ path = "${3rd}/luv/library", words = { "vim%.uv" } },
			},
		},
	},
}
