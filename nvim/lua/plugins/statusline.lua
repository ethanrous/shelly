-- local reponame = ""
-- vim.api.nvim_create_autocmd({ "BufEnter", "DirChanged" }, {
-- 	pattern = "*",
-- 	callback = function()
-- 		local name = vim.fn.system("git rev-parse --show-toplevel 2> /dev/null")
-- 		if name == "" then
-- 			reponame = "󰉋 " .. vim.fn.expand("%:p:~:h")
-- 			return
-- 		end
-- 		name = vim.fn.fnamemodify(name, ":t")
-- 		name = name:sub(1, 1):upper() .. name:sub(2, -2)
-- 		reponame = " " .. name
-- 	end,
-- })
--
-- local function getRepoName()
-- 	return reponame
-- end

local function fugitive_head()
	return " " .. vim.fn.FugitiveHead()
end

local get_location = function()
	if vim.v.hlsearch == 0 then
		local cursor = vim.api.nvim_win_get_cursor(0)
		return string.format("%d:%d", cursor[1], cursor[2])
	end

	local search = vim.fn.searchcount()
	return string.format("%d/%d", search.current, search.total)
end

local fugitive_blame = {
	sections = {
		lualine_c = { fugitive_head },
	},
	filetypes = { "fugitive", "fugitiveblame" },
}

local get_recording_macro = function()
	if vim.fn.reg_recording() ~= "" then
		return "%#StatusLineDiagnosticError#" .. "" .. vim.fn.reg_recording()
	end
	return ""
end
--
-- require("lualine").setup({
-- 	options = {
-- 		theme = lineColors,
-- 		section_separators = { "", "" },
-- 		component_separators = { "", "" },
-- 		disabled_filetypes = {},
-- 	},
-- 	sections = {
-- 		lualine_a = { getRepoName },
-- 		lualine_b = { { "filename", path = 1 } },
-- 		lualine_c = { "filetype" },
-- 		lualine_x = { "diagnostics" },
-- 		lualine_y = { get_location, get_recording_macro },
-- 		lualine_z = { { "diff", colored = false }, "branch" },
-- 	},
-- 	inactive_sections = {
-- 		lualine_a = { getRepoName },
-- 		lualine_b = { { "filename", path = 1 } },
-- 		lualine_c = { "filetype" },
-- 		lualine_x = { "diagnostics" },
-- 		lualine_z = { { "diff", colored = false }, "branch" },
-- 	},
-- 	extensions = {
-- 		fugitive_blame,
-- 		"oil",
-- 		"nvim-dap-ui",
-- 		"nvim-tree",
-- 		"quickfix",
-- 		"lazy",
-- 		"fugitive",
-- 	},
-- })

local function lint_progress()
	return ""
	-- local linters = require("lint").get_running()
	-- if #linters == 0 then
	-- 	return ""
	-- end
	-- return " " .. table.concat(linters, ", ")
end

return {
	"nvim-lualine/lualine.nvim",
	config = function()
		local colors = {
			white = Get_hl_hex("PreProc", "fg"),
			border = Get_hl_hex("Conceal", "fg"),
			background = Get_hl_hex("StatusLineNc", "bg"),
		}

		require("lualine").setup({
			inactive_sections = {
				lualine_a = {},
				lualine_b = {},
				lualine_c = {},
				lualine_x = {},
				lualine_y = {},
				lualine_z = {},
			},
			sections = {
				lualine_a = {
					{
						"filename",
						path = 1,
						symbols = {
							modified = " ",
							readonly = "",
							unnamed = "No name",
							newfile = "New file",
						},
					},
					{ "branch", icon = { "", align = "right" } },
				},
				lualine_b = {},
				lualine_c = {},
				lualine_x = {},
				lualine_y = {},
				lualine_z = {
					lint_progress,
					get_location,
					get_recording_macro,
					"diagnostics",
					"vim.bo.filetype",
					{ "diff", symbols = { added = "+", modified = "~", removed = "-" } },
				},
			},

			options = {
				icons_enabled = true,
				globalstatus = true,
				disabled_filetypes = { "alpha" },
				component_separators = " │ ",
				section_separators = "",

				theme = {
					normal = {
						a = { bg = colors.background, fg = colors.white },
						b = { bg = colors.background, fg = colors.white },
						c = { bg = colors.background, fg = colors.white },
					},
				},
			},

			extensions = {
				"nvim-tree",
				"neo-tree",
				"mason",
				"lazy",
				"fzf",
				"avante",
				fugitive_blame,
				"oil",
				"nvim-dap-ui",
				"quickfix",
				"fugitive",
			},
		})
	end,
}
