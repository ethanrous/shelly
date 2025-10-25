local utils = {}

function utils.set(opts)
	local mode = opts.mode or "n"
	local bufnr = opts.bufnr or 0
	local expr = opts.expr or false

	if not opts.key or not opts.cmd then
		print(vim.inspect(opts))
		error("Keymap options must include 'key' and 'cmd' fields")
	end

	vim.keymap.set(mode, opts.key, opts.cmd, {
		expr = expr,
		buffer = bufnr,
		noremap = true,
		silent = true,
		desc = opts.desc,
	})
end

return utils
