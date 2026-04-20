[< Docs](../index.md)

# Evals

End-to-end quality probes that hit real LLMs and real DBs. Separate from
the `tests/` suite because the cost profile is different: evals are
non-deterministic, cost money per run, and measure behavior quality rather
than logical correctness.

## Why a separate concept

Mirror Mind is built on LLM calls whose output varies run to run. Unit and
integration tests verify the skeleton — composition order, DB reads, prompt
assembly. They cannot verify that the reception layer routes correctly, that
generated summaries read well, that voice rules hold under persona load. That
verification only happens at the LLM output layer.

Putting those probes inside `tests/` would confuse the contract of "tests
passing". A broken reception prompt shouldn't fail a push; an accidentally
committed regression in summary quality shouldn't block CI. Evals run on
demand, with intention, when you're iterating on something that could
change LLM behavior.

## Evals vs tests

| Dimension | `tests/` (vitest) | `evals/` (standalone tsx) |
|-----------|-------------------|---------------------------|
| Determinism | Deterministic | Non-deterministic |
| Network | Offline (`:memory:` SQLite, no API) | Online (OpenRouter, real DB) |
| Cost | Zero | Cents per run |
| CI | Every push | Never — on demand only |
| Measures | Logical correctness | Behavior quality |
| Failure meaning | Code broke | Behavior drifted |
| Run | `npm test` | `npm run eval:<name>` |

## Layout

```
evals/
  README.md            # entry point for developers
  _lib/
    types.ts           # Probe, ProbeResult, EvalReport
    runner.ts          # runEval() — shared sequential runner + reporter
  routing.ts           # first eval: reception persona routing
```

Flat naming until there are more than ten evals. Files under `_lib/` are
shared infrastructure (the underscore prefix distinguishes them from
runnable eval scripts).

## Current evals

| Eval | Purpose | Cost per run | Scope |
|------|---------|--------------|-------|
| [`routing.ts`](../../evals/routing.ts) | Reception layer routes user messages to the right persona (or null) | ~$0.0005 (22 Flash Lite calls) | Alisson-specific fixtures |

## Running

Each eval is a standalone script, not a vitest file:

```bash
npm run eval:routing      # single eval
```

Requires `.env` with `OPENROUTER_API_KEY`, and `data/mirror.db` populated
with the primary user's identity.

An eval exits with code 0 when its score is at or above its threshold
(default 0.85), 1 otherwise. This makes it safe to wrap in shell pipelines
without accidentally masking regressions.

## When to run

- After any change to `server/reception.ts` or its prompt
- After regenerating persona summaries (the router reads summaries as descriptors)
- After swapping the `reception` model in the `models` table
- After changing the persona set (add, remove, rename, re-seed)
- Before shipping a version where any of the above changed

## Contract for a new eval

Each eval file follows the same shape:

1. **Top-of-file JSDoc**: what it measures, scope (Alisson-specific vs
   generic), usage, cost estimate. A reader opening the file should know
   in 30 seconds whether to run it.
2. **Probes array**: inline fixtures typed as `Probe<Input, Expected>[]`.
3. **Setup**: connect to DB, fetch any required state.
4. **Call `runEval(...)`** from `_lib/runner.ts` with name, probes, threshold,
   and the function under eval.
5. **Register** the eval in `package.json` scripts as `eval:<name>`.
6. **Document** the eval: add a row to the "Current evals" table in this
   file, update `evals/README.md` if needed.

## Scope note

Most evals today are **Alisson-specific** — fixtures reference his persona
set and Portuguese identity content. This is a pragmatic choice for the
current product stage (one real user). When the product grows to multiple
real users, fixtures should move into per-user probe files loaded at
runtime, and `_lib/runner.ts` should gain a mechanism to parameterize by
user.

## Evals and the worklog

When an eval is added or its fixtures materially change, mention it in the
[worklog](worklog.md) entry for that session. Evals don't warrant their own
story in the roadmap — they are process infrastructure. But if an eval
catches a meaningful regression, the fix should be recorded in
[decisions.md](../project/decisions.md) with a pointer to the eval that
detected it.

---

**See also:** [Development Guide](development-guide.md) · [Worklog](worklog.md)
