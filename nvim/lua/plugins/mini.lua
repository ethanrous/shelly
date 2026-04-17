vim.pack.add({
	"https://github.com/echasnovski/mini.ai",
	"https://github.com/echasnovski/mini.splitjoin",
	"https://github.com/echasnovski/mini.bracketed",
	"https://github.com/echasnovski/mini.notify",
	"https://github.com/echasnovski/mini.comment",
	"https://github.com/echasnovski/mini.move",
	"https://github.com/echasnovski/mini.surround",
	"https://github.com/echasnovski/mini.misc",
})

-- Better a/i movements
require("mini.ai").setup()

-- Switch between single-line and multiline statements
local splitjoin = require("mini.splitjoin")
splitjoin.setup()
vim.keymap.set("n", "<leader>ts", function()
	splitjoin.toggle()
end, { silent = true, desc = "Toggle between single-line and multiline statements" })

-- Bracketed movement
require("mini.bracketed").setup()

-- Notifications (override vim.notify)
local notify = require("mini.notify")
notify.setup({
	lsp_progress = { enable = false },
	window = { config = { border = "solid" } },
})
vim.notify = notify.make_notify({
	ERROR = { duration = 5000 },
	WARN = { duration = 4000 },
	INFO = { duration = 2000 },
})

-- Comment (with treesitter-aware commentstring)
require("mini.comment").setup({
	options = {
		custom_commentstring = function()
			local ok, cs = pcall(require("ts_context_commentstring.internal").calculate_commentstring)
			return ok and cs or vim.bo.commentstring
		end,
	},
})

-- Move lines
require("mini.move").setup({
	mappings = {
		left = "H",
		right = "L",
		down = "J",
		up = "K",
		line_left = "",
		line_right = "",
		line_down = "J",
		line_up = "K",
	},
})

-- Surround
require("mini.surround").setup({ n_lines = 50 })

-- Misc (zoom window)
require("mini.misc").setup({})
vim.keymap.set("n", "<leader>wz", function()
	require("mini.misc").zoom()
end, { silent = true })
