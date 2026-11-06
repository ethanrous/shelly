---
applyTo: "**/*.md"
---

# Markdown and docs

Rules for every `*.md` file, on top of the code-comment rules on voice, history, tickets, and process artifacts. They override repo precedent: don't imitate dated, ticket-cited, or statistics-laden sections, and don't add a section just because repo instructions ask for a doc update.

## Placement

- Package `README.md` for orientation, `docs/` for architecture and reference, deployment docs next to their artifacts, and `.github/` for agent guidance.
- No roadmap, journal, findings, or session files. History lives in git, PRs, and Jira. If such a section survives in a file you edit, remove it in the same PR.
- Each topic has one canonical doc, updated in place, not rewritten or re-logged per PR.
- Change docs in a PR only when they relate to its code change.
- Generated docs are outputs: edit the source and regenerate.

## Formatting

- When Prettier formats markdown, it owns wrapping: write each paragraph as one line, and don't reflow prose you aren't rewriting.
- Inline code uses single backticks, with no RST role prefix such as `:func:`. Fences use the fewest backticks the content allows.
- Use lists instead of trailing-space line breaks. Relative links must resolve.

## Content

- Reference and architecture docs (`docs/`, a README's "what's here" sections) state present-tense facts about structure and behavior. No imperatives aimed at the reader, no second person, and no Requirements, To-do, or Action items sections. Write "`X` is read from Secrets Manager", not "provision `X`".
- How-to docs (quickstarts, runbooks, `SKILL.md`, agent files) are imperative and may address the reader. A Prerequisites section lists what the reader needs, not unfinished infra work.
- Lead with what exists and where it lives, then why. Keep rationale that is still true, including a rejected alternative stated in the present tense, and drop the story of how the design came about.
- No deployment status, such as "currently runs as a local stdio server". Document durable artifact properties instead.
- Shorter is better. Delete paragraphs whose information already lives in the code or a linked doc.
