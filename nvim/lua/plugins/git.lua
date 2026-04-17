vim.pack.add({
	"https://github.com/sindrets/diffview.nvim",
	"https://github.com/lewis6991/gitsigns.nvim",
	"https://github.com/NeogitOrg/neogit",
})

-- Diffview
local diff_actions = require("diffview.actions")
require("diffview").setup({
	keymaps = {
		view = {
			{
				"n",
				"gf",
				function()
					local tab_nmbr = vim.fn.tabpagenr()
					diff_actions.goto_file_edit()
					vim.cmd("tabclose " .. tab_nmbr)
				end,
				{ desc = "Open the file in the previous tabpage" },
			},
		},
	},
})

vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
	require("diffview").open({})
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>dm", function()
	local branch = "main"
	local result = vim.fn.system("git branch | grep master")
	if result ~= "" then
		branch = "master"
	end
	result = vim.fn.system("git branch | grep devel")
	if result ~= "" then
		branch = "devel"
	end
	require("diffview").open({ "origin/" .. branch .. "..." })
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>gf", function()
	vim.cmd("DiffviewFileHistory %")
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
	require("diffview").close()
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>bc", function()
	local line = vim.fn.line(".")
	local cmd = "git blame -L " .. line .. "," .. line .. " " .. vim.fn.expand("%")
	local output = vim.fn.system(cmd)
	local spaceIndex = string.find(output, " ")
	if spaceIndex == 0 then
		print("No commit hash found")
		return
	end
	local commitHash = string.sub(output, 0, spaceIndex - 1)
	require("diffview").open({ commitHash .. "~.." .. commitHash })
end, { silent = true })

-- Gitsigns
local gitsigns = require("gitsigns")
gitsigns.setup({
	preview_config = { border = "solid" },
	current_line_blame = true,
	current_line_blame_opts = {
		virt_text_pos = "eol",
		virt_text_priority = 0,
	},
})

vim.keymap.set({ "n" }, "]h", function()
	gitsigns.nav_hunk("next")
end, { silent = true })
vim.keymap.set({ "n" }, "[h", function()
	gitsigns.nav_hunk("prev")
end, { silent = true })
vim.keymap.set({ "n" }, "<leader>hh", function()
	gitsigns.preview_hunk_inline()
end, { silent = true })
vim.keymap.set({ "n" }, "<leader>hH", function()
	gitsigns.preview_hunk()
end, { silent = true })
vim.keymap.set({ "o", "x" }, "ih", gitsigns.select_hunk)
vim.keymap.set({ "n" }, "<leader>bl", function()
	gitsigns.blame_line({ full = true })
end)
vim.keymap.set({ "n" }, "<leader>hr", function()
	gitsigns.reset_hunk()
end)
vim.keymap.set({ "n" }, "<leader>gb", gitsigns.blame)

-- Neogit (no eager setup call — it's configured on-first-open via the keymap)
vim.keymap.set({ "n", "v" }, "<leader>gg", function()
	if Close_win_if_open("NeogitStatus") then
		return
	end
	Close_win_if_open("fugitiveblame")
	require("neogit").open({ kind = "vsplit" })
end, { silent = true })
