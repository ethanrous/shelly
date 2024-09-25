local opt = vim.opt
local g = vim.g
local o = vim.o

-- General settings
opt.autoread = true
opt.autoindent = true
opt.backup = false
opt.cmdheight = 0
opt.clipboard = "unnamed"
opt.completeopt = "menu,menuone,noinsert,preview"
opt.errorbells = false
opt.expandtab = true
opt.exrc = true
opt.fileencoding = "utf-8"
opt.hidden = true
opt.hlsearch = false
opt.ignorecase = true
opt.incsearch = true

opt.linespace = 0
opt.mouse = "a"
opt.number = true
opt.ruler = false
opt.scrolloff = 10
opt.shiftwidth = 4

-- Danny. Why. Why would you use this. I hate it.
-- opt.showmatch = true

opt.signcolumn = "yes"
opt.smartcase = true
opt.smartindent = true
opt.smarttab = true
opt.softtabstop = 4
opt.splitright = true
opt.swapfile = false
opt.tabstop = 4
opt.title = true
opt.ttimeoutlen = 0
opt.undofile = true
opt.cursorline = true

o.showmode = false
o.breakindent = true
o.gdefault = true

g.mapleader = " "

-- Toggle relative line numbering
-- vim.cmd("command! ToggleRelLines set relativenumber!")
