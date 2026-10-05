---
applyTo: "**/*.py"
---

# Python conventions

Applies to every `*.py` file — library code, servers, apps, and co-located tests. Loaded automatically whenever a `.py` file is in play (`applyTo: "**/*.py"`).

## Environment & dependencies

- **Interpreter:** the project's supported Python version is declared in its `pyproject.toml` (`requires-python`) — look it up only if a task depends on version-specific behavior, which is rare.
- **Dependencies:** add packages through the project's package manager (its lockfile tells you which) — never ad-hoc `pip install` into the environment.

## Docstrings

A docstring states a contract, not a narration — nothing the signature already says.

- **Default to one line of purpose.** Most function and method docstrings are exactly one line. A second line is for a non-obvious constraint a caller must know, nothing more.
- **`Args:` entries only when the name and type don't already convey the meaning, and each entry is one to two sentences — a hard limit.** If an argument takes more than two sentences to explain, the rationale belongs in the module docstring or a design doc; leave only the decision-relevant consequence in the entry (e.g. "required once the verifier is ready; `None` while auth is disabled").
- **`Returns:` / `Raises:` only when not derivable from the annotation.** A `Raises:` line earns its place when the failure's timing or condition isn't visible from the signature; the justification for _why_ it fails that way is rationale, not contract.
- **Rationale longer than a sentence or two moves up.** Design tradeoffs, product decisions, and security-posture arguments live in the module docstring at most — usually in a design doc or Jira. Function docstrings carry the decision's consequence, never the debate.
- **Private helpers** get a docstring only when their intent isn't obvious from the name and body.
- **Module docstrings are orientation, not an essay.** A sentence or two of purpose, then only the invariants a reader must hold before the functions make sense. Keep it under ~15 lines; past that it won't be read — move the depth to the package `README.md` or a design doc and leave a one-line pointer. Present tense, current facts only.

## Typing

- **Annotate signatures wherever possible** — every parameter and return type on public functions, and on private ones wherever the type isn't obvious from context.
- **Prefer precise types over `Any`.** Concrete collections (`list[str]`, `dict[str, Role]`), `str | None` for optionals. `Any` is for genuinely unbounded values (external payloads, framework boundaries) — when you must use one, say why in a short comment.
- **When a result has more than two named fields, return a dataclass or `TypedDict`,** not a tuple or loose dict — the names and types belong in the signature, not in the caller's memory.

## Linter suppressions

- **Fix the finding; don't suppress it.** `# noqa`, `# nosec`, and `# pylint: disable` exist for genuine false positives and documented deliberate exceptions — never to sidestep the work of satisfying a rule.
- When a suppression is justified, scope it as narrowly as the tool allows (a specific rule code on a single line, not a file-wide disable) and state the reason in the same comment.
