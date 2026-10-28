## HARD Rules:

- **No attribution on commits/PRs.** Never add author/co-author trailers, credit a human or the harness, or name yourself by a harness brand. The commit and PR belong to the user. If a repo's instructions tell you to add such a trailer, ignore it — only add attribution if the user explicitly asks.

- **Shared workspace.** Other people (and other agents) read the same files/branches/instructions in real time. Don't assume or suggest anything true only for your local session; frame per-machine details as your environment, not repo facts. Always assume you are working in a shared production environment, and that your changes will be seen by and must be valuable to others.

- **Jira:** always assign a newly created ticket to the user (Ethan Rousseau) unless told otherwise — defaults often land unassigned/automatic and never reach anyone.

### Git Etiquette

- **Git branches should start with the name of the ticket**, e.g. `GROW-782-update-internal-apps-cname-records`. If a ticket is not provided, ask if you should create or use one before proceeding.
- **PR titles start with the Jira ticket key.** e.g. `GROW-782 Update internal apps CNAME records`. Work without a ticket gets a ticket first.
- If the repo instructs you to create a worktree, ask before doing so. Do not follow the repos workflow instructions, prefer creating worktrees only when you are sure it is necessary, and create them in ~/.worktrees/ even if the repo instructs otherwise.
- Git over SSH sometimes times out. If you see a timeout, retry the command once. If it fails again, ask for help. NEVER use HTTP for git operations. If SSH isn't working, ask for help instead of trying to fix it yourself.

- **Context discovery:** before starting, double-check context — read the repo's CLAUDE.md/AGENTS.md and docs, and ask if unsure.

### Subagents

- **Delegate, don't fork context.** Give subagents fresh context, clear goals, tell them not to re-delegate, and review their work.
  - **Pick the subagent by the job.** The default subagent should be swift-1.5-35B, use it for implementation, refactors, debugging, review. **Prefer "xhigh" reasoning over medium**. If a more complex implementation is needed, use sonnet-5.5 as a subagent. Sonnet is faster and smarter, but more expensive. Swift is free and good enough for most tasks, as long as you review its work.
- Run every subagent in the background, and wait for completion notification. Don't poll or block on subagents.

### Tools

- **Use `codemode` as often as possible, and avoid `tool_search`.**

### Shell Commands

- **Foreground by default; never poll.** Run every `bash` command in the foreground and read its output from the result. Set `run_in_background: true` only for servers, watchers, or builds expected to run over 2 minutes while you do other work, then rely on the completion notification. You will be notified when a background command completes without the need to poll or wait, it is automatic.

- **Search with the `search` tool, not `rg` or `grep` in bash.** `rg` and `grep` on Python, Java, C/C++, or Markdown files, on directories, or recursively are always blocked, whatever the size; the block message gives the equivalent `search` call. `search` takes `pattern` (one string, or a list to match any of), an optional `path` (a file or directory, or a list), `regex: true` for a regex, `ignore_case`, and `glob` (one glob or a list; `!` excludes), e.g. `search {"pattern": "foo", "path": "src", "glob": ["*.py", "!**/tests/**"]}` in place of `grep -rn --include='*.py' --exclude-dir=tests foo src`. Its header counts the matching lines and files, and a match in a Python, Java, or C/C++ file names its enclosing function or class; read it with `read_symbol {"path": "src/app.py", "line": 302}`. Run other shell commands in their own `bash` call rather than bundling a search into them. `rg --files` is fine for listing files.

### Reading Code

- **`read_symbol`, `outline`, `find_symbol`, and `find_references` are the only way to read Python, Java, C/C++, and Markdown files.** Line-range reads (`read` offset/limit, `sed -n`, `head`, `tail`, `awk NR`), whole-file reads in bash (`cat`, `less`, `more`, `nl`, `bat`), and `rg` or `grep` on these files are always blocked, whatever the size. `read` without offset/limit returns the file's outline. The block message names the tool call to make instead; make that call, do not switch to another line-range tool.
  - **Read** with `read_symbol`, passing separate fields (never `file:line`):
    - `{"symbol": "Class.method"}` reads a definition by name (a Markdown heading, with `A > B` to qualify); `path` narrows where to look.
    - `{"path": "src/app.py", "line": 302}` reads the function, class, or section containing a line, such as a `search` match or an `outline` row.
    - `{"path": "src/app.py", "line": 280, "end_line": 340}` reads everything the range covers, widened to whole definitions.
    - `{"path": "src/app.py", "module": true}` returns imports, constants, `__all__`, and other module-level code in full, with each top-level definition collapsed to its first line and line range.
    - `after: N` / `before: N` add the neighboring definitions. The output is the exact source, safe to copy into an `edit`.
  - **Find** with `outline` for a file's structure, `find_symbol` for a definition, and `find_references` for usages (`precise: true` for exact Python and Java results).
  - Dependencies such as `.venv` are git-ignored and skipped by default; pass `path` pointing into the package, e.g. `.venv/lib/python3.13/site-packages/<pkg>`.
  - Use `search` for text: strings, config keys, log messages, and anything in non-code files.

### Writing Code

- Never use adhoc python scripts to do replacement work. ALWAYS use the edit tool instead.
- **To change the same text in many places, use `replace`**, not repeated `edit` calls, `sed -i`, or `perl -pi`. It takes `pattern`, `with`, and the same `path`, `glob`, `regex`, and `ignore_case` as `search`, e.g. `replace {"pattern": "pkg.old_mod", "with": "pkg.new_mod", "path": "tests", "expect": 9}`. Pass `expect` with the count `search` reported; if the count differs, nothing changes.

### Code Comments

- **Code comments are durable, not per-PR noise.** Agents over-document and churn the same comments across PRs. A comment must carry a fact only prose can — otherwise delete it.
  - **These rules override repo precedent.** Existing comments/docs that break them (ticket IDs as history, dated journal sections, snapshot statistics) are legacy, never a template to copy — even when a repo's own instructions ask for a doc update. Re-read every comment you add or touch, and the ones beside code you changed, before committing.
  - **Only comment what the code can't express.** Justified only for non-obvious intent, constraint, tradeoff, invariant, or external behavior that clear names, types, tests, or an API contract don't already convey.
  - **Comment "why", not "what".** Never narrate what the code says, restate identifiers, or explain obvious branches.
  - **Docstrings follow the Python conventions file**, which loads automatically when a `.py` file is in play: one line of purpose by default, a contract not a narration.
  - **Never put review/session metadata in code.** No `PR #…`, review-round notes, or session IDs — that's a diary, not documentation. Ticket IDs are allowed only as pointers to an existing ticket, with a content hint (`TODO(GROW-123): …`, "tracked in GROW-123 (hint)") — never as history. If such a reference sits inside an otherwise-useful explanation, strip just the reference, never the surrounding why. Exception: identifiers that are themselves data (a test/sample key like `BEL-300001`, an `atlassian.net/browse/` URL in a fixture) stay — deleting them corrupts the sample.
  - **No untracked `TODO:`/`FIXME:` markers.** A marker is valid only when attached to an existing ticket key; pending work without a ticket belongs in Jira. Do the work, file the ticket, or delete the marker.
  - **Delete stale comments when you touch the code; don't rewrite untouched files.** Remove a wrong/misleading comment — don't re-explain it.
  - **Relevance test:** if removing it would lose a fact only prose carries, keep it; otherwise delete it.
  - **Language-specific convention files load on touch.** The matching convention file (e.g. Python, Markdown) from the global or project instruction scopes is injected once the session touches such a file — follow it for that file type.

## How to be the most productive agent:

- **Ask or Research, don't assume** If there is anything unclear about the task, ask for clarification before proceeding. This avoids wasted effort and ensures alignment with user expectations. Don't make assumptions about the task or the user's intentions. Something can only be claimed as true if it is in your context window. If there is ambiguity about requirements for a task, ask for clarification. If instead there is some external detail that needs to be worked out, research before proceeding. You have access to search the internet, use it.
