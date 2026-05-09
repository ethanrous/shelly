local const = require("config/const")

vim.pack.add({
	"https://github.com/folke/noice.nvim",
	"https://github.com/folke/snacks.nvim",
	"https://github.com/lukas-reineke/indent-blankline.nvim",
	"https://github.com/brenoprata10/nvim-highlight-colors",
	"https://github.com/RRethy/vim-illuminate",
})

-- Snacks
require("snacks").setup({
	styles = {
		scratch = {
			width = 0.75,
			height = 0.85,
			border = const.BORDER_STYLE,
		},
	},
	input = { enabled = true },
	indent = {
		animate = { enabled = false },
		chunk = {
			enabled = true,
			hl = "SnacksIndentChunk",
		},
	},
})

vim.keymap.set("n", "<leader>.", function()
	Snacks.scratch()
end, { desc = "Toggle Scratch Buffer" })

vim.keymap.set("n", "<leader>s.", function()
	Snacks.scratch.select()
end, { desc = "Select Scratch Buffer" })

vim.keymap.set("n", "<leader>j.", function()
	Snacks.scratch({ ft = "json" })
end, { desc = "Open a json scratch buffer" })

vim.keymap.set("n", "<leader>sn", function()
	local scratchName = vim.fn.input("Enter scratch buffer name: ")
	if scratchName == "" then
		print("A name is required")
		return
	end
	local scratchFt = vim.fn.input("Enter scratch buffer filetype: ")
	local opts = { name = scratchName }
	if scratchFt ~= "" then
		opts.ft = scratchFt
	end
	Snacks.scratch(opts)
end, { desc = "Open a new named json scratch buffer" })

-- Noice
require("noice").setup({
	routes = {
		{
			filter = {
				event = "lsp",
				kind = "progress",
				cond = function(message)
					local client = vim.tbl_get(message.opts, "progress", "client")
					if client == "pyright" then
						return true
					end
					if client ~= "jdtls" then
						return false
					end
					local content = vim.tbl_get(message.opts, "progress", "message")
					if content == nil then
						return false
					end
					return string.find(content, "Validate") or string.find(content, "Publish")
				end,
			},
			opts = { skip = true },
		},
	},
	lsp = {
		override = {
			["vim.lsp.util.convert_input_to_markdown_lines"] = true,
			["vim.lsp.util.stylize_markdown"] = true,
		},
		signature = { enabled = false, throttle = 0 },
		hover = { silent = true },
	},
	cmdline = {
		enabled = true,
		view = "cmdline",
		format = { cmdline = { pattern = "^:", icon = ":", lang = "vim" } },
	},
	messages = {
		enabled = true,
		view = "notify",
		view_error = "notify",
		view_warn = "notify",
		view_history = "messages",
		view_search = false,
	},
	commands = {
		all = {
			view = "popup",
			opts = {
				border = { style = const.BORDER_STYLE },
				size = { width = 0.9, height = 0.9 },
			},
			filter = {},
			filter_opts = {},
		},
	},
	views = {
		virtualtext = false,
		hover = {
			relative = "cursor",
			anchor = "SW",
			position = { row = -1, col = 0 },
			border = { style = const.BORDER_STYLE },
			size = { max_width = 80 },
		},
		cmdline_popup = {
			anchor = "NW",
			position = { row = "35%", col = "50%" },
			border = { style = const.BORDER_STYLE },
			size = { width = 60, height = "auto" },
		},
		popup = {
			border = {
				style = const.BORDER_STYLE,
				padding = { 0, 1 },
				size = { max_width = 80, max_height = 60 },
			},
		},
		vsplit = { size = "50%" },
		cmdline_popupmenu = {
			anchor = "NW",
			position = { row = "55%", col = "50%" },
			size = { width = 60, height = 15, max_height = 15 },
			border = { style = const.BORDER_STYLE },
		},
	},
})

vim.keymap.set({ "v", "n" }, "<leader>sh", function()
	require("noice").cmd("all")
end, { silent = true })

-- Indent-blankline
do
	local highlight = {
		"RainbowRed",
		"RainbowYellow",
		"RainbowBlue",
		"RainbowOrange",
		"RainbowGreen",
		"RainbowViolet",
		"RainbowCyan",
	}
	local hooks = require("ibl.hooks")
	hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
		vim.api.nvim_set_hl(0, "RainbowRed", { fg = "#E06C75" })
		vim.api.nvim_set_hl(0, "RainbowYellow", { fg = "#E5C07B" })
		vim.api.nvim_set_hl(0, "RainbowBlue", { fg = "#61AFEF" })
		vim.api.nvim_set_hl(0, "RainbowOrange", { fg = "#D19A66" })
		vim.api.nvim_set_hl(0, "RainbowGreen", { fg = "#98C379" })
		vim.api.nvim_set_hl(0, "RainbowViolet", { fg = "#C678DD" })
		vim.api.nvim_set_hl(0, "RainbowCyan", { fg = "#56B6C2" })
	end)
	require("ibl").setup({ indent = { highlight = highlight }, scope = { enabled = false } })
end

-- Highlight colors (renders hex/tailwind color swatches in buffers)
require("nvim-highlight-colors").setup({
	render = "virtual",
	enable_named_colors = true,
	enable_tailwind = true,
	enable_hex = true,
	disable = { "NvimTree" },
})

-- Illuminate (highlight other occurrences of word under cursor)
require("illuminate").configure({
	delay = 0,
	should_enable = function(bufnr)
		local mode = vim.api.nvim_get_mode().mode
		return mode == "n" or mode == "i"
	end,
	min_count_to_highlight = 2,
	filetypes_denylist = { "NvimTree", "harpoon" },
})
