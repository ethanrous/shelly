local keymap = require("util.keymap")

return {
	{
		"stevearc/oil.nvim",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		keys = {
			{ "<LEADER>n", "<Cmd>Oil<CR>", desc = "Open Oil" },
		},
		config = function()
			local oil = require("oil")
			oil.setup({
				show_hidden = true,
				use_default_keymaps = false,
				delete_to_trash = true,
				skip_confirm_for_simple_edits = true,
				default_file_explorer = false,
				keymaps = {
					["g?"] = "actions.show_help",
					["I"] = "actions.toggle_hidden",
					["<CR>"] = "actions.select",
					["-"] = "actions.parent",
					["_"] = "actions.open_cwd",
					["R"] = "actions.refresh",
					["<LEADER>n"] = "actions.close",
					["s"] = function()
						require("oil.actions").select_vsplit.callback()
						require("oil.actions").close.callback()
					end,
					["S"] = function()
						require("oil.actions").select_split.callback()
						require("oil.actions").close.callback()
					end,
					["H"] = function()
						-- Function to add oil entry to harpoon
						local Path = require("plenary.path")

						-- Get file under cursor
						local entry = oil.get_cursor_entry()
						local filename = entry and entry.name
						local dir = oil.get_current_dir()

						-- Add to harpoon
						local listItem = {
							context = { row = 1, col = 0 },
							value = Path:new(dir .. filename):make_relative(vim.fn.getcwd()),
						}
						require("harpoon"):list():add(listItem)
					end,
				},
			})

			vim.api.nvim_set_keymap(
				"n",
				"<LEADER>n",
				"<Cmd>Oil<CR>",
				{ noremap = true, silent = true, desc = "Open Oil" }
			)
		end,
	},
	-- {
	-- 	"nvim-neo-tree/neo-tree.nvim",
	-- 	config = function()
	-- 		require("neo-tree").setup({
	-- 			close_if_last_window = true,
	--
	-- 			default_component_configs = {
	-- 				git_status = {
	-- 					symbols = {
	-- 						-- Change type
	-- 						added = "", -- or "✚", but this is redundant info if you use git_status_colors on the name
	-- 						modified = "", -- or "", but this is redundant info if you use git_status_colors on the name
	-- 						deleted = "✖", -- this can only be used in the git_status source
	-- 						renamed = "󰁕", -- this can only be used in the git_status source
	-- 						-- Status type
	-- 						untracked = "",
	-- 						ignored = "",
	-- 						unstaged = "󰄱",
	-- 						staged = "",
	-- 						conflict = "",
	-- 					},
	-- 				},
	-- 			},
	-- 			sources = {
	-- 				"filesystem",
	-- 				"document_symbols",
	-- 				"filesystem",
	-- 			},
	-- 			buffers = {
	-- 				follow_current_file = { enabled = true },
	-- 			},
	--
	-- 			filesystem = {
	-- 				hijack_netrw_behavior = "disabled",
	-- 				follow_current_file = {
	-- 					enabled = true,
	-- 					leave_dirs_open = true,
	-- 				},
	-- 				commands = {
	-- 					avante_add_files = function(state)
	-- 						local node = state.tree:get_node()
	-- 						local filepath = node:get_id()
	-- 						local relative_path = require("avante.utils").relative_path(filepath)
	--
	-- 						local sidebar = require("avante").get()
	--
	-- 						local open = sidebar:is_open()
	-- 						-- ensure avante sidebar is open
	-- 						if not open then
	-- 							require("avante.api").ask()
	-- 							sidebar = require("avante").get()
	-- 						end
	--
	-- 						sidebar.file_selector:add_selected_file(relative_path)
	--
	-- 						-- remove neo tree buffer
	-- 						if not open then
	-- 							sidebar.file_selector:remove_selected_file("neo-tree filesystem [1]")
	-- 						end
	-- 					end,
	-- 				},
	-- 				window = {
	-- 					mappings = {
	-- 						["oa"] = "avante_add_files",
	-- 						["P"] = { "toggle_preview", config = { use_float = true, use_image_nvim = true } },
	-- 					},
	-- 					fuzzy_finder_mappings = { -- define keymaps for filter popup window in fuzzy_finder_mode
	-- 						["<A-j>"] = "move_cursor_down",
	-- 						["<A-k>"] = "move_cursor_up",
	-- 					},
	-- 				},
	-- 			},
	-- 			document_symbols = {
	-- 				window = {
	-- 					position = "float",
	-- 					mappings = {
	-- 						["<cr>"] = "open",
	-- 						["<Tab>"] = "toggle_node",
	-- 					},
	-- 				},
	-- 			},
	-- 		})
	-- 	end,
	-- },
	-- {
	-- 	"nvim-tree/nvim-tree.lua",
	-- 	config = function()
	-- 		vim.keymap.set("n", "<leader>gt", function()
	-- 			local exp = require("nvim-tree.core").get_explorer()
	-- 			Close_win_if_open("fugitiveblame")
	-- 			require("nvim-tree.api").tree.toggle({
	-- 				path = "<args>",
	-- 				find_file = false,
	-- 				update_root = false,
	-- 				focus = true,
	-- 			})
	-- 			require("nvim-tree.api").tree.resize({ width = 50 })
	-- 		end, { silent = true })
	--
	-- 		require("nvim-tree").setup({
	-- 			update_focused_file = {
	-- 				enable = true,
	-- 			},
	-- 		})
	-- 	end,
	-- },
}
