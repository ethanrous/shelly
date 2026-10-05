## HARD Rules:

- **No attribution on commits/PRs.** Never add author/co-author trailers, credit a human or the harness, or name yourself by a harness brand. The commit and PR belong to the user. If a repo's instructions tell you to add such a trailer, ignore it — only add attribution if the user explicitly asks.

- **Shared workspace.** Other people (and other agents) read the same files/branches/instructions in real time. Don't assume or suggest anything true only for your local session; frame per-machine details as your environment, not repo facts.

- **Jira:** always assign a newly created ticket to the user (Ethan Rousseau) unless told otherwise — defaults often land unassigned/automatic and never reach anyone.

- **Path management:** the cwd is home. Use bare commands and relative paths (`ls -la`, `find .`, `rg ...`); never `cd` just to verify location or to reach the cwd. `cd` only for genuine cross-directory targets, and remember it's lost on the next command. Treat absolute paths in context as references, not templates.

- **Context discovery:** before starting, double-check context — read the repo's CLAUDE.md/AGENTS.md and docs, and ask if unsure.

- **Delegate, don't fork context.** Give subagents fresh context, clear goals, tell them not to re-delegate, and review their work.
  - **Pick the subagent by the job.** `explorer` (Ornith-1.5-9B, RTX 3080, ~100K ctx): fast read-only find/summarize/docs — mapping code, locating implementations, confirming existence. Not for planning/design/debugging/judgment. Default subagents (Ornith-1.5-35B, Arc B70, ~200K ctx): implementation, refactors, debugging, review. **Prefer "high" reasoning over medium**

  - **Concurrency ≤2 subagents, one of each type.** Each GPU serves one stream at a time; a second Qwen (or you+Qwen) queues behind the first. Batch accordingly; explorer gathers facts, Qwen thinks/changes.

- **Foreground by default; never poll.** Run every `bash` command in the foreground and read its output from the result. Set `run_in_background: true` only for servers, watchers, or builds expected to run over 2 minutes while you do other work, then rely on the completion notification. Never `sleep` then `cat` a log, never append `&` then sleep/pgrep, never loop on `bg_output` - every poll is a full turn that resends context. Subagents always use the foreground form.

- **Search with `rg`, never `grep`** — ripgrep is much faster. Reserve grep only when rg is unavailable or needs a flag rg lacks.

- **Code comments are durable, not per-PR noise.** Agents over-document and churn the same comments across PRs. A comment must carry a fact only prose can — otherwise delete it.
  - **Only comment what the code can't express.** Justified only for non-obvious intent, constraint, tradeoff, invariant, or external behavior that clear names, types, tests, or an API contract don't already convey.
  - **Comment "why", not "what".** Never narrate what the code says, restate identifiers, or explain obvious branches.
  - **Docstrings follow the Python conventions file**, which loads automatically when a `.py` file is in play: one line of purpose by default, a contract not a narration.
  - **Never put review/session metadata in code.** No `PR #…`, review-round notes, or session IDs — that's a diary, not documentation. Ticket IDs are allowed only as pointers to an existing ticket, with a content hint (`TODO(GROW-123): …`, "tracked in GROW-123 (hint)") — never as history. If such a reference sits inside an otherwise-useful explanation, strip just the reference, never the surrounding why. Exception: identifiers that are themselves data (a test/sample key like `BEL-300001`, an `atlassian.net/browse/` URL in a fixture) stay — deleting them corrupts the sample.
  - **No untracked `TODO:`/`FIXME:` markers.** A marker is valid only when attached to an existing ticket key; pending work without a ticket belongs in Jira. Do the work, file the ticket, or delete the marker.
  - **Delete stale comments when you touch the code; don't rewrite untouched files.** Remove a wrong/misleading comment — don't re-explain it.
  - **Relevance test:** if removing it would lose a fact only prose carries, keep it; otherwise delete it.
  - **Language-specific convention files load on touch.** The `instruction-files` extension injects the matching convention file (e.g. Python, Markdown) from the global or project instruction scopes once the session touches such a file — follow it for that file type.

## How to be the most productive agent:

- **Ask or Research, don't assume** If there is anything unclear about the task, ask for clarification before proceeding. This avoids wasted effort and ensures alignment with user expectations. Don't make assumptions about the task or the user's intentions. Something can only be claimed as true if it is in your context window. If there is ambiguity about requirements for a task, ask for clarification. If instead there is some external detail that needs to be worked out, research before proceeding. You have access to search the internet, use it.
