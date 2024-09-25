return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		config = function()
			require("fzf-lua").setup({})
		end,
		keys = {
			{
				"<A-e>",
				function()
					require("fzf-lua").files({ cwd = vim.fn.getcwd() })
				end,
				desc = "Find files",
			},
			{
				"<S-A-s>",
				function()
					require("fzf-lua").oldfiles()
				end,
				desc = "View recent files",
			},
			{
				"<S-A-f>",
				function()
					require("fzf-lua").live_grep()
				end,
				desc = "Grep files",
			},

			{
				"gi",
				function()
					vim.lsp.buf.implementation()
					-- vim.api.nvim_command("q")
					-- require("fzf-lua").quickfix()
				end,
				desc = "Goto implementation",
			},
		},
		oldfiles = {
			prompt = "History❯ ",
			cwd_only = false,
			stat_file = true, -- verify files exist on disk
			-- can also be a lua function, for example:
			-- stat_file = require("fzf-lua").utils.file_is_readable,
			-- stat_file = function() return true end,
			include_current_session = true, -- include bufs from current session
		},
	},

	-- Yeah yeah, its a bit overkill, but I like the previews
	{
		"ojroques/nvim-lspfuzzy", -- for mapping lsp to fzf previews
		dependencies = { "junegunn/fzf", "junegunn/fzf.vim" },
		config = {
			function()
				require("lspfuzzy").setup({})
			end,
		},
	},
}
