local opt = vim.opt
local g = vim.g
local o = vim.o

g.node_host_prog = "~/.nvm/versions/node/v22.11.0/lib/node_modules"
g.sass_recommended_style = 0

-- General settings
opt.autoread = true
opt.autoindent = true
opt.backup = false
opt.cmdheight = 0
opt.clipboard = "unnamed"
opt.completeopt = "menu,menuone,noinsert,preview"
opt.errorbells = false
opt.expandtab = false
opt.exrc = true
opt.fileencoding = "utf-8"
opt.hidden = true
opt.ignorecase = true
opt.incsearch = true

opt.linespace = 0
opt.mouse = "a"
opt.number = true
opt.ruler = false
opt.scrolloff = 20

-- Danny. Why. Why would you use this. I hate it.
-- opt.showmatch = true

opt.signcolumn = "yes:1"

opt.smartcase = true
opt.smartindent = true
opt.smarttab = true
opt.softtabstop = 4
opt.shiftwidth = 4
opt.tabstop = 4
opt.splitright = true
opt.swapfile = false
opt.title = true
opt.ttimeoutlen = 0
opt.undofile = true
opt.inccommand = "nosplit"
opt.fillchars = opt.fillchars + "diff:╱"

o.cursorline = true
opt.cursorline = true
o.cursorlineopt = "both"

o.showmode = false
o.breakindent = true
o.gdefault = true
o.termguicolors = true

g.mapleader = " "

opt.number = true

opt.diffopt = "internal,filler,closeoff,indent-heuristic,linematch:60,algorithm:histogram"
-- o.guicursor = "n-v-c-sm:block,ci-ve:ver25,r-cr-o:hor20,i:block-blinkoff400-blinkon350"
-- o.guicursor = "n-v-c-sm-i:block,ci-ve:ver25,r-cr-o:hor20"

-- Toggle relative line numbering
-- vim.cmd("command! ToggleRelLines set relativenumber!")
--

-- From https://github.com/yetone/avante.nvim?tab=readme-ov-file
vim.opt.laststatus = 3
