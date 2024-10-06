------------------------
-- Keyboard shortcuts --
------------------------

-- Disable arrow keys
vim.keymap.set("n", "<Up>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Down>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Left>", "<Nop>", { silent = true, noremap = true })
vim.keymap.set("n", "<Right>", "<Nop>", { silent = true, noremap = true })

vim.keymap.set("n", "<A-k>", "<Up>", { silent = true, noremap = true })
vim.keymap.set("n", "<A-j>", "<Down>", { silent = true, noremap = true })
vim.keymap.set("n", "<A-h>", "<Left>", { silent = true, noremap = true })
vim.keymap.set("n", "<A-l>", "<Right>", { silent = true, noremap = true })

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

-- General Navigation o7 --

-- Ctrl + e: emulate emacs goto end of line
vim.keymap.set("i", "<C-e>", "<Esc>A", { silent = true })
vim.keymap.set("n", "<C-e>", "$", { silent = true })

-- Ctrl + a: emulate emacs goto start of line
vim.keymap.set("i", "<C-a>", "<Esc>^i", { silent = true })
vim.keymap.set("n", "<C-a>", "^", { silent = true })

-- Duplicate line
vim.keymap.set({ "i", "n" }, "<A-S-Down>", "<Esc>mcyyp`cj", { silent = true })
vim.keymap.set({ "i", "n" }, "<A-S-j>", "<Esc>mcyyp`cj", { silent = true })
vim.keymap.set("v", "<A-S-j>", "y']p", { silent = true })

-- Default paste to non-volatile register
vim.keymap.set("n", "p", '"0p', { silent = true })

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

-- Selection --

-- Shift + Right/Left: "Select right/left character"
vim.keymap.set("i", "<S-Right>", "<Esc><Right>v<Right>", { silent = true })
vim.keymap.set("n", "<S-Right>", "v<Right>", { silent = true })
vim.keymap.set("i", "<S-Left>", "<Esc>v<Left>", { silent = true })
vim.keymap.set("n", "<S-Left>", "v<Left>", { silent = true })

-- Shift + Up/Down: "Select up/down line"
vim.keymap.set({ "n", "i" }, "<S-Up>", "<Esc><S-v>k", { silent = true })
vim.keymap.set({ "n", "i" }, "<S-Down>", "<Esc><S-v>j", { silent = true })

-- CMD + Shift + Left/Right: "Select to start/end of line"
-- vim.keymap.set("n", "<D-S-Right>", "v$<Left>", { silent = true })
-- vim.keymap.set("n", "<D-S-Left>", "v^", { silent = true })

-- CMD + Shift + Left/Right: "Select to start/end of line"
-- Still working in visual mode for some reason
vim.keymap.set("v", "<D-S-Right>", "$<Left>", { silent = true })
vim.keymap.set("v", "<D-S-Left>", "v^", { silent = true })

-- CMD + Shift + Left/Right: "Select to start/end of line"
-- vim.keymap.set("i", "<D-S-Right>", "<Esc>`^v$<Left>", { silent = true })
-- vim.keymap.set("i", "<D-S-Left>", "<Esc>v^", { silent = true })

-- Shift + Alt + Up/Down: "Navigate/Select up/down line"
vim.keymap.set("v", "<S-Right>", "<Right>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Left>", "<Left>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Up>", "<Up>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Down>", "<Down>", { silent = true, noremap = true })

-- Visual Mode: Left/Right/Up/Down (without Shift): "Exit Visual Mode"
vim.keymap.set("v", "<Right>", "<Esc>", { silent = true })
vim.keymap.set("v", "<Left>", "<Esc>", { silent = true })
vim.keymap.set("v", "<Up>", "<Esc><Up>", { silent = true })
vim.keymap.set("v", "<Down>", "<Esc><Down>", { silent = true })

-- Visual Mode: Alt + Left/Right: "Select to start/end of word"
vim.keymap.set("v", "<A-Right>", "<Esc>e", { silent = true })
vim.keymap.set("v", "<A-Left>", "<Esc>b", { silent = true })

-- Shift + Alt + Left/Right: "Navigate/Select to start/end of word"
vim.keymap.set("v", "<S-A-Right>", "e", { silent = true })
vim.keymap.set("v", "<S-A-Left>", "b", { silent = true })

-- Normal Mode: Alt + Left/Right: "Navigate to start/end of word"
vim.keymap.set("n", "<A-Right>", "w", { silent = true })
vim.keymap.set("n", "<A-Left>", "b", { silent = true })

-- Navigate words in insert mode
vim.keymap.set("i", "<A-Right>", "<Esc><Right>wi", { silent = true })
vim.keymap.set("i", "<A-Left>", "<Esc>bi", { silent = true })

-- Select words in insert mode
vim.keymap.set("i", "<S-A-Right>", "<Esc>`^ve", { silent = true })
vim.keymap.set("i", "<S-A-Left>", "<Esc>vb", { silent = true })

-- Select words in normal mode
vim.keymap.set("n", "<S-A-Right>", "ve", { silent = true })
vim.keymap.set("n", "<S-A-Left>", "vb", { silent = true })

-- Enter puts you in insert mode and makes a newline below or above you
vim.keymap.set("n", "<Enter>", "A<CR>", { silent = true, noremap = true })
vim.keymap.set("n", "<S-Enter>", "^i<CR><Up>", { silent = true, noremap = true })

-- No longer working cuz tmux doesnt like my CMD key
-- vim.keymap.set("v", "<D-Right>", "<Esc>$", { silent = true })
-- vim.keymap.set("v", "<D-Left>", "<Esc>^", { silent = true })
-- vim.keymap.set("v", "<Left>", "<Esc><Left>", { silent = true })
-- vim.keymap.set("v", "<Right>", "<Esc><Right>", { silent = true })
-- vim.keymap.set("v", "<C-k>", "di", { silent = true })

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
-- vim.keymap.set("n", "<A-s>", function()
-- 	require("dap").step_over()
-- end, { silent = true })

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
