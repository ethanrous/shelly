vim.pack.add({
	"https://github.com/tpope/vim-dadbod",
	"https://github.com/kristijanhusak/vim-dadbod-ui",
})

-- Register our custom Redshift adapter (autoload/db/adapter/redshift.vim).
-- This tells dadbod that redshift:// URLs should be handled by our adapter,
-- which delegates to psql under the hood.
vim.g.db_adapter_redshift = "db#adapter#redshift#"

-- DBUI settings
vim.g.db_ui_use_nerd_fonts = 1
vim.g.db_ui_show_database_icon = 1
vim.g.db_ui_execute_on_save = 0
vim.g.db_ui_auto_execute_table_helpers = 1

-- Force result buffer to open below the query buffer within the same column,
-- keeping the sidebar full-height on the left. Closes any existing dbout window first.
vim.api.nvim_create_autocmd("FileType", {
	pattern = "dbout",
	callback = function()
		local dbout_win = vim.api.nvim_get_current_win()
		local dbout_buf = vim.api.nvim_win_get_buf(dbout_win)

		-- Close any other existing dbout windows
		for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
			if win ~= dbout_win then
				local buf = vim.api.nvim_win_get_buf(win)
				if vim.bo[buf].filetype == "dbout" then
					vim.api.nvim_win_close(win, true)
				end
			end
		end

		-- Find the query (sql) window to split below it
		for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
			local buf = vim.api.nvim_win_get_buf(win)
			local ft = vim.bo[buf].filetype
			if ft == "sql" then
				vim.api.nvim_win_close(dbout_win, true)
				vim.api.nvim_set_current_win(win)
				vim.cmd("belowright split")
				vim.api.nvim_win_set_buf(0, dbout_buf)
				vim.api.nvim_win_set_height(0, 20)
				break
			end
		end
	end,
})

-- Table helpers for the redshift scheme
vim.g.db_ui_table_helpers = {
	redshift = {
		List = 'SELECT * FROM "{schema}"."{table}" LIMIT 200',
		Count = 'SELECT COUNT(*) FROM "{schema}"."{table}"',
	},
}

-- Keymaps
vim.keymap.set("n", "<Leader>db", "<cmd>DBUIToggle<cr>", { desc = "Toggle DB UI" })
vim.keymap.set("n", "<Leader>df", "<cmd>DBUIFindBuffer<cr>", { desc = "DB UI find buffer" })
