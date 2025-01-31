local stdPalete = {
	a = { bg = Colors.Pine, fg = Colors.Text, gui = "bold" },
	b = { bg = Colors.PineMuted, fg = Colors.Text },
	c = { bg = Colors.Surface, fg = Colors.Text },

	x = { bg = Colors.Surface, fg = Colors.Text },
	y = { bg = Colors.PineMuted, fg = Colors.Text },
	z = { bg = Colors.Pine, fg = Colors.Text, gui = "bold" },
}

local dullPalete = {
	a = { bg = Colors.Surface, fg = Colors.Muted, gui = "bold" },
	b = { bg = Colors.Surface, fg = Colors.Muted },
	c = { bg = Colors.Surface, fg = Colors.Muted },

	x = { bg = Colors.Surface, fg = Colors.Muted },
	y = { bg = Colors.Surface, fg = Colors.Muted },
	z = { bg = Colors.Surface, fg = Colors.Muted, gui = "bold" },
}

local lineColors = {
	normal = stdPalete,
	insert = stdPalete,
	visual = stdPalete,
	replace = stdPalete,
	command = stdPalete,

	inactive = dullPalete,
}

local reponame = ""
vim.api.nvim_create_autocmd({ "BufEnter", "DirChanged" }, {
	pattern = "*",
	callback = function()
		local name = vim.fn.system("git rev-parse --show-toplevel 2> /dev/null")
		if name == "" then
			reponame = "󰉋 " .. vim.fn.expand("%:p:~:h")
			return
		end
		name = vim.fn.fnamemodify(name, ":t")
		name = name:sub(1, 1):upper() .. name:sub(2, -2)
		reponame = " " .. name
	end,
})

local function getRepoName()
	return reponame
end

require("lualine").setup({
	options = {
		theme = lineColors,
		section_separators = { "", "" },
		component_separators = { "", "" },
		disabled_filetypes = {},
	},
	sections = {
		lualine_a = { getRepoName },
		lualine_b = { { "filename", path = 1 } },
		lualine_c = { "filetype" },
		lualine_x = { "diagnostics" },
		lualine_y = { "location" },
		lualine_z = { { "diff", colored = false }, "branch" },
	},
	inactive_sections = {
		lualine_a = { getRepoName },
		lualine_b = { { "filename", path = 1 } },
		lualine_c = { "filetype" },
		lualine_x = { "diagnostics" },
		lualine_z = { { "diff", colored = false }, "branch" },
	},
	extensions = {
		"oil",
		"nvim-dap-ui",
		"nvim-tree"
	},
})
