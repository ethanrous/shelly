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
			require("mini.splitjoin").setup()
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
			notify.setup()
			vim.notify = notify.make_notify({
				ERROR = { duration = 5000 },
				WARN = { duration = 4000 },
				INFO = { duration = 2000 },
			})
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
					line_down = "<A-Down>",
					line_up = "<A-Up>",
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
}
