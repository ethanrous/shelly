------------------------
-- Keyboard shortcuts --
------------------------

-- Disable arrow keys
vim.keymap.set({ "n", "v" }, "<Up>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Down>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Left>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Right>", "<Nop>", { silent = true, noremap = true })

-- Text Manipulation --

-- Stop from moving back a space when exiting insert mode.
-- I'm sure this is a crime somewhere, but it bugs the hell out of me so... I'm doing it.
-- vim.keymap.set("i", "<Esc>", "<C-[>`^", { silent = true })

-- Ctrl + k: "Delete line"
vim.keymap.set("n", "<C-k>", "dd", { silent = true, noremap = true })

-- Ctrl + k: "Delete line"
vim.keymap.set("i", "<C-k>", "<C-[>`^Di<Right>", { silent = true, nowait = true })

-- in visual mode, d: "Delete to register k"
vim.keymap.set("v", "d", '"kd', { silent = true, nowait = true })

-- Ctrl + y: Emulate emacs yank
vim.keymap.set({ "i", "n" }, "<C-y>", "<Esc>pi<Right>", { silent = true, noremap = true })

-- Shift + Alt + Down: "Duplicate Selection"
vim.keymap.set("v", "<S-A-Down>", "y']i<Down><CR><Up><Esc>p", { silent = true })

-- Auto-indent on new line
vim.keymap.set("n", "i", function()
	return string.match(vim.api.nvim_get_current_line(), "%g") == nil and "cc" or "i"
end, { expr = true, noremap = true, silent = true })

-- General Navigation o7 --

-- Ctrl + e: emulate emacs goto end of line
vim.keymap.set("i", "<C-e>", "<Esc>A", { silent = true })
vim.keymap.set("n", "<C-e>", "$", { silent = true })

-- Duplicate line
vim.keymap.set({ "i", "n" }, "<A-S-Down>", "<Esc>mcyyp`cj", { silent = true })
vim.keymap.set({ "i", "n" }, "<A-S-j>", '<Esc>mc"kyy"kp`cj', { silent = true })
vim.keymap.set("v", "<A-S-j>", '"ky\']"kp', { silent = true })

vim.keymap.set("x", "p", [["_dP]]) -- Paste without yanking
-- vim.keymap.set("n", "p", '"0p', { silent = true })

-- Go [b]ack / go... [v]orward ??
vim.keymap.set("n", "gb", "<C-o>", { silent = true })
vim.keymap.set("n", "gv", "<C-i>", { silent = true })

-- Window/Buffer Control --
vim.keymap.set({ "i", "n" }, "<C-w><C-l>", "<Esc>:vert split<CR>", { silent = true })
vim.keymap.set({ "i", "n" }, "<A-s>", function()
	local harpoon = require("harpoon")
	if harpoon.ui.win_id ~= nil then
		vim.api.nvim_feedkeys("\x0d", "m", false)
		return
	end

	if harpoon:list()._length > 1 then
		harpoon:list():select(2)
		return
	end

	local key = vim.api.nvim_replace_termcodes("<C-^>", true, false, true)
	vim.api.nvim_feedkeys(key, "n", false)
end)

-- Save + exit --
vim.keymap.set({ "i", "n" }, "<C-q>", "<Esc>:wqa<CR>", { silent = true })
-- vim.keymap.set("n", "xx", ":update<CR>", { silent = true })

-- Move lines fast
vim.keymap.set({ "v", "n" }, "<A-j>", "10j", { silent = true })
vim.keymap.set({ "v", "n" }, "<A-k>", "10k", { silent = true })

-- Git --
vim.keymap.set({ "n", "v" }, "<LEADER>gd", function()
	require("diffview").open()
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<LEADER>gc", function()
	require("diffview").close()
end, { silent = true })

-- Selection --
-- Enter puts you in insert mode and makes a newline below or above you
-- vim.keymap.set("n", "<Enter>", "o", { silent = true, noremap = true })
-- vim.keymap.set("n", "<S-Enter>", "O", { silent = true, noremap = true })

-- TODO - https://neovim.io/doc/user/quickref.html#Q_to

-- Debugging --

vim.keymap.set("n", "<LEADER>ff", function()
	-- require("conform").format({
	-- 	lsp_fallback = true,
	-- 	async = true,
	-- 	timeout_ms = 500,
	-- })
	vim.cmd("silent update")
end, { silent = true })

vim.keymap.set("n", "<LEADER>FF", function()
	require("conform").format({
		lsp_fallback = true,
		async = false,
		timeout_ms = 500,
	})
	vim.cmd("silent update")
	local buf_name = vim.api.nvim_buf_get_name(0)
	if buf_name:sub(-#".go") == ".go" then
		vim.cmd("silent !swag fmt %")
	end
end, { silent = true })

-- Open file in Default Application (i.e. pdf in Chrome)
vim.keymap.set("n", "<leader>fo", function()
	vim.cmd("silent !open " .. vim.fn.expand("%"))
end, { silent = true })

-- Search selection in google
vim.keymap.set("v", "<leader>gs", function()
	local r = vim.fn.getregion(vim.fn.getpos("v"), vim.fn.getpos("."))
	vim.cmd("silent !~/shelly/zsh/source/gsearch " .. r[1])
end, { silent = true })

-- vim.keymap.set("n", "<leader>fg", function()
-- 	require("telescope").extensions.live_grep_args.live_grep_args()
-- 	-- callTelescope(require("telescope.builtin").live_grep)
-- end, { silent = true })
