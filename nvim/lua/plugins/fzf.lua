return {
	{
		"nvim-telescope/telescope.nvim",
		tag = "0.1.8",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local actions = require("telescope.actions")
			local callTelescope = function(input)
				-- local theme = require("telescope.themes").get_dropdown()
				-- input(theme)
				input()
			end

			vim.keymap.set("n", "gi", function()
				callTelescope(require("telescope.builtin").lsp_implementations)
			end, { silent = true })

			vim.keymap.set("n", "gr", function()
				require("telescope.builtin").lsp_references({ include_declaration = false })
			end, { silent = true })

			vim.keymap.set("n", "gs", function()
				callTelescope(require("telescope.builtin").lsp_document_symbols)
			end, { silent = true })

			vim.keymap.set("n", "gd", function()
				callTelescope(require("telescope.builtin").lsp_definitions)
			end, { silent = true })

			vim.keymap.set("n", "<leader>fg", function()
				callTelescope(require("telescope.builtin").live_grep)
			end, { silent = true })

			vim.keymap.set("v", "<leader>fg", function()
				require("telescope.builtin").grep_string()
			end, { silent = true })

			vim.keymap.set("n", "<leader>gt", function()
				require("telescope.builtin").builtin()
			end, { silent = true })

			vim.keymap.set("n", "<leader>gh", function()
				require("telescope.builtin").highlights()
			end, { silent = true })

			vim.keymap.set("n", "<leader>gp", function()
				callTelescope(require("telescope.builtin").diagnostics)
			end, { silent = true })

			-- vim.keymap.set("n", "<leader>ff", function()
			-- 	callTelescope(require("telescope.builtin").find_files)
			-- end, { silent = true })

			vim.keymap.set("n", "gt", function()
				callTelescope(require("telescope.builtin").lsp_type_definitions)
			end, { silent = true })

			vim.keymap.set({ "i", "n" }, "<A-f>", function()
				callTelescope(require("telescope.builtin").current_buffer_fuzzy_find)
			end, { silent = true })

			require("telescope").setup({
				defaults = {
					layout_strategy = "flex",
					layout_config = {
						horizontal = {
							width = 0.90,
							height = 0.90,
							preview_width = 0.5,
						},
						vertical = {
							width = 0.90,
							height = 0.90,
							preview_width = 0.5,
						},
					},

					path_display = { shorten = 1 },
					mappings = {
						i = {
							["<esc>"] = actions.close,
							["<C-c>"] = false,
							["<C-h>"] = "which_key",
							["<A-j>"] = "move_selection_next",
							["<A-k>"] = "move_selection_previous",
							["<A-e>"] = "move_selection_previous",
							["<C-u>"] = false,
						},
					},
				},
			})
		end,
	},
	{
		"danielfalk/smart-open.nvim",
		branch = "0.2.x",
		config = function()
			require("telescope").load_extension("smart_open")
		end,
		dependencies = {
			"kkharji/sqlite.lua",
			-- Only required if using match_algorithm fzf
			{ "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
			-- Optional.  If installed, native fzy will be used when match_algorithm is fzy
			{ "nvim-telescope/telescope-fzy-native.nvim" },
		},
		keys = {
			{
				"<A-e>",
				function()
					require("telescope").extensions.smart_open.smart_open()
				end,
				desc = "Smart open files",
			},
		},
	},
}
