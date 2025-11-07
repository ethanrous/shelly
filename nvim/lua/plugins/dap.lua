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

			require("dap-python").setup("python3")
			require("dap-go").setup()

			-- dap.adapters.delve = function(callback, config)
			-- 	local delve_args = { "debug", "--log-output=delve.log" }
			-- 	if config.mode == "remote" and config.request == "attach" then
			-- 		callback({
			-- 			type = "server",
			-- 			host = config.host or "127.0.0.1",
			-- 			port = config.port or "38697",
			-- 		})
			-- 	else
			-- 		callback({
			-- 			type = "server",
			-- 			port = "${port}",
			-- 			executable = {
			-- 				command = "dlv",
			-- 				args = {
			-- 					"dap",
			-- 					"-l",
			-- 					"127.0.0.1:${port}",
			-- 					"debug",
			-- 					"--log",
			-- 					"--log-dest=./build/logs/go-dlv.log",
			-- 				},
			-- 				detached = vim.fn.has("win32") == 0,
			-- 			},
			-- 		})
			-- 	end
			-- end

			dap.configurations.python = {
				{
					type = "python",
					request = "launch",
					name = "Launch file",
					program = "${file}",
					pythonPath = function()
						return "/usr/bin/python3"
					end,
				},
			}

			-- table.insert(dap.configurations.go, {
			-- 	buildFlags = "",
			-- 	name = "Launch pre-built executable",
			-- 	program = function()
			-- 		return vim.fn.input("Path to executable: ", vim.fn.getcwd() .. "/", "file")
			-- 	end,
			-- 	request = "attach",
			-- 	type = "executable",
			-- })

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
				dap.run_last()
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
