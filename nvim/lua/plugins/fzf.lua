function Get_current_selection()
	local vstart = vim.fn.getpos(".")
	local vend = vim.fn.getpos("v")

	if vstart[2] ~= vend[2] then
		return ""
	end

	local line_start = vstart[3]
	local line_end = vend[3]

	if line_start > line_end then
		line_start, line_end = line_end, line_start
	end

	-- or use api.nvim_buf_get_lines
	return string.sub(vim.fn.getline("."), line_start, line_end)
end

return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		config = function()
			require("fzf-lua").setup({
				keymap = {
					fzf = false,
				},
				hls = { border = "FloatBorder" },
				oldfiles = {
					prompt = "History❯ ",
					cwd_only = false,
					stat_file = false, -- verify files exist on disk
					-- can also be a lua function, for example:
					-- stat_file = require("fzf-lua").utils.file_is_readable,
					-- stat_file = function() return true end,
					include_current_session = true, -- include bufs from current session
				},
				diagnostics = {
					severity_only = 1,
				},
			})
			vim.keymap.set({ "n", "i" }, "<A-S-f>", function()
				require("fzf-lua").live_grep()
			end, { silent = true, noremap = true })

			vim.keymap.set("v", "<A-S-f>", function()
				local selection = Get_current_selection()
				require("fzf-lua").live_grep({ search = selection })
			end, { silent = true, noremap = true })
		end,
		keys = {
			{
				"<A-e>",
				function()
					require("fzf-lua").files({ cwd = vim.fn.getcwd() })
				end,
				desc = "Find files",
			},
			{
				"<A-a>",
				function()
					require("fzf-lua").buffers()
				end,
				desc = "View recent files",
				{ "n", "i" },
			},
			-- {
			-- 	"<S-A-f>",
			-- 	function()
			-- 		require("fzf-lua").live_grep()
			-- 	end,
			-- 	desc = "Grep files",
			-- 	{ "n", "i" },
			-- },
			-- {
			-- 	"<S-A-f>",
			-- 	function()
			-- 		vim.fn.setreg("", vim.diagnostic.get_next().message)
			-- 		require("fzf-lua").live_grep()
			-- 		vim.api.nvim_paste(vim.fn.getreg('"'))
			-- 	end,
			-- 	desc = "Grep files",
			-- 	"v",
			-- },
			{
				"gn",
				function()
					require("fzf-lua").lsp_workspace_diagnostics()
				end,
				desc = "Workspace diagnostics",
			},
			{
				"gi",
				function()
					require("fzf-lua").lsp_implementations()
				end,
				desc = "Goto implementations",
			},
			{
				"gr",
				function()
					require("fzf-lua").lsp_references()
				end,
				desc = "Goto references",
			},
		},
	},
}
