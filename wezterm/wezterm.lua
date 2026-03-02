-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- For example, changing the color scheme:
config.font = wezterm.font("JetBrains Mono")
config.font_size = 17
config.automatically_reload_config = true
config.window_padding = {
	left = 0,
	right = 0,
	top = 0,
	bottom = 0,
}
config.max_fps = 120
config.audible_bell = "Disabled"

-- config.tab_bar_at_bottom = true
config.use_fancy_tab_bar = false
config.show_new_tab_button_in_tab_bar = false
config.window_decorations = "RESIZE"
config.tab_max_width = 50

local theme = "dark"

local tabBarBackground
local background
local c_white
local blue

if theme == "light" then
	config.color_scheme = "Catppuccin Latte"

	tabBarBackground = "#e6e9ef"
	background = "#eff1f5"
	c_white = "#4c4f69"
	blue = "#1e66f5"
else
	tabBarBackground = "#131621"
	background = "#0D1017"
	c_white = "#e5e5eb"
	blue = "#82aaff"

	config.colors = {
		background = background,
		foreground = c_white,
		cursor_bg = c_white,

		tab_bar = {
			-- background = tabBarBackground,
			-- The active tab is the one that has focus in the window
			background = tabBarBackground,

			active_tab = {
				fg_color = blue,
				bg_color = background,
			},

			inactive_tab = {
				fg_color = c_white,
				bg_color = tabBarBackground,
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
end

-- Allow for sessions to be resurrected after quitting WezTerm
local resurrect = wezterm.plugin.require("https://github.com/MLFlexer/resurrect.wezterm")

config.leader = { key = " ", mods = "CTRL" }

local function spawn_tab_to_right(window, _pane)
	local mux_window = window:mux_window()

	local active_index = 0
	for i, tab_info in ipairs(mux_window:tabs_with_info()) do
		if tab_info.is_active then
			active_index = i - 1
			break
		end
	end

	local new_tab, new_pane = mux_window:spawn_tab({})
	window:perform_action(wezterm.action.MoveTab(active_index + 1), new_pane)
	new_tab:activate()
end

config.keys = {
	-- Turn off the default CMD-m Hide action, allowing CMD-m to
	-- be potentially recognized and handled by the tab
	{
		key = "t",
		mods = "CMD",
		action = wezterm.action_callback(spawn_tab_to_right),
	},
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
		mods = "CMD",
		action = wezterm.action.ActivatePaneDirection("Left"),
	},
	{
		key = "v",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
	},
	{
		key = "z",
		mods = "CMD",
		action = wezterm.action.TogglePaneZoomState,
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
		key = "F",
		mods = "CMD|SHIFT",
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
	{
		key = "w",
		mods = "ALT",
		action = wezterm.action_callback(function(win, pane)
			resurrect.state_manager.save_state(resurrect.workspace_state.get_workspace_state())
		end),
	},
	{
		key = "r",
		mods = "ALT",
		action = wezterm.action_callback(function(win, pane)
			resurrect.fuzzy_loader.fuzzy_load(win, pane, function(id, label)
				local type = string.match(id, "^([^/]+)") -- match before '/'
				id = string.match(id, "([^/]+)$") -- match after '/'
				id = string.match(id, "(.+)%..+$") -- remove file extention
				local opts = {
					spawn_in_workspace = true,
					relative = true,
					restore_text = true,
					on_pane_restore = resurrect.tab_state.default_on_pane_restore,
				}
				if type == "workspace" then
					local state = resurrect.state_manager.load_state(id, "workspace")
					resurrect.workspace_state.restore_workspace(state, opts)
				elseif type == "window" then
					local state = resurrect.state_manager.load_state(id, "window")
					resurrect.window_state.restore_window(pane:window(), state, opts)
				elseif type == "tab" then
					local state = resurrect.state_manager.load_state(id, "tab")
					resurrect.tab_state.restore_tab(pane:tab(), state, opts)
				end
			end)
		end),
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
	local indexName = tab_info.tab_index + 1
	if tab_info.active_pane.is_zoomed then
		indexName = "[" .. indexName .. "]"
	end
	indexName = indexName .. " "
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
	local edge_background
	local edge_foreground
	local foreground

	if theme == "light" then
		edge_background = tabBarBackground
		foreground = "#808080"

		if tab.is_active then
			foreground = blue
			edge_background = background
		elseif hover then
			foreground = "#c0c0c0"
		end

		edge_foreground = background
	else
		edge_background = tabBarBackground
		foreground = "#808080"

		if tab.is_active then
			foreground = blue
			edge_background = background
		elseif hover then
			foreground = "#c0c0c0"
		end

		edge_foreground = background
	end

	local title = tab_title(tab)

	return {
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = " " },
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = foreground } },
		{ Text = title },
		{ Background = { Color = edge_background } },
		{ Foreground = { Color = edge_foreground } },
		{ Text = " " },
	}
end)

wezterm.on("gui-startup", resurrect.state_manager.resurrect_on_gui_startup)

resurrect.state_manager.set_max_nlines(5000)

resurrect.state_manager.periodic_save({
	interval_seconds = 60,
	save_tabs = true,
	save_windows = true,
	save_workspaces = true,
})

wezterm.on("resurrect.error", function(err)
	wezterm.log_error("ERROR!")
	wezterm.gui.gui_windows()[1]:toast_notification("resurrect", err, nil, 3000)
end)

-- and finally, return the configuration to wezterm
return config
