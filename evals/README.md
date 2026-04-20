[< Repo](../README.md)

# Evals

End-to-end quality probes that hit real LLMs and real DBs. Separate from
`tests/` because the cost profile is different: evals are non-deterministic,
cost money per run, and measure behavior quality rather than logical
correctness.

## When to add an eval vs a test

| You're verifying... | Use |
|---------------------|-----|
| Logical correctness (DB ops, parsing, composition) | `tests/` (vitest) |
| LLM behavior under real API calls | `evals/` |
| A prompt change broke routing / voice / summary quality | `evals/` |
| A regression that only shows at the LLM output layer | `evals/` |

Evals never run in CI. They run on demand when you change something that
could affect LLM behavior (reception prompt, persona summaries, model swap,
identity layers).

## Running

Each eval is a standalone tsx script:

```bash
npm run eval:routing        # reception persona routing
npm run evals               # run all (flags total cost)
```

Requires `.env` with `OPENROUTER_API_KEY`, and `data/mirror.db` with the
primary user's identity seeded.

## Cost

Each eval prints expected cost in its header docstring. Current totals:

| Eval | Cost per run |
|------|--------------|
| `routing.ts` | ~$0.0005 (22 reception calls at Gemini Flash Lite pricing) |

Don't run evals in a loop. If you need to iterate, change the probe fixtures
to isolate what you're testing.

## Adding a new eval

1. Create `evals/<name>.ts`. Use `evals/routing.ts` as template.
2. Top-of-file JSDoc: purpose, scope (Alisson-specific vs generic), cost estimate.
3. Define probes as `Probe<Input, Expected>[]` — see `_lib/types.ts`.
4. Call `runEval({ name, threshold, probes, run })` from `_lib/runner.ts`.
5. Add `"eval:<name>": "tsx evals/<name>.ts"` to `package.json`.
6. Document the eval in `docs/process/evals.md`.

## Layout

```
evals/
  _lib/
    types.ts       # Probe, ProbeResult, EvalReport types
    runner.ts      # runEval() — sequential, prints table, sets exit code
  routing.ts       # reception persona routing
  README.md        # this file
```

Flat naming until there are >10 evals. Files under `_lib/` are shared
infrastructure, not runnable evals (the underscore prefix marks them).

## Scope note

Most evals today are **Alisson-specific** — fixtures reference his persona
set and Portuguese identity content. When mirror-mind grows to multiple
real users, fixtures should move to per-user files loaded dynamically.
