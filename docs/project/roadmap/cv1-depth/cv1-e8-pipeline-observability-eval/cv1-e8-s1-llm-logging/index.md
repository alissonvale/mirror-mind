[< CV1.E8](../)

# CV1.E8.S1 — LLM call logging with admin toggle

**Status:** 🚧 In Progress (opened 2026-04-27)

## Problem

CV1.E7 built the response intelligence pipeline (reception → composer → main → expression, plus title and summary). CV1.E9 added the Voz da Alma path on top. The pipeline now makes 2-4 LLM calls per user turn, each with its own role, model, system prompt, and behavior.

When something goes wrong — the Alma reads as flat, reception classifies an apontamento as a question, the persona response is too long, the title is wrong — there is no way to inspect what was actually sent to the model and what came back. The existing telemetry (`usage_log`) records cost and tokens for billing reconciliation, not the prompts themselves. Without the actual prompts, every diagnosis is guesswork: did reception see the right candidates? did the composer compose the right layers? did the model fail to follow a rule that was explicitly stated?

The first week of real Alma usage will surface "vários refinamentos pequenos" (Alisson's words on opening this story). Each refinement is to a prompt — Alma preamble, reception classification, doctrine content, mode guides. Iterating on prompts blindly compounds the cost: change → guess → re-test → maybe still wrong. Iterating with the actual prompts visible compresses each refinement to a surgical change.

## Fix

A new table `llm_calls` and a logging service that writes one row per LLM invocation, capturing the full system prompt, user message, response, role, model, provider, token counts, cost, latency, and the session/entry/user identifiers when applicable. A toggle (`llm_logging_enabled` setting) lets admin start/stop logging globally so the system isn't always paying storage when nobody is investigating. An admin UI lists the calls with filters (role, session, model, date range, prompt search) and a detail view renders the full prompts and response in a human-legible monospace block. Export to JSON or CSV for offline analysis.

## What ships

- **`llm_calls` table.** Append-only schema with id, role, provider, model, system_prompt, user_message, response, tokens_in, tokens_out, cost_usd, latency_ms, session_id, entry_id, user_id, env, error, created_at. Indexed by `(role, created_at)`, `(session_id, created_at)`, `(created_at)`.
- **Settings key `llm_logging_enabled`.** Boolean (`"true"` / `"false"` in the existing `settings` table). Default `"true"` — admins can toggle off via the admin UI.
- **DB helpers (`server/db/llm-calls.ts`).** insertLlmCall, listLlmCalls (with filters + pagination), countLlmCalls, getLlmCall, deleteLlmCalls (by ids or older-than), deleteAllLlmCalls.
- **Logging service (`server/llm-logging.ts`).** `logLlmCall(...)` checks the toggle and writes the row. Defensive: never throws, never blocks the pipeline. On failure, logs to stderr and returns silently.
- **Hook integration in 5 sites.**
  - `server/reception.ts` — already has `logUsage` for cost; adds `logLlmCall` with full prompts. Captures the assembled SESSION POOL + OUT-OF-POOL system prompt and the user message.
  - `server/expression.ts` — captures the mode-guide system prompt, the draft+user_message wrapped prompt, and the reshaped response.
  - `server/title.ts` — title generation.
  - `server/summary.ts` — layer/scope summarization.
  - **Main generation** — three adapters (`adapters/web/index.tsx` web stream, `server/index.tsx` web sync, `adapters/telegram/index.ts`). Captures the composed system prompt (canonical or Alma), the user message, and the final assistant text plus tokens.
- **Admin UI** (bilingual en/pt-BR, follows CV2.E1 admin localization pattern):
  - `GET /admin/llm-logs` — list view with filters (role dropdown, session_id input, model dropdown, date range, search-in-prompt input), 50 rows per page, columns: timestamp, role, model, latency, tokens, cost, session preview link.
  - `GET /admin/llm-logs/:id` — detail view with system_prompt and response in `<pre>` blocks, monospace, scroll-y, white-space:pre-wrap so newlines and indentation render verbatim. Metadata table beside.
  - Toggle button in the page header showing current state + flip action.
  - Cleanup actions: "Clear all" (with confirm) and "Clear older than N days".
  - Link from the admin dashboard.
- **Export.** `GET /admin/llm-logs/export?format=json|csv` with current filters applied. JSON: array of full rows. CSV: RFC 4180 escape (multi-line cells preserved with quote-doubling).
- **i18n.** Strings for the admin UI in `adapters/web/locales/{en,pt-BR}.json`.

## Tests

- `tests/db/llm-calls.test.ts` (new) — insert/list/filter/count/delete helpers.
- `tests/llm-logging.test.ts` (new) — service: writes when toggle on, no-op when off, swallows errors.
- `tests/reception.test.ts` (extend) — confirms hook fires on reception success.
- `tests/web.test.ts` (extend) — admin routes (list, detail, toggle, clear, export) authenticated and rendering.

## Non-goals (parked)

- **Per-step latency & cost dashboards** — aggregate views over the log table. Future story when the friction surfaces.
- **Prompt diffing across versions** — compare two prompt variants against the same recorded user message.
- **Eval harness integration** — formalize `evals/scope-routing.ts` and friends as a runner that uses the log as fixtures.
- **Hashing or PII redaction** — admin is the only reader; data lives in the local SQLite. Add when we cross a deployment boundary.
- **Automatic retention.** Manual cleanup only — admin decides when to drop old rows.
- **Per-role toggle.** Global on/off only. Per-role toggle is a future refinement if specific roles dominate the storage.
- **Streaming-aware capture** — main generation captures the final accumulated draft, not per-delta events. Streaming-internal events stay in the in-memory subscriber.

## Docs

- [Plan](plan.md)
- [Test guide](test-guide.md)
