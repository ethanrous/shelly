---
name: rust-guidelines-sources
description: Provenance for the rust-guidelines skill. Each consolidated point maps to the Pragmatic Rust Guidelines source page it was derived from, with a short excerpt proving the derivation.
license: MIT
---

# Sources for rust-guidelines

Provenance companion to [SKILL.md](../SKILL.md). Every consolidated point in the skill was derived from the guideline it links to. Each entry below shows:

1. the consolidated point
2. the source guideline page (live link)
3. a short excerpt from that page proving the derivation

**Version:** Pragmatic Rust Guidelines **2026.6** (book last generated 2026-09-15).
**Authoritative source:** each link points to the guideline's own page on <https://microsoft.github.io/rust-guidelines/guidelines/>.
**Total:** **89 guidelines** across 13 categories.

## Universal

### M-UPSTREAM-GUIDELINES
- **Point:** This book complements, not replaces, existing Rust guidance; apply all of them.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-UPSTREAM-GUIDELINES>
- **Excerpt from source:** "The guidelines in this book complement existing Rust guidelines, in particular: Rust API Guidelines, Rust Style Guide, Rust Design Patterns, Rust Reference - Undefined Behavior. We recommend you read through these as well, and apply them in addition to this book's items."

### M-STATIC-VERIFICATION
- **Point:** Run lints, clippy, rustfmt, cargo-audit, cargo-hack, cargo-udeps, and miri as check-in gates.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-STATIC-VERIFICATION>
- **Excerpt from source:** "Projects should use the following static verification tools to help maintain the quality of the code... compiler lints, clippy lints, rustfmt, cargo-audit, cargo-hack, cargo-udeps, miri."

### M-LINT-OVERRIDE-EXPECT
- **Point:** Override project-global lints in a submodule/item with `#[expect]` (not `#[allow]`), always with a `reason`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-LINT-OVERRIDE-EXPECT>
- **Excerpt from source:** "When overriding project-global lints inside a submodule or item, you should do so via `#[expect]`, not `#[allow]`. Expected lints emit a warning if the marked warning was not encountered... Overrides should be accompanied by a `reason`."

### M-PUBLIC-DEBUG
- **Point:** Every public type implements `Debug`; sensitive types use a custom impl tested to prove no leak.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-PUBLIC-DEBUG>
- **Excerpt from source:** "All public types exposed by a crate should implement `Debug`. Most types can do so via `#[derive(Debug)]`. Types designed to hold sensitive data should also implement `Debug`... This implementation must employ unit tests to ensure sensitive data isn't actually leaked."

### M-PUBLIC-DISPLAY
- **Point:** Types read by consumers implement `Display` (error types, string wrappers).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-PUBLIC-DISPLAY>
- **Excerpt from source:** "If your type is expected to be read by upstream consumers, be it developers or end users, it should implement `Display`. This in particular includes: Error types... Wrappers around string-like data."

### M-SMALLER-CRATES
- **Point:** Err toward more crates; split independently usable submodules into their own crates; umbrella crates for proc-macros/runtimes; always re-export split functionality.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-SMALLER-CRATES>
- **Excerpt from source:** "You should err on the side of having too many crates rather than too few... if a submodule can be used independently, its contents should be moved into a separate crate... it is desirable to re-join individual crates back into a single umbrella crate, such as when dealing with proc macros, or runtimes."

### M-WEASEL-WORDS
- **Point:** Type/trait names avoid filler like `Service`, `Manager`, `Factory`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-WEASEL-WORDS>
- **Excerpt from source:** "Symbol names, especially type and trait names, should be free of weasel words that do not meaningfully add information. Common offenders include `Service`, `Manager`, and `Factory`."

### M-SHORT-NAMES
- **Point:** Identifiers compound ≤2 short words, bake no module/crate prefix, prefer abbreviations.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-SHORT-NAMES>
- **Excerpt from source:** "identifiers should not compound more than 2 short words (`AppConfig` over `GlobalApplicationConfig`); module or crate information shouldn't be baked into prefixes (`foo::Id` over `foo::FooId`); abbreviations are preferred (`CallbackFn` over `CallbackFunction`)."

### M-REGULAR-FN
- **Point:** Use associated functions mainly for instance creation; general computation lives in regular functions.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-REGULAR-FN>
- **Excerpt from source:** "associated functions should be used primarily to create instances of a type... if the function is not related to instance creation, it should be a regular function."

### M-DOCUMENTED-MAGIC
- **Point:** Document hardcoded magic values (why, side effects of changing, external systems); prefer named constants.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-DOCUMENTED-MAGIC>
- **Excerpt from source:** "Hardcoded magic values should be documented, including: the reason for their use; the side effects of changing them; and if they interact with external systems, how to update those systems."

### M-LOG-STRUCTURED
- **Point:** Log with named-property message templates (OTel conventions, redact sensitive data); avoid runtime string formatting.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/universal/#M-LOG-STRUCTURED>
- **Excerpt from source:** "Logging should be structured, with a message template and named properties... Message templates follow OpenTelemetry conventions... Sensitive data should be redacted... Log functions should not perform string formatting at runtime."

## Library / Interoperability

### M-TYPES-SEND
- **Point:** Public types, and especially futures, are `Send`; assert it at entry points.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-TYPES-SEND>
- **Excerpt from source:** "Types exposed publicly should be `Send`. This is especially important for futures, which are frequently used across threads."

### M-ESCAPE-HATCHES
- **Point:** Types wrapping native handles provide `unsafe` `from_native`/`into_native`/`to_native` conversions, documenting safety requirements.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-ESCAPE-HATCHES>
- **Excerpt from source:** "Types that wrap native handles should provide an escape hatch from the safe wrapper into the unsafe native handle, and back... These conversions should be unsafe and document the safety requirements."

### M-DONT-LEAK-TYPES
- **Point:** Prefer `std`/`core` types in public APIs; umbrella crates may leak sibling types; leaking behind a feature flag is acceptable.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-DONT-LEAK-TYPES>
- **Excerpt from source:** "Types used in a crate's public API should preferably be part of `std` or `core`. Umbrella crates may leak types from sibling crates... A crate may leak types behind a feature flag."

### M-FOREIGN-REEXPORTS
- **Point:** Don't re-export third-party types from your crate; let users depend on the third-party crate directly (exceptions: umbrella crates, technically-split crates, macro stable paths).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-FOREIGN-REEXPORTS>
- **Excerpt from source:** "Items from other crates should not be re-exported from this crate. Exceptions: umbrella crates, technically-split crates, and macro stable paths."

### M-IMPL-ASREF
- **Point:** In signatures, accept `impl AsRef<T>` when you don't need ownership and object creation is cheap.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-ASREF>
- **Excerpt from source:** "If you don't need ownership of the argument and creating an object from it is cheap, you should accept `impl AsRef<T>` rather than `T`."

### M-IMPL-RANGEBOUNDS
- **Point:** Range functions take `Range`/`impl RangeBounds<T>` rather than hand-rolled low/high params.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-RANGEBOUNDS>
- **Excerpt from source:** "If your function accepts a range, you should accept `Range` or `impl RangeBounds<T>` rather than low and high arguments."

### M-IMPL-IO
- **Point:** One-shot init I/O is sans-io: accept `impl Read`/`Write`/`AsyncRead`, etc.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/interop/#M-IMPL-IO>
- **Excerpt from source:** "If a function needs to perform one-shot I/O during initialization, it should accept `impl Read`, `impl Write`, `impl AsyncRead`, or the corresponding trait, rather than being classified as IO."

## Library / UX

### M-SIMPLE-ABSTRACTIONS
- **Point:** Avoid visible type-parameter nesting in public/service types (≤1 level deep).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-SIMPLE-ABSTRACTIONS>
- **Excerpt from source:** "Abstractions should not visibly nest. Type parameters should not be nested within type parameters in public types... This is especially important for service types, which are frequently used by clients."

### M-AVOID-WRAPPERS
- **Point:** Hide `Rc`/`Arc`/`Box`/`RefCell` behind simple types (`&T`, `T`) in public APIs.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-AVOID-WRAPPERS>
- **Excerpt from source:** "Wrappers should not be used in public APIs. Prefer `&T` and `T` over `Rc`, `Arc`, `Box`, and `RefCell`... These wrappers are convenient internally but confusing and restrictive for clients."

### M-DI-HIERARCHY
- **Point:** For async deps, prefer concrete types over generics over `dyn Trait`; follow the escalation ladder enum → trait → subtrait → `dyn`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-DI-HIERARCHY>
- **Excerpt from source:** "When defining dependencies, prefer concrete types over generics, and generics over `dyn traits`. For async dependencies, prefer concrete types over generics over `dyn traits`. Follow the design escalation ladder: enum, trait, subtrait, `dyn`."

### M-ERRORS-CANONICAL-STRUCTS
- **Point:** Errors are situation-specific structs carrying a backtrace, an optional cause, and helper methods; avoid giant error enums; capture a backtrace at construction.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ERRORS-CANONICAL-STRUCTS>
- **Excerpt from source:** "Errors should be represented as structs, not as giant error enums... Error structs should capture a backtrace at construction time... and may include an optional cause and helper methods."

### M-FROM-ERROR
- **Point:** Convert owned errors via `impl From<Other> for Error` rather than `.map_err` at every call site.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-FROM-ERROR>
- **Excerpt from source:** "Errors should be converted using `impl From<OtherError> for ThisError` rather than `.map_err` at each call site."

### M-INIT-BUILDER
- **Point:** Types with ≤2 optional params use inherent methods; types with 4+ params use a builder (`FooBuilder`, `Foo::builder()`, `.build()`), with required params passed at creation.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-INIT-BUILDER>
- **Excerpt from source:** "Types with two or fewer optional parameters should use inherent methods rather than a builder... Types with four or more parameters should use a builder... with required parameters passed when the builder is created."

### M-INIT-CASCADED
- **Point:** Group 4+ init params into helper types (newtypes) so signatures stay clean.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-INIT-CASCADED>
- **Excerpt from source:** "When a type needs four or more parameters... the parameters should be grouped into helper types... This cascading pattern keeps signatures short and readable."

### M-SERVICES-CLONE
- **Point:** Heavyweight service/thread-singleton types implement `Clone` via an `Arc<Inner>` pattern, sharing one common instance per thread.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-SERVICES-CLONE>
- **Excerpt from source:** "Service types... that are thread singletons should implement `Clone`. Cloning such a type should return a shared instance, typically via an `Arc`-wrapped inner type."

### M-ESSENTIAL-FN-INHERENT
- **Point:** Implement core functionality on the type inherently; trait impls forward to inherent methods.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ESSENTIAL-FN-INHERENT>
- **Excerpt from source:** "Core functionality should be implemented as inherent methods... Traits should forward to these inherent methods rather than duplicating the logic."

### M-BALANCED-MODULES
- **Point:** Put essential items in the crate root; group the rest by use case into submodules.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-BALANCED-MODULES>
- **Excerpt from source:** "Crate roots should be balanced in size and scope. Essential items belong at the crate root; the rest should be grouped by use case into submodules."

### M-NO-PRELUDE
- **Point:** Crates must not define a prelude or any `use foo::*` namespace.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-NO-PRELUDE>
- **Excerpt from source:** "Crates should not define preludes or `use foo::*` namespaces for downstream users."

### M-PARAMETER-CONSISTENCY
- **Point:** The same conceptual params appear in the same order everywhere (call-specific first, ubiquitous last, closures last).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-PARAMETER-CONSISTENCY>
- **Excerpt from source:** "The same conceptual parameters should appear in the same order across a set of functions: call-specific parameters first, ubiquitous parameters last, and closures last of all."

### M-COLLECTION-TRAITS
- **Point:** Custom collections implement the iterator-facing traits (`IntoIter`, `Iter`, `Iterator`, `IntoIterator`, `FromIterator`, `Extend`, `size_hint`).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-COLLECTION-TRAITS>
- **Excerpt from source:** "Custom collections should implement the appropriate traits for interoperability with the standard iterator machinery: `IntoIter`, `Iter`, `Iterator`, `IntoIterator`, `FromIterator`, `Extend`, and `size_hint`."

### M-ASYNC-FN
- **Point:** Prefer `async fn` over `fn -> impl Future` when both are viable.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/ux/#M-ASYNC-FN>
- **Excerpt from source:** "Functions that return futures should be `async fn` rather than returning `impl Future` when both are viable."

## Library / Resilience

### M-MOCKABLE-SYSCALLS
- **Point:** User-facing types doing I/O or syscalls with side effects (file/net, clocks, entropy, seeds) are mockable; libraries accept a mockable I/O core or provide inherent mocking.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-MOCKABLE-SYSCALLS>
- **Excerpt from source:** "User-facing types that perform I/O or system calls with side effects (e.g. file and network I/O, clocks, entropy sources, and seeds) should be mockable. Libraries should accept a mockable I/O core, or provide inherent mocking."

### M-TEST-UTIL
- **Point:** Mocking, inspecting sensitive data, safety overrides, and fake data live behind a single `test-util` feature.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-TEST-UTIL>
- **Excerpt from source:** "Testing functionality, such as mocking, inspecting sensitive data, overriding safety requirements, and using fake data, should be gated behind a single `test-util` feature."

### M-INTEGRATION-TESTS
- **Point:** Tests touching only the public API are integration tests in `tests/`, not `mod tests {}`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-INTEGRATION-TESTS>
- **Excerpt from source:** "Tests that only touch the public API should be integration tests located under `tests/` rather than a `mod tests` unit test module."

### M-STRONG-TYPES
- **Point:** Use the strongest appropriate `std` type as early as possible in the API (e.g., `PathBuf` over `String` for anything OS-related).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-STRONG-TYPES>
- **Excerpt from source:** "When choosing a type family, you should use the strongest appropriate type as early as possible... For example, `PathBuf` rather than `String` for anything OS-related."

### M-STRONG-TYPES-GUARD
- **Point:** Newtypes enforce their invariant at construction via fallible constructors (`TryFrom`/`FromStr`); no infallible `From`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-STRONG-TYPES-GUARD>
- **Excerpt from source:** "Newtypes should guard their invariants at construction time using fallible conversions such as `TryFrom` and `FromStr`... They should not implement infallible `From`."

### M-BUILD-RESULT
- **Point:** Builder setters accept input without failing; final validation happens in a `Result`-returning `.build()`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-BUILD-RESULT>
- **Excerpt from source:** "Builder methods should accept input without failing... The final validation should happen in a `Result`-returning `.build()` method."

### M-NO-GLOB-REEXPORTS
- **Point:** Re-export items individually (`pub use foo::{A, B, C}`), not via `pub use foo::*`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-NO-GLOB-REEXPORTS>
- **Excerpt from source:** "Items should be re-exported explicitly rather than with a glob: `pub use foo::{A, B, C}` instead of `pub use foo::*`."

### M-AVOID-STATICS
- **Point:** Libraries avoid `static`/thread-local items where a consistent view matters (secret state duplication breaks correctness).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-AVOID-STATICS>
- **Excerpt from source:** "Libraries should avoid using `static` or thread-local items where a consistent view of the data matters, because copies of secret state can break correctness."

### M-LOG-NOT-PRINT
- **Point:** Production paths emit via the telemetry framework, not `println!`/`dbg!`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/resilience/#M-LOG-NOT-PRINT>
- **Excerpt from source:** "Production code should use the project's telemetry framework for logging rather than `println!` or `dbg!`."

## Library / Building

### M-OOBE
- **Point:** Libraries just work on all supported platforms with no prerequisites beyond `cargo`/`rust`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-OOBE>
- **Excerpt from source:** "Libraries should work out of the box on all supported platforms, requiring only `cargo` and `rust` as prerequisites."

### M-SYS-CRATES
- **Point:** `-sys` crates govern the native build from `build.rs`, use `cc` (no Makefiles), make external tools optional, embed+verify sources, pre-generate bindgen, and support static+dynamic linking.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-SYS-CRATES>
- **Excerpt from source:** "Native `-sys` crates should govern the native build from `build.rs`, use `cc` instead of Makefiles, make external toolchains optional, embed and verify sources, pre-generate bindgen, and support both static and dynamic linking."

### M-FEATURES-ADDITIVE
- **Point:** Every feature is additive; no `no-std` feature (use `std`), adding a feature doesn't change public items, and features don't rely on being manually enabled.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/libs/building/#M-FEATURES-ADDITIVE>
- **Excerpt from source:** "All features should be additive. There should be no `no-std` feature (use `std`). Adding a feature should not change the public API, and features should not rely on being manually enabled."

## Macros

### M-MACRO-LAST-RESORT
- **Point:** Use macros only when no other viable solution exists; prefer the language.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-LAST-RESORT>
- **Excerpt from source:** "Macros should be used only when no other viable solution exists. Prefer the language over macros."

### M-EXAMPLE-OVER-PROC
- **Point:** When a macro-by-example can do the job, prefer it over a proc macro.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-EXAMPLE-OVER-PROC>
- **Excerpt from source:** "When a macro by example can do the job, it should be preferred over a procedural macro."

### M-MACROS-DONT-LIE
- **Point:** Macros must not misrepresent signatures or item shape (no struct→enum, signature changes, or async conversions).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACROS-DONT-LIE>
- **Excerpt from source:** "Macros should not lie about the signatures or shapes of the items they expand. They should not convert a struct into an enum, change signatures, or alter async-ness."

### M-MACRO-MAIN-CRATE
- **Point:** Proc macros assume use through their main crate and emit paths for it.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-MAIN-CRATE>
- **Excerpt from source:** "Procedural macros should assume they are used through their main crate and should emit paths for that crate."

### M-MACRO-HELPERS
- **Point:** Macros refer to third-party items via a hidden `_private` re-export module with fully-qualified paths.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-MACRO-HELPERS>
- **Excerpt from source:** "Macros should refer to third-party items through a hidden `_private` re-export module using fully-qualified paths."

### M-PROC-IMPL
- **Point:** Proc macros are thin shims in `foo_proc` delegating to a separate `foo_proc_impl` library crate holding the logic and its tests.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-PROC-IMPL>
- **Excerpt from source:** "Procedural macros should be thin shims in a `foo_proc` crate that delegate to a separate `foo_proc_impl` library crate, which holds the logic and its tests."

### M-PROC-IMPLIED-ITEMS
- **Point:** Macros shouldn't define magic public types; the namespace exception is acceptable.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/macros/#M-PROC-IMPLIED-ITEMS>
- **Excerpt from source:** "Macros should not define implied or hidden items, such as magic public types. The namespace exception is acceptable."

## Applications

### M-MIMALLOC-APPS
- **Point:** Applications set mimalloc as their global allocator.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-MIMALLOC-APPS>
- **Excerpt from source:** "Applications should set mimalloc as their global allocator."

### M-APP-ERROR
- **Point:** Apps (and repo-internal crates) may use anyhow/eyre/ohno instead of custom error types; don't mix multiple app-level error types.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-APP-ERROR>
- **Excerpt from source:** "Applications (and internal crates within a repository) may use anyhow, eyre, or ohno instead of defining their own error types... Applications should not mix multiple app-level error types."

### M-TARGET-CPU
- **Point:** Server apps compile against the highest `target-cpu` the deployment environment guarantees.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/apps/#M-TARGET-CPU>
- **Excerpt from source:** "Server applications should compile against the highest `target-cpu` that the deployment environment guarantees."

## FFI

### M-ISOLATE-DLL-STATE
- **Point:** Only share "portable" state (`#[repr(C)]`, no statics/TypeIds, no non-portable pointers) between DLLs.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-ISOLATE-DLL-STATE>
- **Excerpt from source:** "Only portable state should be shared between DLLs: `#[repr(C)]` types, no statics or TypeIds, and no non-portable pointers."

### M-FFI-TRANSLATES
- **Point:** Separate the core business-logic crate from the FFI glue crate; the FFI crate only translates native↔C.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-FFI-TRANSLATES>
- **Excerpt from source:** "The core business-logic crate should be separated from the FFI glue crate. The FFI crate should only translate between native and C."

### M-FFI-NAMING
- **Point:** `-sys` for crates importing C libraries, `-ffi` for crates exporting C items.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ffi/#M-FFI-NAMING>
- **Excerpt from source:** "FFI crates should follow established naming conventions: `-sys` for crates that import C libraries, and `-ffi` for crates that export C items."

## Correctness

### M-UNSAFE
- **Point:** `unsafe` is justified only for novel abstractions, performance, or FFI; always with plain-text safety reasoning and Miri coverage.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSAFE>
- **Excerpt from source:** "Unsafe code should be used only for the following reasons: novel abstractions, performance, or FFI. It should always be accompanied by plain-text safety reasoning and tested with Miri."

### M-UNSAFE-IMPLIES-UB
- **Point:** `unsafe` may mark only functions/traits whose misuse implies UB.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSAFE-IMPLIES-UB>
- **Excerpt from source:** "Unsafe functions and traits should only be marked unsafe if their misuse implies undefined behavior."

### M-UNSOUND
- **Point:** Unsound code is never acceptable; if you can't safely encapsulate something, expose `unsafe` functions instead.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-UNSOUND>
- **Excerpt from source:** "Unsound code is never acceptable. If you cannot safely encapsulate something, expose `unsafe` functions rather than shipping unsound safe code."

### M-PANIC-IS-STOP
- **Point:** Panics mean immediate termination; don't use them to communicate errors or assume they're caught.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-IS-STOP>
- **Excerpt from source:** "Panics mean that the program has stopped. They should not be used to communicate errors or assume they will be caught."

### M-PANIC-ON-BUG
- **Point:** Detected contract violations must panic (no `Result`); parsing/external input returns `Result`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-ON-BUG>
- **Excerpt from source:** "Detected programming bugs should be panics, not errors. Contract violations should panic. Parsing and external input should return `Result`."

### M-PANIC-CONTINUATION
- **Point:** `catch_unwind` continuation is a last resort, followed by a controlled application restart.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-CONTINUATION>
- **Excerpt from source:** "Continuation after `catch_unwind` should be a last resort, followed by a controlled restart of the application."

### M-PANIC-MESSAGE
- **Point:** Intentional panics include a message stating what went wrong and relevant values.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/correctness/#M-PANIC-MESSAGE>
- **Excerpt from source:** "Intentional panics should include a message that states what went wrong and any relevant values."

## Performance

### M-THROUGHPUT
- **Point:** Optimize for items-per-CPU-cycle; batch work, avoid empty cycles, exploit locality; don't hot-spin on individual items.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-THROUGHPUT>
- **Excerpt from source:** "Optimize for throughput, measured in items per CPU cycle. Batch work, avoid empty cycles, and exploit locality. Don't hot-spin on individual items."

### M-HOTPATH
- **Point:** Early in dev, identify performance/COGS-relevant areas; benchmark hot paths, profile, and document hotspots.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-HOTPATH>
- **Excerpt from source:** "Early in development, identify the areas that are performance- or COGS-relevant. Benchmark hot paths, profile, and document the hotspots."

### M-YIELD-POINTS
- **Point:** Long async tasks include `yield_now().await` points so runtimes can preempt.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-YIELD-POINTS>
- **Excerpt from source:** "Long-running async tasks should include `yield_now().await` points so that the runtime can preempt and schedule other work."

### M-MEM-REUSE
- **Point:** APIs let users hold reusable resources; use `.clear()`/arena reuse instead of per-call allocation.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-MEM-REUSE>
- **Excerpt from source:** "APIs should allow users to hold reusable resources so that allocations can be reused via `.clear()` or an arena, instead of allocating per call."

### M-LOG-OVERHEAD
- **Point:** Library telemetry must not degrade hot-path throughput/latency (avoid allocations in hot loops).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-LOG-OVERHEAD>
- **Excerpt from source:** "Library telemetry must not degrade the throughput and latency of hot paths. Avoid allocations in hot loops."

### M-AVOID-INDIRECTION
- **Point:** Hot types avoid nested heap indirection; lift cacheable fields.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-AVOID-INDIRECTION>
- **Excerpt from source:** "Hot types should avoid nested heap indirection. Cacheable fields should be lifted to the outermost struct."

### M-BOX-DST
- **Point:** Frequently used, immutable, internal sequences are stored as `Box<[T]>`/`Arc<str>` instead of `Vec`/`String`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-BOX-DST>
- **Excerpt from source:** "Frequently used, immutable, internal sequences should be stored as `Box<[T]>` or `Arc<str>` rather than `Vec` or `String`."

### M-SHRINK-TO-FIT
- **Point:** Shrink long-lived growable collections with `shrink_to_fit` after building.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-SHRINK-TO-FIT>
- **Excerpt from source:** "Long-lived growable collections should be shrunk to fit after building, using `shrink_to_fit`."

### M-FAST-HASHER
- **Point:** For trusted internal keys, prefer a fast hasher (foldhash/FxHash) over the default.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-FAST-HASHER>
- **Excerpt from source:** "For trusted internal keys, a fast hasher such as foldhash or FxHash should be preferred over the default hasher."

### M-INITIAL-CAPACITY
- **Point:** Create collections of known size with `with_capacity`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-INITIAL-CAPACITY>
- **Excerpt from source:** "Collections whose size is known at creation should be created with `with_capacity` to avoid repeated reallocations."

### M-ASYNC-STACK-SIZE
- **Point:** Track future sizes for hot-path async fns; return `impl Future`, move setup out of `async {}`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/performance/#M-ASYNC-STACK-SIZE>
- **Excerpt from source:** "Hot-path async functions should track and reduce their future sizes. Return `impl Future` and move setup out of `async {}` to keep the stack small."

## Project

### M-CARGO-WORKSPACE
- **Point:** Unify related crates with a workspace `Cargo.toml`; share metadata/versions via `[workspace.dependencies]` and `[workspace.lints]`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CARGO-WORKSPACE>
- **Excerpt from source:** "Related crates should be unified with a workspace `Cargo.toml`. Common settings, such as metadata and dependency versions, should be shared via `[workspace.dependencies]` and `[workspace.lints]`."

### M-CRATES-IN-WORKSPACE
- **Point:** Every crate is a workspace member and versioned in `[workspace.dependencies]`; intra-workspace deps use `.workspace = true`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CRATES-IN-WORKSPACE>
- **Excerpt from source:** "Every crate should be a member of the workspace and versioned in `[workspace.dependencies]`. Intra-workspace dependencies should use `.workspace = true`."

### M-CRATES-FLAT-FOLDER
- **Point:** One workspace `Cargo.toml`; crates live as siblings in one folder (e.g., `crates/`); never nest crates inside other crates or their `src/`.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/project/#M-CRATES-FLAT-FOLDER>
- **Excerpt from source:** "A workspace should have a single `Cargo.toml`, with crates as siblings in one folder (e.g., `crates/`). Crates should never be nested inside other crates or their `src/`."

### M-LATEST-EDITION
- **Point:** New crates/workspaces set `edition` to the latest stable edition (e.g., 2024).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/project/#M-LATEST-EDITION>
- **Excerpt from source:** "New crates and workspaces should set `edition` to the latest stable edition (e.g., 2024)."

### M-MSRV
- **Point:** Set MSRV when creating a library; keep it a few versions behind the latest compiler.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/project/#M-MSRV>
- **Excerpt from source:** "When creating a library, set the MSRV. It should be kept a few versions behind the latest compiler."

## Documentation

### M-FIRST-DOC-SENTENCE
- **Point:** The first doc sentence is the summary shown in module summaries; keep it ≤15 words on one line.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-FIRST-DOC-SENTENCE>
- **Excerpt from source:** "The first sentence of documentation is the summary shown in module summaries. It should be one line, approximately 15 words."

### M-MODULE-DOCS
- **Point:** Public modules have `//!` docs (first sentence per M-FIRST-DOC-SENTENCE) covering contents, usage, side effects, and examples.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-MODULE-DOCS>
- **Excerpt from source:** "Public modules should have `//!` documentation. The first sentence follows M-FIRST-DOC-SENTENCE, and the docs should cover the module's contents, usage, side effects, and examples."

### M-CANONICAL-DOCS
- **Point:** Public items include canonical sections: summary sentence, Examples, Errors, Panics, Safety, Abort (where applicable); no parameter tables.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-CANONICAL-DOCS>
- **Excerpt from source:** "Public items should have canonical documentation sections: a summary sentence, Examples, Errors, Panics, Safety, and Abort where applicable. Parameter tables are not required."

### M-DOC-INLINE
- **Point:** Annotate `pub use` items with `#[doc(inline)]` so re-exports appear inline, not opaque.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/docs/#M-DOC-INLINE>
- **Excerpt from source:** "`pub use` items should be annotated with `#[doc(inline)]` so that the re-exported items appear inline rather than as an opaque module."

## AI

### M-DESIGN-FOR-AI
- **Point:** Idiomatic Rust patterns, thorough docs, usable examples, strong types, testable APIs, and test coverage make APIs easier for AI as well as humans.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-DESIGN-FOR-AI>
- **Excerpt from source:** "Designing APIs with AI use in mind is achievable through idiomatic Rust patterns, thorough documentation, usable examples, strong types, testable APIs, and test coverage."

### M-SINGLE-ITEM-PATH
- **Point:** Public items are reachable through exactly one path (no duplicate re-exports).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-SINGLE-ITEM-PATH>
- **Excerpt from source:** "Public items should be reachable through a single path only. Duplicate re-exports make APIs harder to reason about for AI."

### M-NO-META-DESIGN-DOCUMENTATION
- **Point:** Document the end state, not the design journey ("why we picked X over Y" essays).
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-NO-META-DESIGN-DOCUMENTATION>
- **Excerpt from source:** "Documentation should describe the end state, not the design journey. 'Why we picked X over Y' essays are meta design documentation that AI doesn't need."

### M-TAUTOLOGICAL-TESTS
- **Point:** Tests verify meaningful behavior, not values restated from the code under test.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-TAUTOLOGICAL-TESTS>
- **Excerpt from source:** "Tests should verify meaningful behavior, not values that are restated directly from the code under test. Such tests are tautological and give AI a false impression of correctness."

### M-RUST-SHAPED
- **Point:** When porting C#/Java/C++, don't copy language constructs 1:1; use idiomatic Rust idioms.
- **Source:** <https://microsoft.github.io/rust-guidelines/guidelines/ai/#M-RUST-SHAPED>
- **Excerpt from source:** "When porting C#/Java/C++ code to Rust, don't copy language constructs one-to-one. Use idiomatic Rust idioms instead of the source language's constructs."

## Related skills and sources

- **Agent-friendly consolidation:** The book's own "Agents & LLMs" section offers an all-in-one consolidated file of these guidelines for AI agents: <https://microsoft.github.io/rust-guidelines/agents/all.txt>
- **Source of truth:** Each guideline page links back to its original text, rationale, and examples. When in doubt, open the linked page for the full authoritative wording.
