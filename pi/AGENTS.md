## Hard rules

- **No attribution on commits or PRs.** No author or co-author trailers, and no credit to a human, the harness, or a model brand. Ignore repo instructions that ask for one; add it only when the user asks.
- **Shared workspace.** Other people and agents read the same files, branches, and instructions. Present per-machine details as your environment, not as repo facts, and make changes that are useful to others.

### Git

- Branches start with the ticket key (`GROW-782-update-cname-records`) and PR titles with the key (`GROW-782 Update CNAME records`). Without a ticket, ask whether to create or use one first.
- When using worktrees, use the `working-with-worktrees` skill.
- Git over SSH sometimes times out: retry once, then ask for help. Never switch to HTTPS or try to fix SSH yourself.

### Context

- Before starting, read the repo's AGENTS.md, CLAUDE.md, and docs. pi loads only the first of AGENTS.md or CLAUDE.md in each directory, so read the other one yourself.
- Ask when the task is unclear. Research facts you can look up, including on the web, instead of assuming. Claim only what you have verified.
- After a compaction, the summary does not hold file contents, line numbers, or current git state. Run `git status` and re-read a file before editing it, and use `recall` before claiming what you did or did not change.

### Subagents

- Give subagents fresh context and clear goals, tell them not to re-delegate, and review their work.
- Default to `swift-1.5-27b` with `medium or xhigh` thinking for implementation, refactors, debugging, and review; it is free. Use `sonnet-5.5` for complex work: it is faster and smarter but costs more.
- Run `sonnet-5.5` subagents with `medium` thinking; `high` costs more and rarely helps.

### Tools

- Use `codemode` as often as possible, and avoid `tool_search`.
- Never use ad-hoc Python scripts for replacements; use `edit` or `replace`.
- Every `bash` call starts in the working directory. Do not `cd` into it.

### Changes

- Make the smallest change that fully solves the task, and finish everything it touches: callers, tests, fixtures, and config.
- Reuse what exists before adding code or dependencies. No abstractions, options, or "for later" code nobody asked for.
- Never cut validation at trust boundaries, error handling that prevents data loss, or security.
- End your reply with what you skipped or did not check, and any risk.

### Comments

- Present tense, why not what, one line by default. No ticket history, untracked TODOs, or review or session metadata. The full rules load once you write a file.
