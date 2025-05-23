return {
	{
		"ThePrimeagen/harpoon",
		branch = "harpoon2",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local harpoon = require("harpoon")
			local Extensions = require("harpoon.extensions")
			local Path = require("plenary.path")
			harpoon.setup()

			vim.keymap.set("n", "<A-a>", function()
				if harpoon.ui.win_id ~= nil then
					vim.api.nvim_feedkeys("k", "n", false)
				end
			end)

			vim.keymap.set("n", "<A-d>", function()
				if harpoon.ui.win_id ~= nil then
					vim.api.nvim_feedkeys("j", "n", false)
					return
				end

				harpoon.ui:toggle_quick_menu(harpoon:list(), {
					border = "single",
				})
				vim.api.nvim_feedkeys("j", "n", false)

				vim.o.cursorline = true
			end)

			vim.keymap.set("n", "<A-w>", function()
				local h_list = harpoon:list()
				h_list:select(h_list._index)
			end)

			vim.keymap.set({ "i", "n" }, "<A-s>", function()
				if harpoon.ui.win_id ~= nil then
					vim.api.nvim_feedkeys("\x0d", "m", false)
					return
				end

				if harpoon:list()._length > 1 then
					harpoon:list():select(2)
					return
				end

				local key = vim.api.nvim_replace_termcodes("<C-^>", true, false, true)
				vim.api.nvim_feedkeys(key, "n", false)
			end)
		end,
	},
}
