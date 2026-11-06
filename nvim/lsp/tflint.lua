---@brief
---
--- https://github.com/terraform-linters/tflint
---
--- A pluggable Terraform linter that can act as lsp server.
--- Installation instructions can be found in https://github.com/terraform-linters/tflint#installation.

---@type vim.lsp.Config
return {
	-- tflint logs to stderr while exiting; a closed stderr pipe kills it with SIGPIPE before it stops its plugin process.
	cmd = { "sh", "-c", "exec tflint --langserver 2>/dev/null" },
	filetypes = { "terraform" },
	root_markers = { ".terraform", ".git", ".tflint.hcl" },
}
