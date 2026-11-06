---
name: "working-with-worktrees"
description: "Create and manage git worktrees in the standard location: reuse an existing one, create it under ~/.worktrees/<repo>/<branch>, set it up, and clean it up when done."
version: 1
created: "2026-10-29"
updated: "2026-10-29"
---

## When to Use

Use whenever you need an isolated checkout of a repo — reviewing a PR, working a branch in parallel with the main checkout, or any task that asks for a "worktree." A worktree is a separate directory that keeps the main checkout clean, so it must live in the standard, findable location and be named for the repo and branch.

## Procedure

1. Ask before creating one, even if the repo's instructions call for a worktree.
2. Run `git worktree list` first. If a worktree for the branch already exists, REUSE it — do not create a duplicate.
3. Create it at `~/.worktrees/<repo-name>/<branch-name>/`: the first path component is the repo, the second is the branch (e.g. branch `GROW-123-fix-thing` in `data-insights` → `~/.worktrees/data-insights/GROW-123-fix-thing/`). Never use a flat, ad-hoc top-level name.
4. Base it correctly: for a PR review, check out the PR head (merge ref / head SHA); for new work, branch off `main`/`master`.
5. Set the worktree up like a fresh clone — run the repo's install (e.g. `just install` / `uv sync`) so it has its own venv/node deps. A worktree does not share the main checkout's environment or its uncommitted changes.
6. When you're done, remove it with `git worktree remove <path>` (add `--force` only if you must discard changes) and clear any stale metadata with `git worktree prune`.

## Pitfalls

1. Naming a worktree with a flat slug (e.g. `~/.worktrees/pr-269-review`) instead of `~/.worktrees/<repo>/<branch>/`. The path is meant to encode repo + branch so a worktree sits next to its siblings and is easy to find; a made-up top-level name breaks that and scatters worktrees across the `~/.worktrees/` root.
2. Creating a second worktree for a branch that already has one — check `git worktree list` and reuse the existing path.
3. Treating a worktree as a view of the main checkout: it is a separate checkout with its own working tree, so edits in one are invisible in the other, and it needs its own dependency install.
4. Reviewing a stale head: after creating the worktree, re-confirm the head SHA; if the author pushes a new commit (e.g. a merge of master), update the worktree and re-run the suite at the new head before approving.

## Verification

1. `git worktree list` shows the worktree at `~/.worktrees/<repo-name>/<branch-name>/` — repo name first, branch second.
2. The worktree has its dependencies installed and its target tests pass.
3. On cleanup, `git worktree list` no longer shows the removed path (or `git worktree prune` cleared the stale entry) and the main checkout is untouched.
