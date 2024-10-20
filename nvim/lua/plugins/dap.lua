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
					-- program = "./cmd/weblens/main.go",
					name = "Attach to weblens CORE",
					-- program = function()
					-- 	vim.system("./scripts/startWeblens")
					-- 	print("YOOOOOO")
					-- 	return ""
					-- 	-- return "${workspaceFolder}/.build/debug/" .. vim.fn.substitute(vim.fn.getcwd(), "^.*/", "", "")
					-- end,
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
			dapui.setup()
			require("neodev").setup({
				library = { plugins = { "nvim-dap-ui" }, types = true },
			})

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
