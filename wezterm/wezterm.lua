-- Pull in the wezterm API
local wezterm = require("wezterm")
local os = require("os")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
config.font = wezterm.font("JetBrains Mono")
config.font_size = 17
config.automatically_reload_config = true
config.window_padding = {
	left = "0.25cell",
	right = 0,
	top = 0,
	bottom = 0,
}
config.max_fps = 120

config.tab_bar_at_bottom = true
config.use_fancy_tab_bar = false
config.show_new_tab_button_in_tab_bar = false
config.window_decorations = "RESIZE"
config.tab_max_width = 50

-- local background = "#232136",
local c_jeans = "#262f3e"
local c_thunder = "#425974"
local c_smoke = "#bebec3"
local c_white = "#e5e5eb"

config.colors = {
	background = c_jeans,
	foreground = c_white,
	cursor_bg = c_white,
	cursor_border = "#3e8fb0",

	tab_bar = {
		background = c_jeans,
		-- The active tab is the one that has focus in the window

		active_tab = {
			bg_color = "#345B78",
			fg_color = c_white,
		},
		inactive_tab = {
			bg_color = c_jeans,
			fg_color = c_white,
		},
	},
	ansi = {
		"#393552",
		"#eb6f92",
		"#3e8fb0",
		"#f6c177",
		"#9ccfd8",
		"#c4a7e7",
		"#ea9a97",
		"#e0def4",
	},

	brights = {
		"#6e6a86",
		"#eb6f92",
		"#3e8fb0",
		"#f6c177",
		"#9ccfd8",
		"#c4a7e7",
		"#ea9a97",
		"#e0def4",
	},
}

config.leader = { key = " ", mods = "CTRL" }
config.keys = {
	-- Turn off the default CMD-m Hide action, allowing CMD-m to
	-- be potentially recognized and handled by the tab
	{
		key = "[",
		mods = "CMD",
		action = wezterm.action.MoveTabRelative(-1),
	},
	{
		key = "]",
		mods = "CMD",
		action = wezterm.action.MoveTabRelative(1),
	},
	{
		key = " ",
		mods = "LEADER",
		action = wezterm.action.ActivateLastTab,
	},
	{
		key = " ",
		mods = "LEADER|CTRL",
		action = wezterm.action.ActivateLastTab,
	},
	{
		key = "s",
		mods = "CMD",
		action = wezterm.action.ActivateLastTab,
	},
	{
		key = "s",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitHorizontal({ domain = "CurrentPaneDomain" }),
	},
	{
		key = "h",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
	},
	{
		key = "z",
		mods = "CMD",
		action = wezterm.action.TogglePaneZoomState,
	},
	{
		key = "h",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Left"),
	},
	{
		key = "l",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Right"),
	},
	{
		key = "k",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Up"),
	},
	{
		key = "j",
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Down"),
	},
	-- {
	-- 	key = "h",
	-- 	mods = "CMD|SHIFT",
	-- 	action = wezterm.action.RotatePanes("CounterClockwise"),
	-- },
	{
		key = "b",
		mods = "CMD",
		action = wezterm.action.RotatePanes("Clockwise"),
	},
	{
		key = "?",
		mods = "SHIFT|ALT",
		action = wezterm.action.Search({ CaseInSensitiveString = "" }),
	},
	{
		key = "u",
		mods = "ALT",
		action = wezterm.action.ActivateCopyMode,
	},
	{
		key = "L",
		mods = "CMD|SHIFT",
		action = wezterm.action.ActivateTabRelative(1),
	},
	{
		key = "H",
		mods = "CMD|SHIFT",
		action = wezterm.action.ActivateTabRelative(-1),
	},
}

for i = 1, 8 do
	-- CTRL+ALT + number to activate that tab
	table.insert(config.keys, {
		key = tostring(i),
		mods = "LEADER",
		action = wezterm.action.ActivateTab(i - 1),
	})
end

config.harfbuzz_features = { "calt=0", "clig=0", "liga=0" }

function string.starts(String, Start)
	return string.sub(String, 1, string.len(Start)) == Start
end

function string.ends(String, End)
	return string.sub(String, string.len(String) - string.len(End) + 1) == End
end

function string.trim_prefix(String, Prefix)
	if not string.starts(String, Prefix) then
		return String
	end
	return string.sub(String, string.len(Prefix) + 1, string.len(String))
end

function string.delete_after(String, Delim)
	local start = string.find(String, Delim)
	if not start then
		return String
	end
	return string.sub(String, 1, start - 1)
end

function string.basename(String)
	local last = string.find(String, "/[^/]*$")
	if not last then
		return String
	end
	return string.sub(String, last + 1)
end

local function getTabIndexString(tab_info)
	local indexName = "[" .. tab_info.tab_index + 1
	if tab_info.active_pane.is_zoomed then
		indexName = indexName .. "*"
	end
	indexName = indexName .. "] "
	return indexName
end

local function tab_title(tab_info)
	local title = tab_info.tab_title
	-- if the tab title is explicitly set, take that

	if title and #title > 0 then
		return getTabIndexString(tab_info) .. title
	end

	local dir = tab_info.active_pane.current_working_dir.file_path
	local proc = tab_info.active_pane.foreground_process_name
	if string.starts(dir, "/Users/erousseau/repos/") then
		dir = string.trim_prefix(dir, "/Users/erousseau/repos/")
		dir = string.delete_after(dir, "/")
	end

	proc = string.basename(proc)
	if proc == "bash" then
		proc = ""
	end

	return getTabIndexString(tab_info) .. string.basename(dir) .. " " .. proc
end

wezterm.on("format-tab-title", function(tab, tabs, panes, cnf, hover, max_width)
	local edge_background = c_jeans
	local background = c_jeans
	local foreground = "#808080"

	if tab.is_active then
		background = c_thunder
		foreground = c_smoke
	elseif hover then
		background = "#3b3052"
		foreground = "#909090"
	end

	local edge_foreground = background

	local title = tab_title(tab)

	return {
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = " " },
		{ Background = { Color = background } },
		{ Foreground = { Color = foreground } },
		{ Text = title },
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = " " },
	}
end)

-- and finally, return the configuration to wezterm
return config
