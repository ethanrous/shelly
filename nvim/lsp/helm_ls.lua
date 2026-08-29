---@type vim.lsp.Config
return {
	cmd = { "helm_ls", "serve" },
	filetypes = { "helm", "yaml.helm-values" },
	root_markers = { "Chart.yaml" },
	capabilities = {
		workspace = {
			didChangeWatchedFiles = {
				dynamicRegistration = true,
			},
		},
	},
	settings = {
		["helm-ls"] = {
			yamlls = {
				path = "yaml-language-server",
			},
		},
	},
}
