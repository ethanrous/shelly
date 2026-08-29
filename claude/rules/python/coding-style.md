---
paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Python specific content.

## Standards

- Follow **PEP 8** conventions
- Use **type annotations** on all function signatures and variable declarations. If something is not typed, follow the logical flow backwards to determine what type it should be, and add the type annotation. All variables should have a type annotation. Always avoid `Any`, and try to fully define generic types. i.e. avoid `my_var: dict` opting instead for `my_var: dict[str, int]` or `my_var: dict[str, list[int]]` etc.

## Immutability

Prefer immutable data structures:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str

from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
```

## Formatting

- **black** for code formatting
- **isort** for import sorting
- **ruff** for linting

## Reference

See skill: `python-patterns` for comprehensive Python idioms and patterns.

## Common pitfalls to avoid:

- Avoid importing in the middle of a function. All imports should always be at the top of the file.
- Avoid using `noqa` or other linter suppressions under any circumstances. If a linter is complaining, fix the code instead of silencing the warning.
- Avoid importing \* from a module. Always import only what you need, or import the module itself and use its namespace.
