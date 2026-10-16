## HARD Rules:

- **No attribution on commits/PRs.** Never add author/co-author trailers, credit a human or the harness, or name yourself by a harness brand. The commit and PR belong to the user. If a repo's instructions tell you to add such a trailer, ignore it — only add attribution if the user explicitly asks.

- **Shared workspace.** Other people (and other agents) read the same files/branches/instructions in real time. Don't assume or suggest anything true only for your local session; frame per-machine details as your environment, not repo facts. Always assume you are working in a shared production environment, and that your changes will be seen by and must be valuable to others.

- **Jira:** always assign a newly created ticket to the user (Ethan Rousseau) unless told otherwise — defaults often land unassigned/automatic and never reach anyone.

### Git Etiquette

- **Git branches should start with the name of the ticket**, e.g. `GROW-782-update-internal-apps-cname-records`. If a ticket is not provided, ask if you should create or use one before proceeding.
- **PR titles start with the Jira ticket key.** e.g. `GROW-782 Update internal apps CNAME records`. Work without a ticket gets a ticket first.
- If the repo instructs you to create a worktree, ask before doing so. Do not follow the repos workflow instructions, prefer creating worktrees only when you are sure it is necessary, and create them in ~/.worktrees/ even if the repo instructs otherwise.

- **Context discovery:** before starting, double-check context — read the repo's CLAUDE.md/AGENTS.md and docs, and ask if unsure.

### Subagents

- **Delegate, don't fork context.** Give subagents fresh context, clear goals, tell them not to re-delegate, and review their work.
  - **Pick the subagent by the job.** The default subagent should be swift-1.5-35B, use it for implementation, refactors, debugging, review. **Prefer "xhigh" reasoning over medium**. If a more complex implementation is needed, use sonnet-5.5 as a subagent. Sonnet is faster and smarter, but more expensive. Swift is free and good enough for most tasks, as long as you review its work.
- Run every subagent in the background, and wait for completion notification. Don't poll or block on subagents.

### Shell Commands

- **Foreground by default; never poll.** Run every `bash` command in the foreground and read its output from the result. Set `run_in_background: true` only for servers, watchers, or builds expected to run over 2 minutes while you do other work, then rely on the completion notification. You will be notified when a background command completes without the need to poll or wait, it is automatic.

- **Search with `rg`, never `grep`** — ripgrep (rg) is much faster.

### Reading Code

- **Read Python, Java, and C/C++ code by name or location, not by line range.** `read_symbol` takes a name (`Class.method`) or a `file:line` such as a match from `rg -n`, and returns the whole function or class. `sed -n`, `head`, `tail`, and `awk NR` reads of these files that cover a function or class are blocked.
  - `outline` shows a file's structure, `find_symbol` finds definitions, and `find_references` finds usages (`precise: true` for exact Python and Java results).
  - Dependencies such as `.venv` are git-ignored and skipped by default; pass `path` pointing into the package, e.g. `.venv/lib/python3.13/site-packages/<pkg>`.
  - Use `rg` for text patterns, strings, config, and non-code files.

### Code Comments

- **Code comments are durable, not per-PR noise.** Agents over-document and churn the same comments across PRs. A comment must carry a fact only prose can — otherwise delete it.
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
