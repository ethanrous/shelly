return {
	{
		"zbirenbaum/copilot.lua",
		event = "InsertEnter",
		config = function()
			-- vim.g.copilot_proxy = "https://chat.arcticio.net"
			-- vim.g.copilot_proxy_strict_ssl = false
			-- vim.g.copilot_proxy = "http://lucy.arcticnet:11439"
			require("copilot").setup({
				filetypes = {
					["*"] = true,
				},
				suggestion = {
					enabled = true,
					auto_trigger = true,
					keymap = {
						accept = false,
						accept_word = false,
						accept_line = false,
						next = false,
						prev = false,
						dismiss = false,
					},
				},
				server_opts_overrides = {
					settings = {
						advanced = {
							inlineSuggestCount = 1,
						},
					},
				},
			})
		end,
	},
	{
		"olimorris/codecompanion.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
		config = function()
			local codecompanion = require("codecompanion")
			codecompanion.setup({
				enabled = true,
				autostart = true,
				autostop = true,
				autostop_events = { "InsertLeave" },
				display = {
					diff = {
						provider = "mini_diff",
					},
				},
				strategies = {
					chat = {
						adapter = "ollama",
					},
					inline = {
						adapter = "ollama",
					},
				},
				adapters = {
					ollama = function()
						return require("codecompanion.adapters").extend("ollama", {
							env = {
								url = "http://lucy.arcticnet:11439",
								-- api_key = "OLLAMA_API_KEY",
							},
							-- headers = {
							-- 	["Content-Type"] = "application/json",
							-- 	["Authorization"] = "Bearer ${api_key}",
							-- },
							parameters = {
								sync = true,
							},
							schema = { model = { default = "llama3.2:3b" } },
						})
					end,
				},
			})
			vim.keymap.set({ "n" }, "<leader>ll", "<cmd>CodeCompanionChat Toggle<cr>")
		end,
	},
}
