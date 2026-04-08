vim.pack.add({
	"https://github.com/zbirenbaum/copilot.lua",
	"https://github.com/copilotlsp-nvim/copilot-lsp",
})

require("copilot").setup({
	filetypes = { ["*"] = true },
	copilot_model = "gpt-41-copilot",
	suggestion = {
		enabled = true,
		auto_trigger = true,
		keymap = {
			accept = false,
			accept_word = false,
			accept_line = false,
			next = false,
			prev = false,
			dismiss = false,
		},
	},
	server_opts_overrides = {
		settings = {
			advanced = { inlineSuggestCount = 1 },
		},
	},
})
