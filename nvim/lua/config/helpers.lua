local autocmd = vim.api.nvim_create_autocmd
local usercmd = vim.api.nvim_create_user_command

-- Edit config
usercmd("Config", function()
	vim.cmd("edit ~/shelly")
end, { nargs = 0 })

-- Save all buffers when leaving the window
autocmd({ "BufLeave", "FocusLost" }, {
	pattern = "*",
	callback = function()
		local buf = vim.api.nvim_get_current_buf()
		local readonly = vim.api.nvim_buf_get_option(buf, "readonly")
		if readonly or vim.o.buftype == "acwrite" then
			return
		end

		local buf_modified = vim.api.nvim_buf_get_option(buf, "modified")
		if buf_modified and vim.fn.expand("%s") ~= "" then
			require("conform").format({
				lsp_fallback = true,
				async = true,
				timeout_ms = 500,
			})

			vim.cmd("silent update")
			return
		end
	end,
})

autocmd("BufEnter", {
	pattern = "*",
	callback = function()
		local harpoon = require("harpoon")

		local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
		if
			bufname == ""
			or vim.o.buftype ~= ""
			or vim.bo.filetype == ""
			or bufname == "."
			or string.find(bufname, ":/")
			or string.find(bufname, "node_modules")
		then
			return
		end

		vim.cmd("set number")

		local item = harpoon:list().config.create_list_item(harpoon:list().config)
		harpoon:list():remove(item)
		if Starts_with(item.value, "/Users/") then
			return
		end
		harpoon:list():prepend()

		while harpoon:list()._length > 100 do
			harpoon:list():remove_at(harpoon:list()._length)
		end
		harpoon:list():select(1)
	end,
})

--Open quickfix and help windows to the right instead of below
autocmd("FileType", {
	pattern = { "qf", "help" },
	callback = function()
		vim.cmd("wincmd L")
	end,
})

-- Highlight yanked text
autocmd("TextYankPost", {
	callback = function()
		vim.hl.on_yank()
	end,
	desc = "Briefly highlight yanked text",
})

local function gotoHarpoon()
	local harpoon = require("harpoon")
	if harpoon:list()._length > 1 then
		harpoon:list():select(1)
	end
end

autocmd("BufReadPost", {
	pattern = "*",
	callback = function()
		local mk = vim.api.nvim_buf_get_mark(0, ".")
		if mk[1] == 0 then
			return
		end
		if mk[1] > vim.api.nvim_buf_line_count(0) then
			return
		end
		vim.cmd("'.")
	end,
})

vim.api.nvim_create_autocmd("VimLeavePre", {
	pattern = "*",
	callback = function()
		if vim.g.savesession then
			local cwd = vim.fn.getcwd()
			local new_path = string.gsub(cwd, "/", "-")
			new_path = string.sub(new_path, 2)
			vim.api.nvim_command("mks! ~/.config/nvim/session/" .. new_path .. ".session.vim")
		end
	end,
})

autocmd("CursorMoved", {
	group = vim.api.nvim_create_augroup("auto-hlsearch", { clear = true }),
	callback = function()
		if vim.v.hlsearch == 1 and vim.fn.searchcount().exact_match == 0 then
			vim.schedule(function()
				vim.cmd.nohlsearch()
			end)
		end
	end,
})

vim.api.nvim_create_autocmd("FileType", {
	pattern = "eruby.yaml",
	command = "set filetype=yaml",
})

function Dump(o)
	if type(o) == "table" then
		local s = "{ "
		for k, v in pairs(o) do
			if type(k) ~= "number" then
				k = '"' .. k .. '"'
			end
			s = s .. "[" .. k .. "] = " .. Dump(v) .. ","
		end
		return s .. "} "
	else
		return tostring(o)
	end
end

usercmd("Swag", function()
	vim.cmd("!swag fmt %")
end, { nargs = 0 })

usercmd("Cppath", function()
	local path = vim.fn.expand("%:p")
	vim.fn.setreg("+", path)
	vim.notify('Copied "' .. path .. '" to the clipboard!')
end, {})

function Region_to_text(region)
	local text = ""
	local maxcol = vim.v.maxcol
	for line, cols in vim.spairs(region) do
		local endcol = cols[2] == maxcol and -1 or cols[2]
		local chunk = vim.api.nvim_buf_get_text(0, line, cols[1], line, endcol, {})[1]
		text = ("%s%s\n"):format(text, chunk)
	end
	return text
end

function Starts_with(str, start)
	return str:sub(1, #start) == start
end

function Ends_with(str, ending)
	return ending == "" or str:sub(-#ending) == ending
end

function Close_win_if_open(filetype)
	for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
		local bufnr = vim.api.nvim_win_get_buf(win)
		if vim.bo[bufnr].filetype == filetype then
			vim.api.nvim_win_close(win, false)
			return true
		end
	end
	return false
end
