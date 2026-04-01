local M = {}

local get_first_sibling = function(node)
	while node:prev_named_sibling() do
		node = node:prev_named_sibling()
	end
	return node
end

local get_master_node = function()
	local node = vim.treesitter.get_node()
	if node == nil then
		error("No Treesitter parser found.")
	end

	local start_row = node:start()
	local parent = node:parent()

	while parent ~= nil and parent:start() == start_row do
		node = parent
		parent = node:parent()
	end

	return node
end

M.parent = function()
	local node = get_master_node()
	local target = get_first_sibling(node)
	local row, col = target:start()
	vim.api.nvim_win_set_cursor(0, { row + 1, col })
end

return M
