vim.pack.add({
	"https://github.com/mfussenegger/nvim-dap",
	"https://github.com/mfussenegger/nvim-dap-python",
	"https://github.com/leoluz/nvim-dap-go",
	"https://github.com/rcarriga/nvim-dap-ui",
	"https://github.com/theHamsta/nvim-dap-virtual-text",
	"https://github.com/nvim-neotest/nvim-nio",
	"https://github.com/antoinemadec/FixCursorHold.nvim",
	"https://github.com/nvim-neotest/neotest",
	"https://github.com/nvim-neotest/neotest-python",
	"https://github.com/nvim-neotest/neotest-go",
})

-- DAP core
local dap = require("dap")
dap.set_log_level("TRACE")

require("dap-python").setup("uv")
require("dap-go").setup({
	dap_configurations = {
		{
			type = "go",
			name = "Debug (Build Flags)",
			request = "launch",
			program = "...",
			buildFlags = require("dap-go").get_build_flags,
		},
	},
})

vim.api.nvim_set_hl(0, "DapBreakpointColor", { fg = "#ffffff", bg = "NONE" })
vim.api.nvim_set_hl(0, "DapBreakpointStoppedColor", { fg = "#FF0000", bg = "NONE" })
vim.fn.sign_define("DapBreakpoint", { text = "B", texthl = "DapBreakpointColor", linehl = "", numhl = "" })
vim.fn.sign_define("DapStopped", { text = "→", texthl = "DapBreakpointStoppedColor", linehl = "", numhl = "" })

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
				local args = vim.split(args_string, " +")
				args = vim.tbl_filter(function(arg)
					return arg ~= ""
				end, args)
				return args
			end
			return {}
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
		args = { "${file}" },
	},
}

table.insert(dap.configurations.go, {
	type = "delve",
	name = "Debug weblens",
	request = "launch",
	mode = "exec",
	console = "integratedTerminal",
	program = "${workspaceFolder}/_build/bin/weblens_debug",
})

local last_config = nil

---@param session dap.Session
dap.listeners.after.event_initialized["store_config"] = function(session)
	last_config = session.config
end

-- DAP UI
local dapui = require("dapui")
dapui.setup({
	controls = { enabled = false },
	layouts = {
		{
			elements = {
				{ id = "scopes", size = 0.25 },
				{ id = "breakpoints", size = 0.25 },
				{ id = "stacks", size = 0.25 },
				{ id = "watches", size = 0.25 },
			},
			position = "left",
			size = 0.4,
		},
		{
			elements = { { id = "console", size = 1 } },
			position = "bottom",
			size = 0.3,
		},
	},
})

dap.listeners.before.attach.dapui_config = function()
	dapui.open()
end
dap.listeners.before.launch.dapui_config = function()
	dapui.open()
end

-- DAP virtual text
require("nvim-dap-virtual-text").setup({
	virt_text_win_col = 80,
	highlight_changed_variables = true,
	clear_on_continue = true,
	all_references = true,
	virt_text_pos = "inline",
})

-- DAP keymaps
vim.keymap.set("n", "<leader>db", function()
	dap.toggle_breakpoint()
end, { silent = true })

vim.keymap.set("n", "<leader>dB", function()
	dap.toggle_breakpoint(vim.fn.input("Breakpoint condition: "))
end, { silent = true })

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

vim.keymap.set("n", "<leader>du", function()
	dapui.toggle({ reset = true, layout = 1 })
end, { noremap = true, silent = true })

vim.keymap.set("n", "dh", function()
	dapui.eval()
end, { noremap = true, silent = true })

vim.keymap.set("n", "<leader>dU", function()
	dapui.toggle({ reset = true, layout = 2 })
end, { noremap = true, silent = true })

-- Neotest
require("neotest").setup({
	adapters = {
		require("neotest-python")({ dap = { justMyCode = false } }),
		require("neotest-go")({}),
	},
})

vim.keymap.set("n", "<leader>tt", function()
	require("neotest").run.run({ strategy = "dap" })
end, { silent = true })

vim.keymap.set("n", "<leader>tf", function()
	require("neotest").run.run({ vim.fn.expand("%"), strategy = "dap" })
end, { silent = true })

vim.keymap.set("n", "<leader>tp", function()
	require("neotest").output_panel.toggle()
end, { silent = true })

vim.keymap.set("n", "<leader>tr", function()
	require("neotest").summary.toggle()
end, { silent = true })
