---
applyTo: "**/*.md"
---

# Markdown and docs

Applies to every `*.md` file — READMEs, `docs/`, deployment docs, skills, agents, and agent guidance. Loaded automatically whenever a `.md` file is in play (`applyTo: "**/*.md"`).

## Placement

- Package `README.md` for orientation, `docs/` for architecture and reference, deployment docs next to the artifacts they describe, `.github/` for agent guidance.
- No roadmap, journal, findings, or session files. Development history lives in git, pull requests, and Jira.
- Living docs belong in one place, updated meaningfully — not rewritten per PR. Append decisions; don't restructure, re-summarize, or re-log a whole doc on every commit.
- Atomic PRs: no README/doc/markdown changes in a PR that doesn't directly relate to the code change.

## Generated files

Docs produced by a generator are outputs, not sources. When a repo generates a doc (check its task runner or CI), edit the source and regenerate; never hand-edit the output.

## Formatting

- If the repo formats markdown with Prettier, it owns line wrapping (`proseWrap: never`). Write each paragraph as one line; the formatter is the only thing that wraps or unwraps. Don't reflow wrapped prose you aren't otherwise rewriting.
- Inline code uses single backticks, never doubled, and never preceded by an RST role marker (no `:class:` / `:func:`-style prefixes) — a bare `name` code span is enough. Multiple backticks appear only as fenced-code delimiters, and even then only the minimum needed for the content.
- Use lists rather than trailing-space hard breaks. Relative links must resolve.

## Two kinds of docs

- **Reference and architecture docs** (`docs/`, a README's "what's here" sections) state present-tense facts about structure, contents, and behavior. They never read as the author talking to the reader.
- **How-to docs** (quickstarts, runbooks, `SKILL.md` files, agent files, and agent guidance) are imperative by design and may address the reader. A Prerequisites section is fine when it lists what the reader needs before starting (install the toolchain, VPN access).
- In both kinds, unfinished infra work is not a prerequisite or a to-do — it belongs in Jira.

## Reference docs describe structure, not tasks

- **Less is more.** Shorter docs get read; a wall of text gets skipped. Favor terse, scannable structure — short sections, lead-in lines, and bare facts. When two phrasings say the same thing, pick the shorter one, and delete whole paragraphs when their information already lives in the code or a linked doc.
- **No model-to-user voice.** No imperative verbs aimed at the reader ("provision `X` in Secrets Manager", "create the namespace", "ensure `Y` is set"), no second person, and no "Requirements"/"To-do"/"Action items"/"Open tasks" sections built around work that still needs doing. State facts instead: "`LOGS_OPENSEARCH_PASSWORD` is read from AWS Secrets Manager" rather than "provision `LOGS_OPENSEARCH_PASSWORD`".
- **Lead with the _what_, then the _why_.** Describe what exists, where it lives, how components relate, and what the system does. Keep rationale that is still true (a constraint, trade-off, or rejected alternative, stated in the present tense) and drop the story of how the design came about. If a passage can be read as "here's what needs to be done," rewrite it as "here's how this part of the repo is structured."

## Docs describe the current state — not its history

- **No references to past events.** Never cite PR numbers, review rounds, commits, dates, or ticket IDs in support of a statement ("verified in PR #162", "added in GROW-586", "per the 2026-09 audit", "originally", "previously"). State the _reason_ in the present tense ("the chunk size is capped at 50 because the Jira API rate-limits larger batches"), not the story of who noticed it and when. Contrasting the current design with a rejected or prior _design_ is legitimate ("this scopes by project keys rather than a saved filter, which had drifted out of sync"), and "used to" is fine when it compares two code shapes ("the lookup table used to be keyed by id, now by name"); it is banned when it attributes a change to a person, PR, ticket, or date.
- **Ticket IDs only as pointers.** Committed docs never cite a ticket as history. A Jira key with a content hint that points at where a still-true constraint or pending work is tracked is fine. Sample data that happens to be a key (`BEL-300001` in a fixture) stays.
- **No references to future state.** No "will be replaced by…", "follow-up: …", "next phase will…", planning checklists, or open-task lists. Planned work lives in Jira.
- **No operational or deployment status.** Don't describe where, how, or whether something is currently deployed or running ("the server currently runs as a local stdio MCP server", "there is no hosted EKS deployment today"). Document durable artifact properties instead — what the chart, Dockerfile, and publish workflow are and do, what values exist, what behavior fails closed. Current deployment state belongs in Jira, git, or ops runbooks.
- **No process artifacts in any committed file.** Per-PR summary/journal sections, changelogs inside docs, incident reports or "problems found during …" appendices, checklists of completed or pending actions, roadmaps, and "as of <snapshot>" statistics are excluded. Roadmap and planning content is tracked in Jira — never re-add it to a doc because it is convenient to have nearby; if a section like this survives in a file you are editing, removing it belongs in that same PR.
- **Prefer deletion over accretion.** Remove stale or redundant docs outright instead of appending corrections. When two docs cover the same territory, consolidate into one canonical doc and delete the rest.
