vim.pack.add({ "https://github.com/nvim-lualine/lualine.nvim" })

local function fugitive_head()
	return " " .. vim.fn.FugitiveHead()
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
		return "%#StatusLineDiagnosticError#" .. "" .. vim.fn.reg_recording()
	end
	return ""
end

local function lsp_status()
	if vim.bo.buftype ~= "" then
		return ""
	end

	local filetype = vim.bo.filetype
	if filetype == "" then
		return ""
	end

	local attached = {}
	for _, client in ipairs(vim.lsp.get_clients({ bufnr = 0 })) do
		attached[client.name] = true
	end

	-- copilot attaches to every filetype, so it can't signal whether the
	-- filetype's actual language server came up.
	local matches = {}
	for _, name in ipairs(require("config.lsp_servers")) do
		if name ~= "copilot" then
			local ok, config = pcall(function()
				return vim.lsp.config[name]
			end)

			if ok and config and vim.tbl_contains(config.filetypes or {}, filetype) then
				table.insert(matches, { name = name, config = config })
			end
		end
	end

	if #matches == 0 then
		return "%#StatusLineDiagnosticError#" .. "⚠ no LSP"
	end

	for _, match in ipairs(matches) do
		if attached[match.name] then
			return ""
		end
	end

	local first = matches[1]
	local cmd = type(first.config.cmd) == "table" and first.config.cmd[1] or nil
	if cmd and vim.fn.executable(cmd) == 0 then
		return "%#StatusLineDiagnosticError#" .. "⚠ " .. first.name .. " missing"
	end
	return "%#StatusLineDiagnosticError#" .. "⚠ " .. first.name .. " not attached"
end

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
					modified = " ",
					readonly = "",
					unnamed = "No name",
					newfile = "New file",
				},
			},
			{ "branch", icon = { "", align = "right" } },
		},
		lualine_b = {},
		lualine_c = {},
		lualine_x = {},
		lualine_y = {},
		lualine_z = {
			lsp_status,
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
