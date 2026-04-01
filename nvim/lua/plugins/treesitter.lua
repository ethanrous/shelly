return {
	-- Syntax plugin
	{
		"nvim-treesitter/nvim-treesitter",
		lazy = false,
		branch = "main",
		build = ":TSUpdate",
		config = function()
			require("nvim-treesitter").setup({})

			-- Install parsers (replaces ensure_installed)
			require("nvim-treesitter").install({
				"lua",
				"javascript",
				"typescript",
				"fish",
				"bash",
				"dockerfile",
				"java",
				"ruby",
				"go",
				"html",
				"json",
				"markdown",
				"markdown_inline",
				"python",
				"scala",
				"scss",
				"css",
				"regex",
				"vim",
				"yaml",
				"tsx",
				"rust",
			})

			-- Register filetype-to-parser mappings (replaces filetype_to_parsername)
			vim.treesitter.language.register("tsx", { "javascript", "typescript.tsx" })

			-- Enable treesitter highlighting (replaces highlight = { enable = true })
			vim.api.nvim_create_autocmd("FileType", {
				callback = function(args)
					pcall(vim.treesitter.start, args.buf)
				end,
			})
		end,
		dependencies = {
			"nvim-treesitter/nvim-treesitter-context",
			"nvim-treesitter/nvim-treesitter-textobjects",
			{
				"JoosepAlviste/nvim-ts-context-commentstring",
				opts = {
					enable_autocmd = false,
				},
			},
		},
	},
	{
		"nvim-treesitter/nvim-treesitter-context",
		lazy = false,
		config = function()
			require("treesitter-context").setup({
				max_lines = 10,
			})
		end,
	},

	-- Treesitter text objects
	{
		"nvim-treesitter/nvim-treesitter-textobjects",
		branch = "main",
		config = function()
			require("nvim-treesitter-textobjects").setup({
				select = {
					lookahead = true,
				},
				move = {
					set_jumps = true,
				},
			})

			local select_textobject = function(query)
				return function()
					require("nvim-treesitter-textobjects.select").select_textobject(query, "textobjects")
				end
			end

			local goto_next = function(query)
				return function()
					require("nvim-treesitter-textobjects.move").goto_next_start(query, "textobjects")
				end
			end

			local goto_prev = function(query)
				return function()
					require("nvim-treesitter-textobjects.move").goto_previous_start(query, "textobjects")
				end
			end

			-- Select keymaps
			vim.keymap.set({ "x", "o" }, "aa", select_textobject("@parameter.outer"), { desc = "Select outer part of a parameter/argument" })
			vim.keymap.set({ "x", "o" }, "ia", select_textobject("@parameter.inner"), { desc = "Select inner part of a parameter/argument" })
			vim.keymap.set({ "x", "o" }, "ai", select_textobject("@conditional.outer"), { desc = "Select outer part of a conditional" })
			vim.keymap.set({ "x", "o" }, "ii", select_textobject("@conditional.inner"), { desc = "Select inner part of a conditional" })
			vim.keymap.set({ "x", "o" }, "al", select_textobject("@loop.outer"), { desc = "Select outer part of a loop" })
			vim.keymap.set({ "x", "o" }, "il", select_textobject("@loop.inner"), { desc = "Select inner part of a loop" })
			vim.keymap.set({ "x", "o" }, "af", select_textobject("@call.outer"), { desc = "Select outer part of a function call" })
			vim.keymap.set({ "x", "o" }, "if", select_textobject("@call.inner"), { desc = "Select inner part of a function call" })
			vim.keymap.set({ "x", "o" }, "am", select_textobject("@function.outer"), { desc = "Select outer part of a method/function definition" })
			vim.keymap.set({ "x", "o" }, "im", select_textobject("@function.inner"), { desc = "Select inner part of a method/function definition" })
			vim.keymap.set({ "x", "o" }, "ac", select_textobject("@class.outer"), { desc = "Select outer part of a class" })
			vim.keymap.set({ "x", "o" }, "ic", select_textobject("@class.inner"), { desc = "Select inner part of a class" })

			-- Move keymaps
			vim.keymap.set({ "n", "x", "o" }, "]f", goto_next("@call.outer"), { desc = "Next function call start" })
			vim.keymap.set({ "n", "x", "o" }, "]m", goto_next("@function.outer"), { desc = "Next method/function def start" })
			vim.keymap.set({ "n", "x", "o" }, "]c", goto_next("@class.outer"), { desc = "Next class start" })
			vim.keymap.set({ "n", "x", "o" }, "]i", goto_next("@conditional.outer"), { desc = "Next conditional start" })
			vim.keymap.set({ "n", "x", "o" }, "]l", goto_next("@loop.outer"), { desc = "Next loop start" })
			vim.keymap.set({ "n", "x", "o" }, "[f", goto_prev("@call.outer"), { desc = "Prev function call start" })
			vim.keymap.set({ "n", "x", "o" }, "[m", goto_prev("@function.outer"), { desc = "Prev method/function def start" })
			vim.keymap.set({ "n", "x", "o" }, "[c", goto_prev("@class.outer"), { desc = "Prev class start" })
			vim.keymap.set({ "n", "x", "o" }, "[i", goto_prev("@conditional.outer"), { desc = "Prev conditional start" })
			vim.keymap.set({ "n", "x", "o" }, "[l", goto_prev("@loop.outer"), { desc = "Prev loop start" })
		end,
	},
	{
		"HiPhish/rainbow-delimiters.nvim",
		config = function()
			require("rainbow-delimiters.setup").setup({
				blacklist = { "xml" },
			})
		end,
	},
}
