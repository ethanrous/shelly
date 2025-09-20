return {
	{
		"zbirenbaum/copilot.lua",
		event = "InsertEnter",
		config = function()
			-- vim.g.copilot_proxy = "http://127.0.0.1:11435"
			-- vim.g.copilot_proxy_strict_ssl = false

			require("copilot").setup({
				filetypes = {
					["*"] = true,
				},
				copilot_model = "gpt-41-copilot",
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
		event = "VeryLazy",
		version = false, -- set this if you want to always pull the latest change
		opts = {
			-- add any opts here
			mode = "agentic",
			provider = "copilot",
			cursor_applying_provider = "copilot",
			behaviour = {
				--- ... existing behaviours
				enable_cursor_planning_mode = true, -- enable cursor planning mode!
				auto_suggestions = false,
			},
			providers = {
				copilot = {
					model = "gpt-5",
				},
				ollama = {
					endpoint = "http://127.0.0.1:9001",
					timeout = 30000, -- Timeout in milliseconds
					model = "gpt-oss:20b",
					extra_request_body = {
						options = {
							temperature = 0.75,
							num_ctx = 20480,
							keep_alive = "5m",
						},
					},
				},
			},
			mappings = {
				sidebar = {
					apply_all = "A",
					apply_cursor = "a",
					retry_user_request = "r",
					edit_user_request = "e",
					switch_windows = "<Tab>",
					reverse_switch_windows = "<S-Tab>",
					remove_file = "d",
					add_file = "@",
					close = { "<Esc>", "q" },
					close_from_input = nil, -- e.g., { normal = "<Esc>", insert = "<C-d>" }
				},
			},
		},
		-- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
		build = "make",
		-- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"stevearc/dressing.nvim",
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			--- The below dependencies are optional,
			"echasnovski/mini.pick", -- for file_selector provider mini.pick
			"nvim-telescope/telescope.nvim", -- for file_selector provider telescope
			"zbirenbaum/copilot.lua", -- for providers='copilot'
			"OXY2DEV/markview.nvim",
			-- {
			-- 	-- support for image pasting
			-- 	"HakonHarnes/img-clip.nvim",
			-- 	event = "VeryLazy",
			-- 	opts = {
			-- 		-- recommended settings
			-- 		default = {
			-- 			embed_image_as_base64 = false,
			-- 			prompt_for_file_name = false,
			-- 			drag_and_drop = {
			-- 				insert_mode = true,
			-- 			},
			-- 			-- required for Windows users
			-- 			use_absolute_path = true,
			-- 		},
			-- 	},
			-- },
		},
	},
	{
		"OXY2DEV/markview.nvim",
		enabled = true,
		lazy = false,
		ft = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
		opts = {
			preview = {
				filetypes = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
			},
			max_length = 99999,
		},
	},
}
