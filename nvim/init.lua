require("config.settings")
require("config.lazy")
require("config.helpers")
require("config.keyboard")
require("config.statusline")

-- vim.cmd("colorscheme " .. "rose-pine-moon")
Base = "#232136"
Surface = "#2a273f"
Pine = "#3e8fb0"
Foam = "#9ccfd8"
Subtle = "#908caa"
Muted = "#6e6a86"
Text = "#e0def4"

local TelescopeColor = {
	TelescopeMatching = { fg = Text, bg = Pine },
	TelescopeSelection = { fg = Foam, bg = Base, bold = true },

	TelescopePromptPrefix = { fg = Subtle, bg = Surface },
	TelescopePromptCounter = { fg = Subtle, bg = Surface },
	TelescopePromptNormal = { fg = Subtle, bg = Surface },
	TelescopePromptBorder = { bg = Surface, fg = Surface },
	TelescopePromptTitle = { bg = Surface, fg = Subtle },

	TelescopeResultsNormal = { bg = Surface, fg = Text },
	TelescopeResultsBorder = { bg = Surface, fg = Surface },
	TelescopeResultsTitle = { fg = Subtle },
	TelescopeResultsVariable = { fg = Subtle },
	Directory = { fg = Muted },

	TelescopeSelectionCaret = { fg = Subtle, bg = Base },

	TelescopePreviewNormal = { bg = Base },
	TelescopePreviewBorder = { bg = Surface, fg = Surface },
	TelescopePreviewTitle = { bg = Surface, fg = Subtle },

	NormalFloat = { bg = Surface, fg = Subtle },
	FloatBorder = { fg = Surface, bg = Surface },
	LspSignatureActiveParameter = { fg = Text, bg = Pine, bold = true },

	DapUIPlayPause = { fg = Pine, bg = Surface },
	DapUIRestartNC = { fg = Pine, bg = Surface },
	DapUIPlayPauseNC = { fg = Pine, bg = Surface },
	DapUIStepOutNC = { fg = Pine, bg = Surface },
	DapUIUnavailableNC = { fg = Subtle, bg = Surface },

	HarpoonWindow = { fg = Pine, bg = Pine },
	HarpoonBorder = { fg = Pine, bg = Pine },

	OilDir = { fg = Foam },
}

vim.api.nvim_set_hl(0, "RainbowRed", { fg = "#E06C75" })
vim.api.nvim_set_hl(0, "RainbowYellow", { fg = "#E5C07B" })
vim.api.nvim_set_hl(0, "RainbowBlue", { fg = "#61AFEF" })
vim.api.nvim_set_hl(0, "RainbowOrange", { fg = "#D19A66" })
vim.api.nvim_set_hl(0, "RainbowGreen", { fg = "#98C379" })
vim.api.nvim_set_hl(0, "RainbowViolet", { fg = "#C678DD" })
vim.api.nvim_set_hl(0, "RainbowCyan", { fg = "#56B6C2" })

for hl, color in pairs(TelescopeColor) do
	vim.api.nvim_set_hl(0, hl, color)
end
