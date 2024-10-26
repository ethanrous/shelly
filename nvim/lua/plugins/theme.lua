local function configureTheme(name)
	vim.cmd("colorscheme " .. name)

	local function onBufEnter()
		vim.opt.termguicolors = true
		vim.wo.fillchars = "eob: "
		vim.cmd("silent! syntax enable")
		vim.cmd("silent! hi Normal guibg=NONE ctermbg=NONE")
		vim.cmd("silent! hi EndOfBuffer guibg=NONE ctermbg=NONE")

		-- Line numbers highlight fg
		vim.cmd("silent! hi LineNr guifg=#b4befe")
	end

	local augroup = vim.api.nvim_create_augroup("ThemeConfig", {})
	vim.api.nvim_create_autocmd("BufEnter", {
		group = augroup,
		callback = onBufEnter,
	})
end

return {
	-- {
	-- 	"shaunsingh/nord.nvim",
	-- },
	{
		"folke/tokyonight.nvim",
		config = function()
			configureTheme("tokyonight")
		end,
		lazy = false,
		priority = 1000,
		name = "tokyonight",
		opts = {},
	},
	{
		"rose-pine/neovim",
		name = "rose-pine",
		lazy = false,
		priority = 1000,
		-- config = function()
		-- 	configureTheme("rose-pine")
		-- end,
	},

	-- Illuminate words like the one you are hovering
	{
		"RRethy/vim-illuminate",
		config = function()
			require("illuminate").configure({
				delay = 0,
				should_enable = function(bufnr)
					local mode = vim.api.nvim_get_mode().mode
					return mode == "n" or mode == "i"
				end,
				min_count_to_highlight = 2,
				filetypes_denylist = {
					"NvimTree",
				},
			})
		end,
		event = "BufEnter",
	},

	-- Highlight color codes with their code #ff00ff
	{
		"norcalli/nvim-colorizer.lua",
		config = true,
		event = "VimEnter",
	},
}
