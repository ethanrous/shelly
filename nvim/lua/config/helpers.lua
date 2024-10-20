local autocmd = vim.api.nvim_create_autocmd

-- Edit config
vim.api.nvim_create_user_command("Config", function()
	vim.cmd("edit ~/shelly")
end, { nargs = 0 })

-- Save all buffers when leaving the window
autocmd({ "BufLeave", "FocusLost", "InsertLeave" }, {
	pattern = "*",
	callback = function()
		vim.cmd("wa")
	end,
})

-- Set the number column "on" for all buffers (except NvimTree)
autocmd("BufEnter", {
	pattern = "*",
	callback = function()
		local bufname = vim.fn.expand("%")
		if string.sub(bufname, 1, 8) == "NvimTree" then
			vim.cmd("set nonumber")
		else
			vim.cmd("set number")
		end

		vim.api.nvim_set_hl(0, "DapBreakpoint", { fg = "#eaeaeb", bg = "#ffffff" })
		vim.api.nvim_set_hl(0, "DapLogPoint", { fg = "#eaeaeb", bg = "#ffffff" })
		vim.api.nvim_set_hl(0, "DapStopped", { fg = "#eaeaeb", bg = "#ffffff" })
		vim.api.nvim_set_hl(0, "Visual", { fg = "#000000", bg = "#ffffff" })
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
