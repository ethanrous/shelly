vim.pack.add({
	"https://github.com/dlyongemallo/diffview.nvim",
	"https://github.com/lewis6991/gitsigns.nvim",
	"https://github.com/NeogitOrg/neogit",
})

-- Diffview: clean up tab/statusline display for diffview:// URIs
local function format_diffview_bufname(bufname)
	if not bufname:match("^diffview://") then
		return nil
	end

	local panel = bufname:match("([^/]+)$")
	if not panel then
		return "Diffview"
	end

	local labels = {
		DiffviewFilePanel = "Diffview: Files",
		DiffviewFileHistoryPanel = "Diffview: History",
	}

	if labels[panel] then
		return labels[panel]
	end

	-- Diff content buffers: diffview:///path/to/repo.git/COMMIT/relative/path
	local hash, relpath = bufname:match("%.git/(%x+)/(.+)$")
	if hash and relpath then
		return relpath .. " (" .. hash:sub(1, 7) .. ")"
	end

	local clean = panel:gsub("^Diffview", ""):gsub("Panel$", "")
	if clean ~= "" then
		return "Diffview: " .. clean
	end

	return "Diffview"
end

function _G.shelly_tabline()
	local s = ""
	for i = 1, vim.fn.tabpagenr("$") do
		s = s .. (i == vim.fn.tabpagenr() and "%#TabLineSel#" or "%#TabLine#")
		s = s .. "%" .. i .. "T"

		local winnr = vim.fn.tabpagewinnr(i)
		local bufnr = vim.fn.tabpagebuflist(i)[winnr]
		local bufname = vim.fn.bufname(bufnr)

		local label = format_diffview_bufname(bufname)
			or vim.fn.fnamemodify(bufname, ":t")
		if label == "" then
			label = "[No Name]"
		end

		if vim.fn.getbufvar(bufnr, "&modified") == 1 then
			label = label .. " +"
		end

		s = s .. " " .. label .. " "
	end

	return s .. "%#TabLineFill#%T"
end

vim.o.tabline = "%!v:lua.shelly_tabline()"

function _G.shelly_statusline()
	local bufname = vim.api.nvim_buf_get_name(0)
	local label = format_diffview_bufname(bufname)
	if label then
		return " " .. label
	end
	return " %f %h%m%r%=%l,%c%V %P "
end

vim.o.statusline = "%!v:lua.shelly_statusline()"

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
	require("diffview").toggle({})
end, { silent = true, desc = "Open the diff to the last commit" })

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
end, { silent = true, desc = "Open the diff to main" })

vim.keymap.set({ "n", "v" }, "<LEADER>gf", function()
	vim.cmd("DiffviewFileHistory %")
end, { silent = true, desc = "Open the file history" })

vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
	require("diffview").close()
end, { silent = true, desc = "Close diffview" })

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
end, { silent = true, desc = "Open the diff for the current line's commit" })

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
