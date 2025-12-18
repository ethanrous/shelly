return {
	{
		"zbirenbaum/copilot.lua",
		event = "InsertEnter",
		dependencies = {
			"copilotlsp-nvim/copilot-lsp",
		},
		config = function()
			-- vim.g.copilot_proxy = "http://127.0.0.1:11435"
			-- vim.g.copilot_proxy_strict_ssl = false

			require("copilot").setup({
				filetypes = {
					["*"] = true,
				},
				copilot_model = "claude-haiku-4-5-copilot",
				-- nes = {
				-- 	enabled = true,
				-- 	keymap = {
				-- 		accept_and_goto = "<A-s>",
				-- 		accept = false,
				-- 		dismiss = "<Esc>",
				-- 	},
				-- },
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
		lazy = true,
		opts = {
			strategies = {
				chat = {
					adapter = "ollama",
				},
				inline = {
					adapter = "ollama",
				},
				cmd = {
					adapter = "ollama",
				},
			},
		},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
	},
	{
		"yetone/avante.nvim",
		version = false, -- set this if you want to always pull the latest change
		keys = {
			{ "<leader>aa", mode = { "n", "v" } },
			{ "<leader>at", mode = { "n", "v" } },
		},
		opts = {
			provider = "claude-code",
		},
		-- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
		build = "make",
		-- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			--- The below dependencies are optional,
			"echasnovski/mini.pick", -- for file_selector provider mini.pick
			"nvim-telescope/telescope.nvim", -- for file_selector provider telescope
			"zbirenbaum/copilot.lua", -- for providers='copilot'
			"OXY2DEV/markview.nvim",
		},
	},
	{
		"OXY2DEV/markview.nvim",
		enabled = true,
		lazy = true,
		ft = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
		opts = {
			preview = {
				filetypes = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
			},
			max_length = 99999,
		},
	},
}
