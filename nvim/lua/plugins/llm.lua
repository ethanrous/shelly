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
				copilot_model = "gpt-41-copilot",
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
		"folke/sidekick.nvim",
		opts = {
			-- add any options here
			cli = {
				mux = {
					backend = "zellij",
					enabled = true,
				},
			},
		},
		keys = {
			{
				"<tab>",
				function()
					-- if there is a next edit, jump to it, otherwise apply it if any
					if not require("sidekick").nes_jump_or_apply() then
						return "<Tab>" -- fallback to normal tab
					end
				end,
				expr = true,
				desc = "Goto/Apply Next Edit Suggestion",
			},
			{
				"<c-.>",
				function()
					require("sidekick.cli").toggle()
				end,
				desc = "Sidekick Toggle",
				mode = { "n", "t", "i", "x" },
			},
			{
				"<leader>aa",
				function()
					require("sidekick.cli").toggle()
				end,
				desc = "Sidekick Toggle CLI",
			},
			{
				"<leader>as",
				function()
					require("sidekick.cli").select()
				end,
				-- Or to select only installed tools:
				-- require("sidekick.cli").select({ filter = { installed = true } })
				desc = "Select CLI",
			},
			{
				"<leader>ad",
				function()
					require("sidekick.cli").close()
				end,
				desc = "Detach a CLI Session",
			},
			{
				"<leader>at",
				function()
					require("sidekick.cli").send({ msg = "{this}" })
				end,
				mode = { "x", "n" },
				desc = "Send This",
			},
			{
				"<leader>af",
				function()
					require("sidekick.cli").send({ msg = "{file}" })
				end,
				desc = "Send File",
			},
			{
				"<leader>av",
				function()
					require("sidekick.cli").send({ msg = "{selection}" })
				end,
				mode = { "x" },
				desc = "Send Visual Selection",
			},
			{
				"<leader>ap",
				function()
					require("sidekick.cli").prompt()
				end,
				mode = { "n", "x" },
				desc = "Sidekick Select Prompt",
			},
			-- Example of a keybinding to open Claude directly
			{
				"<leader>ac",
				function()
					require("sidekick.cli").toggle({ name = "claude", focus = true })
				end,
				desc = "Sidekick Toggle Claude",
			},
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
