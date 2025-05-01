return {
	{
		"zbirenbaum/copilot.lua",
		event = "InsertEnter",
		config = function()
			require("copilot").setup({
				filetypes = {
					["*"] = true,
				},
				copilot_model = "gpt-4o-copilot",
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
		"yetone/avante.nvim",
		event = "VeryLazy",
		version = false, -- Never set this value to "*"! Never!
		config = function()
			require("avante").setup({
				-- add any opts here
				-- for example
				provider = "copilot",
				auto_suggestions_provider = "copilot",
				cursor_applying_provider = "copilot", -- In this example, use Groq for applying, but you can also use any provider you want.

				copilot = {
					endpoint = "https://api.githubcopilot.com",
					model = "gpt-4o-2024-08-06",
					proxy = nil, -- [protocol://]host[:port] Use this proxy
					allow_insecure = false, -- Allow insecure server connections
					timeout = 30000, -- Timeout in milliseconds
					temperature = 0,
					max_tokens = 20480,
				},
				behaviour = {
					enable_cursor_planning_mode = true, -- enable cursor planning mode!
					auto_suggestions = false, -- Experimental stage
					auto_set_highlight_group = true,
				},
				windows = {
					edit = {
						border = "single",
					},
				},
				suggestion = {
					debounce = 6000,
					throttle = 6000,
				},
			})

			-- vim.api.nvim_create_autocmd("WinEnter", {
			-- 	pattern = "*",
			-- 	callback = function()
			-- 		vim.bo.winblend = 0
			-- 	end,
			-- })
		end,
		-- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
		build = "make",
		-- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			-- "stevearc/dressing.nvim",
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			--- The below dependencies are optional,
			"echasnovski/mini.pick", -- for file_selector provider mini.pick
			"nvim-telescope/telescope.nvim", -- for file_selector provider telescope
			-- "hrsh7th/nvim-cmp", -- autocompletion for avante commands and mentions
			"ibhagwan/fzf-lua", -- for file_selector provider fzf
			"nvim-tree/nvim-web-devicons", -- or echasnovski/mini.icons
			"zbirenbaum/copilot.lua", -- for providers='copilot'
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
			{
				-- Make sure to set this up properly if you have lazy=true
				"MeanderingProgrammer/render-markdown.nvim",
				opts = {
					file_types = { "markdown", "Avante" },
				},
				ft = { "markdown", "Avante" },
			},
		},
	},
}
