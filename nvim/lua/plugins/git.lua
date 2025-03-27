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
			require("diffview").setup({
				-- view = {
				-- 	default = {
				-- 		-- Config for changed files, and staged files in diff views.
				-- 		layout = "diff2_horizontal",
				-- 		disable_diagnostics = false, -- Temporarily disable diagnostics for diff buffers while in the view.
				-- 		winbar_info = true, -- See |diffview-config-view.x.winbar_info|
				-- 	},
				-- 	merge_tool = {
				-- 		-- Config for conflicted files in diff views during a merge or rebase.
				-- 		layout = "diff4_mixed",
				-- 		disable_diagnostics = true, -- Temporarily disable diagnostics for diff buffers while in the view.
				-- 		winbar_info = true, -- See |diffview-config-view.x.winbar_info|
				-- 	},
				-- },
			})

			vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
				require("diffview").open()
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
					virt_text_pos = "right_align",
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
}
