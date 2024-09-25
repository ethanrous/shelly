return {
	{
		"ray-x/lsp_signature.nvim",
		event = "VeryLazy",
		opts = {
			bind = true,
			close_timeout = 1,
			-- floating_window = false,
			-- hint_prefix = " ",
			hint_enable = false,
			floating_window_off_x = function()
				return vim.fn.col("$") - 1

				-- return 5
			end,
			--hint_inline = function()
			--		return false
			--	end,
			-- handler_opts = {
			-- 	border = "rounded",
			-- },
		},
		config = function(_, opts)
			require("lsp_signature").setup(opts)
		end,
	},
}
