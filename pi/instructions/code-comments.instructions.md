---
applyTo: "*"
---

# Code comments

Applies to comments and inline documentation in **any** file type — source code, YAML/JSON/TOML config, scripts, markup.

## What earns a comment

- **Only comment what the code can't express.** A comment is justified only when it conveys a non-obvious intent, constraint, tradeoff, invariant, or external behavior that clear names, types, schema keys, or tests do not.
- **Comment "why," not "what."** Never narrate what the code or config already says, restate identifiers, or explain obvious branches.
- **State a contract, not a narration.** Nothing the signature, key name, or surrounding structure already conveys.
- **Default to the minimum.** Most comments are one line. A second line is for a non-obvious constraint the reader must know — nothing more.
- **Rationale longer than a sentence or two moves out.** Design tradeoffs, product decisions, and security-posture arguments live in a design doc or Jira at most. A comment carries the decision's consequence, never the debate, and only when it is relevant to the future reader.
- **Relevance test:** if removing a comment would lose a fact that only prose carries, keep it; otherwise delete it.

## Format

- **Single backticks, never doubled.** When a comment or docstring references a name, wrap it in exactly one pair of backticks: `fn()` — never ``fn()`` .

## Voice and tense

- **Present tense, current facts only.** Describe how things are now ("the chunk size is capped at 50 because the API rate-limits larger batches"), never the story of how that was discovered.
- **Write to the future reader, not the user.** No second person, no imperatives aimed at a reader, no specifics to the current session, no "you" — a committed comment is addressed to the next maintainer. Exception: when the file itself is instructional (setup scripts, runbooks, templates), addressing the operator is fine.
- **No references to past events.** Never cite PR numbers, review rounds, commits, dates, or ticket IDs in support of a statement ("verified in PR #162", "added in GROW-586", "per the 2026-09 audit", "originally", "previously"). State the _reason_ in the present tense. Contrasting the current design with a rejected or prior design does not belong in the repo. Do not attribute a change to a person, PR, ticket, or date.
- **Ticket IDs only as pointers.** A Jira key with a content hint that points at where a still-true constraint or pending work is tracked is fine; citing one as history is not. Sample data that happens to be a key stays.
- **No references to future state.** No "will be replaced by…", "follow-up: …", planning notes, or open-task lists. Planned work lives in Jira.
- **Never put review or session metadata in a file.** No `PR #…`, review-round notes, "was wrong in an earlier version" notes, session IDs, or author attribution — that's a diary, not documentation.
- **No process artifacts.** Per-PR summary/journal blocks, changelogs inside files, incident reports, checklists of completed or pending actions, and "as of <snapshot>" statistics have no place in a committed file.

## Maintenance

- **Delete stale comments when you touch the file; don't rewrite untouched ones.** If a comment is wrong or misleading, remove it — don't re-explain.
- **Prefer deletion over accretion.** When two comments or docs cover the same fact, consolidate into one canonical spot and delete the rest.

## Tool-suppression directives

- **Fix the finding; don't suppress it.** Linter, formatter, or security-tool suppression markers exist for genuine false positives and documented deliberate exceptions — never to sidestep the work of satisfying a rule.
- When a suppression is justified, scope it as narrowly as the tool allows and state the reason in the same line or comment.
