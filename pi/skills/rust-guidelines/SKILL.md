---
name: rust-guidelines
description: Pragmatic Rust Guidelines (Microsoft, version 2026.6) consolidated for agents working on Rust code. Use when writing, reviewing, refactoring, or benchmarking Rust — libraries, applications, FFI, macros, unsafe code, error handling, or async. Applies the guidelines' actionable items so code is safe, ergonomic, performant, and well-documented. Each item links back to its source guideline. Full per-point provenance with source links is in references/SOURCES.md.
license: MIT
---

# Pragmatic Rust Guidelines

> Consolidated from the Microsoft **Pragmatic Rust Guidelines** book, version **2026.6**
> (last generated 2026-09-15). Every item below is taken from a guideline in the source
> and links back to it — nothing is invented here.

## How to use this skill

- **Scope:** Apply the relevant guideline(s) to new code, and flag deviations in existing code.
- **Golden rule:** Each guideline exists for a reason; the *spirit* counts more than the letter. Before working around a guideline, understand its motivation. If a guideline seems to conflict with a real need, read its source page and note the deviation.
- **Not a straitjacket:** Teams are free to adopt these as they see fit. Where a guideline is marked *must* it should always hold; *should* gives flexibility.
- **Provenance:** This skill is a consolidation. The authoritative text for every item is the linked page. For a full mapping of each consolidated point to its source link (and a short excerpt proving the derivation), see [references/SOURCES.md](references/SOURCES.md).
- **Upstream sources to also follow** (mentioned explicitly by the book): the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/checklist.html), the [Rust Style Guide](https://doc.rust-lang.org/stable/style-guide/), [Rust Design Patterns](https://rust-unofficial.github.io/patterns/intro.html), and the [Rust Reference — Undefined Behavior](https://doc.rust-lang.org/reference/behavior-considered-undefined.html).

## Quick checklist

Apply all of the following to the crate/project you are touching (from the book's own checklist):

- [ ] Follow the upstream guidelines (Universal)
- [ ] Use static verification (Universal)
- [ ] Lint overrides use `#[expect]` (Universal)
- [ ] Public types are `Debug` (Universal)
- [ ] Public types meant to be read are `Display` (Universal)
- [ ] If in doubt, split the crate (Universal)
- [ ] Names are free of weasel words (Universal)
- [ ] Names of items are short (Universal)
- [ ] Prefer regular over associated functions (Universal)
- [ ] Magic values are documented (Universal)
- [ ] Use structured logging with message templates (Universal)
- [ ] Types are `Send` (Interop)
- [ ] Native escape hatches (Interop)
- [ ] Don't leak external types (Interop)
- [ ] Items come from their original crate (Interop)
- [ ] Accept `impl AsRef<>` where feasible (Interop)
- [ ] Accept `impl RangeBounds<>` where feasible (Interop)
- [ ] Accept `impl 'IO'` where feasible (Interop)
- [ ] Abstractions don't visibly nest (UX)
- [ ] Avoid smart pointers and wrappers in APIs (UX)
- [ ] Prefer types over generics, generics over `dyn traits` (UX)
- [ ] Errors are canonical structs (UX)
- [ ] Canonical error conversion uses `From`, not `map_err` (UX)
- [ ] Complex type construction has builders (UX)
- [ ] Complex type initialization hierarchies are cascaded (UX)
- [ ] Services are `Clone` (UX)
- [ ] Essential functionality should be inherent (UX)
- [ ] Modules are balanced in size and scope (UX)
- [ ] Don't define preludes (UX)
- [ ] Parameter ordering is consistent (UX)
- [ ] Collections implement the appropriate iter traits (UX)
- [ ] Functions are `async` over returning a `Future` (UX)
- [ ] I/O and system calls are mockable (Resilience)
- [ ] Test utilities are feature gated (Resilience)
- [ ] Integration tests live under `tests/` (Resilience)
- [ ] Use the proper type family (Resilience)
- [ ] Newtypes guard their invariants (Resilience)
- [ ] Builders validate in final `.build()` (Resilience)
- [ ] Don't glob re-export items (Resilience)
- [ ] Avoid statics (Resilience)
- [ ] Production code uses telemetry, not `println` (Resilience)
- [ ] Libraries work out of the box (Building)
- [ ] Native `-sys` crates compile without dependencies (Building)
- [ ] Features are additive (Building)
- [ ] Macros are a last resort (Macros)
- [ ] Prefer 'macros by example' over proc macros (Macros)
- [ ] Macros don't lie about signatures (Macros)
- [ ] Macros assume main crate (Macros)
- [ ] Third party items come from hidden `_private` module (Macros)
- [ ] Proc macros should have separate impl crate incl. tests (Macros)
- [ ] Proc macros don't produce implied or hidden items (Macros)
- [ ] Use mimalloc for apps (Applications)
- [ ] Applications may use Anyhow or derivatives (Applications)
- [ ] Applications target highest viable target-cpu (Applications)
- [ ] Isolate DLL state between FFI libraries (FFI)
- [ ] Business logic belongs in core crates, FFI only translates (FFI)
- [ ] FFI crates follow established naming conventions (FFI)
- [ ] Unsafe needs reason, should be avoided (Correctness)
- [ ] Unsafe implies undefined behavior (Correctness)
- [ ] All code must be sound (Correctness)
- [ ] Panic means 'stop the program' (Correctness)
- [ ] Detected programming bugs are panics, not errors (Correctness)
- [ ] Panic continuation is last resort (Correctness)
- [ ] Custom panics have a helpful message (Correctness)
- [ ] Optimize for throughput, avoid empty cycles (Performance)
- [ ] Identify, profile, optimize the hot path early (Performance)
- [ ] Long-running tasks should have yield points (Performance)
- [ ] Reuse allocations where possible (Performance)
- [ ] Library telemetry does not tank performance (Performance)
- [ ] Nested type hierarchies should avoid needless indirection (Performance)
- [ ] Use boxed slices and strings for immutable owned sequences (Performance)
- [ ] Shrink collections to fit after building (Performance)
- [ ] Use a fast hasher where possible (Performance)
- [ ] Collections are created with sufficient initial capacity (Performance)
- [ ] Hot `async` functions reduce stack size (Performance)
- [ ] Common settings come from the workspace `Cargo.toml` (Project)
- [ ] The workspace lists and versions all crates (Project)
- [ ] All crates are siblings in one folder (Project)
- [ ] New crates target latest edition (Project)
- [ ] MSRV is conservatively updated (Project)
- [ ] First sentence is one line; approx. 15 words (Documentation)
- [ ] Has comprehensive module documentation (Documentation)
- [ ] Documentation has canonical sections (Documentation)
- [ ] Mark `pub use` items with `#[doc(inline)]` (Documentation)
- [ ] Design with AI use in mind (AI)
- [ ] Items are only visible through one path (AI)
- [ ] Avoid meta design documentation (AI)
- [ ] Tests do not assert ground truth (AI)
- [ ] Rust code solves Rust problems (AI)

## Guidelines

### Universal

- **Follow the upstream guidelines (M-UPSTREAM-GUIDELINES)** — This book complements, not replaces, existing Rust guidance (Rust API Guidelines, Style Guide, Design Patterns, UB reference). Apply all of them. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-UPSTREAM-GUIDELINES)
- **Use static verification (M-STATIC-VERIFICATION)** — Run lints, clippy (all major groups + `restriction`), rustfmt, cargo-audit, cargo-hack, cargo-udeps, and miri as check-in gates. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-STATIC-VERIFICATION)
- **Lint overrides use `#[expect]` (M-LINT-OVERRIDE-EXPECT)** — Override project-global lints in a submodule/item with `#[expect]` (not `#[allow]`), always with a `reason`. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-LINT-OVERRIDE-EXPECT)
- **Public types are `Debug` (M-PUBLIC-DEBUG)** — Every public type implements `Debug` (`#[derive(Debug)]` where possible); types holding sensitive data use a custom impl tested to prove no leak. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-PUBLIC-DEBUG)
- **Public types meant to be read are `Display` (M-PUBLIC-DISPLAY)** — Types read by consumers implement `Display` (error types, string wrappers). [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-PUBLIC-DISPLAY)
- **If in doubt, split the crate (M-SMALLER-CRATES)** — Err toward more crates; split independently usable submodules into their own crates; use umbrella crates for proc-macros/runtimes; always re-export split functionality. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-SMALLER-CRATES)
- **Names are free of weasel words (M-WEASEL-WORDS)** — Type/trait names avoid filler like `Service`, `Manager`, `Factory`. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-WEASEL-WORDS)
- **Names of items are short (M-SHORT-NAMES)** — Identifiers compound ≤2 short words, bake no module/crate prefix, prefer abbreviations. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-SHORT-NAMES)
- **Prefer regular over associated functions (M-REGULAR-FN)** — Use associated functions mainly for instance creation; general computation lives in regular functions. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-REGULAR-FN)
- **Magic values are documented (M-DOCUMENTED-MAGIC)** — Document hardcoded magic values (why, side effects of changing, external systems); prefer named constants. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-DOCUMENTED-MAGIC)
- **Use structured logging with message templates (M-LOG-STRUCTURED)** — Log with named-property message templates (OTel conventions, redact sensitive data); avoid runtime string formatting. [Universal](https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-LOG-STRUCTURED)

### Library / Interoperability

- **Types are `Send` (M-TYPES-SEND)** — Public types, and especially futures, are `Send`; assert it at entry points. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-TYPES-SEND)
- **Native escape hatches (M-ESCAPE-HATCHES)** — Types wrapping native handles provide `unsafe` `from_native`/`into_native`/`to_native` conversions, documenting safety requirements. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-ESCAPE-HATCHES)
- **Don't leak external types (M-DONT-LEAK-TYPES)** — Prefer `std`/`core` types in public APIs; umbrella crates may leak sibling types; leaking behind a feature flag is acceptable. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-DONT-LEAK-TYPES)
- **Items come from their original crate (M-FOREIGN-REEXPORTS)** — Don't re-export third-party types from your crate; let users depend on the third-party crate directly (exceptions: umbrella crates, technically-split crates, macro stable paths). [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-FOREIGN-REEXPORTS)
- **Accept `impl AsRef<>` where feasible (M-IMPL-ASREF)** — In signatures, accept `impl AsRef<T>` when you don't need ownership and object creation is cheap. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-ASREF)
- **Accept `impl RangeBounds<>` where feasible (M-IMPL-RANGEBOUNDS)** — Range functions take `Range`/`impl RangeBounds<T>` rather than hand-rolled low/high params. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-RANGEBOUNDS)
- **Accept `impl 'IO'` where feasible (M-IMPL-IO)** — One-shot init I/O is sans-io: accept `impl Read`/`Write`/`AsyncRead`, etc. [Interop](https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-IO)

### Library / UX

- **Abstractions don't visibly nest (M-SIMPLE-ABSTRACTIONS)** — Avoid visible type-parameter nesting in public/service types (≤1 level deep). [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-SIMPLE-ABSTRACTIONS)
- **Avoid smart pointers and wrappers in APIs (M-AVOID-WRAPPERS)** — Hide `Rc`/`Arc`/`Box`/`RefCell` behind simple types (`&T`, `T`) in public APIs. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-AVOID-WRAPPERS)
- **Prefer types over generics, generics over `dyn traits` (M-DI-HIERARCHY)** — For async deps, prefer concrete types over generics over `dyn Trait`; follow the escalation ladder enum → trait → subtrait → `dyn`. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-DI-HIERARCHY)
- **Errors are canonical structs (M-ERRORS-CANONICAL-STRUCTS)** — Errors are situation-specific structs carrying a backtrace, an optional cause, and helper methods; avoid giant error enums; capture a backtrace at construction. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ERRORS-CANONICAL-STRUCTS)
- **Canonical error conversion uses `From`, not `map_err` (M-FROM-ERROR)** — Convert owned errors via `impl From<Other> for Error` rather than `.map_err` at every call site. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-FROM-ERROR)
- **Complex type construction has builders (M-INIT-BUILDER)** — Types with ≤2 optional params use inherent methods; types with 4+ params use a builder (`FooBuilder`, `Foo::builder()`, `.build()`), with required params passed at creation. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-INIT-BUILDER)
- **Complex type initialization hierarchies are cascaded (M-INIT-CASCADED)** — Group 4+ init params into helper types (newtypes) so signatures stay clean. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-INIT-CASCADED)
- **Services are `Clone` (M-SERVICES-CLONE)** — Heavyweight service/thread-singleton types implement `Clone` via an `Arc<Inner>` pattern, sharing one common instance per thread. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-SERVICES-CLONE)
- **Essential functionality should be inherent (M-ESSENTIAL-FN-INHERENT)** — Implement core functionality on the type inherently; trait impls forward to inherent methods. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ESSENTIAL-FN-INHERENT)
- **Modules are balanced in size and scope (M-BALANCED-MODULES)** — Put essential items in the crate root; group the rest by use case into submodules. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-BALANCED-MODULES)
- **Don't define preludes (M-NO-PRELUDE)** — Crates must not define a prelude or any `use foo::*` namespace. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-NO-PRELUDE)
- **Parameter ordering is consistent (M-PARAMETER-CONSISTENCY)** — The same conceptual params appear in the same order everywhere (call-specific first, ubiquitous last, closures last). [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-PARAMETER-CONSISTENCY)
- **Collections implement the appropriate iter traits (M-COLLECTION-TRAITS)** — Custom collections implement the iterator-facing traits (`IntoIter`, `Iter`, `Iterator`, `IntoIterator`, `FromIterator`, `Extend`, `size_hint`). [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-COLLECTION-TRAITS)
- **Functions are `async` over returning a `Future` (M-ASYNC-FN)** — Prefer `async fn` over `fn -> impl Future` when both are viable. [UX](https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ASYNC-FN)

### Library / Resilience

- **I/O and system calls are mockable (M-MOCKABLE-SYSCALLS)** — User-facing types doing I/O or syscalls with side effects (file/net, clocks, entropy, seeds) are mockable; libraries accept a mockable I/O core or provide inherent mocking. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-MOCKABLE-SYSCALLS)
- **Test utilities are feature gated (M-TEST-UTIL)** — Mocking, inspecting sensitive data, safety overrides, and fake data live behind a single `test-util` feature. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-TEST-UTIL)
- **Integration tests live under `tests/` (M-INTEGRATION-TESTS)** — Tests touching only the public API are integration tests in `tests/`, not `mod tests {}`. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-INTEGRATION-TESTS)
- **Use the proper type family (M-STRONG-TYPES)** — Use the strongest appropriate `std` type as early as possible in the API (e.g., `PathBuf` over `String` for anything OS-related). [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-STRONG-TYPES)
- **Newtypes guard their invariants (M-STRONG-TYPES-GUARD)** — Newtypes enforce their invariant at construction via fallible constructors (`TryFrom`/`FromStr`); no infallible `From`. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-STRONG-TYPES-GUARD)
- **Builders validate in final `.build()` (M-BUILD-RESULT)** — Builder setters accept input without failing; final validation happens in a `Result`-returning `.build()`. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-BUILD-RESULT)
- **Don't glob re-export items (M-NO-GLOB-REEXPORTS)** — Re-export items individually (`pub use foo::{A, B, C}`), not via `pub use foo::*`. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-NO-GLOB-REEXPORTS)
- **Avoid statics (M-AVOID-STATICS)** — Libraries avoid `static`/thread-local items where a consistent view matters (secret state duplication breaks correctness). [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-AVOID-STATICS)
- **Production code uses telemetry, not `println` (M-LOG-NOT-PRINT)** — Production paths emit via the telemetry framework, not `println!`/`dbg!`. [Resilience](https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-LOG-NOT-PRINT)

### Library / Building

- **Libraries work out of the box (M-OOBE)** — Libraries just work on all supported platforms with no prerequisites beyond `cargo`/`rust`. [Building](https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-OOBE)
- **Native `-sys` crates compile without dependencies (M-SYS-CRATES)** — `-sys` crates govern the native build from `build.rs`, use `cc` (no Makefiles), make external tools optional, embed+verify sources, pre-generate bindgen, and support static+dynamic linking. [Building](https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-SYS-CRATES)
- **Features are additive (M-FEATURES-ADDITIVE)** — Every feature is additive; no `no-std` feature (use `std`), adding a feature doesn't change public items, and features don't rely on being manually enabled. [Building](https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-FEATURES-ADDITIVE)

### Macros

- **Macros are a last resort (M-MACRO-LAST-RESORT)** — Use macros only when no other viable solution exists; prefer the language. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-LAST-RESORT)
- **Prefer 'macros by example' over proc macros (M-EXAMPLE-OVER-PROC)** — When a macro-by-example can do the job, prefer it over a proc macro. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-EXAMPLE-OVER-PROC)
- **Macros don't lie about signatures (M-MACROS-DONT-LIE)** — Macros must not misrepresent signatures or item shape (no struct→enum, signature changes, or async conversions). [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACROS-DONT-LIE)
- **Macros assume main crate (M-MACRO-MAIN-CRATE)** — Proc macros assume use through their main crate and emit paths for it. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-MAIN-CRATE)
- **Third party items come from hidden `_private` module (M-MACRO-HELPERS)** — Macros refer to third-party items via a hidden `_private` re-export module with fully-qualified paths. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-HELPERS)
- **Proc macros should have separate impl crate incl. tests (M-PROC-IMPL)** — Proc macros are thin shims in `foo_proc` delegating to a separate `foo_proc_impl` library crate holding the logic and its tests. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-PROC-IMPL)
- **Proc macros don't produce implied or hidden items (M-PROC-IMPLIED-ITEMS)** — Macros shouldn't define magic public types; the namespace exception is acceptable. [Macros](https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-PROC-IMPLIED-ITEMS)

### Applications

- **Use mimalloc for apps (M-MIMALLOC-APPS)** — Applications set mimalloc as their global allocator. [Applications](https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-MIMALLOC-APPS)
- **Applications may use Anyhow or derivatives (M-APP-ERROR)** — Apps (and repo-internal crates) may use anyhow/eyre/ohno instead of custom error types; don't mix multiple app-level error types. [Applications](https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-APP-ERROR)
- **Applications target highest viable target-cpu (M-TARGET-CPU)** — Server apps compile against the highest `target-cpu` the deployment environment guarantees. [Applications](https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-TARGET-CPU)

### FFI

- **Isolate DLL state between FFI libraries (M-ISOLATE-DLL-STATE)** — Only share "portable" state (`#[repr(C)]`, no statics/TypeIds, no non-portable pointers) between DLLs. [FFI](https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-ISOLATE-DLL-STATE)
- **Business logic belongs in core crates, FFI only translates (M-FFI-TRANSLATES)** — Separate the core business-logic crate from the FFI glue crate; the FFI crate only translates native↔C. [FFI](https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-FFI-TRANSLATES)
- **FFI crates follow established naming conventions (M-FFI-NAMING)** — `-sys` for crates importing C libraries, `-ffi` for crates exporting C items. [FFI](https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-FFI-NAMING)

### Correctness

- **Unsafe needs reason, should be avoided (M-UNSAFE)** — `unsafe` is justified only for novel abstractions, performance, or FFI; always with plain-text safety reasoning and Miri coverage. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSAFE)
- **Unsafe implies undefined behavior (M-UNSAFE-IMPLIES-UB)** — `unsafe` may mark only functions/traits whose misuse implies UB. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSAFE-IMPLIES-UB)
- **All code must be sound (M-UNSOUND)** — Unsound code is never acceptable; if you can't safely encapsulate something, expose `unsafe` functions instead. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSOUND)
- **Panic means 'stop the program' (M-PANIC-IS-STOP)** — Panics mean immediate termination; don't use them to communicate errors or assume they're caught. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-IS-STOP)
- **Detected programming bugs are panics, not errors (M-PANIC-ON-BUG)** — Detected contract violations must panic (no `Result`); parsing/external input returns `Result`. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-ON-BUG)
- **Panic continuation is last resort (M-PANIC-CONTINUATION)** — `catch_unwind` continuation is a last resort, followed by a controlled application restart. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-CONTINUATION)
- **Custom panics have a helpful message (M-PANIC-MESSAGE)** — Intentional panics include a message stating what went wrong and relevant values. [Correctness](https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-MESSAGE)

### Performance

- **Optimize for throughput, avoid empty cycles (M-THROUGHPUT)** — Optimize for items-per-CPU-cycle; batch work, avoid empty cycles, exploit locality; don't hot-spin on individual items. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-THROUGHPUT)
- **Identify, profile, optimize the hot path early (M-HOTPATH)** — Early in dev, identify performance/COGS-relevant areas; benchmark hot paths, profile, and document hotspots. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-HOTPATH)
- **Long-running tasks should have yield points (M-YIELD-POINTS)** — Long async tasks include `yield_now().await` points so runtimes can preempt. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-YIELD-POINTS)
- **Reuse allocations where possible (M-MEM-REUSE)** — APIs let users hold reusable resources; use `.clear()`/arena reuse instead of per-call allocation. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-MEM-REUSE)
- **Library telemetry does not tank performance (M-LOG-OVERHEAD)** — Library telemetry must not degrade hot-path throughput/latency (avoid allocations in hot loops). [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-LOG-OVERHEAD)
- **Nested type hierarchies should avoid needless indirection (M-AVOID-INDIRECTION)** — Hot types avoid nested heap indirection; lift cacheable fields. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-AVOID-INDIRECTION)
- **Use boxed slices and strings for immutable owned sequences (M-BOX-DST)** — Frequently used, immutable, internal sequences are stored as `Box<[T]>`/`Arc<str>` instead of `Vec`/`String`. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-BOX-DST)
- **Shrink collections to fit after building (M-SHRINK-TO-FIT)** — Shrink long-lived growable collections with `shrink_to_fit` after building. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-SHRINK-TO-FIT)
- **Use a fast hasher where possible (M-FAST-HASHER)** — For trusted internal keys, prefer a fast hasher (foldhash/FxHash) over the default. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-FAST-HASHER)
- **Collections are created with sufficient initial capacity (M-INITIAL-CAPACITY)** — Create collections of known size with `with_capacity`. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-INITIAL-CAPACITY)
- **Hot `async` functions reduce stack size (M-ASYNC-STACK-SIZE)** — Track future sizes for hot-path async fns; return `impl Future`, move setup out of `async {}`. [Performance](https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-ASYNC-STACK-SIZE)

### Project

- **Common settings come from the workspace `Cargo.toml` (M-CARGO-WORKSPACE)** — Unify related crates with a workspace `Cargo.toml`; share metadata/versions via `[workspace.dependencies]` and `[workspace.lints]`. [Project](https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CARGO-WORKSPACE)
- **The workspace lists and versions all crates (M-CRATES-IN-WORKSPACE)** — Every crate is a workspace member and versioned in `[workspace.dependencies]`; intra-workspace deps use `.workspace = true`. [Project](https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CRATES-IN-WORKSPACE)
- **All crates are siblings in one folder (M-CRATES-FLAT-FOLDER)** — One workspace `Cargo.toml`; crates live as siblings in one folder (e.g., `crates/`); never nest crates inside other crates or their `src/`. [Project](https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CRATES-FLAT-FOLDER)
- **New crates target latest edition (M-LATEST-EDITION)** — New crates/workspaces set `edition` to the latest stable edition (e.g., 2024). [Project](https://microsoft.github.io/rust-guidelines/guidelines/project/#M-LATEST-EDITION)
- **MSRV is conservatively updated (M-MSRV)** — Set MSRV when creating a library; keep it a few versions behind the latest compiler. [Project](https://microsoft.github.io/rust-guidelines/guidelines/project/#M-MSRV)

### Documentation

- **First sentence is one line; approx. 15 words (M-FIRST-DOC-SENTENCE)** — The first doc sentence is the summary shown in module summaries; keep it ≤15 words on one line. [Documentation](https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-FIRST-DOC-SENTENCE)
- **Has comprehensive module documentation (M-MODULE-DOCS)** — Public modules have `//!` docs (first sentence per M-FIRST-DOC-SENTENCE) covering contents, usage, side effects, and examples. [Documentation](https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-MODULE-DOCS)
- **Documentation has canonical sections (M-CANONICAL-DOCS)** — Public items include canonical sections: summary sentence, Examples, Errors, Panics, Safety, Abort (where applicable); no parameter tables. [Documentation](https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-CANONICAL-DOCS)
- **Mark `pub use` items with `#[doc(inline)]` (M-DOC-INLINE)** — Annotate `pub use` items with `#[doc(inline)]` so re-exports appear inline, not opaque. [Documentation](https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-DOC-INLINE)

### AI

- **Design with AI use in mind (M-DESIGN-FOR-AI)** — Idiomatic Rust patterns, thorough docs, usable examples, strong types, testable APIs, and test coverage make APIs easier for AI as well as humans. [AI](https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-DESIGN-FOR-AI)
- **Items are only visible through one path (M-SINGLE-ITEM-PATH)** — Public items are reachable through exactly one path (no duplicate re-exports). [AI](https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-SINGLE-ITEM-PATH)
- **Avoid meta design documentation (M-NO-META-DESIGN-DOCUMENTATION)** — Document the end state, not the design journey ("why we picked X over Y" essays). [AI](https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-NO-META-DESIGN-DOCUMENTATION)
- **Tests do not assert ground truth (M-TAUTOLOGICAL-TESTS)** — Tests verify meaningful behavior, not values restated from the code under test. [AI](https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-TAUTOLOGICAL-TESTS)
- **Rust code solves Rust problems (M-RUST-SHAPED)** — When porting C#/Java/C++, don't copy language constructs 1:1; use idiomatic Rust idioms. [AI](https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-RUST-SHAPED)

## Related skills and sources

- **Agent-friendly consolidation:** The book's own "Agents & LLMs" section offers an all-in-one consolidated file of these guidelines for AI agents: <https://microsoft.github.io/rust-guidelines/agents/all.txt>
- **Source of truth:** Each item above links to its original guideline page. When in doubt, open the linked page for the full text, rationale, and examples.
