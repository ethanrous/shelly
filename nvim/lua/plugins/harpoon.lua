return {
	{
		"ThePrimeagen/harpoon",
		branch = "harpoon2",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local harpoon = require("harpoon")
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

				harpoon.ui:toggle_quick_menu(harpoon:list())
				vim.api.nvim_feedkeys("j", "n", false)
			end)

			vim.keymap.set("n", "<A-w>", function()
				local h_list = harpoon:list()
				h_list:select(h_list._index)
			end)
		end,
	},
}
