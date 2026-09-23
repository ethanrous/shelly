# targeted-compaction

Scores old context items while the main model is working, then prunes them in one batch when
context usage crosses a threshold. The goal is to delay pi-blackhole's summarizing compaction by
shrinking the context in a way that costs exactly one cache-miss reprefill instead of a full
resummarization, and to keep the prefix stable in between.

## Why

Full summarizing compaction throws away detail and pays for a summarization call. Most of what
fills up a long agent session is not information the model still needs: a `read` of a file it
later re-read, a duplicate `grep` output, a failed command it already retried, a huge `bash` dump
from ten turns ago. None of that needs an LLM to identify. Deleting it with plain rules keeps the
cache mostly intact and needs no extra model call.

Background: "The Complexity Trap" (arXiv 2508.21433) found that simple observation masking
(dropping old tool outputs) matches LLM-based summarization in benchmark score at roughly half
the compute cost. CliffCompaction (arXiv 2609.26779) found that rare, rule-based deletion
preserves far more of the prompt cache than compacting on every threshold crossing, because
cache-breaking edits are batched instead of continuous. This extension follows both ideas: cheap
rule-based deletion, batched into rare flushes.

## How it works

**Items.** A prunable item is either a tool result (keyed by its `toolCallId`) or a thinking
block inside an old assistant message (keyed by `<assistantTimestamp>:<blockIndex>`). User
messages, the system prompt, and custom messages are never touched.

**Candidates vs. applied.** While the agent works, scorers mark items as *candidates* (safe to
drop, with a reason and an estimated token count) without changing anything. Nothing is actually
pruned until a flush moves candidates into the *applied* set. Only `applied` affects what's sent
to the model.

**One reprefill per flush.** The `context` hook rewrites messages using only the `applied` set,
and it's a pure function of `(messages, applied)`: same applied set in, byte-identical messages
out, every time. That means the provider-facing prefix is stable except at the moment a flush
changes `applied` - one cache miss, then stable again until the next flush.

**Stubs, not deletions.** A pruned tool result's content is replaced with a one-line stub:

```
[pruned by targeted-compaction: read src/foo.ts, 412 lines, ~5.1k tokens. Re-run the tool if you need it.]
```

The tool-call/result pair stays valid because the message is still there, just shrunk. Pruned
thinking blocks are removed from the assistant message entirely (see the thinking-pruning caveat
below).

**Turns.** A "turn" here means the same thing pi's own compaction docs mean: it starts at a user
message and runs through the next user message. `protectTurns` counts back from the most recent
turn; items inside that window are never touched by any rule or scorer.

## Config reference

Set a `targetedCompaction` object in `~/.pi/agent/models.json`, at provider level, model level, or
both (model overrides provider, shallow merge). pi does not support a project-local models.json,
so that's the only file this extension reads.

```json
{
  "providers": {
    "lucy": {
      "targetedCompaction": { "enabled": true }
    }
  }
}
```

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Extension is inert for a model unless this is `true` somewhere in its provider/model config. |
| `flushAt` | `0.55` | Flush when context usage reaches this fraction of the context window. |
| `minSavings` | `0.1` | Only flush if unapplied candidates would free at least this fraction of the window. |
| `protectTurns` | `3` | Most recent user turns that no rule or scorer ever touches. |
| `bulkyTokens` | `2000` | Tool outputs above this estimated token count are eligible for the bulky-and-old rule. |
| `bulkyAgeTurns` | `6` | ...once they're at least this many turns old. |
| `scorer` | `"rules"` | `"rules"`, `"laya"`, or `"llm"`. Rules always run; `laya`/`llm` add candidates for items rules left undecided. |
| `layaEndpoint` | `"http://127.0.0.1:8765"` | Base URL of a running `laya-serve` sidecar. |
| `layaThreshold` | `0.8` | Mark an item when laya's P(not needed) is at least this. |
| `llmModel` | unset | `{ "provider": "...", "id": "..." }`, required to use the `llm` scorer. |

Token estimates throughout use chars/4, the same heuristic pi itself uses.

## Scorers

### rules (always runs)

Pure functions over the extracted item list, no network or model calls:

1. A `read` of a path superseded by a later `write` of that path, or a later read of the same
   range or the whole file. An `edit` does not supersede a read, since most of the read stays accurate.
2. Exact duplicate tool outputs (content hash), keeping only the latest.
3. A failed tool call followed later by a successful call of the same tool on the same target
   (same path, or identical arguments for tools without one).

Outputs under 64 tokens are never marked; the stub would cost about as much.
4. Tool outputs bigger than `bulkyTokens`, at least `bulkyAgeTurns` turns old.
5. Thinking blocks outside the `protectTurns` window (see the caveat below).

### laya (sidecar)

[Laya](https://huggingface.co/convaiinnovations/laya) is a ModernBERT-large (421M parameter)
encoder classifier, Apache-2.0, that answers typed yes/no/choice/score questions about a "state"
with calibrated probabilities, in a 512-token context. It is not an LLM: no generation, just a
classification head.

**Setup:**

```bash
pip install "laya[serve]"
LAYA_DEVICE=cuda LAYA_PRELOAD=1 laya-serve   # binds 0.0.0.0:8000 by default
```

Set `layaEndpoint` to wherever it's running (default assumed here is `http://127.0.0.1:8765`;
change it to match your `laya-serve` port, commonly `8000`).

**What this extension sends.** For each unscored, non-protected tool-result item, a request to
`POST /v1/systemone`:

```json
{
  "state": { "goal": "...", "tool": "read", "args": {...}, "output_preview": "...", "output_tokens": 412, "age_turns": 4 },
  "questions": {
    "still_needed": { "type": "noul", "instructions": "Is this tool output still needed to finish the current task?" }
  }
}
```

A `noul`-type question returns a calibrated `P(true)` in `answers.still_needed.noul`; this
extension marks the item when `1 - P(true) >= layaThreshold`.

**Verification status.** The endpoint path, request shape, and the `noul` question type are drawn
from the `laya-serve` documentation and the `receptron/laya` client's usage examples, which show
that shape without a raw HTTP example. This implementation is built against the documented shape
but has not been exercised against a live `laya-serve` instance. There is no documented endpoint
for batching multiple states in one request, so this client sends one request per item,
sequentially, and stops (falling back to rules-only for the rest of the run, with a single
`ctx.ui.notify` warning) at the first connection failure.

**Zero-shot accuracy is weak.** On laya's own typed-decisions benchmark, the base checkpoint
scores well below a majority-class baseline (roughly 0.36 vs. a 0.46 baseline); the fine-tuned
`laya-typed-decisions` checkpoint reaches about 0.77. Base-checkpoint laya, used zero-shot as
above, should not be trusted much more than a coin flip. The false-positive log below exists to
build a fine-tuning set: enough labeled (state, still-needed) pairs from real sessions to fine-tune
a checkpoint that's actually calibrated for this task.

### llm

Sends a compact numbered digest (id, tool, args, size, age, first line) of unscored items plus the
current goal to a side model via `ctx.modelRegistry.complete()` with `cacheRetention: "none"`, and
asks for a JSON array of ids safe to drop. Parses defensively; a malformed or missing response
just means no items are marked this round.

## Commands

`/prune [subcommand]`, default `status`:

- `status` - one-line summary: candidates marked, tokens, applied count, active scorer, current
  context usage.
- `show` - list of unapplied candidates with reason and estimated tokens.
- `now` - force a flush immediately, ignoring `flushAt`/`minSavings`.
- `undo` - restore the most recently flushed batch.
- `scorer <rules|laya|llm>` - override the configured scorer for this session.

## Status bar

Shown only when enabled for the active model: `prune: 38 marked ~41k · 12 applied`.

## Timing and persistence

Scoring kicks off in the background (not awaited) on every `turn_end`, aborting any scoring run
still in flight via `AbortController`; only items the rules haven't already re-decided and the
secondary scorer hasn't already looked at are sent to laya/llm. `maybeFlush` runs on `turn_end`
and `agent_end`.

There is no extra gate between flushes. A second flush before the next request costs nothing
extra, since the next request is a cache miss either way. After that request, usage reflects the
pruned context. `minSavings` keeps small batches from triggering a reprefill on their own.

`applied` and the flush-batch history (ids, tokens, timestamp, turn index) persist via
`pi.appendEntry("targeted-compaction", ...)` after every flush and undo, and are restored on
`session_start` and `session_tree` by scanning the current branch for the latest such entry. Candidates are not
persisted; they're cheap to recompute. After a real compaction (`session_compact`), applied and
candidate ids that no longer correspond to a live item in the branch are dropped.

## Coexistence with pi-blackhole, and hook ordering

This extension never touches `session_before_compact` - pi-blackhole owns that, and still
performs its own summarizing compaction eventually. The intent is only to delay it by keeping
`ctx.getContextUsage()` lower for longer.

**Load order.** Read from pi's package manager (`packages/coding-agent/src/core/package-manager.ts`,
function `resourcePrecedenceRank`): resources are ranked `project-local top-level` <
`user/global top-level` < everything with `origin: "package"`, regardless of scope, and sorted by
that rank before loading. Extensions installed via the `packages` list in `settings.json` (like
`pi-blackhole`, `pi-thinking-tail`, etc.) always have `origin: "package"` and therefore always load
*after* extensions auto-discovered from `~/.pi/agent/extensions/` (this one) or `.pi/extensions/`.

**What that means for `context` handlers.** `ExtensionRunner.emitContext()` runs every extension's
`context` handler in that same load order, threading each handler's output into the next as
`currentMessages` (confirmed in `packages/coding-agent/src/core/extensions/runner.js`,
`emitContext`). Since this extension loads before the `pi-blackhole` package, its `context` hook
runs first: pi-blackhole's own `context` hook (`src/hooks/compaction-context.ts`) sees the
already-pruned messages (stubs in place of pruned tool results), not the originals. That's the
desired direction - blackhole's compaction-threshold accounting sees the smaller, pruned context,
which is exactly how this extension delays blackhole's compaction. It does mean blackhole's
`context` hook cannot see the original content of anything this extension has stubbed; if
blackhole's hook does anything content-sensitive with tool outputs (as opposed to just sizing
them), it will act on the stub text instead.

## Logging and the false-positive metric

Every flush appends a line to `~/.pi/agent/targeted-compaction/log.jsonl`:

```json
{"type":"flush","reason":"threshold","ids":[...],"tokens":1234,"scorer":"rules","timestamp":...}
```

A false positive is logged when, within 5 turns after a flush, the model calls a tool with the
same name and (for `read`/`edit`/`write`) the same `path`, or identical arguments otherwise, as an
item that flush just pruned - i.e., it needed the pruned content after all and had to re-fetch it:

```json
{"type":"false_positive","id":"tool:call_123","toolName":"read","scorer":"rules","timestamp":...}
```

This is the training signal for fine-tuning a laya checkpoint on this task: pruned items that
turn out to have been needed are exactly the negative examples a fine-tune needs, alongside the
(much larger) set of pruned items that were never re-requested.

## Limitations

- Rule 3 (failed-then-succeeded) matches on tool name alone, not on arguments; a failed `bash`
  call can be marked safe to drop once *any* later `bash` call succeeds, even an unrelated one.
- Thinking-block pruning is gated to `ctx.model.api === "openai-completions"` (the api `lucy`
  uses) because removing thinking blocks from older provider transcripts can violate a signed
  multi-turn thinking requirement on other APIs. It has not been tested against a provider that
  enforces that.
- The llm scorer's digest and the laya `state` payload include only a preview of tool output, args,
  and the latest user message as "the goal" - for long-running sessions with a drifted goal, this
  can be an inaccurate signal about relevance.
- `/prune` subcommands rely on `ctx.ui.notify`, which is a no-op in print (`-p`) and JSON output
  modes (per pi's docs, `notify`/`setStatus` work in TUI and RPC modes). Verified interactively
  is straightforward; verifying subcommand output in print mode is not, and wasn't done here.
- False-positive detection only looks back through in-memory flush-batch signatures for the
  current process; signatures (though not `applied` itself) are not persisted, so a `/reload` or
  session restore loses the detection window for flushes from before the reload.
