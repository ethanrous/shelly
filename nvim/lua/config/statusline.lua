-- from https://github.com/cseickel/dotfiles/blob/main/config/nvim/lua/status.lua

local M = {}

local isempty = function(s)
	return s == nil or s == ""
end

vim.cmd([[
  highlight WinBar           guibg=None guifg=#BBBBBB gui=bold
  highlight WinBarHeader     guibg=None guifg=#BBBBBB gui=bold,underline
  highlight WinBarNC         guibg=None guifg=#888888 gui=bold
  highlight WinBarLocation   guibg=None guifg=#888888 gui=bold
  highlight WinBarModified   guibg=None guifg=#d7d787
  highlight WinBarGitDirty   guibg=None guifg=#d7afd7
  highlight WinBarIndicator  guibg=None guifg=#5fafd7 gui=bold
  highlight WinBarInactive   guibg=None guibg=#3a3a3a guifg=#777777 gui=bold

  highlight ModeC guibg=#2a273f guifg=#dddddd gui=bold " COMMAND 
  highlight ModeI guibg=#2a273f guifg=#ffff5f gui=bold " INSERT  
  highlight ModeT guibg=#2a273f guifg=#95e454 gui=bold " TERMINAL
  highlight ModeN guibg=#2a273f guifg=#87d7ff gui=bold " NORMAL  
  highlight ModeN guibg=#2a273f guifg=#5fafd7 gui=bold " NORMAL  
  highlight ModeV guibg=#2a273f guifg=#c586c0 gui=bold " VISUAL  
  highlight ModeR guibg=#2a273f guifg=#f44747 gui=bold " REPLACE 

  highlight StatusLine              guibg=#2a273f guifg=#908caa
  highlight StatusLineGit  gui=bold guibg=#2a273f guifg=#908caa
  highlight StatusLineCwd  gui=bold guibg=#2a273f guifg=#908caa
  highlight StatusLineFile gui=bold guibg=#2a273f guifg=#908caa
  highlight StatusLineMod           guibg=#2a273f guifg=#908caa
  highlight StatusLineError         guibg=#2a273f guifg=#eb6f92
  highlight StatusLineInfo          guibg=#2a273f guifg=#9ccfd8
  highlight StatusLineHint          guibg=#2a273f guifg=#c4a7e7
  highlight StatusLineWarn          guibg=#2a273f guifg=#f6c177
  highlight StatusLineChanges       guibg=#2a273f guifg=#908caa
  highlight StatusLineOutside       guibg=#2a273f guifg=#908caa
  highlight StatusLineTransition1   guibg=#2a273f guifg=#908caa
  highlight StatusLineTransition2   guibg=#2a273f guifg=#908caa

  function! FindHeader()
    " We need to find the header, it will be the first line that has:
    " | columnName |
    " in it.
    " We will only look at the first 100 lines.
    let b:table_header = 1
    for i in range(1, 100)
      let line = getline(i)
      let header = matchstr(line, '|\s.*\s|')
      if !empty(header)
        let b:table_header = i
        return
      endif
    endfor
  endfunction

  augroup dbout
    autocmd!
    autocmd BufReadPost *.dbout call FindHeader()
  augroup END
]])

M.get_neo_tree_context = function()
	local context = require("neo-tree.ui.selector").get_scrolled_off_node_text()
	if isempty(context) then
		return M.active_indicator()
	else
		return context
	end
	--local source = vim.b.neo_tree_source
	--if not isempty(source) then
	--  local label = require("neo-tree").config.source_selector.tab_labels[source]
	--  if not isempty(label) then
	--    return label
	--  end
	--end
	--return ""
end

M.get_header = function()
	local header_line = vim.b.table_header or 1
	-- Sets the winbar to the header line of the buffer, but only if the buffer is
	-- scrolled down so that the header is not visible.
	local view = vim.fn.winsaveview()
	if view.topline <= header_line then
		return nil
	else
		-- get the gutter width
		local winid = vim.api.nvim_get_current_win()
		local wininfo = vim.fn.getwininfo(winid)
		if #wininfo == 0 then
			return nil
		end
		local textoff = wininfo[1].textoff
		local gutter = string.rep(" ", textoff)

		local text = vim.fn.getline(header_line)
		-- remove the first_col - 1 characters from the beginning of the text
		if view.leftcol > 1 then
			text = text:sub(view.leftcol + 1, -1)
		end
		-- add textoff to the beginning of the text
		-- ensure the text is left aligned
		return gutter .. "%#WinBarHeader#" .. text .. "%*%<"
	end
end

M.get_statusline = function()
	local parts = {
		'%{fnamemodify(getcwd(), ":~")}/%*',
		"%<",
		"%{%v:lua.status.get_filename()%}",
		"%{IsBuffersModified()}%*",

		"%=",
		"%{%v:lua.status.get_diag_counts()%}",
		"%{%v:lua.status.get_git_changes()%}",
		"%{%v:lua.status.get_git_branch()%}",
	}
	return table.concat(parts)
end

-- mode_map copied from:
-- https://github.com/nvim-lualine/lualine.nvim/blob/5113cdb32f9d9588a2b56de6d1df6e33b06a554a/lua/lualine/utils/mode.lua
-- Copyright (c) 2020-2021 hoob3rt
-- MIT license, see LICENSE for more details.
local mode_map = {
	["n"] = "NORMAL",
	["no"] = "O-PENDING",
	["nov"] = "O-PENDING",
	["noV"] = "O-PENDING",
	["no\22"] = "O-PENDING",
	["niI"] = "NORMAL",
	["niR"] = "NORMAL",
	["niV"] = "NORMAL",
	["nt"] = "NORMAL",
	["v"] = "VISUAL",
	["vs"] = "VISUAL",
	["V"] = "V-LINE",
	["Vs"] = "V-LINE",
	["\22"] = "V-BLOCK",
	["\22s"] = "V-BLOCK",
	["s"] = "SELECT",
	["S"] = "S-LINE",
	["\19"] = "S-BLOCK",
	["i"] = "INSERT",
	["ic"] = "INSERT",
	["ix"] = "INSERT",
	["R"] = "REPLACE",
	["Rc"] = "REPLACE",
	["Rx"] = "REPLACE",
	["Rv"] = "V-REPLACE",
	["Rvc"] = "V-REPLACE",
	["Rvx"] = "V-REPLACE",
	["c"] = "COMMAND",
	["cv"] = "EX",
	["ce"] = "EX",
	["r"] = "REPLACE",
	["rm"] = "MORE",
	["r?"] = "CONFIRM",
	["!"] = "SHELL",
	["t"] = "TERMINAL",
}

local is_current = function()
	local winid = vim.g.actual_curwin
	if isempty(winid) then
		return false
	else
		return winid == tostring(vim.api.nvim_get_current_win())
	end
end

M.active_indicator = function()
	if is_current() then
		return "%#WinBarIndicator#▔▔▔▔▔▔▔▔%*"
	else
		return ""
	end
end
local icon_cache = {}

M.get_icon = function(filename, extension)
	if not filename then
		if vim.bo.filetype == "terminal" then
			filename = "terminal"
			extension = "terminal"
		else
			filename = vim.fn.expand("%:t")
		end
	end

	local cached = icon_cache[filename]
	if not cached then
		if not extension then
			extension = vim.fn.fnamemodify(filename, ":e")
		end
		local file_icon = require("nvim-web-devicons").get_icon(filename, extension)
		cached = " " .. file_icon .. "%*"
		icon_cache[filename] = cached
	end
	return cached
end

M.get_filename = function()
	local has_icon, icon = pcall(M.get_icon)
	if has_icon then
		if vim.b.db_name then
			return icon .. "%t [" .. vim.b.db_name .. "]"
		else
			return icon .. " %t"
		end
	else
		return " %t"
	end
end

local make_two_char = function(symbol)
	if symbol:len() == 1 then
		return symbol .. " "
	else
		return symbol
	end
end

local sign_cache = {}
local get_sign = function(severity, icon_only)
	if icon_only then
		local defined = vim.fn.sign_getdefined("DiagnosticSign" .. severity)
		if defined and defined[1] then
			return " " .. defined[1].text
		elseif severity and severity[1] then
			return " " .. severity[1]
		else
			if severity == "Error" then
				return "E"
			elseif severity == "Warn" then
				return "W"
			elseif severity == "Info" then
				return "I"
			elseif severity == "Hint" then
				return "H"
			else
				return "?"
			end
		end
	end

	local cached = sign_cache[severity]
	if cached then
		return cached
	end

	local defined = vim.fn.sign_getdefined("DiagnosticSign" .. severity)
	local text, highlight
	defined = defined and defined[1]
	if defined and defined.text and defined.texthl then
		text = " " .. make_two_char(defined.text)
		highlight = defined.texthl
	else
		text = " " .. severity:sub(1, 1)
		highlight = "Diagnostic" .. severity
	end
	cached = "%#" .. highlight .. "#" .. text .. "%*"
	sign_cache[severity] = cached
	return cached
end

M.get_diag = function()
	local d = vim.diagnostic.get(0)
	if #d == 0 then
		return ""
	end

	local min_severity = 100
	for _, diag in ipairs(d) do
		if diag.severity < min_severity then
			min_severity = diag.severity
		end
	end
	local severity = ""
	if min_severity == vim.diagnostic.severity.ERROR then
		severity = "Error"
	elseif min_severity == vim.diagnostic.severity.WARN then
		severity = "Warn"
	elseif min_severity == vim.diagnostic.severity.INFO then
		severity = "Info"
	elseif min_severity == vim.diagnostic.severity.HINT then
		severity = "Hint"
	else
		return ""
	end

	return get_sign(severity)
end

M.get_diag_counts = function()
	local d = vim.diagnostic.get(0)
	if #d == 0 then
		return ""
	end

	local grouped = {}
	for _, diag in ipairs(d) do
		local severity = diag.severity
		if not grouped[severity] then
			grouped[severity] = 0
		end
		grouped[severity] = grouped[severity] + 1
	end

	local result = ""
	local S = vim.diagnostic.severity
	if grouped[S.ERROR] then
		result = result .. "%#StatusLineError#" .. get_sign("Error", true) .. grouped[S.ERROR] .. "%* "
	end
	if grouped[S.WARN] then
		result = result .. "%#StatusLineWarn#" .. get_sign("Warn", true) .. grouped[S.WARN] .. "%* "
	end
	if grouped[S.INFO] then
		result = result .. "%#StatusLineInfo#" .. get_sign("Info", true) .. grouped[S.INFO] .. "%* "
	end
	if grouped[S.HINT] then
		result = result .. "%#StatusLineHint#" .. get_sign("Hint", true) .. grouped[S.HINT] .. "%* "
	end
	return result
end

M.get_git_branch = function()
	local branch = vim.b.git_branch
	if isempty(branch) then
		return ""
	else
		return " " .. branch .. " %*"
	end
end

M.get_git_changes = function()
	local changes = vim.b.gitsigns_status
	if isempty(changes) then
		return ""
	else
		return "%#StatusLineChanges#" .. changes .. "  %*"
	end
end

M.get_git_dirty = function()
	local dirty = vim.b.gitsigns_status
	if isempty(dirty) then
		return " "
	else
		return "%#WinBarGitDirty# %*"
	end
end

M.get_location = function()
	local success, result = pcall(function()
		if not is_current() then
			return ""
		end
		local provider = require("nvim-navic")
		if not provider.is_available() then
			return ""
		end

		local location = provider.get_location({})
		if not isempty(location) and location ~= "error" then
			return "%#WinBarLocation#  " .. location .. "%*"
		else
			return ""
		end
	end)

	if not success then
		return ""
	end
	return result
end

M.get_mode = function()
	if not is_current() then
		--return "%#WinBarInactive# win #" .. vim.fn.winnr() .. " %*"
		return "%#WinBarInactive#  #" .. vim.fn.winnr() .. "  %*"
	end
	local mode_code = vim.api.nvim_get_mode().mode
	local mode = mode_map[mode_code] or string.upper(mode_code)
	return "%#Mode" .. mode:sub(1, 1) .. "# " .. mode .. " %*"
end

vim.cmd([[
  function! GitBranch()
    return trim(system("git -C " . getcwd() . " branch --show-current 2>/dev/null"))
  endfunction

  augroup GitBranchGroup
      autocmd!
      autocmd BufEnter * let b:git_branch = GitBranch()
  augroup END

  " [+] if only current modified, [+3] if 3 modified including current buffer.
  " [3] if 3 modified and current not, "" if none modified.
  function! IsBuffersModified()
      let cnt = len(filter(getbufinfo(), 'v:val.changed == 1'))
      return cnt == 0 ? "" : "*"
  endfunction
]])

_G.status = M
vim.o.statusline = "%{%v:lua.status.get_statusline()%}"

vim.api.nvim_create_autocmd({ "ModeChanged" }, {
	pattern = "*",
	callback = function()
		vim.schedule(function()
			vim.cmd("redraw")
		end)
	end,
})

return M
