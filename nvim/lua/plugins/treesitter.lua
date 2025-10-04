return {
	-- Syntax plugin
	{
		"nvim-treesitter/nvim-treesitter",
		lazy = false,
		config = function()
			local status_ok, nvim_treesitter_configs = pcall(require, "nvim-treesitter.configs")
			if not status_ok then
				return
			end

			local status_ok_2, nvim_treesitter_parsers = pcall(require, "nvim-treesitter.parsers")
			if not status_ok_2 then
				return
			end

			nvim_treesitter_configs.setup({
				ensure_installed = {
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
					"python",
					"scala",
					"scss",
					"css",
					"regex",
					"vim",
					"yaml",
					"tsx",
					"rust",
				},
				auto_install = true,
				highlight = {
					enable = true,
				},
				indent = {
					enable = true,
				},
				incremental_selection = {
					enable = true,
					keymaps = {
						init_selection = "gnn",
						-- node_incremental = "grn",
						-- scope_incremental = "grc",
						-- node_decremental = "grm",
					},
				},
			})

			local parser_config = nvim_treesitter_parsers.get_parser_configs()
			parser_config.tsx.filetype_to_parsername = { "javascript", "typescript.tsx" }
		end,
		build = ":TSUpdate",
		-- event = "BufEnter",
		dependencies = {
			"nvim-treesitter/nvim-treesitter-context",
			"nvim-treesitter/nvim-treesitter-textobjects",
			"JoosepAlviste/nvim-ts-context-commentstring",
			"OXY2DEV/markview.nvim",
		},
	},
	{
		"nvim-treesitter/nvim-treesitter-context",
		config = function()
			require("treesitter-context").setup({
				max_lines = 10,
			})
		end,
	},

	-- Tressitter text objects
	{
		"nvim-treesitter/nvim-treesitter-textobjects",
		config = function()
			require("nvim-treesitter.configs").setup({
				textobjects = {
					select = {
						enable = true,

						-- Automatically jump forward to textobj, similar to targets.vim
						lookahead = true,

						keymaps = {
							["aa"] = { query = "@parameter.outer", desc = "Select outer part of a parameter/argument" },
							["ia"] = { query = "@parameter.inner", desc = "Select inner part of a parameter/argument" },

							["ai"] = { query = "@conditional.outer", desc = "Select outer part of a conditional" },
							["ii"] = { query = "@conditional.inner", desc = "Select inner part of a conditional" },

							["al"] = { query = "@loop.outer", desc = "Select outer part of a loop" },
							["il"] = { query = "@loop.inner", desc = "Select inner part of a loop" },

							["af"] = { query = "@call.outer", desc = "Select outer part of a function call" },
							["if"] = { query = "@call.inner", desc = "Select inner part of a function call" },

							["am"] = {
								query = "@function.outer",
								desc = "Select outer part of a method/function definition",
							},
							["im"] = {
								query = "@function.inner",
								desc = "Select inner part of a method/function definition",
							},

							["ac"] = { query = "@class.outer", desc = "Select outer part of a class" },
							["ic"] = { query = "@class.inner", desc = "Select inner part of a class" },
						},
					},
					move = {
						enable = true,
						set_jumps = true,
						goto_next_start = {
							["]f"] = { query = "@call.outer", desc = "Next function call start" },
							["]m"] = { query = "@function.outer", desc = "Next method/function def start" },
							["]c"] = { query = "@class.outer", desc = "Next class start" },
							["]i"] = { query = "@conditional.outer", desc = "Next conditional start" },
							["]l"] = { query = "@loop.outer", desc = "Next loop start" },
						},
						goto_previous_start = {
							["[f"] = { query = "@call.outer", desc = "Prev function call start" },
							["[m"] = { query = "@function.outer", desc = "Prev method/function def start" },
							["[c"] = { query = "@class.outer", desc = "Prev class start" },
							["[i"] = { query = "@conditional.outer", desc = "Prev conditional start" },
							["[l"] = { query = "@loop.outer", desc = "Prev loop start" },
						},
					},
				},
			})
		end,
	},
}
