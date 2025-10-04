------------------------
-- Keyboard shortcuts --
------------------------

local keymap = require("util.keymap")

-- Disable arrow keys
vim.keymap.set({ "n", "v" }, "<Up>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Down>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Left>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set({ "n", "v" }, "<Right>", "<Nop>", { silent = true, noremap = true })

-- Text Manipulation --

-- in visual mode, d: "Delete to register k"
vim.keymap.set("v", "d", '"kd', { silent = true, nowait = true })

-- Shift + Alt + Down: "Duplicate Selection"
vim.keymap.set("v", "<S-A-Down>", "y']i<Down><CR><Up><Esc>p", { silent = true })

-- Auto-indent on new line
vim.keymap.set("n", "i", function()
	return string.match(vim.api.nvim_get_current_line(), "%g") == nil and "cc" or "i"
end, { expr = true, noremap = true, silent = true })

-- General Navigation o7 --

-- Duplicate line
vim.keymap.set({ "i", "n" }, "<A-S-j>", '<Esc>mc"kyy"kp`cj', { silent = true })
vim.keymap.set("x", "<A-S-j>", function()
	if vim.fn.mode() == "V" then
		return '"ky\']"kpV`]'
	else
		return 'V"ky\']"kpV`]'
	end
end, { silent = true, expr = true })

vim.keymap.set("x", "p", [["_dP]]) -- Paste without yanking

-- Go [b]ack / go... [v]orward ??
vim.keymap.set("n", "gb", "<C-o>", { silent = true })
vim.keymap.set("n", "gv", "<C-i>", { silent = true })

-- Window/Buffer Control --
vim.keymap.set({ "i", "n" }, "<C-w><C-l>", "<Esc>:vert split<CR>", { silent = true })

-- Move lines fast
vim.keymap.set({ "v", "n" }, "<A-j>", "10j", { silent = true })
vim.keymap.set({ "v", "n" }, "<A-k>", "10k", { silent = true })

-- Selection --
-- Enter puts you in insert mode and makes a newline below or above you
-- vim.keymap.set("n", "<Enter>", "o", { silent = true, noremap = true })
-- vim.keymap.set("n", "<S-Enter>", "O", { silent = true, noremap = true })

-- TODO - https://neovim.io/doc/user/quickref.html#Q_to

-- Debugging --

vim.keymap.set("n", "<LEADER>ff", function()
	vim.cmd("silent write")
	-- vim.schedule(Format_hunks)
end, { silent = true })

vim.keymap.set("n", "<LEADER>lr", function()
	vim.cmd("LspRestart")
end, { silent = true })

vim.keymap.set("n", "<LEADER>ln", function()
	print(vim.o.rnu)
	vim.o.rnu = not vim.o.rnu
end)

vim.keymap.set("n", "<LEADER>FF", function()
	require("conform").format({
		lsp_fallback = true,
		async = false,
		timeout_ms = 500,
	})
	vim.cmd("silent update")
	local buf_name = vim.api.nvim_buf_get_name(0)
	if buf_name:sub(-#".go") == ".go" then
		vim.cmd("silent !swag fmt --exclude ./build")
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

vim.keymap.set(
	"n",
	"<leader>xc",
	":call setreg('+', expand('%:.'))<CR>",
	{ desc = "Copy current file relative path to clipboard" }
)

vim.keymap.set(
	"n",
	"<leader>xC",
	":call setreg('+', expand('%:p'))<CR>",
	{ desc = "Copy current file absolute path to clipboard" }
)

vim.keymap.set("n", "<leader>bd", ":w | %bd | e#<CR>", { desc = "Close all buffers except the current one" })

vim.keymap.set("n", "<leader>tt", ":tabn<CR>", { desc = "Switch to the most recent tab" })
vim.keymap.set("n", "<leader>tc", ":tabn<CR>", { desc = "Switch to the most recent tab" })

vim.keymap.set("n", "<leader>do", function()
	local file_path = vim.fn.expand("%:p")
	print(file_path)
	vim.cmd("silent !open -R " .. file_path)
end, { desc = "Open the currnet directory in Finder" })

-- Code Companion --
vim.keymap.set({ "n", "v" }, "<C-a>", "<cmd>CodeCompanionActions<cr>", { noremap = true })
vim.keymap.set({ "n", "v" }, "<LocalLeader>a", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

local function safeDelete(mode, lhs)
	if type(mode) == "table" then
		mode = mode[1]
	end

	if vim.fn.maparg(lhs, mode) ~= "" then
		vim.keymap.del(mode, lhs)
	end
end

-- Remove conflicting keymaps --
safeDelete("n", "gri")
safeDelete("n", "grt")
safeDelete("n", "grr")
safeDelete({ "n", "x" }, "gra")
safeDelete("n", "grn")
