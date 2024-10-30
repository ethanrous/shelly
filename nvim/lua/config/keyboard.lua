------------------------
-- Keyboard shortcuts --
------------------------

-- Disable arrow keys
vim.keymap.set("n", "<Up>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Down>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Left>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Right>", "<Nop>", { silent = true, noremap = true })

-- Text Manipulation --

-- Stop from moving back a space when exiting insert mode.
-- I'm sure this is a crime somewhere, but it bugs the hell out of me so... I'm doing it.
-- vim.keymap.set("i", "<Esc>", "<C-[>`^", { silent = true })

-- Ctrl + k: "Delete line"
vim.keymap.set("n", "<C-k>", "dd", { silent = true, noremap = true })

-- Ctrl + k: "Delete line"
vim.keymap.set("i", "<C-k>", "<C-[>`^Di<Right>", { silent = true, nowait = true })

-- Ctrl + y: Emulate emacs yank
vim.keymap.set({ "i", "n" }, "<C-y>", "<Esc>pi<Right>", { silent = true, noremap = true })

-- Shift + Alt + Down: "Duplicate Selection"
vim.keymap.set("v", "<S-A-Down>", "y']i<Down><CR><Up><Esc>p", { silent = true })

-- Auto-indent on new line
vim.keymap.set("n", "i", function()
	return string.match(vim.api.nvim_get_current_line(), "%g") == nil and "cc" or "i"
end, { expr = true, noremap = true })

-- General Navigation o7 --

-- Ctrl + e: emulate emacs goto end of line
vim.keymap.set("i", "<C-e>", "<Esc>A", { silent = true })
vim.keymap.set("n", "<C-e>", "$", { silent = true })

-- Ctrl + a: emulate emacs goto start of line
-- vim.keymap.set("i", "<C-a>", "<Esc>^i", { silent = true })
-- vim.keymap.set("n", "<C-a>", "^", { silent = true })

-- vim.keymap.set("v", "o", "%", { silent = true })

-- Duplicate line
vim.keymap.set({ "i", "n" }, "<A-S-Down>", "<Esc>mcyyp`cj", { silent = true })
vim.keymap.set({ "i", "n" }, "<A-S-j>", "<Esc>mcyyp`cj", { silent = true })
vim.keymap.set("v", "<A-S-j>", "y']p", { silent = true })

-- Default paste to non-volatile register
vim.keymap.set("x", "p", [["_dP]]) -- Paste without yanking
-- vim.keymap.set("n", "p", '"0p', { silent = true })

-- Go [b]ack / go... [v]orward ??
vim.keymap.set("n", "gb", "<C-o>", { silent = true })
vim.keymap.set("n", "gv", "<C-i>", { silent = true })

-- Window/Buffer Control --
vim.keymap.set({ "i", "n" }, "<C-w><C-l>", "<Esc>:vert split<CR>", { silent = true })
-- vim.keymap.set( { 'i', 'n' }, '<D-e>', require('fzf-lua').files, { desc = "Fzf Files", silent = true})
vim.keymap.set({ "i", "n" }, "<A-s>", "<Esc><C-^>")

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
vim.keymap.set("n", "<A-b>", function()
	require("dap").toggle_breakpoint()
end, { silent = true })

-- Continue / Run to Cursor
vim.keymap.set("n", "<A-c>", function()
	require("dap").continue()
end, { silent = true })
vim.keymap.set("n", "<A-S-c>", function()
	require("dap").run_to_cursor()
end, { silent = true })

vim.keymap.set("n", "<A-r>", function()
	require("dap").run_last()
end, { silent = true })

vim.keymap.set("n", "<A-z>", function()
	require("dap").up()
end, { silent = true })
vim.keymap.set("n", "<A-x>", function()
	require("dap").down()
end, { silent = true })
vim.keymap.set("n", "<A-n>", function()
	require("dap").step_over()
end, { silent = true })

vim.keymap.set("n", "<A-S-z>", function()
	require("dap").step_out()
end, { silent = true })
vim.keymap.set("n", "<A-S-x>", function()
	require("dap").step_into()
end, { silent = true })

-- Show Debug UI
vim.keymap.set("n", "<D-S-d>", function()
	require("dapui").toggle()
end, { silent = true })
