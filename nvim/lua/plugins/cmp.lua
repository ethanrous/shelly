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
		},
		opts = {
			completion = {
				menu = {
					auto_show = function(ctx)
						return ctx.mode ~= "cmdline" or not vim.tbl_contains({ "/", "?" }, vim.fn.getcmdtype())
					end,
					border = "single",
					draw = { gap = 2, columns = { { "kind_icon" }, { "label", "label_description", gap = 1 } } },
				},
				documentation = { auto_show = true, auto_show_delay_ms = 0, window = { border = "single" } },
				list = { selection = { preselect = true, auto_insert = false } },
			},
			snippets = { preset = "luasnip" },
			sources = {
				default = { "lsp", "path", "snippets", "buffer" },
			},
			signature = { enabled = true, window = { border = "single" } },
			keymap = {
				preset = "default",
				["<A-j>"] = { "select_next" },
				["<A-k>"] = { "select_prev" },
				["<A-l>"] = { "select_and_accept" },
				["<C-d>"] = { "show_documentation" },
				["<A-Tab>"] = {
					function(cmp)
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
	{
		"folke/noice.nvim",
		dependencies = {
			-- if you lazy-load any plugin below, make sure to add proper `module="..."` entries
			"MunifTanjim/nui.nvim",
			-- OPTIONAL:
			--   `nvim-notify` is only needed, if you want to use the notification view.
			--   If not available, we use `mini` as the fallback
			-- "rcarriga/nvim-notify",
		},
		config = function()
			require("noice").setup({
				lsp = {
					-- override markdown rendering so that **cmp** and other plugins use **Treesitter**
					override = {
						["vim.lsp.util.convert_input_to_markdown_lines"] = true,
						["vim.lsp.util.stylize_markdown"] = true,
						["cmp.entry.get_documentation"] = true, -- requires hrsh7th/nvim-cmp
					},
					signature = {
						enabled = false,
						throttle = 0,
					},
					hover = {
						silent = true,
					},
				},

				-- you can enable a preset for easier configuration
				presets = {
					bottom_search = true, -- use a classic bottom cmdline for search
					command_palette = true, -- position the cmdline and popupmenu together
					long_message_to_split = true, -- long messages will be sent to a split
					inc_rename = false, -- enables an input dialog for inc-rename.nvim
					lsp_doc_border = true, -- add a border to hover docs and signature help
				},

				cmdline = {
					enabled = true,
					format = {
						-- conceal: (default=true) This will hide the text in the cmdline that matches the pattern.
						-- view: (default is cmdline view)
						-- opts: any options passed to the view
						-- icon_hl_group: optional hl_group for the icon
						-- title: set to anything or empty string to hide
						-- icon_hl_group = "NoiceCmdlineIcon",
						cmdline = { pattern = "^:", icon = "$", lang = "vim" },
					},
				},
				commands = {
					all = {
						-- options for the message history that you get with `:Noice`
						view = "popup",
						opts = { enter = true, format = "details" },
						filter = {},
					},
				},
				views = {
					hover = {
						relative = "cursor",
						anchor = "SW",
						position = {
							row = -1,
							col = 0,
						},
						border = { style = "single" },
						size = { max_width = 80 },
					},
					cmdline_popup = {
						anchor = "NW",
						position = {
							row = "35%",
							col = "50%",
						},
						border = {
							style = "single",
						},
						size = {
							width = 60,
							height = "auto",
						},
					},
					popup = {
						border = {
							style = "single",
							padding = { 0, 1 },
							size = { max_width = 80, max_height = 60 },
						},
					},
					cmdline_popupmenu = {
						anchor = "NW",
						position = {
							row = "55%",
							col = "50%",
						},
						size = {
							width = 60,
							height = 15,
							max_height = 15,
						},
						border = {
							style = "single",
						},
					},
				},
			})

			vim.keymap.set({ "v", "n" }, "<leader>sh", function()
				require("noice").cmd("all")
			end, { silent = true })
		end,
	},
}
