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
					local listedBufs = vim.fn.getbufinfo({ buflisted = 1 })
					local bufPaths = vim.tbl_map(function(buf)
						return buf.name
					end, listedBufs)
					vim.list_extend(vim.v.oldfiles, bufPaths)
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
					require("fzf-lua").lsp_implementations()
				end,
				desc = "Goto implementations",
			},
			{
				"gr",
				function()
					require("fzf-lua").lsp_references()
				end,
				desc = "Goto references",
			},
		},
		oldfiles = {
			prompt = "History❯ ",
			cwd_only = false,
			stat_file = false, -- verify files exist on disk
			-- can also be a lua function, for example:
			-- stat_file = require("fzf-lua").utils.file_is_readable,
			-- stat_file = function() return true end,
			include_current_session = true, -- include bufs from current session
		},
	},
}
