return {
	{
		"tpope/vim-fugitive",
		config = function()
			vim.keymap.set({ "n", "v" }, "<LEADER>gb", function()
				if Close_win_if_open("fugitiveblame") then
					return
				end
				Close_win_if_open("NvimTree")
				vim.cmd("G blame")
			end, { silent = true })
		end,
	},
	{
		"sindrets/diffview.nvim",
		config = function()
			local actions = require("diffview.actions")
			require("diffview").setup({
				keymaps = {
					view = {
						{
							"n",
							"gf",
							function()
								local win = vim.fn.nvim_get_current_win()
								print("CLOSE WINDR? " .. win)

								-- actions.goto_file_edit()
								--
								-- vim.api.nvim_win_close(win, false) -- do not force
							end,
							{ desc = "Open the file in the previous tabpage" },
						},
					},
				},
			})

			vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
				require("diffview").open({})
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>gf", function()
				vim.cmd("DiffviewFileHistory %")
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
				require("diffview").close()
			end, { silent = true })
		end,
	},
	{
		"lewis6991/gitsigns.nvim",
		config = function()
			require("gitsigns").setup({
				current_line_blame = true,
				current_line_blame_opts = {
					virt_text_pos = "eol",
					virt_text_priority = 0,
				},
			})
		end,
	},
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim", -- required
			"sindrets/diffview.nvim", -- optional - Diff integration

			-- Only one of these is needed.
			"nvim-telescope/telescope.nvim", -- optional
		},
		config = function()
			vim.keymap.set({ "n", "v" }, "<leader>gg", function()
				if Close_win_if_open("NeogitStatus") then
					return
				end
				Close_win_if_open("fugitiveblame")
				require("neogit").open({ kind = "vsplit" })
			end, { silent = true })
		end,
	},
	{
		"pwntester/octo.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope.nvim",
			"nvim-tree/nvim-web-devicons",
		},
		config = function()
			require("octo").setup({
				use_local_fs = true,
				-- integrations = {
				-- 	telescope = true,
				-- },
			})

			-- vim.keymap.set({ "n", "v" }, "<LEADER>gh", function()
			-- 	if Close_win_if_open("octo") then
			-- 		return
			-- 	end
			-- 	Close_win_if_open("fugitiveblame")
			-- 	require("octo").open_hunk()
			-- end, { silent = true })
		end,
	},
}
