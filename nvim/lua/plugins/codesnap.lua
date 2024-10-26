return {
	-- Code snipet images
	{
		"mistricky/codesnap.nvim",
		build = "make",
		keys = {
			{
				"<Leader>s",
				"<Cmd>CodeSnap<CR>",
				mode = "v",
				desc = "Screenshot code snippet",
			},
		},
		opts = {
			watermark = "",
			bg_padding = 0,
		},
	},
}
