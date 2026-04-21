[< Story](index.md)

# Refactoring — CV0.E3.S6

Review pass observations. Two buckets: **applied** (commits that landed) and **parked** (observations left alone, with a criterion for revisiting).

---

## Applied

### `settings` as a generic primitive, not just for USD→BRL

The first draft of the plan put the exchange rate inline on a `usd_to_brl_rate` column somewhere. Pulled it out as a generic `settings(key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)` table so future global tunables (alert threshold, hard cutoff percentage, maintenance mode flag) have a natural home without another schema migration.

**Why:** the rate was the first case; the shape generalizes cleanly; new settings won't each require a column.

### Env detection read at call time, not at import

Initial draft of `currentEnv()` cached the MIRROR_ENV value at module import. Switched to per-call reads so tests can flip the env var without module reloads, and so a production restart is not needed to change the tag. Minor cost (one env-var read per LLM call), zero caching value since env vars don't change mid-process.

**Why:** simpler mental model, testable, no caching headache.

### Client-side banner fetch instead of wiring through 11 admin pages

The plan called for a soft-alert banner on `/admin/*`. The obvious implementation is a middleware that fetches the billing status and attaches to `c.var.budgetAlert`, then every admin page passes it into its `Layout`. With 11+ render sites, that's 11 prop additions for one banner.

Alternative shipped: Layout renders an empty `<div id="budget-alert-banner">` for admin users; `layout.js` detects the div on page load, fetches `/admin/budget-alert.json`, and populates the banner if the alert is active. No page-by-page wiring. Regular users don't see the div at all (server-rendered conditional).

**Why:** less invasive, same user outcome, keeps admin pages focused on their own concerns. Trade-off: banner appears after JS runs, not during initial server paint — acceptable (admin pages already have several client-side enhancements).

### `headeredStreamFn` as the single Agent-side seam

The five call sites using `complete()` (reception, title, summary×2) pass `headers: buildLlmHeaders()` directly in the options. The three Agent-based main paths (web, telegram, api) can't inject options at call time — the Agent owns its stream. Solution: a small `headeredStreamFn` wrapper around `streamSimple` that merges `buildLlmHeaders()` into whatever options the Agent hands down. Passed once as `streamFn` in each `new Agent({...})` call.

**Why:** pi-ai's `headers` option exists on StreamOptions; the Agent has a `streamFn` hook that accepts the same signature. Clean composition; no patching of pi-agent-core.

### Live chat.js updates respect the same visibility rules

The Rail is also updated live after each turn via `/mirror/stream`'s `done` event, which carries a `rail` payload. `chat.js`'s `setCost()` now takes the full state object (not just `costBRL`), so the live update respects `showCost`, `showBrl`, and `usdToBrlRate` identically to the server-rendered path.

**Why:** two code paths rendering the same data must apply the same rules. Not doing this would mean non-admin users briefly see cost after each turn before a refresh, or the currency flickers between USD and BRL as updates arrive.

---

## Evaluated but not done

### No hard cutoff when credit hits zero (parked to v2)

The plan explicitly deferred this. Behavior today: when OpenRouter returns "insufficient credits" on a call, the mirror surfaces a generic provider error to the user. No advance warning at, say, $0.10 remaining to block the next call proactively.

**Revisit when:** we observe the soft alert in practice long enough to know whether admins top up reliably based on the banner alone. If not — if balances repeatedly hit zero mid-conversation — add a soft hold (refuse new user turns at <1% remaining with a clearer message) before considering a true hard cutoff.

### Heuristic BRL cost from the Rail is still used — not reconciled against real cost

The Context Rail continues to compute BRL cost via the char/4 heuristic × `models.price_brl_per_1m_*`. This was deliberate — the Rail is a per-session indicator, and the real per-call costs from `/generation/{id}` live in `usage_log`. Reconciling the two at Rail level would mean joining every Rail computation against `usage_log` by session_id + timestamp, which is more complexity than the Rail needs.

Budget surfaces (the dashboard, the alert banner) use real cost. Rail uses heuristic. They diverge by 10-30%. Admins who care about precision read `/admin/budget`, not the Rail.

**Revisit when:** Rail users start asking "why does the Rail say R$0.20 but /admin/budget says R$0.15 for the same session?" If the question comes up, introduce a small join at `computeSessionStats` level. Not before.

### `usage_log` retention is unbounded

v1 stores every row forever. A busy year could accumulate ~100k rows, still cheap for SQLite but eventually nontrivial for aggregations.

**Revisit when:** the `/admin/budget` page load gets slow. Add a periodic purge (anything older than 90 days) or an archive table. A 30-day `usage_log_archive` + daily rollup would cut working-set size without losing monthly reports.

### No cost visibility in Telegram / CLI adapters

S6's visibility changes apply to the web adapter (Rail). Telegram and CLI adapters don't show cost anywhere today, so there's nothing to hide. When either grows a cost-adjacent UI (e.g. a `/balance` Telegram command), it needs to honor the same admin-only rule.

**Revisit when:** adapter-level cost UX surfaces. Note in the adapter's story plan.

### Exchange rate is manual — no auto-fetch from an FX API

Admin edits the rate manually. A daily cron against a free FX API (ExchangeRate-API, open.er-api, etc.) would keep it reasonably current without manual intervention.

**Revisit when:** the manual edit feels tedious (e.g., admin opens `/admin/budget`, notices BRL looks stale, sighs, edits — and this happens more than once a month). Until then, manual is fine.

### Budget UI assumes OpenRouter is the billing substrate

The `keyInfo` fetch hits OpenRouter's `/auth/key`. The `getGeneration` fetch hits OpenRouter's `/generation/{id}`. If a future provider/key resolves through a non-OpenRouter path (e.g., Anthropic OAuth via S8's infra, or a direct Gemini API), there's no billing surface for those calls.

Today this is fine — the mirror runs 100% on OpenRouter post-S8's Copilot failure. The moment we route any role through a different billing substrate, the budget page needs to either degrade gracefully ("X calls this month not tracked — routed through non-OpenRouter provider") or add provider-specific billing adapters.

**Revisit when:** a role is configured to an OAuth provider in `/admin/oauth` + `/admin/models`. Guard rail: `usage_log` already captures `provider` per row; the budget aggregations already show per-model breakdown, so at least the admin can see the volume. Accuracy of cost comes later.
