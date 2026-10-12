---
name: "parallel-stacked-pr-implementation"
description: "Implement a multi-stage change as a GitHub stacked PR using parallel subagents — \"implement each stage in parallel and open a stacked PR\", gh stack, stacked PRs with worktrees, parallel agents per branch."
version: 1
created: "2026-10-06"
updated: "2026-10-06"
---
## When to Use
The user has a staged plan, wants sub-agents to implement the stages concurrently, and wants the result opened as a GitHub stacked PR (gh-stack extension installed).

## Procedure
1. Resolve every cross-stage unknown with the user before launching agents (values that only exist after a parent applies, ARNs created by hand, random suffixes).
2. Write a shared contract file (e.g. /tmp/<ticket>-contract.md) that pins every name crossing a stage boundary (variables, outputs, resource names) plus the global rules (no deploys or plans, no commits, no delegation, comment rules).
3. Create one worktree per stage from origin/main with the final branch names (`git worktree add -b <branch> ~/.worktrees/<repo>/<branch> origin/main`), then run `git branch --unset-upstream` on each.
4. Launch one agent per stage in parallel. Each prompt names its worktree, its file scope, and tells it to code against the contract for things earlier stages create, without creating them itself.
5. Review every diff yourself: run `git -C <wt> diff`, cat the untracked files, check them against the contract, and run fmt/check and `git diff --check`.
6. Commit each stage on its own branch, then stack the branches: `git -C <wt_n> rebase --onto <branch_n-1> origin/main` for n = 2..N. Disjoint file sets rebase cleanly.
7. Push all branches and create each PR with `gh pr create --base <parent> --head <branch> --title '<KEY> ...' --body-file ...`.
8. Link them into a stack with `gh stack link <pr1> <pr2> ...` (bottom to top), then verify each PR's base and head with `gh pr view`.

## Pitfalls
- Agents in separate worktrees can't see each other's code, so any name crossing a stage boundary that isn't in the contract will drift.
- A shared versions.tf symlink (Terraform repos) means a module can't add configuration_aliases. Use a provider block inside the module, following existing precedent, instead.
- `gh stack submit --auto` creates drafts with auto titles. For real titles and bodies, create the PRs yourself, then run `gh stack link`.
- In Atlantis repos, stacked PRs autoplan their head tree, which includes the parents' changes, and they compete for project locks. Apply strictly bottom-up.

## Verification
1. `git log --oneline --graph origin/main~1..<top branch>` shows exactly one commit per stage, in order.
2. Each PR's baseRefName is the branch below it, and the bottom PR's base is main.
3. `gh stack link` reports that the stack was created.