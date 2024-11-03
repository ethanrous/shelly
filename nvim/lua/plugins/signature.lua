return {
	{
		"ray-x/lsp_signature.nvim",
		event = "VeryLazy",
		opts = {
			bind = true,
			close_timeout = 1,
			hint_enable = false,
			floating_window_off_x = function()
				return vim.fn.col("$") - 1
			end,
			--hint_inline = function()
			--		return false
			--	end,
			handler_opts = {
				border = "single",
			},
			timer_interval = 100,
			always_trigger = true,
		},
		config = function(_, opts)
			require("lsp_signature").setup(opts)
		end,
	},
}
