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
		"CopilotC-Nvim/CopilotChat.nvim",
		dependencies = {
			{ "github/copilot.vim" }, -- or zbirenbaum/copilot.lua
			{ "nvim-lua/plenary.nvim", branch = "master" }, -- for curl, log and async functions
		},
		build = "make tiktoken", -- Only on MacOS or Linux
		opts = {
			-- See Configuration section for options
		},
		-- See Commands section for default commands if you want to lazy load on them
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
						adapter = "Copilot",
					},
					inline = {
						adapter = "Copilot",
					},
				},
				adapters = {
					ollama = function()
						return require("codecompanion.adapters").extend("ollama", {
							-- env = {
							-- url = "http://lucy.arcticnet:11439",
							-- api_key = "OLLAMA_API_KEY",
							-- },
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
					Copilot = function()
						return require("codecompanion.adapters").extend("Copilot", {})
					end,
				},
			})
			vim.keymap.set({ "n" }, "<leader>ll", "<cmd>CodeCompanionChat Toggle<cr>")
		end,
	},
}
