vim.pack.add({
	"https://github.com/olimorris/codecompanion.nvim",
	"https://github.com/OXY2DEV/markview.nvim",
	-- "https://github.com/milanglacier/minuet-ai.nvim",
})

-- CodeCompanion
require("codecompanion").setup({
	-- NOTE: The log_level is in `opts.opts`
	opts = { log_level = "DEBUG" },
})

vim.keymap.set({ "n", "v" }, "<LocalLeader>a", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
vim.keymap.set("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

-- Markview
require("markview").setup({
	preview = {
		filetypes = { "markdown", "norg", "rmd", "org", "vimwiki", "Avante" },
	},
	max_length = 99999,
})

-- -- Minuet AI
-- require("minuet").setup({
-- 	-- Enable or disable auto-completion. Note that you still need to add
-- 	-- Minuet to your cmp/blink sources. This option controls whether cmp/blink
-- 	-- will attempt to invoke minuet when minuet is included in cmp/blink
-- 	-- sources. This setting has no effect on manual completion; Minuet will
-- 	-- always be enabled when invoked manually. You can use the command
-- 	-- `Minuet cmp/blink toggle` to toggle this option.
-- 	cmp = {
-- 		enable_auto_complete = false,
-- 	},
-- 	blink = {
-- 		enable_auto_complete = false,
-- 	},
-- 	debounce = 150,
-- 	throttle = 600,
-- 	request_timeout = 20,
-- 	virtualtext = {
-- 		-- Specify the filetypes to enable automatic virtual text completion,
-- 		-- e.g., { 'python', 'lua' }. Note that you can still invoke manual
-- 		-- completion even if the filetype is not on your auto_trigger_ft list.
-- 		auto_trigger_ft = { "*" },
-- 		keymap = {
-- 			accept = nil,
-- 			accept_line = "<A-Tab>",
-- 			accept_n_lines = nil,
-- 			-- Cycle to next completion item, or manually invoke completion
-- 			next = "<A-L>",
-- 			-- Cycle to prev completion item, or manually invoke completion
-- 			prev = nil,
-- 			dismiss = nil,
-- 		},
-- 		-- Whether show virtual text suggestion when the completion menu
-- 		-- (nvim-cmp or blink-cmp) is visible.
-- 		show_on_completion_menu = false,
-- 	},
-- 	provider = "openai_fim_compatible",
-- 	n_completions = 1,
-- 	-- the maximum total characters of the context before and after the cursor
-- 	-- 16000 characters typically equate to approximately 4,000 tokens for
-- 	-- LLMs.
-- 	context_window = 3000,
--
-- 	provider_options = {
-- 		openai_fim_compatible = {
-- 			-- For Windows users, TERM may not be present in environment variables.
-- 			-- Consider using APPDATA instead.
-- 			api_key = "TERM",
-- 			name = "Llama.cpp",
-- 			end_point = "http://localhost:1234/v1/completions",
-- 			-- The model is set by the llama-cpp server and cannot be altered
-- 			-- post-launch.
-- 			-- model = "qwen2.5-coder-7b",
-- 			model = "qwen3.6-27b-mlx",
-- 			optional = {
-- 				max_tokens = 36,
-- 				top_p = 0.8,
-- 				stop = {
-- 					"<|endoftext|>",
-- 					"<|fim_prefix|>",
-- 					"<|fim_middle|>",
-- 					"<|fim_suffix|>",
-- 					"<|fim_pad|>",
-- 					"<|repo_name|>",
-- 					"<|file_sep|>",
-- 					"<|im_start|>",
-- 					"<|im_end|>",
-- 					"\n\n", -- optional: also stop on blank line to keep completions tight
-- 				},
-- 			},
-- 			-- Llama.cpp does not support the `suffix` option in FIM completion.
-- 			-- Therefore, we must disable it and manually populate the special
-- 			-- tokens required for FIM completion.
-- 			template = {
-- 				prompt = function(context_before_cursor, context_after_cursor, _)
-- 					return "<|fim_prefix|>"
-- 						.. context_before_cursor
-- 						.. "<|fim_suffix|>"
-- 						.. context_after_cursor
-- 						.. "<|fim_middle|>"
-- 				end,
-- 				suffix = false,
-- 			},
-- 		},
-- 	},
-- })
