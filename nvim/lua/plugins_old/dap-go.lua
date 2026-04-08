return {
	{
		"leoluz/nvim-dap-go",
		config = function()
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
		end,
	},
}
