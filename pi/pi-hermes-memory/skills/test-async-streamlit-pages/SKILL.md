---
name: "test-async-streamlit-pages"
description: "Validate multi-section Streamlit pages with cached loaders, background jobs, URL state, and partial telemetry without live credentials."
version: 2
created: "2026-09-15"
updated: "2026-09-15"
---
## When to Use
When repairing or adding a Streamlit page whose fragments submit background jobs and whose runtime APIs or telemetry semantics need end-to-end verification.

## Procedure
1. Read the actual signatures of query loaders, chart builders, shared job helpers, and URL-binding helpers before wiring renderers. Compile first to catch incomplete edits.
2. Keep telemetry transforms pure. Test units, zero/null/invalid intervals, repeated rows, scoped identifiers, overlap boundaries, and explicit fetch-cap truncation independently of the UI.
3. Mock the database transport entry point with representative DataFrames while keeping cached loaders and page rendering real. Clear loader caches between tests.
4. For deterministic AppTest coverage, replace only the executor with an immediate Future implementation; exercise the real job helper, widgets, chart builders, and render sections through AppTest.from_file.
5. Add a deferred-Future test: render pending shells, complete submitted jobs, rerun until loaded, and assert completed jobs are marked handled and stop causing reruns.
6. Test URL round trips in a fresh AppTest session, malformed parameters, dependent selector changes, empty datasets, and isolated per-source failures with sanitized UI errors.
7. Run the broader dashboard suite and the available validator separately; distinguish mocked full-render proof from live warehouse/schema verification.

## Pitfalls
- AppTest exposes unsupported Plotly elements with key=None; identify a chart by its proto.id suffix or inspect proto.spec instead.
- Pandas datetime64 columns can retain NaT after where(notna, None); cast to object before replacing missing values.
- Never bypass st.cache_data via __wrapped__ just to make tests easier.
- Background-page validation can succeed while only loading shells render; full loaded-path tests are still necessary.
- Do not label temporal overlap as dependency or ownership, or fabricate elapsed durations for missing telemetry.
- If a harness provisions .env as a FIFO, avoid reading it during hermetic tests; current python-dotenv supports PYTHON_DOTENV_DISABLED=1.

## Verification
1. Full-page tests render expected named charts and tables, not just an exception-free empty page.
2. Changing scope/date/run invalidates dependent selections and issues queries with the correct complete identifiers.
3. A failed SQL section leaves the task section visible and does not leak database error details.
4. Deferred-job tests reach a settled state with no unreported completed jobs or repeated query submissions.
5. Advance the mocked clock across the query-anchor granularity AFTER the page settles; change every dropdown with deferred loaders. Assert the chosen value and URL survive, the observation snapshot stays stable, and unrelated job Future identities do not change. A permanently frozen clock hides page-wide reload regressions.
6. Verify interactions in a real browser as well as AppTest, which uses full script reruns rather than actual fragment-only browser events. Cross a real minute boundary and confirm a presentation-only control does not start data loaders.