return {
	"windwp/nvim-ts-autotag",
	ft = { "html", "javascript", "typescript", "javascriptreact", "typescriptreact", "svelte", "vue" },
	config = function()
		require("nvim-ts-autotag").setup({
			opts = {
				-- Auto close on trailing </
				enable_close_on_slash = true,
			},
		})
	end,
}
