" Debug wrapper around the job runner — logs every command and result line count.
" ponytail: remove this file when column completion is confirmed working.

function! s:nvim_job_cb(jobid, data, event) dict abort
  if a:event ==? 'exit'
    echom '[dadbod] job done, lines=' . len(self.output) . ' first=' . get(self.output, 0, '?') . ' second=' . get(self.output, 1, '?')
    return self.callback(self.output)
  endif
  call extend(self.output, a:data)
endfunction

function! vim_dadbod_completion#job#run(cmd, callback, stdin) abort
  echom '[dadbod] job#run: ' . get(a:cmd, -1, '?')
  let jobid = jobstart(a:cmd, {
        \ 'on_stdout': function('s:nvim_job_cb'),
        \ 'on_stderr': function('s:nvim_job_cb'),
        \ 'on_exit':   function('s:nvim_job_cb'),
        \ 'output':    [],
        \ 'callback':  a:callback,
        \ 'stdout_buffered': 1,
        \ 'stderr_buffered': 1,
        \ })
  if !empty(a:stdin)
    call chansend(jobid, a:stdin)
    call chanclose(jobid, 'stdin')
  endif
  return jobid
endfunction
