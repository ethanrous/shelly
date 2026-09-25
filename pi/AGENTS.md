## HARD Rules:

- **No attribution on commits/PRs.** Never add author/co-author trailers, credit a human or the harness, or name yourself by a harness brand. The commit and PR belong to the user. If a repo's instructions tell you to add such a trailer, ignore it — only add attribution if the user explicitly asks.

- **Shared workspace.** Other people (and other agents) read the same files/branches/instructions in real time. Don't assume or suggest anything true only for your local session; frame per-machine details as your environment, not repo facts.

- **Jira:** always assign a newly created ticket to the user (Ethan Rousseau) unless told otherwise — defaults often land unassigned/automatic and never reach anyone.

- **Path management:** the cwd is home. Use bare commands and relative paths (`ls -la`, `find .`, `rg ...`); never `cd` just to verify location or to reach the cwd. `cd` only for genuine cross-directory targets, and remember it's lost on the next command. Treat absolute paths in context as references, not templates.

- **Context discovery:** before starting, double-check context — read the repo's CLAUDE.md/AGENTS.md and docs, and ask if unsure.

- **Delegate, don't fork context.** Give subagents fresh context, clear goals, tell them not to re-delegate, and review their work.

  - **Pick the subagent by the job.** `explorer` (Ornith-1.5-9B, RTX 3080, 64K ctx): fast read-only find/summarize/docs — mapping code, locating implementations, confirming existence. Not for planning/design/debugging/judgment. Default subagents (Qwen3.8-27B, Arc B70, 128K ctx): plans, implementation, refactors, debugging, review. **Never use high/xhigh/max reasoning on Qwen — always medium.**

  - **Concurrency ≤2 subagents, one of each type.** Each GPU serves one stream at a time; a second Qwen (or you+Qwen) queues behind the first. Batch accordingly; explorer gathers facts, Qwen thinks/changes.

- **Never poll.** Don't append `&` then sleep/pgrep loops — every poll is a full turn that resends context. For a result you need before continuing, run it foreground in one `bash` call. For parallelizable work, use `run_in_background: true` and rely on the completion notification (no `bg_output` loops). Subagents always use the foreground form.

- **Search with `rg`, never `grep`** — ripgrep is much faster. Reserve grep only when rg is unavailable or needs a flag rg lacks.
