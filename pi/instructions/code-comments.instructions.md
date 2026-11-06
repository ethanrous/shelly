---
applyTo: "*"
---

# Code comments

Rules for comments, docstrings, and docs in any file type. They override repo precedent: existing comments that break them are legacy, not a template, even when the repo's own instructions ask for a doc update.

## What earns a comment

- Comment only what the code can't express: a non-obvious intent, constraint, trade-off, invariant, or external behavior. Never restate names, types, or obvious branches.
- Comment why, not what. State a contract, not a narration.
- One line by default, and a second only for a constraint the reader must know. Longer rationale goes in a design doc or Jira; the comment keeps only its consequence.
- If deleting a comment loses no fact that only prose carries, delete it.

## Voice

- Present tense and current facts, written for the next maintainer. No "you" or imperatives, except in instructional files such as setup scripts, runbooks, and templates.
- No history: no PR numbers, review rounds, commits, dates, "originally", or "previously", and no attribution to a person, PR, or ticket. State the reason instead. A comment does not contrast the code with a prior design.
- No future state: no "will be replaced", follow-ups, or task lists. Planned work lives in Jira.
- A ticket key appears only as a pointer, with a content hint, to where a still-true constraint or pending work is tracked. A `TODO` needs an existing ticket key: `TODO(GROW-123): ...`. Sample data that is a key, such as `BEL-300001` in a fixture, stays.
- No session or process artifacts: session IDs, review notes, per-PR summaries, changelogs inside files, incident reports, checklists, or "as of" statistics.

## Format and maintenance

- Wrap names in single backticks, never doubled.
- Before finishing, re-read every comment you added or touched and the ones beside code you changed, which go stale when a flag or condition is removed.
- Delete a wrong comment instead of re-explaining it. Don't rewrite comments in code you didn't touch.
- When two comments or docs state the same fact, keep one.
- Fix a linter or security finding instead of suppressing it. A justified suppression is as narrow as the tool allows and states its reason on the same line.
