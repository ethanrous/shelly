return {
	{
		"sindrets/diffview.nvim",
		keys = {
			{ "<LEADER>gd", mode = { "n", "v" } },
			{ "<LEADER>dm", mode = { "n", "v" } },
			{ "<LEADER>gf", mode = { "n", "v" } },
			{ "<LEADER>gc", mode = { "n", "v" } },
			{ "<LEADER>bc", mode = { "n", "v" } },
		},
		config = function()
			local actions = require("diffview.actions")
			require("diffview").setup({
				keymaps = {
					view = {
						{
							"n",
							"gf",
							function()
								local tab_nmbr = vim.fn.tabpagenr()
								actions.goto_file_edit()
								vim.cmd("tabclose " .. tab_nmbr)
							end,
							{ desc = "Open the file in the previous tabpage" },
						},
					},
				},
			})

			vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
				require("diffview").open({})
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>dm", function()
				local branch = "main"

				local result = vim.fn.system("git branch | grep master")
				if result ~= "" then
					branch = "master"
				end

				result = vim.fn.system("git branch | grep devel")
				if result ~= "" then
					branch = "devel"
				end
				require("diffview").open({ "origin/" .. branch .. "..." })
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>gf", function()
				vim.cmd("DiffviewFileHistory %")
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
				require("diffview").close()
			end, { silent = true })

			vim.keymap.set({ "n", "v" }, "<LEADER>bc", function()
				local line = vim.fn.line(".")
				local cmd = "git blame -L " .. line .. "," .. line .. " " .. vim.fn.expand("%")
				local output = vim.fn.system(cmd)
				local spaceIndex = string.find(output, " ")
				if spaceIndex == 0 then
					print("No commit hash found")
					return
				end

				local commitHash = string.sub(output, 0, spaceIndex - 1)
				require("diffview").open({ commitHash .. "~.." .. commitHash })
			end, { silent = true })
		end,
	},
	{
		"lewis6991/gitsigns.nvim",
		event = "VeryLazy",
		config = function()
			require("gitsigns").setup({
				preview_config = {
					border = "solid",
				},
				current_line_blame = true,
				current_line_blame_opts = {
					virt_text_pos = "eol",
					virt_text_priority = 0,
				},
			})
			local gitsigns = require("gitsigns")
			vim.keymap.set({ "n" }, "]h", function()
				gitsigns.nav_hunk("next")
			end, { silent = true })
			vim.keymap.set({ "n" }, "[h", function()
				gitsigns.nav_hunk("prev")
			end, { silent = true })
			vim.keymap.set({ "n" }, "<leader>hh", function()
				gitsigns.preview_hunk_inline()
			end, { silent = true })

			vim.keymap.set({ "o", "x" }, "ih", gitsigns.select_hunk)
			vim.keymap.set({ "n" }, "<leader>bl", function()
				gitsigns.blame_line({ full = true })
			end)
			vim.keymap.set({ "n" }, "<leader>hr", function()
				gitsigns.reset_hunk()
			end)
			vim.keymap.set({ "n" }, "<leader>gb", gitsigns.blame)
		end,
	},
	{
		"NeogitOrg/neogit",
		lazy = true,
		keys = {
			{ "<leader>gg", mode = { "n", "v" } },
		},
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
