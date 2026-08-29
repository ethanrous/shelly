vim.loader.enable()

require("config")
require("util")
-- require("vim._core.ui2").enable()

vim.lsp.enable(require("config.lsp_servers"))
