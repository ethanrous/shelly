return {
	{
		"mfussenegger/nvim-dap",
		lazy = true,
		keys = {
			{ "<leader>db", mode = "n" },
			{ "<leader>dc", mode = "n" },
			{ "<A-S-c>", mode = "n" },
			{ "<leader>dr", mode = "n" },
			{ "<A-n>", mode = "n" },
			{ "<A-o>", mode = "n" },
			{ "<A-O>", mode = "n" },
			{ "<A-i>", mode = "n" },
			{ "<A-I>", mode = "n" },
		},
		dependencies = { "mfussenegger/nvim-dap-python", "leoluz/nvim-dap-go" },
		config = function()
			local dap = require("dap")
			dap.set_log_level("TRACE")

			require("dap-python").setup("uv")
			require("dap-go").setup()

			vim.api.nvim_set_hl(0, "DapBreakpointColor", { fg = "#ffffff", bg = "NONE" })
			vim.api.nvim_set_hl(0, "DapBreakpointStoppedColor", { fg = "#FF0000", bg = "NONE" })
			vim.fn.sign_define("DapBreakpoint", { text = "B", texthl = "DapBreakpointColor", linehl = "", numhl = "" })
			vim.fn.sign_define(
				"DapStopped",
				{ text = "→", texthl = "DapBreakpointStoppedColor", linehl = "", numhl = "" }
			)

			local dapui = require("dapui")

			dap.listeners.before.attach.dapui_config = function()
				dapui.open()
			end
			dap.listeners.before.launch.dapui_config = function()
				dapui.open()
			end

			dap.configurations.python = {
				{
					type = "python",
					request = "launch",
					name = "Launch file",
					program = function()
						return "${file}"
					end,
					console = "integratedTerminal",
					pythonPath = function()
						return vim.fn.getcwd() .. "/.venv/bin/python3"
					end,
					justMyCode = false,

					args = function()
						local args_string = vim.fn.input("Arguments: ")
						if args_string and args_string ~= "" then
							return vim.split(args_string, " +") -- Splits by one or more spaces
						end
						return {} -- No arguments if input is empty
					end,
				},
				{
					type = "python",
					request = "launch",
					name = "Pytest: Current File",
					module = "pytest",
					console = "integratedTerminal",
					pythonPath = function()
						return vim.fn.getcwd() .. "/.venv/bin/python3"
					end,
					justMyCode = false,

					args = { "${file}", "-sv" },
				},
			}

			local last_config = nil

			---@param session dap.Session
			dap.listeners.after.event_initialized["store_config"] = function(session)
				last_config = session.config
			end

			vim.keymap.set("n", "<leader>db", function()
				dap.toggle_breakpoint()
			end, { silent = true })

			-- Continue / Run to Cursor
			vim.keymap.set("n", "<leader>dc", function()
				dap.continue()
			end, { silent = true })
			vim.keymap.set("n", "<A-S-c>", function()
				dap.run_to_cursor()
			end, { silent = true })

			vim.keymap.set("n", "<leader>dr", function()
				if last_config then
					dap.run(last_config)
				else
					dap.run_last()
				end
			end, { silent = true })

			vim.keymap.set("n", "<A-n>", function()
				dap.step_over()
			end, { silent = true })

			vim.keymap.set("n", "<A-o>", function()
				dap.up()
			end, { silent = true })

			vim.keymap.set("n", "<A-O>", function()
				dap.step_out()
			end, { silent = true })

			vim.keymap.set("n", "<A-i>", function()
				dap.down()
			end, { silent = true })

			vim.keymap.set("n", "<A-I>", function()
				dap.step_into()
			end, { silent = true })
		end,
	},
	{
		"rcarriga/nvim-dap-ui",
		lazy = true,
		keys = {
			{ "<leader>du", mode = "n" },
			{ "dh", mode = "n" },
		},
		config = function()
			local dapui = require("dapui")
			dapui.setup({
				controls = {
					enabled = false,
				},
				layouts = {
					{
						elements = {
							{
								id = "scopes",
								size = 0.25,
							},
							{
								id = "breakpoints",
								size = 0.25,
							},
							{
								id = "stacks",
								size = 0.25,
							},
							{
								id = "watches",
								size = 0.25,
							},
						},
						position = "right",
						size = 0.4,
					},
					{
						elements = {
							{
								id = "console",
								size = 1,
							},
						},
						position = "bottom",
						size = 0.3,
					},
				},
			})

			local dap = require("dap")
			dap.listeners.before.attach.dapui_config = function()
				dapui.open()
			end

			vim.keymap.set("n", "<leader>du", function()
				dapui.toggle()
			end, { noremap = true, silent = true })

			vim.keymap.set("n", "dh", function()
				dapui.eval()
			end, { noremap = true, silent = true })
		end,
		dependencies = { "mfussenegger/nvim-dap", "nvim-neotest/nvim-nio" },
	},
	{
		"theHamsta/nvim-dap-virtual-text",
		lazy = true,
		config = function()
			require("nvim-dap-virtual-text").setup({
				virt_text_win_col = 80,
				highlight_changed_variables = true,
				clear_on_continue = true,
				all_references = true,
				virt_text_pos = "inline",
			})
		end,
	},
	{
		"leoluz/nvim-dap-go",
		lazy = true,
		config = function()
			require("dap-go").setup({})
		end,
	},
}
