return {
	-- Better a/i movements
	{
		"echasnovski/mini.ai",
		version = false,
		config = function()
			require("mini.ai").setup()
		end,
	},

	-- To switch between single-line and multiline statements
	{
		"echasnovski/mini.splitjoin",
		version = false,
		config = function()
			local splitjoin = require("mini.splitjoin")
			splitjoin.setup()
			vim.keymap.set("n", "<leader>ts", function()
				splitjoin.toggle()
			end, { silent = true, desc = "Toggle between single-line and multiline statements" })
		end,
	},

	-- Move forward and backwards
	{
		"echasnovski/mini.bracketed",
		version = false,
		config = function()
			require("mini.bracketed").setup()
		end,
	},

	-- Notification pluggin & lsp loading
	{
		"echasnovski/mini.notify",
		version = false,
		config = function()
			local notify = require("mini.notify")
			notify.setup({
				window = {
					config = {
						border = "solid",
					},
				},
			})

			vim.notify = notify.make_notify({
				ERROR = { duration = 5000 },
				WARN = { duration = 4000 },
				INFO = { duration = 2000 },
			})

			vim.keymap.set({ "v", "n" }, "<leader>sh", function()
				notify.show_history()
			end, { silent = true })
		end,
	},

	-- Commenting
	{
		"echasnovski/mini.comment",
		version = false,
		config = function()
			require("mini.comment").setup({
				options = {
					custom_commentstring = function()
						return require("ts_context_commentstring.internal").calculate_commentstring()
							or vim.bo.commentstring
					end,
				},
			})
		end,
	},

	-- Move lines around
	{
		"echasnovski/mini.move",
		version = false,
		config = function()
			require("mini.move").setup({
				mappings = {
					-- Visual mode
					left = "H",
					right = "L",
					down = "J",
					up = "K",

					-- Normal mode
					line_left = "",
					line_right = "",
					line_down = "J",
					line_up = "K",
				},
			})
		end,
	},

	--  Surround text objects
	{
		"echasnovski/mini.surround",
		version = false,
		config = function()
			require("mini.surround").setup()
		end,
	},

	-- {
	-- 	"echasnovski/mini.diff",
	-- 	version = false,
	-- 	config = function()
	-- 		require("mini.diff").setup()
	-- 	end,
	-- },

	{
		"echasnovski/mini.misc",
		version = false,
		config = function()
			vim.keymap.set("n", "<leader>wz", function()
				require("mini.misc").zoom()
			end, { silent = true })
		end,
	},

	{
		"ggandor/leap.nvim",
		config = function()
			local leap = require("leap")
			-- leap.create_default_mappings()
			leap.opts.equivalence_classes = { " \t\r\n", "([{", ")]}", "'\"`" }
			vim.keymap.set({ "n", "x", "o" }, "f", "<Plug>(leap-forward)")
			vim.keymap.set({ "n", "x", "o" }, "F", "<Plug>(leap-backward)")
			-- vim.keymap.set({ "n", "x", "o" }, "gs", "<Plug>(leap-from-window)")
		end,
		dependencies = {
			"tpope/vim-repeat",
		},
	},
}
