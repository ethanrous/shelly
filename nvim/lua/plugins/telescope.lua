vim.pack.add({
	"https://github.com/nvim-telescope/telescope.nvim",
	"https://github.com/nvim-telescope/telescope-live-grep-args.nvim",
	"https://github.com/nvim-telescope/telescope-ui-select.nvim",
	"https://github.com/nvim-telescope/telescope-fzf-native.nvim",
	"https://github.com/nvim-telescope/telescope-fzy-native.nvim",
	"https://github.com/debugloop/telescope-undo.nvim",
	{ src = "https://github.com/danielfalk/smart-open.nvim", version = "0.2.x" },
	"https://github.com/kkharji/sqlite.lua",
})

local telescope = require("telescope")
local actions = require("telescope.actions")
local builtin = require("telescope.builtin")
local lga_actions = require("telescope-live-grep-args.actions")

-- Allow for more space for the fnames
local picker_config = {}
for b, _ in pairs(builtin) do
	picker_config[b] = { fname_width = 80 }
end

telescope.setup({
	pickers = vim.tbl_extend("force", picker_config, {
		lsp_references = { fname_width = 80 },
	}),
	extensions = {
		live_grep_args = {
			auto_quoting = true,
			file_ignore_patterns = { "node_modules", "pnpm-lock.yaml", "package-lock.json" },
			additional_args = function(_)
				return { "--hidden", "--glob", "!.git" }
			end,
			hidden = true,
			mappings = {
				i = {
					["<C-k>"] = lga_actions.quote_prompt(),
					["<C-i>"] = lga_actions.quote_prompt({ postfix = " --iglob " }),
				},
			},
		},
		["ui-select"] = {
			require("telescope.themes").get_dropdown({}),
		},
		smart_open = {
			ignore_patterns = {
				"*.git/*", "*debug/*", "*.pdf", "*.ico", "*.class", "*~", "~:",
				"*.jar", "*.node", "*.lock", "*.gz", "*.zip", "*.7z", "*.rar",
				"*.lzma", "*.bz2", "*.rlib", "*.rmeta", "*.DS_Store", "*.cur",
				"*.png", "*.jpeg", "*.jpg", "*.gif", "*.bmp", "*.avif", "*.heif",
				"*.jxl", "*.tif", "*.tiff", "*.ttf", "*.otf", "*.woff*", "*.sfd",
				"*.pcf", "*.svg", "*.ser", "*.wasm", "*.pack", "*.pyc", "*.apk",
				"*.bin", "*.dll", "*.pdb", "*.db", "*.so", "*.spl", "*.min.js",
				"*.min.gzip.js", "*.doc", "*.swp", "*.bak", "*.ctags", "*.ppt",
				"*.xls",
			},
		},
		undo = {},
	},
	defaults = {
		borderchars = { "─", "│", "─", "│", "┌", "┐", "┘", "└" },
		sorting_strategy = "ascending",
		layout_strategy = "vertical",
		layout_config = {
			horizontal = { prompt_position = "top", width = 0.90, height = 0.90, preview_width = 0.9 },
			vertical = { width = 0.95, height = 0.95, preview_width = 0.9 },
		},
		vimgrep_arguments = {
			"rg", "--color=never", "--no-heading", "--with-filename",
			"--line-number", "--column", "--smart-case",
			"--ignore-file", ".gitignore",
			"--ignore-file", ".git/",
			"--ignore-file", "swag/",
			"--ignore-file", "docs/",
		},
		mappings = {
			i = {
				["<esc>"] = actions.close,
				["<C-c>"] = false,
				["<C-h>"] = "which_key",
				["<A-j>"] = "move_selection_next",
				["<A-k>"] = "move_selection_previous",
				["<A-e>"] = "move_selection_previous",
				["<C-u>"] = false,
			},
		},
	},
})

telescope.load_extension("live_grep_args")
telescope.load_extension("ui-select")
telescope.load_extension("smart_open")
telescope.load_extension("undo")
telescope.load_extension("fzf")

-- Keybinds
vim.keymap.set("n", "gi", function()
	builtin.lsp_implementations()
end, { silent = true })

vim.keymap.set("n", "gr", function()
	builtin.lsp_references({ include_declaration = false })
end, { silent = true })

local function get_diffview_search_dirs()
	local ok, lib = pcall(require, "diffview.lib")
	if not ok then
		return nil
	end
	local view = lib.get_current_view()
	if not view or not view.files then
		return nil
	end

	local paths = {}
	local seen = {}
	for _, entry in view.files:iter() do
		local layout = entry.layout
		if not layout then
			goto continue
		end
		for _, win in ipairs({ layout.a, layout.b }) do
			if not (win and win.file and win.file.bufnr) then
				goto next_win
			end
			local bufnr = win.file.bufnr
			if not vim.api.nvim_buf_is_valid(bufnr) then
				goto next_win
			end
			local name = vim.api.nvim_buf_get_name(bufnr)
			if name == "" or seen[name] then
				goto next_win
			end
			seen[name] = true
			if vim.fn.filereadable(name) == 1 then
				paths[#paths + 1] = name
			else
				local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
				local tmpfile = vim.fn.tempname()
				vim.fn.writefile(lines, tmpfile)
				paths[#paths + 1] = tmpfile
			end
			::next_win::
		end
		::continue::
	end
	if #paths == 0 then
		return nil
	end
	return paths
end

vim.keymap.set("n", "<leader>fg", function()
	local dirs = get_diffview_search_dirs()
	telescope.extensions.live_grep_args.live_grep_args({ search_dirs = dirs })
end, { silent = true })

vim.keymap.set("n", "<leader>tc", function()
	builtin.resume({ cache_index = 1 })
end)

vim.keymap.set("v", "<leader>fg", function()
	local dirs = get_diffview_search_dirs()
	builtin.grep_string({ search_dirs = dirs })
end, { silent = true })

vim.keymap.set("n", "<leader>gh", function()
	builtin.highlights()
end, { silent = true })

vim.keymap.set("n", "<leader>gp", function()
	builtin.diagnostics({ show_all = true, severity = { "Error" } })
end, { silent = true })

vim.keymap.set("n", "<leader>gP", function()
	builtin.diagnostics({ show_all = true, severity = { "Error", "Warn" } })
end, { silent = true })

vim.keymap.set("n", "gt", function()
	builtin.lsp_type_definitions()
end, { silent = true })

vim.keymap.set({ "i", "n" }, "<A-f>", function()
	builtin.current_buffer_fuzzy_find()
end, { silent = true })

vim.keymap.set({ "n", "v" }, "<A-e>", function()
	require("telescope").extensions.smart_open.smart_open({ cwd_only = true })
end, { silent = true, desc = "Smart open files" })

vim.keymap.set("n", "<leader>u", "<cmd>Telescope undo<cr>", { desc = "undo history" })
