return {
	{
		"mfussenegger/nvim-dap",
		config = function()
			require("dap").adapters.delve = {
				type = "server",
				port = "${port}",
				executable = {
					command = "dlv",
					args = { "dap", "-l", "127.0.0.1:${port}" },
				},
			}
			require("dap").configurations.go = {
				{
					type = "delve",
					request = "launch",
					mode = "test",
					program = "${file}",
					name = "Go test current file",
					showLog = true,
					logFile = vim.fn.getcwd() .. "/build/logs/go-dap.log",
					logLevel = "DEBUG",
					env = { CONFIG_NAME = "TEST", APP_ROOT = vim.fn.getcwd() },
				},
				{
					type = "delve",
					request = "launch",
					program = "./cmd/weblens/main.go",
					name = "Run weblens CORE",
					showLog = true,
					logFile = vim.fn.getcwd() .. "/build/logs/go-dap.log",
					logLevel = "DEBUG",
					env = { CONFIG_NAME = "DEBUG-CORE", APP_ROOT = vim.fn.getcwd() },
				},
				{
					type = "delve",
					request = "attach",
					name = "Attach to weblens CORE",
					waitFor = "weblens",
					showLog = true,
					logFile = vim.fn.getcwd() .. "/build/logs/debug-weblens-core.log",
					logLevel = "DEBUG",
					env = { CONFIG_NAME = "DEBUG-CORE", APP_ROOT = vim.fn.getcwd() },
				},
			}
		end,
	},
	{
		"rcarriga/nvim-dap-ui",
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

			require("neodev").setup({
				library = { plugins = { "nvim-dap-ui" }, types = true },
			})

			local dap = require("dap")
			dap.listeners.before.attach.dapui_config = function()
				dapui.open()
			end

			vim.keymap.set("n", "<leader>du", function()
				dapui.toggle()
			end, { noremap = true, silent = true })

			vim.keymap.set({ "n", "i" }, "<A-v>", function()
				dapui.eval()
			end, { noremap = true, silent = true })
		end,
		dependencies = { "mfussenegger/nvim-dap", "nvim-neotest/nvim-nio" },
	},
	{
		"theHamsta/nvim-dap-virtual-text",
		config = function()
			require("nvim-dap-virtual-text").setup({
				virt_text_win_col = 80,
				highlight_changed_variables = true,
				clear_on_continue = true,
			})
		end,
	},
	{
		"leoluz/nvim-dap-go",
		config = function()
			require("dap-go").setup({})
		end,
	},
}
