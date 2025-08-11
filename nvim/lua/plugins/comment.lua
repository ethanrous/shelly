return {
	{ "numToStr/Comment.nvim" },
	{
		"rmagatti/alternate-toggler",
		event = { "BufReadPost" }, -- lazy load after reading a buffer
		config = function()
			require("alternate-toggler").setup({
				alternates = {
					["=="] = "!=",
				},
			})

			vim.keymap.set(
				"n",
				"<leader>tt", -- <space><space>
				function()
					require("alternate-toggler").toggleAlternate()
				end
			)
		end,
	},
}
