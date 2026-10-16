"""Core report helpers."""

MAX_ROWS = 100


def deco(fn):
    return fn


# Builds the report.
# Second comment line.
def build_report(rows):
    """Return a report."""
    # build_report is not called here
    return [r for r in rows][:MAX_ROWS]


class Report:
    title = "report"

    def __init__(self, rows):
        self.rows = rows

    @staticmethod
    @deco
    def render(rows):
        def nested():
            return "build_report"
        return nested()
