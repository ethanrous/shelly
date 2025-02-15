return {
	{
		"folke/snacks.nvim",
		priority = 1000,
		lazy = false,
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
				scope = {
					only_current = true,
					hl = {
						"RainbowRed",
						"RainbowYellow",
						"RainbowBlue",
						"RainbowOrange",
						"RainbowGreen",
						"RainbowViolet",
						"RainbowCyan",
					},
				},
				blank = {
					hl = {
						"RainbowRed",
						"RainbowYellow",
						"RainbowBlue",
						"RainbowOrange",
						"RainbowGreen",
						"RainbowViolet",
						"RainbowCyan",
					},
				},
			},
		},
	},
}
