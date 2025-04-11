return {
	{
		"folke/snacks.nvim",
		priority = 1000,
		lazy = false,
		keys = {
			{
				"<leader>.",
				function()
					Snacks.scratch()
				end,
				desc = "Toggle Scratch Buffer",
			},
			{
				"<leader>S",
				function()
					Snacks.scratch.select()
				end,
				desc = "Select Scratch Buffer",
			},
		},
		opts = {
			dashboard = {
				width = 75,
				preset = {
					keys = {
						{
							icon = " ",
							key = "f",
							desc = "Find File",
							action = ":lua require('telescope').extensions.smart_open.smart_open({ cwd_only = true })",
						},
						{ icon = " ", key = "n", desc = "New File", action = ":ene | startinsert" },
						{
							icon = " ",
							key = "g",
							desc = "Find Text",
							action = ":lua Snacks.dashboard.pick('live_grep')",
						},
						{
							icon = " ",
							key = "r",
							desc = "Recent Files",
							action = ":lua Snacks.dashboard.pick('oldfiles')",
						},
						{
							icon = " ",
							key = "c",
							desc = "Config",
							action = ":lua Snacks.dashboard.pick('files', {cwd = vim.fn.stdpath('config')})",
						},
						{ icon = " ", key = "s", desc = "Restore Session", section = "session" },
						{
							icon = "󰒲 ",
							key = "L",
							desc = "Lazy",
							action = ":Lazy",
							enabled = package.loaded.lazy ~= nil,
						},
						{ icon = " ", key = "q", desc = "Quit", action = ":qa" },
					},
				},
				sections = {
					{ section = "header" },
					{ section = "keys", gap = 1, padding = 1 },
					function()
						local in_git = Snacks.git.get_root() ~= nil
						local cmds = {}
						return vim.tbl_map(function(cmd)
							return vim.tbl_extend("force", {
								pane = 2,
								section = "terminal",
								enabled = in_git,
								padding = 1,
								ttl = 5 * 60,
								indent = 3,
							}, cmd)
						end, cmds)
					end,
					{ section = "startup" },
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
				-- scope = {
				-- 	enabled = true,
				-- 	hl = "SnacksIndentScope",
				-- },
				-- hl = {
				-- 	"RainbowRed",
				-- 	"RainbowYellow",
				-- 	"RainbowBlue",
				-- 	"RainbowOrange",
				-- 	"RainbowGreen",
				-- 	"RainbowViolet",
				-- 	"RainbowCyan",
				-- },
				-- chunk = {
				-- 	enabled = true,
				-- },
				-- scope = {
				-- 	only_current = true,
				-- },
				-- blank = {
				-- 	hl = {
				-- 		"RainbowRed",
				-- 		"RainbowYellow",
				-- 		"RainbowBlue",
				-- 		"RainbowOrange",
				-- 		"RainbowGreen",
				-- 		"RainbowViolet",
				-- 		"RainbowCyan",
				-- 	},
				-- },
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
