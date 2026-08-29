" ponytail: shim so vim-dadbod-completion's async column-fetch callback re-triggers blink.
" The plugin checks exists('*coc#refresh') as a sentinel, then calls coc#start() — define both.
function! coc#refresh() abort
endfunction

function! coc#start() abort
  lua vim.notify("[dadbod] coc#start fired — re-triggering blink", vim.log.levels.INFO)
  lua require("blink.cmp").show()
endfunction
