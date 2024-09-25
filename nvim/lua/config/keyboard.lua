------------------------
-- Keyboard shortcuts --
------------------------

-- Text Manipulation --
vim.keymap.set("i", "<Esc>", "<C-[>`^", { silent = true })

vim.keymap.set("n", "<C-k>", "dd", { silent = true })
vim.keymap.set("i", "<C-k>", "<C-[>`^Di<Right>", { silent = true })

vim.keymap.set({ "i", "n" }, "<C-y>", "<Esc>pi", { silent = true })

vim.keymap.set("v", "<A-S-Down>", "y']i<Enter><Up><Esc>p", { silent = true })

-- General Navigation --
vim.keymap.set({ "i", "n" }, "<C-e>", "<esc>A", { silent = true })
vim.keymap.set({ "i", "n" }, "<A-S-Down>", "<esc>yypA", { silent = true })
vim.keymap.set("i", "<C-a>", "<esc>^i", { silent = true })
vim.keymap.set("n", "<C-a>", "^", { silent = true })
vim.keymap.set("n", "<D-Left>", "^", { silent = true })
vim.keymap.set("n", "<D-Right>", "$", { silent = true })
vim.keymap.set("i", "<D-Left>", "<esc>^i", { silent = true })
vim.keymap.set("i", "<D-Right>", "<esc>A", { silent = true })
vim.keymap.set("i", "<D-Enter>", "$<Enter>", { silent = true })

vim.keymap.set("i", "<D-Up>", "<esc>gg<C-0>i", { silent = true })
vim.keymap.set("n", "<D-Up>", "<esc>gg<C-0>", { silent = true })

vim.keymap.set("i", "<D-Down>", "<esc>Gi", { silent = true })
vim.keymap.set("n", "<D-Down>", "G", { silent = true })

vim.keymap.set("n", "gb", "<C-o>", { silent = true })
vim.keymap.set("n", "gv", "<C-i>", { silent = true })

vim.keymap.set({ "n", "v" }, "<A-Right>", "w", { silent = true })
vim.keymap.set({ "n", "v" }, "<A-Left>", "b", { silent = true })

vim.keymap.set("i", "<A-Right>", "<Esc><Right>wi", { silent = true })
vim.keymap.set("i", "<A-Left>", "<Esc>bi", { silent = true })

-- Diagnostics --
vim.keymap.set("n", "<LEADER>d", vim.diagnostic.open_float, { silent = true })
vim.keymap.set({ "n", "i" }, "<A-d>", vim.diagnostic.goto_next, { silent = true })
vim.keymap.set({ "n", "i" }, "<A-S-d>", vim.diagnostic.goto_prev, { silent = true })

-- Window/Buffer Control --
vim.keymap.set({ "i", "n" }, "<C-w><C-l>", "<Esc>:vert split<Enter>", { silent = true })
-- vim.keymap.set( { 'i', 'n' }, '<D-e>', require('fzf-lua').files, { desc = "Fzf Files", silent = true})
vim.keymap.set({ "i", "n" }, "<A-a>", "<Esc><C-^>", { silent = true })

-- Save + exit --
vim.keymap.set({ "i", "n" }, "<C-q>", "<Esc>:wqa<Enter>", { silent = true })
vim.keymap.set({ "i", "n" }, "<C-x><C-s>", "<Esc>:w<Enter>", { silent = true })

-- Selection --
vim.keymap.set("i", "<S-Right>", "<Esc><Right>v<Right>", { silent = true })
vim.keymap.set("n", "<S-Right>", "v<Right>", { silent = true })

vim.keymap.set("i", "<S-Left>", "<Esc>v<Left>", { silent = true })
vim.keymap.set("n", "<S-Left>", "v<Left>", { silent = true })

-- Shift + Up/Down: "Select up/down line"
vim.keymap.set({ "n", "i" }, "<S-Up>", "<Esc>v<Up>", { silent = true })
vim.keymap.set({ "n", "i" }, "<S-Down>", "<Esc>v<Down>", { silent = true })

-- CMD + Shift + Left/Right: "Select to start/end of line"
vim.keymap.set("n", "<D-S-Right>", "v$<Left>", { silent = true })
vim.keymap.set("n", "<D-S-Left>", "v^", { silent = true })

vim.keymap.set("v", "<D-S-Right>", "$<Left>", { silent = true })
vim.keymap.set("v", "<D-S-Left>", "v^", { silent = true })

vim.keymap.set("i", "<D-S-Right>", "<Esc>`^v$<Left>", { silent = true })
vim.keymap.set("i", "<D-S-Left>", "<Esc>v^", { silent = true })

vim.keymap.set("v", "<S-Right>", "<Right>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Left>", "<Left>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Up>", "<Up>", { silent = true, noremap = true })
vim.keymap.set("v", "<S-Down>", "<Down>", { silent = true, noremap = true })

vim.keymap.set("v", "<Right>", "<Esc>", { silent = true })
vim.keymap.set("v", "<Left>", "<Esc>", { silent = true })
vim.keymap.set("v", "<Up>", "<Esc>", { silent = true })
vim.keymap.set("v", "<Down>", "<Esc>", { silent = true })

vim.keymap.set("v", "<A-Right>", "<Esc>e", { silent = true })
vim.keymap.set("v", "<A-Left>", "<Esc>b", { silent = true })

vim.keymap.set("v", "<D-Right>", "<Esc>$", { silent = true })
vim.keymap.set("v", "<D-Left>", "<Esc>^", { silent = true })
vim.keymap.set("v", "<Left>", "<Esc><Left>", { silent = true })
vim.keymap.set("v", "<Right>", "<Esc><Right>", { silent = true })
vim.keymap.set("v", "<C-k>", "di", { silent = true })

-- Shift + Alt + Left/Right: "Navigate/Select to start/end of word"
vim.keymap.set("v", "<S-A-Right>", "e", { silent = true })
vim.keymap.set("v", "<S-A-Left>", "b", { silent = true })

vim.keymap.set("i", "<S-A-Right>", "<Esc>`^ve", { silent = true })
vim.keymap.set("i", "<S-A-Left>", "<Esc>vb", { silent = true })

vim.keymap.set("n", "<S-A-Right>", "ve", { silent = true })
vim.keymap.set("n", "<S-A-Left>", "vb", { silent = true })

vim.keymap.set("n", "<Enter>", " o", { silent = true })
vim.keymap.set("n", "<S-Enter>", " O", { silent = true })

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
vim.keymap.set("n", "<A-s>", function()
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
