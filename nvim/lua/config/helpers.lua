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

-- Set the number column "on" for all buffers (except NvimTree)
autocmd("BufEnter", {
	pattern = "*",
	callback = function()
		vim.cmd("set number")
		local harpoon = require("harpoon")

		local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
		if string.find(bufname, ":/") then
			return
		end

		if bufname ~= "" and vim.o.buftype == "" then
			local item = harpoon:list().config.create_list_item(harpoon:list().config)
			harpoon:list():remove(item)
			if Starts_with(item.value, "/Users/") then
				return
			end
			harpoon:list():prepend()
			harpoon:list():select(1)
		end

		-- vim.api.nvim_set_hl(0, "DapBreakpoint", { fg = "#eaeaeb", bg = "#ffffff" })
		-- vim.api.nvim_set_hl(0, "DapLogPoint", { fg = "#eaeaeb", bg = "#ffffff" })
		-- vim.api.nvim_set_hl(0, "DapStopped", { fg = "#eaeaeb", bg = "#ffffff" })
		-- update_hl("Visual", { fg = "#000000", bg = "#ffffff" })
		-- update_hl("Normal", { fg = "#ffffff" })
	end,
})

-- Highlight yanked text
autocmd("TextYankPost", {
	callback = function()
		vim.highlight.on_yank()
	end,
	desc = "Briefly highlight yanked text",
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

-- autocmd("FileType", {
-- 	pattern = { "qf" },
-- 	command = [[nnoremap <buffer> <CR> <CR>:cclose<CR>]],
-- })

-- autocmd("ModeChanged", {
-- 	callback = function()
-- 		vim.cmd("redraw")
-- 	end,
-- })

-- autocmd({ "BufWritePost" }, {
-- 	pattern = "*.go",
-- 	command = "!swag fmt %",
-- })

usercmd("Swag", function()
	vim.cmd("!swag fmt %")
end, { nargs = 0 })

usercmd("Help", function(args)
	if not args["args"] then
		return
	end
	vim.cmd("vert help " .. args["args"])
end, { nargs = 1 })

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
