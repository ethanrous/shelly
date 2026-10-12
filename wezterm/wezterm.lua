-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

config.term = "xterm-256color"

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

local light_scheme = "Catppuccin Latte"
local dark_scheme = "Tokyo Night Moon"

local function get_color_scheme(scheme)
	local tabBarBackground
	local background
	local c_white
	local blue
	local ansi, brights

	if scheme == light_scheme then
		tabBarBackground = "#e6e9ef"
		background = "#eff1f5"
		c_white = "#4c4f69"
		blue = "#1e66f5"

		ansi = {
			"#4c4f69", -- black (dark gray)
			"#c01c28", -- red (darker red)
			"#2d7b2e", -- green (much darker green)
			"#a56707", -- yellow (much darker yellow/brown)
			"#1954cf", -- blue (darker blue)
			"#7030cf", -- magenta (much darker purple)
			"#0e7c86", -- cyan (much darker cyan)
			"#3b3e52", -- white (very dark gray)
		}
		brights = {
			"#5c5f77", -- bright black
			"#b8174c", -- bright red
			"#26943a", -- bright green
			"#c96f1e", -- bright yellow
			"#155db3", -- bright blue
			"#8839ef", -- bright magenta
			"#0d8f99", -- bright cyan
			"#6c6f85", -- bright white
		}
	else
		tabBarBackground = "#131621"
		background = "#0D1017"
		c_white = "#e5e5eb"
		blue = "#82aaff"

		ansi = {
			"#393552",
			"#eb6f92",
			"#3e8fb0",
			"#f6c177",
			"#9ccfd8",
			"#c4a7e7",
			"#ea9a97",
			"#e0def4",
		}
		brights = {
			"#6e6a86",
			"#eb6f92",
			"#3e8fb0",
			"#f6c177",
			"#9ccfd8",
			"#c4a7e7",
			"#ea9a97",
			"#e0def4",
		}
	end

	local colors = {
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

				fg_color = "#808080",
				-- fg_color = c_white,
				bg_color = tabBarBackground,
			},
		},
		ansi = ansi,
		brights = brights,
	}
	return colors
end

wezterm.on("toggle-dark-mode", function(window)
	local overrides = window:get_config_overrides() or {}
	overrides.color_scheme = (overrides.color_scheme == light_scheme) and dark_scheme or light_scheme
	overrides.colors = get_color_scheme(overrides.color_scheme)

	window:set_config_overrides(overrides)
end)

config.colors = get_color_scheme(dark_scheme)

-- Allow for sessions to be resurrected after quitting WezTerm
local resurrect = wezterm.plugin.require("https://github.com/MLFlexer/resurrect.wezterm")

config.leader = { key = " ", mods = "CTRL" }

local function spawn_tab_to_right(window, _)
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

local saved_tab_counts = {}

-- Number of tabs in a saved workspace or window state file, or nil for a saved tab.
local function saved_tab_count(path, epoch)
	local cached = saved_tab_counts[path]
	if cached and cached.epoch == epoch then
		return cached.count
	end

	local count
	local fh = io.open(path, "r")
	if fh then
		local ok, state = pcall(wezterm.json_parse, fh:read("a"))
		fh:close()
		if ok and type(state) == "table" then
			if state.tabs then
				count = #state.tabs
			elseif state.window_states then
				count = 0
				for _, window_state in ipairs(state.window_states) do
					count = count + #window_state.tabs
				end
			end
		end
	end

	saved_tab_counts[path] = { epoch = epoch, count = count }
	return count
end

-- Selector over every saved resurrect state, newest first, labelled with save time and tab count.
-- Relies on BSD stat for modification times.
local function pick_saved_state(win, pane)
	local out = ""
	local find = io.popen(
		string.format(
			'find "%s" -type f -name "*.json" -print0 | xargs -0 stat -f "%%m %%N"',
			resurrect.state_manager.save_state_dir
		),
		"r"
	)
	if find then
		out = find:read("a")
		find:close()
	end

	local saves = {}
	for line in out:gmatch("[^\n]+") do
		local epoch, path, kind, name = line:match("^(%d+) (.*/([^/]+)/([^/]+)%.json)$")
		if epoch then
			table.insert(saves, { epoch = tonumber(epoch), path = path, kind = kind, name = name })
		end
	end
	table.sort(saves, function(a, b)
		return a.epoch > b.epoch
	end)

	if #saves == 0 then
		wezterm.emit("resurrect.error", "No existing state files to select")
		return
	end

	local short_kind = { workspace = "ws", window = "win", tab = "tab" }
	local choices = {}
	for i, save in ipairs(saves) do
		local count = saved_tab_count(save.path, save.epoch)
		local tabs = count and (count .. (count == 1 and " tab" or " tabs")) or ""
		table.insert(choices, {
			id = tostring(i),
			label = string.format(
				"%s  %-3s  %7s  %s",
				os.date("%Y-%m-%d %H:%M", save.epoch),
				short_kind[save.kind] or save.kind,
				tabs,
				save.name
			),
		})
	end

	win:perform_action(
		wezterm.action.InputSelector({
			title = "Load State",
			description = "Select State to Load and press Enter = accept, Esc = cancel, / = filter",
			fuzzy_description = "Search State to Load: ",
			choices = choices,
			fuzzy = true,
			action = wezterm.action_callback(function(_, _, id, _)
				local save = saves[tonumber(id)]
				if not save then
					return
				end
				local opts = {
					spawn_in_workspace = true,
					relative = true,
					restore_text = true,
					on_pane_restore = resurrect.tab_state.default_on_pane_restore,
				}
				local state = resurrect.state_manager.load_state(save.name, save.kind)
				if save.kind == "workspace" then
					resurrect.workspace_state.restore_workspace(state, opts)
				elseif save.kind == "window" then
					resurrect.window_state.restore_window(pane:window(), state, opts)
				elseif save.kind == "tab" then
					resurrect.tab_state.restore_tab(pane:tab(), state, opts)
				end
			end),
		}),
		pane
	)
end

config.keys = {
	-- Turn off the default CMD-m Hide action, allowing CMD-m to
	-- be potentially recognized and handled by the tab
	{
		key = "t",
		mods = "CMD",
		action = wezterm.action_callback(spawn_tab_to_right),
	},
	{ key = "w", mods = "CMD", action = wezterm.action.CloseCurrentPane({ confirm = true }) },
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
	{
		key = "t",
		mods = "CTRL",
		action = wezterm.action({ EmitEvent = "toggle-dark-mode" }),
	},
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
		action = wezterm.action_callback(function(_, _)
			local workspace_state = resurrect.workspace_state.get_workspace_state()
			resurrect.state_manager.save_state(workspace_state)
			resurrect.state_manager.write_current_state(workspace_state.workspace, "workspace")
		end),
	},
	{
		key = "r",
		mods = "ALT",
		action = wezterm.action_callback(pick_saved_state),
	},
}

for i = 1, 9 do
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

-- Working directory of the tab's active pane without a trailing slash, or nil when it is unknown.
local function tab_cwd(tab_info)
	local cwd = tab_info.active_pane.current_working_dir
	local dir = cwd and cwd.file_path
	if not dir then
		return nil
	end
	return (string.gsub(dir, "(.)/+$", "%1"))
end

local function tab_title(tab_info)
	local title = tab_info.tab_title
	if title and #title > 0 then
		return getTabIndexString(tab_info) .. title
	end

	local dir = tab_cwd(tab_info) or ""
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

local function hash_string(s)
	local h = 5381
	for i = 1, #s do
		h = (h * 33 + s:byte(i)) % 4294967296 -- djb2, kept under 2^32 for float safety
	end
	return h
end

local function path_parent(dir)
	local rev = string.reverse(dir)
	local _, slash = string.find(rev, "/")
	if not slash then
		return dir
	end
	return string.reverse(string.sub(rev, slash + 1))
end

-- Walk up from `dir` to the nearest git root and return that repo's directory name.
local function repo_basename(dir)
	local cur = dir
	while cur and #cur > 0 do
		local fh = io.open(cur .. "/.git", "r")
		if fh then
			fh:close()
			return string.basename(cur)
		end
		local parent = path_parent(cur)
		if parent == cur then
			break
		end
		cur = parent
	end
	return nil
end

-- Active and inactive tab backgrounds, with the hue hashed from the repo name. Nil outside a repo.
local function resolve_tab_colors(tab)
	local dir = tab_cwd(tab)
	local repo = dir and repo_basename(dir)
	if not repo then
		return nil
	end
	local hue = hash_string(repo) % 360
	return string.format("hsl(%d, 40%%, 29%%)", hue), string.format("hsl(%d, 30%%, 17%%)", hue)
end

local function is_active_tab(tab, tabs)
	for _, candidate in ipairs(tabs) do
		if candidate.tab_id == tab.tab_id then
			return candidate.is_active == true
		end
	end
	return tab.is_active == true
end

wezterm.on("format-tab-title", function(tab, tabs, _, _, _, _)
	local title = tab_title(tab)
	local active_color, inactive_color = resolve_tab_colors(tab)
	if not active_color then
		return " " .. title .. " "
	end

	local is_active = is_active_tab(tab, tabs)
	return {
		{ Background = { Color = is_active and active_color or inactive_color } },
		{ Foreground = { Color = is_active and "#f0f0f0" or "#8f96a3" } },
		{ Text = " " .. title .. " " },
	}
end)

wezterm.on("gui-startup", resurrect.state_manager.resurrect_on_gui_startup)

resurrect.state_manager.set_max_nlines(5000)

local save_interval_seconds = 60
local save_retention_days = 30

-- Layout, working directories and alt-screen programs of a pane tree. Scrollback, geometry and focus are left out.
local function pane_tree_signature(node)
	if not node then
		return ""
	end
	return string.format(
		"{%s|%s|%s|%s|%s}",
		node.domain or "",
		node.cwd or "",
		node.process and table.concat(node.process.argv or {}, " ") or "",
		pane_tree_signature(node.right),
		pane_tree_signature(node.bottom)
	)
end

local function window_signature(state)
	local tabs = {}
	for i, tab in ipairs(state.tabs) do
		tabs[i] = tab.title .. pane_tree_signature(tab.pane_tree)
	end
	return table.concat(tabs, "\n")
end

local window_snapshots = {}

-- Saves the window to a dated file. While its tabs and panes stay the same, each save overwrites that file.
local function snapshot_window(mux_win)
	local state = resurrect.window_state.get_window_state(mux_win)
	local signature = window_signature(state)
	local id = mux_win:window_id()
	local snapshot = window_snapshots[id]
	if not snapshot or snapshot.signature ~= signature then
		local title = state.title
		-- Keeps the file name under the 255 byte limit without splitting a UTF-8 character.
		if #title > 180 then
			title = title:sub(1, 180):gsub("[\xC2-\xF4][\x80-\xBF]*$", "")
		end
		snapshot = {
			signature = signature,
			name = string.format("%s_%s_%d", title, os.date("%Y-%m-%d_%H-%M-%S"), id),
		}
		window_snapshots[id] = snapshot
	end
	resurrect.state_manager.save_state(state, snapshot.name)
end

local function save_titled_tabs(mux_win)
	for _, mux_tab in ipairs(mux_win:tabs()) do
		if mux_tab:get_title() ~= "" then
			resurrect.state_manager.save_state(resurrect.tab_state.get_tab_state(mux_tab))
		end
	end
end

local function save_workspace()
	local state = resurrect.workspace_state.get_workspace_state()
	resurrect.state_manager.save_state(state)
	resurrect.state_manager.write_current_state(state.workspace, "workspace")
end

-- Deletes saved window and tab states last written more than `save_retention_days` ago.
local function prune_saved_states()
	local dir = resurrect.state_manager.save_state_dir
	local ok, _, stderr = wezterm.run_child_process({
		"/usr/bin/find",
		dir .. "window",
		dir .. "tab",
		"-type",
		"f",
		"-name",
		"*.json",
		"-mmin",
		"+" .. save_retention_days * 24 * 60,
		"-delete",
	})
	if not ok then
		error(stderr)
	end
end

local function attempt(what, fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok then
		wezterm.log_error("resurrect: " .. what .. " failed: " .. tostring(err))
	end
end

-- Saves all state every `save_interval_seconds`. WezTerm discards an error raised in a timer callback,
-- so the timer is re-armed first and each step logs its own failure.
local function schedule_save()
	wezterm.time.call_after(save_interval_seconds, function()
		schedule_save()
		attempt("workspace save", save_workspace)
		for _, gui_win in ipairs(wezterm.gui.gui_windows()) do
			local mux_win = gui_win:mux_window()
			attempt("window save", snapshot_window, mux_win)
			attempt("tab save", save_titled_tabs, mux_win)
		end
		attempt("pruning saved states", prune_saved_states)
	end)
end

schedule_save()

wezterm.on("resurrect.error", function(err)
	wezterm.log_error("ERROR!")
	wezterm.gui.gui_windows()[1]:toast_notification("resurrect", err, nil, 3000)
end)

-- and finally, return the configuration to wezterm
return config
