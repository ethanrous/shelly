return {
	-- Code snipet images
	{
		"mistricky/codesnap.nvim",
		config = function()
			require("codesnap").setup({
				has_line_number = true,
				watermark = "",
				bg_padding = 0,
				has_breadcrumbs = true,
				show_workspace = true,
				-- bg_color = "#232136",
				code_font_family = "JetBrainsMono Nerd Font",
			})
		end,
		build = "make",
		keys = {
			{
				"<Leader>s",
				"<Cmd>CodeSnap<CR>",
				mode = "v",
				desc = "Screenshot code snippet",
			},
		},
	},
}
