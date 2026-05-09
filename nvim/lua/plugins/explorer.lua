vim.pack.add({ "https://github.com/stevearc/oil.nvim" })

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
		["S"] = function()
			require("oil.actions").select_split.callback()
			require("oil.actions").close.callback()
		end,
		["H"] = function()
			local Path = require("plenary.path")
			local entry = oil.get_cursor_entry()
			local filename = entry and entry.name
			local dir = oil.get_current_dir()
			local listItem = {
				context = { row = 1, col = 0 },
				value = Path:new(dir .. filename):make_relative(vim.fn.getcwd()),
			}
			require("harpoon"):list():add(listItem)
		end,
	},
})

vim.keymap.set("n", "<LEADER>n", "<Cmd>Oil<CR>", { noremap = true, silent = true, desc = "Open Oil" })
