return {
	-- {
	-- 	"stevearc/oil.nvim",
	-- 	dependencies = { "nvim-tree/nvim-web-devicons" },
	-- 	config = function()
	-- 		local oil = require("oil")
	-- 		oil.setup({
	-- 			use_default_keymaps = false,
	-- 			delete_to_trash = true,
	-- 			skip_confirm_for_simple_edits = true,
	-- 			keymaps = {
	-- 				["g?"] = "actions.show_help",
	-- 				["I"] = "actions.toggle_hidden",
	-- 				["<CR>"] = "actions.select",
	-- 				["-"] = "actions.parent",
	-- 				["_"] = "actions.open_cwd",
	-- 				["R"] = "actions.refresh",
	-- 				["<LEADER>n"] = "actions.close",
	-- 				["s"] = function()
	-- 					require("oil.actions").select_vsplit.callback()
	-- 					require("oil.actions").close.callback()
	-- 				end,
	-- 				["S"] = function()
	-- 					require("oil.actions").select_split.callback()
	-- 					require("oil.actions").close.callback()
	-- 				end,
	-- 				["H"] = function()
	-- 					-- Function to add oil entry to harpoon
	-- 					local Path = require("plenary.path")

	-- 					-- Get file under cursor
	-- 					local entry = oil.get_cursor_entry()
	-- 					local filename = entry and entry.name
	-- 					local dir = oil.get_current_dir()

	-- 					-- Add to harpoon
	-- 					local listItem = {
	-- 						context = { row = 1, col = 0 },
	-- 						value = Path:new(dir .. filename):make_relative(vim.fn.getcwd()),
	-- 					}
	-- 					require("harpoon"):list():add(listItem)
	-- 				end,
	-- 			},
	-- 		})

	-- 		vim.api.nvim_set_keymap(
	-- 			"n",
	-- 			"<LEADER>n",
	-- 			"<Cmd>Oil<CR>",
	-- 			{ noremap = true, silent = true, desc = "Open Oil" }
	-- 		)
	-- 	end,
	-- },
	{
		"nvim-tree/nvim-tree.lua",
		config = function()
			require("nvim-tree").setup({
				update_focused_file = {
					enable = true,
				},
			})
		end,
	},
}
