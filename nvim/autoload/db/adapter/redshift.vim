" Redshift adapter for vim-dadbod.
" Delegates to psql (Redshift speaks the PostgreSQL wire protocol).

function! db#adapter#redshift#canonicalize(url) abort
  return db#adapter#postgresql#canonicalize(a:url)
endfunction

function! db#adapter#redshift#interactive(url, ...) abort
  " Rewrite redshift:// to postgresql:// so psql accepts it.
  let pg_url = substitute(a:url, '^redshift:', 'postgresql:', '')
  return call('db#adapter#postgresql#interactive', [pg_url] + a:000)
endfunction

function! db#adapter#redshift#filter(url) abort
  let pg_url = substitute(a:url, '^redshift:', 'postgresql:', '')
  return db#adapter#postgresql#filter(pg_url)
endfunction

function! db#adapter#redshift#input(url, in) abort
  let pg_url = substitute(a:url, '^redshift:', 'postgresql:', '')
  return db#adapter#postgresql#input(pg_url, a:in)
endfunction

function! db#adapter#redshift#complete_database(url) abort
  let pg_url = substitute(a:url, '^redshift:', 'postgresql:', '')
  return db#adapter#postgresql#complete_database(pg_url)
endfunction

function! db#adapter#redshift#tables(url) abort
  let pg_url = substitute(a:url, '^redshift:', 'postgresql:', '')
  return db#adapter#postgresql#tables(pg_url)
endfunction
