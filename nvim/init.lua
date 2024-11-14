require("config.settings")
require("config.lazy")
require("config.helpers")
require("config.keyboard")
require("config.statusline")

-- vim.cmd("colorscheme " .. "tokyonight-storm")
vim.cmd("colorscheme " .. "rose-pine-moon")
local base = "#232136"
local surface = "#2a273f"
local pine = "#3e8fb0"
local foam = "#9ccfd8"
local subtle = "#908caa"
local muted = "#6e6a86"
local text = "#e0def4"

-- https://github.com/augustocdias/dotfiles/blob/main/.config/nvim/lua/setup/catppuccin.lua
local TelescopeColor = {
	TelescopeMatching = { fg = text, bg = pine },
	TelescopeSelection = { fg = foam, bg = base, bold = true },

	TelescopePromptPrefix = { fg = subtle, bg = surface },
	TelescopePromptCounter = { fg = subtle, bg = surface },
	TelescopePromptNormal = { fg = subtle, bg = surface },
	TelescopePromptBorder = { bg = surface, fg = surface },
	TelescopePromptTitle = { bg = surface, fg = subtle },

	TelescopeResultsNormal = { bg = surface, fg = text },
	TelescopeResultsBorder = { bg = surface, fg = surface },
	TelescopeResultsTitle = { fg = subtle },
	TelescopeResultsVariable = { fg = subtle },
	Directory = { fg = muted },

	TelescopeSelectionCaret = { fg = subtle, bg = base },

	TelescopePreviewNormal = { bg = base },
	TelescopePreviewBorder = { bg = surface, fg = surface },
	TelescopePreviewTitle = { bg = surface, fg = subtle },

	NormalFloat = { bg = surface, fg = subtle },
	FloatBorder = { fg = surface, bg = surface },
	LspSignatureActiveParameter = { fg = text, bg = pine, bold = true },

	DapUIPlayPause = { fg = pine, bg = surface },
	DapUIRestartNC = { fg = pine, bg = surface },
	DapUIPlayPauseNC = { fg = pine, bg = surface },
	DapUIStepOutNC = { fg = pine, bg = surface },
	DapUIUnavailableNC = { fg = subtle, bg = surface },

	OilDir = { fg = foam },
}

for hl, col in pairs(TelescopeColor) do
	vim.api.nvim_set_hl(0, hl, col)
end
