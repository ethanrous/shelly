return {
	{
		"folke/snacks.nvim",
		priority = 1000,
		lazy = true,
		event = "BufReadPost",
		keys = {
			{
				"<leader>.",
				function()
					Snacks.scratch()
				end,
				desc = "Toggle Scratch Buffer",
			},
			{
				"<leader>s.",
				function()
					Snacks.scratch.select()
				end,
				desc = "Select Scratch Buffer",
			},
			{
				"<leader>j.",
				function()
					Snacks.scratch({ ft = "json" })
				end,
				desc = "Open a json scratch buffer",
			},
		},
		opts = {
			styles = {
				scratch = {
					width = 0.5,
					height = 0.75,
					border = "single",
				},
			},
			input = {
				enabled = true,
			},
			indent = {
				animate = {
					enabled = false,
				},
				chunk = {
					enabled = true,
					hl = "SnacksIndentChunk",
				},
			},
		},
	},
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
				routes = {
					{
						filter = {
							event = "lsp",
							kind = "progress",
							cond = function(message)
								local client = vim.tbl_get(message.opts, "progress", "client")
								if client ~= "jdtls" then
									return false
								end

								local content = vim.tbl_get(message.opts, "progress", "message")
								if content == nil then
									return false
								end

								return string.find(content, "Validate") or string.find(content, "Publish")
							end,
						},
						opts = { skip = true },
					},
				},
				lsp = {
					-- override markdown rendering so that **cmp** and other plugins use **Treesitter**
					override = {
						["vim.lsp.util.convert_input_to_markdown_lines"] = true,
						["vim.lsp.util.stylize_markdown"] = true,
						-- ["cmp.entry.get_documentation"] = true, -- requires hrsh7th/nvim-cmp
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
				-- presets = {
				-- 	bottom_search = true, -- use a classic bottom cmdline for search
				-- 	command_palette = false, -- position the cmdline and popupmenu together
				-- 	long_message_to_split = true, -- long messages will be sent to a split
				-- 	inc_rename = false, -- enables an input dialog for inc-rename.nvim
				-- 	lsp_doc_border = true, -- add a border to hover docs and signature help
				-- },

				-- conceal: (default=true) This will hide the text in the cmdline that matches the pattern.
				-- view: (default is cmdline view)
				-- opts: any options passed to the view
				-- icon_hl_group: optional hl_group for the icon
				-- title: set to anything or empty string to hide
				-- icon_hl_group = "NoiceCmdlineIcon",
				cmdline = {
					enabled = true,
					view = "cmdline",
					format = {
						cmdline = { pattern = "^:", icon = ":", lang = "vim" },
					},
				},
				messages = {
					-- NOTE: If you enable messages, then the cmdline is enabled automatically.
					-- This is a current Neovim limitation.
					enabled = true, -- enables the Noice messages UI
					view = "notify", -- default view for messages
					view_error = "notify", -- view for errors
					view_warn = "notify", -- view for warnings
					view_history = "messages", -- view for :messages
					view_search = false, -- view for search count messages. Set to `false` to disable
				},
				commands = {
					all = {
						-- options for the message history that you get with `:Noice`
						view = "vsplit",
						opts = { enter = true, format = "details" },
						filter = {},
						filter_opts = { reverse = true },
					},
				},
				views = {
					virtualtext = false,
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
					vsplit = {
						size = "50%",
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
