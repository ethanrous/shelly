vim.pack.add({
	"https://github.com/amitds1997/remote-nvim.nvim",
	"https://github.com/stevearc/profile.nvim",
})

vim.keymap.set("v", "<Leader>s", function()
	init_codesnap()
	vim.cmd("CodeSnap")
end, { desc = "Screenshot code snippet" })

-- Remote-nvim
require("remote-nvim").setup()

-- Profile.nvim
local profile = require("profile")
profile.instrument_autocmds()

vim.keymap.set("n", "<f4>", function()
	if profile.is_recording() then
		profile.stop()
		vim.ui.input({ prompt = "Save profile to:", completion = "file", default = "profile.json" }, function(filename)
			if filename then
				profile.export(filename)
				vim.notify(("Wrote %s"):format(filename))
			end
		end)
	else
		local profileName = vim.fn.input("Enter profile name (or leave empty for full): ")
		vim.notify("Starting recording")
		profile.start(profileName .. "*")
	end
end)
