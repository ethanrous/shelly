local autocmd = vim.api.nvim_create_autocmd

vim.api.nvim_create_user_command("Config", function()
	vim.cmd("edit ~/shelly")
end, { nargs = 0 })

autocmd({ "BufLeave", "FocusLost" }, {
	pattern = "*",
	callback = function()
		vim.cmd("wa")
	end,
})

autocmd("BufEnter", {
	pattern = "*",
	callback = function()
		local bufname = vim.fn.expand("%")
		if string.sub(bufname, 1, 8) == "NvimTree" then
			vim.cmd("set nonumber")
		else
			vim.cmd("set number")
		end
	end,
})

autocmd("TextYankPost", {
	callback = function()
		vim.highlight.on_yank()
	end,
	desc = "Briefly highlight yanked text",
})
