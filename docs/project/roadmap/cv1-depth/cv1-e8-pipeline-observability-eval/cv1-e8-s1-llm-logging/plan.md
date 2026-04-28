[< Story](index.md)

# Plan — CV1.E8.S1 LLM call logging

## Schema

```sql
CREATE TABLE llm_calls (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,              -- 'reception' | 'main' | 'expression' | 'title' | 'summary'
  provider TEXT NOT NULL,          -- 'openrouter' | 'anthropic' | 'google' | ...
  model TEXT NOT NULL,             -- e.g. 'anthropic/claude-sonnet-4'
  system_prompt TEXT NOT NULL,     -- the assembled prompt sent to the model
  user_message TEXT NOT NULL,      -- user input (or draft for expression, or seed for summary)
  response TEXT,                   -- the model's response text (NULL on error)
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  session_id TEXT,                 -- when applicable
  entry_id TEXT,                   -- the assistant entry produced (when applicable)
  user_id TEXT REFERENCES users(id),
  env TEXT NOT NULL,               -- 'dev' | 'prod'
  error TEXT,                      -- non-null on failed calls
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_llm_calls_role_created ON llm_calls(role, created_at);
CREATE INDEX idx_llm_calls_session_created ON llm_calls(session_id, created_at);
CREATE INDEX idx_llm_calls_created ON llm_calls(created_at);
```

Settings key: `llm_logging_enabled` in the existing `settings` table. Stored as `"true"` or `"false"`. Default `"true"` on first boot (a new `seedSettingIfEmpty` helper installs it during migration).

## Logging service contract

```typescript
interface LlmCallLog {
  role: "reception" | "main" | "expression" | "title" | "summary";
  provider: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  response: string | null;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  sessionId?: string | null;
  entryId?: string | null;
  userId?: string | null;
  error?: string;
}

function logLlmCall(db: Database, payload: LlmCallLog): void;
```

Behavior:
- Reads `llm_logging_enabled` setting; if `"false"`, returns immediately.
- Otherwise inserts a row. On any error (DB lock, schema drift, etc.), catches and logs to stderr; never throws.
- Synchronous insert (better-sqlite3 has no async path; the call returns after the row is committed). Negligible latency impact (~0.1ms per insert).

## Hook integration strategy

For each of the 5 sites, the pattern is:
1. Capture the system prompt and user message before the LLM call.
2. Capture `startedAt = Date.now()`.
3. After the LLM call returns (success or fail), call `logLlmCall` with the captured data and the response (or error message).
4. The session_id / entry_id / user_id come from the surrounding pipeline context.

The five sites and their adaptations:

| Site | role | system_prompt source | user_message source | response source | session_id / entry_id |
|---|---|---|---|---|---|
| `server/reception.ts` | `reception` | the assembled `systemPrompt` (already a local var) | the user's text | the parsed JSON response (raw text before parse) | sessionId from caller, entry_id null (reception runs before entry is created) |
| `server/expression.ts` | `expression` | `buildSystemPrompt(...)` output | `buildUserPrompt(userMessage, draft)` output | the rewritten text | sessionId from options, entry_id null |
| `server/title.ts` | `title` | the title-generation prompt | the conversation snippet sent in | the title | sessionId yes, entry_id null |
| `server/summary.ts` | `summary` | the summarization prompt | the layer/scope content being summarized | the summary | session_id null, entry_id null |
| **main** (3 adapters) | `main` | the `systemPrompt` from `composeSystemPrompt` or `composeAlmaPrompt` | the user's text | the final draft accumulated from text_delta + thinking-block fallback | sessionId yes, entry_id = the assistant entry id once persisted |

For main, the entry_id is known only after the assistant entry is appended. Two options:
- (a) Log immediately after generation with entry_id null, accept the gap.
- (b) Log AFTER the entry is appended, so entry_id is populated.

Choosing **(b)** for main — the link from a logged call to its entry is the primary use case for filtering. For reception/expression/title/summary, entry_id stays null because they don't produce assistant entries themselves (they're stages).

## Admin UI shape

### List view (`/admin/llm-logs`)

```
┌───────────────────────────────────────────────────────────────────────┐
│  LLM Logs                            Logging: [ON]  ⚙️ Toggle          │
│                                       🗑️ Clear all  📤 Export JSON CSV  │
├───────────────────────────────────────────────────────────────────────┤
│  Role: [all ▾]  Session: [____]  Model: [all ▾]  Date: [____]  🔍 [____] │
│  Apply filters  ·  Clear filters                                        │
├───────────────────────────────────────────────────────────────────────┤
│  Time         Role         Model                  Tokens   Cost   Lat  │
│  ─────────────────────────────────────────────────────────────────────  │
│  12:34:56     reception    gemini-2.5-flash       523/187  $0.001  1.2s  │
│  12:34:57     main         claude-sonnet-4        1842/612 $0.024  4.1s  │
│  12:34:58     (skipped)                                                 │
│  ...                                                                    │
└───────────────────────────────────────────────────────────────────────┘
```

Each row links to the detail view. Pagination at the bottom: `← prev | 1 of N | next →`.

### Detail view (`/admin/llm-logs/:id`)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Call abc123…                                  [back to list]           │
│                                                                        │
│  Role: main         Model: anthropic/claude-sonnet-4                    │
│  Provider: openrouter   Session: a1b2c3…   Entry: x9y8z7…               │
│  Tokens: 1842 in / 612 out  Cost: $0.024  Latency: 4.1s                 │
│  Created: 2026-04-27 12:34:57   Env: dev                                │
│                                                                        │
│  ┌─ System prompt ──────────────────────────────────────────────────┐   │
│  │ <pre> the full system prompt, monospace, preserved whitespace </pre>│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ User message ──────────────────────────────────────────────────┐   │
│  │ <pre> ... </pre>                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─ Response ──────────────────────────────────────────────────────┐   │
│  │ <pre> ... </pre>                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

The three `<pre>` blocks use `white-space: pre-wrap`, monospace font, max-height with scroll, light background. **No markdown rendering** — admin needs to see what was actually sent and received, not how it would render.

## Phases

| # | Phase | Files |
|---|---|---|
| 1 | Story docs | this folder |
| 2 | Schema + migration + helpers | `server/db.ts` (SCHEMA + migrate), `server/db/llm-calls.ts` (new), `server/db/settings.ts` (new helper if needed), `tests/db/llm-calls.test.ts` (new) |
| 3 | Logging service | `server/llm-logging.ts` (new), `tests/llm-logging.test.ts` (new) |
| 4 | Hook integration | `server/reception.ts`, `server/expression.ts`, `server/title.ts`, `server/summary.ts`, `adapters/web/index.tsx` (web stream + admin route detail), `server/index.tsx` (web sync), `adapters/telegram/index.ts` |
| 5 | Admin UI | `adapters/web/index.tsx` (routes), `adapters/web/pages/admin/llm-logs.tsx` (new — list + detail components) |
| 6 | Toggle + cleanup | route handlers + UI buttons in admin page |
| 7 | Export | route handler in `adapters/web/index.tsx`, CSV escaping helper |
| 8 | Wrap-up | i18n strings, worklog, decisions, badges, bump to v0.19.0 |

## Risks

**Storage growth.** A typical Alma turn writes ~15-20 KB of system prompt (preamble + soul + doctrine + identity). Multiplied by reception + expression + main + title (occasional), a single turn can persist 50-80 KB. A heavy use day at ~50 turns = 2-4 MB. A month of heavy use = ~100 MB. Acceptable for local-only SQLite. If the deployment expands to VPS multi-user, retention policy moves out of "non-goal" and into a follow-up story.

**Logging-on-by-default surprise.** The toggle defaults true so the next user turn after this ships starts populating data immediately. Documented in the docs and the admin page header shows the state explicitly.

**Capture timing for main on streaming path.** The web stream main generation accumulates the draft from `text_delta` events; the response is only fully known after `agent.prompt(text)` resolves. The thinking-block fallback (CV1.E9 follow-up 5) extends the response source. The hook fires after both finalize, before the assistant entry is persisted; we then update entry_id with a UPDATE after the entry is appended. Two-step write to keep the FK populated.

**Async error path.** If `logLlmCall` throws, the pipeline must continue. Wrapping every call site in try/catch is brittle; the service itself owns the catch. Tested.

## Notes on existing telemetry

The `usage_log` table exists (CV0.E3 pricing/budget work). It records cost-relevant fields per call (role, provider, model, tokens, cost_usd, generation_id) for budget reconciliation. We keep it untouched — the new `llm_calls` table adds the prompts and response, which `usage_log` deliberately omits to stay lean for the cost queries.

The two tables are joinable on `(role, created_at)` proximity but not a strict FK. That's fine for v1; if cross-table analysis becomes a friction, we add a shared `call_id` field in a follow-up.
