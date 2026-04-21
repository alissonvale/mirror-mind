[< Story](index.md)

# Plan: CV0.E3.S6 — Budget as simulated subscription

**Roadmap:** [CV0.E3.S6](index.md)
**Context:** CV0.E3.S8 built OAuth credential support but the subscription-backed providers we hoped to exploit (Google Code Assist for Individuals, GitHub Copilot) proved unviable — Google's free tier had quota/latency issues that killed the scope-routing eval; Copilot's individual plans changed mid-April cutting off the pattern. Pay-per-token via OpenRouter remains the reliable substrate. This story wraps it in a **subscription-like experience**: deposit credit upfront, watch it burn, get alerted, decide when to refill.

---

## Goal

Give the admin a **"prepaid plan" UX** over OpenRouter's pay-per-token reality. Four capabilities, validated together:

1. **Real per-call cost tracking.** Every LLM call (reception, title, summary, main) logs a row to `usage_log` with the actual cost OpenRouter charged — not an estimate. The generation ID from each response is captured and later resolved against OpenRouter's `/generation/{id}` endpoint.
2. **Credit balance visibility.** `/admin/budget` surfaces the dedicated account's remaining credit pulled live from OpenRouter's `/auth/key` endpoint.
3. **Breakdowns that match the way the admin thinks.** This month's spend split by role, by environment (dev vs prod), and by model. Burn rate over the last 7 days + projected days of credit left.
4. **Soft alert.** Banner in `/admin/*` when the credit remaining falls under 20% of the last top-up amount. No hard cutoff in v1 — avoids mid-conversation lockout.

Plus two secondary things that the subscription framing requires:

- **Admin-only visibility for costs.** The Context Rail's cost display (which currently shows BRL cost to every user in `/mirror`) becomes admin-only. The budget surface is admin-only from birth.
- **Per-admin currency display preference.** The USD→BRL exchange rate is a global install setting (one value per mirror, editable by any admin). Whether to render BRL alongside USD is a per-user toggle on `users` — admins who track in USD only can turn it off.

## Non-goals

- **Hard cutoff when credit hits zero.** v1 only warns. Killing mid-conversation responses without admin intervention is worse UX than letting OpenRouter return the "insufficient credits" error directly once the balance is actually zero. Revisit in v2 when the v1 soft alert proves its shape.
- **Historical charts and sparklines.** The page shows numbers and small ASCII/dot progress bars. Real charts add a chart library and styling work that isn't worth the weight for the first iteration.
- **Email/Telegram notifications of low balance.** UI banner only. The admin is going to open `/admin` regularly; banner is enough. Notification infra belongs to a broader alerts story (radar item: CV0.E3 operational alerts).
- **Multi-currency beyond USD/BRL.** Binary toggle, single rate. When an admin needs EUR or GBP, refactor to `users.preferred_currency TEXT` + `exchange_rates` table. YAGNI for now.
- **Setting the spending limit at the OpenRouter account level via API.** The admin sets their monthly cap manually in OpenRouter's dashboard; we surface usage against it. Automating cap-setting from the mirror adds coupling to OpenRouter's admin API without meaningful user value at this scale.
- **Top-up flow inside the mirror.** "Add $20" button links out to OpenRouter's credit page. We don't run Stripe or handle payment.
- **Historical retention longer than 90 days.** `usage_log` rows older than 90 days can be purged by a future maintenance job. v1 keeps everything; purge is a radar item.

## Decisions

### D1 — Real cost from OpenRouter, no local estimation

Each LLM call completes and pi-ai returns an `AssistantMessage`. The OpenRouter generation ID (hopefully surfaced by pi-ai; if not, see Open Questions) is captured. A fire-and-forget async task then:

1. Waits a short delay (~1s — OpenRouter's `/generation/{id}` typically isn't ready immediately).
2. Fetches `/api/v1/generation/{id}` — returns `total_cost`, `tokens_prompt`, `tokens_completion`, and more.
3. Writes a row to `usage_log` with the real numbers.

If the endpoint returns 404 on the first try, retry with exponential backoff up to 5 times over ~30 seconds. If still not available, write the row with `cost_usd = NULL` and log a warning. These are diagnostic signals, not failures — the LLM call itself has long since returned to the user.

**Why no heuristic layer.** The heuristic ("characters / 4 × BRL price") is what the Context Rail uses today and it's known to be ~10-30% off. Mixing estimated rows with real rows in `usage_log` would either require a `cost_source` column (and downstream consumers that handle both) or a reconciliation path that rewrites estimated rows when real numbers arrive. Both add complexity. Since the user prefers real cost from day one (even at the cost of logging latency), skip estimation entirely.

### D2 — USD internally, BRL as optional display

The `usage_log.cost_usd` column is the single source of truth. No `cost_brl` column — BRL is a derived value computed at render time from `cost_usd × settings.usd_to_brl_rate`.

**Why global rate, per-user toggle.** The rate is a fact of the world (applied uniformly when converting). Whether an admin wants to *see* BRL is personal — some admins track expenses in USD, some in BRL. Gating the display on a per-user boolean lets both coexist without either being wrong.

Schema adds:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Seed: ('usd_to_brl_rate', '5.00', <now>)

ALTER TABLE users ADD COLUMN show_brl_conversion INTEGER NOT NULL DEFAULT 1;
```

The `settings` primitive is generic enough to absorb other install-wide config later (alert threshold, hard cutoff percentage when that lands, etc.) — it's not S6-specific plumbing.

### D3 — Environment tagging via `MIRROR_ENV` env var

Each `usage_log` row carries `env TEXT` (`'dev'` or `'prod'`). Resolved at boot from `process.env.MIRROR_ENV`, defaulting to `'dev'` when unset. This matches the admin's mental model — dev vs prod is a property of the deploy, not of the DB or the user.

Rationale against storing env in DB: if you restore a prod backup to dev for debugging, the env tag should reflect the runtime, not the backup source. Env var is deploy-scoped; DB is deploy-agnostic.

### D4 — X-Title and HTTP-Referer headers on every OpenRouter call

Two headers that OpenRouter recognizes and surfaces in the provider's own dashboard (under an "app" column):

- `X-Title: mirror-mind` (app name)
- `HTTP-Referer: <base-url>` (origin) — computed from a new `MIRROR_BASE_URL` env var, or constructed from request context, or defaulted to `http://localhost:3000` if unavailable.

**Why pass these even with a dedicated account.** Redundancy. Our `usage_log` is the primary tracking. OpenRouter's dashboard is secondary evidence. If the two ever diverge — e.g., a bug in our logger, a retroactive reconciliation mismatch — the dashboard's app-tagged data gives us a sanity check.

### D5 — Soft alert at 20%, no hard cutoff

Banner on `/admin/*` when `remaining / last_topup < 0.20`. "Last top-up amount" is reconstructed from OpenRouter's `/auth/key` response (which returns `limit` and `usage` for accounts with spending caps set). If the admin hasn't set a cap at OpenRouter, we use the peak credit balance seen in the last 30 days as the baseline.

**Why 20% and not a dollar value.** Installs with different top-up patterns ($10 vs $50) shouldn't all trigger at $2 remaining. 20% of *whatever the admin deposited* is the same subjective "getting low" signal.

**Why no hard cutoff in v1.** The failure mode of a hard cutoff is worse than the failure mode of no cutoff. Hard cutoff mid-conversation = broken UX, no way to recover without admin intervention. No cutoff = OpenRouter eventually returns an insufficient-credits error, which already surfaces to the user as a stream failure and the admin sees the banner. The v1 hypothesis is that the banner is enough signal for any engaged admin to top up before the account actually zeros.

### D6 — OpenRouter integration — two endpoints, both cached short

`server/openrouter-billing.ts`:

- `getKeyInfo()` — calls `GET /api/v1/auth/key` with the install's OPENROUTER_API_KEY. Cached 60 seconds in-process. Returns credit balance + usage total + optional spending limit.
- `getGeneration(id)` — calls `GET /api/v1/generation/{id}`. Not cached (each call is unique). Retries with exponential backoff (1s, 2s, 4s, 8s, 16s) before giving up. Returns per-call cost + tokens used + model.

Both handle OpenRouter 5xx as soft failures — return `undefined` and log. Callers render "billing data unavailable" instead of crashing.

### D7 — Hide cost display from non-admin users

The Context Rail (`adapters/web/pages/context-rail.tsx`) currently renders BRL session cost visible to every user. This is a behavior change on existing code:

- For `user.role === 'admin'`: render cost same as before (respecting `show_brl_conversion`).
- For `user.role === 'user'`: render the Rail without the cost field — the other fields (model, tokens, composed-layers) stay visible.

No new routes, just conditional rendering in the Rail component.

### D8 — Budget page layout — numbers over charts

Top band: huge credit-remaining number + progress bar.

Then a card grid:

- **This month** — single total, with delta from last month if data exists.
- **By role** — main, reception, title, summary. Number + count of calls.
- **By environment** — dev, prod. Matches D3.
- **By model** — every distinct `model` seen this month.
- **Burn rate** — average USD/day over last 7 days, plus "at this rate, credits last X days."

Plus a "Preferences" section with:

- Exchange rate editor (global, any admin can change).
- `show_brl_conversion` toggle (per current admin).

Link at the bottom: "Top up credits at OpenRouter →" (external).

### D9 — Story is admin-internal; user manual doesn't need to know this exists

No user-facing docs for this story. The cost model is invisible to regular users by design (D7). Admin test guide covers the operational flow.

## Phases

1. **Schema + DB helpers** — `usage_log` table, `settings` table, `users.show_brl_conversion` column. CRUD helpers in new files. Migration idempotent. Re-exports from `server/db.ts`. Unit tests.
2. **OpenRouter billing integration** — `server/openrouter-billing.ts` with `getKeyInfo()` and `getGeneration(id)`. Types for the response shapes. Fetch mocked in tests. Cache behavior verified. Retry behavior verified.
3. **Instrument LLM calls with usage logging** — investigate pi-ai's AssistantMessage for the OpenRouter generation ID; if absent, fall back to OpenRouter's `/activity` endpoint with timestamp reconciliation. Wire `logUsage()` into all 5 call sites. Tests confirm the writer fires and the cost eventually resolves.
4. **`/admin/budget` page** — credit display, breakdowns, burn rate. Preferences section with rate editor and BRL toggle. Sidebar link. Admin-only guard. Tests for render, 403 for non-admin, update flows.
5. **Env tagging + X-Title + soft alert** — `MIRROR_ENV` read at boot. Headers passed to every pi-ai call via `resolveApiKey` extension or a new `buildLlmCallOptions(db, role)`. Soft alert banner in admin layout. Tests.
6. **Hide costs from non-admin** — Rail component conditional on `user.role`. Tests confirm the cost field is absent for non-admins and respects the BRL toggle for admins.
7. **Docs + refactoring + status** — test-guide walks through the acceptance flow (fresh install → deposit → call → see number). refactoring captures applied + parked items. Epic index marks S6 ✅. Worklog updated.

## Files likely touched

- `server/db.ts` — schema (2 new tables, 1 new column), migration, re-exports
- `server/db/usage-log.ts` *(new)* — CRUD helpers
- `server/db/settings.ts` *(new)* — get/set generic key/value
- `server/db/users.ts` — `show_brl_conversion` accessor
- `server/openrouter-billing.ts` *(new)* — billing client
- `server/usage.ts` *(new)* — `logUsage()` + aggregations
- `server/model-auth.ts` — extend to return headers (X-Title, HTTP-Referer) alongside API key, or expose a separate `buildLlmCallHeaders()`
- `server/reception.ts`, `server/title.ts`, `server/summary.ts` — capture generation ID + call `logUsage()`
- `adapters/web/index.tsx` — main path logUsage() call, new `/admin/budget` routes
- `adapters/telegram/index.ts` — main path logUsage() call
- `server/index.tsx` — API main path logUsage() call
- `adapters/web/pages/admin/budget.tsx` *(new)*
- `adapters/web/pages/layout.tsx` — sidebar link "Budget", banner for low balance
- `adapters/web/pages/context-rail.tsx` — conditional cost display
- `adapters/web/public/style.css` — budget page styles + banner
- Tests: `tests/db.test.ts` (schema), `tests/usage-log.test.ts` *(new)*, `tests/openrouter-billing.test.ts` *(new)*, `tests/web.test.ts` (budget + rail changes)

## Open questions to resolve during implementation

- **Does pi-ai's AssistantMessage expose OpenRouter's `id`?** Phase 3 investigation. If not, two fallbacks: (a) patch pi-ai to forward it (large scope, outside this story), or (b) consume `/api/v1/activity` periodically and reconcile against `usage_log` rows by timestamp + model. Plan B is ugly but tractable. Plan A is ideal.
- **What's the real lag between a completed call and `/generation/{id}` being ready?** Drives the retry schedule. Start with 1/2/4/8/16s and tune based on observed behavior.
- **When OpenRouter's `/auth/key` returns no explicit spending limit, what's the right denominator for the "20% remaining" alert?** Proposal: peak credit seen in the last 30 days. If the admin has never topped up, the alert simply doesn't fire yet. Discuss if there's a cleaner formulation.
- **Exchange rate sourcing.** Admin-edited is the intended UX. Should we also offer an auto-fetch from some free FX API on a schedule? Not in v1, but worth tracking if the manual edit feels tedious.

---

**See also:**
- [CV0.E3.S8 — OAuth credentials for subscription-backed providers](../cv0-e3-s8-oauth-subscriptions/) — built the infrastructure this story's `X-Title` wiring reuses
- [CV0.E3.S1 — Admin customizes models via the browser](../cv0-e3-s1-admin-models/) — established the "JSON as seed, DB as source of truth" pattern that this story extends with the `settings` primitive
- [Spike 2026-04-21 — Subscription OAuth](../../../spikes/spike-2026-04-21-subscription-oauth.md) — the cost curve anxiety that motivated both S8 and S6
- [OpenRouter API docs — /auth/key](https://openrouter.ai/docs/api-reference/get-current-api-key) (external)
- [OpenRouter API docs — /generation/{id}](https://openrouter.ai/docs/api-reference/get-a-generation) (external)
