[< Story](index.md)

# Test guide — CV0.E3.S6

This story turns OpenRouter pay-per-token into a subscription-like experience. Every LLM call logs real cost. `/admin/budget` shows credit remaining + burn rate + breakdowns. Non-admin users no longer see cost in the Context Rail. A banner warns admins when credit is under 20% of the spending cap.

---

## Automated checks

```sh
npm test
```

Expected: **311 tests passing** (was 283 at the start of S6, +28 new).

Look for:

- `usage_log` describe block — insert, update (partial reconciliation), totals, aggregations by role/env/model/day.
- `settings` describe block — upsert, typed rate accessor, invalid value rejection.
- `users.show_brl_conversion` — default 1, toggle.
- `openrouter-billing` — `getKeyInfo` cached 60s, `getGeneration` retry on 404 then succeed, fail-fast on 5xx, malformed body returns undefined.
- `usage` — fake AssistantMessage flows through `logUsage`, background reconcile skipped for non-OpenRouter providers and missing responseId, `currentEnv()` parses MIRROR_ENV.
- `admin budget` route block — 403 for non-admin, hero + breakdowns render, rate editor persists, show-brl toggle flips, billing unavailable fallback.
- `budget-alert.json` — alert when <20%, null when ≥20%, 403 for non-admin.
- `context rail` — cost is `data-hidden=true` for non-admin, rendered for admin.

---

## Manual flow — the primary acceptance path

### 1. Set the environment tag

In `.env` (or the VPS systemd unit):

```
MIRROR_ENV=dev
# or MIRROR_ENV=prod on the server
MIRROR_BASE_URL=http://localhost:3000
# or the real origin in prod
```

Restart the server so the env vars are read on boot.

### 2. Set a spending cap at OpenRouter

At `openrouter.ai/settings/keys`, on the mirror's dedicated key (e.g. `mirror-dev`), set a **monthly spending limit** — this is what the budget UI uses as the "100% baseline" for the progress bar and the 20% alert threshold.

Without a cap, `/admin/budget` renders an "uncapped" notice and the alert banner never fires (there's nothing to measure against).

### 3. Generate some usage

Open `/mirror` as your admin user. Send 2-3 substantive messages so reception + main fire. For each turn, a row is written to `usage_log` immediately (with tokens from pi-ai but no cost). Within ~5-30 seconds, the background reconciler fetches `/api/v1/generation/{id}` and patches the row with real cost.

Verify in SQLite:

```sh
sqlite3 data/mirror.db "SELECT role, provider, model, env, input_tokens, output_tokens, printf('%.6f', cost_usd) FROM usage_log ORDER BY created_at DESC LIMIT 10"
```

Expect rows for `main`, `reception`, and (when you trigger a Begin-again) `title`. The `env` should be `dev`. `cost_usd` starts as NULL and is populated by the background reconciler.

### 4. Visit /admin/budget

Sidebar → **This Mirror** → **Budget**.

Verify:

- **Hero**: "Credit remaining $X.XX · R$Y" (or just $ if BRL display is off). Progress bar visually represents remaining / limit.
- **This month**: total spent, total calls, "N awaiting reconciliation" if any rows have not yet been resolved.
- **Burn rate**: "$X.XX/day · At this rate, credits last Y days". The projection is based on trailing 7 days.
- **By role**: at minimum `main`, `reception`. `title` if you did a Begin-again.
- **By environment**: only `dev` (you haven't used prod yet).
- **By model**: one row per distinct `provider/model` combo.
- **Preferences** section:
  - Exchange rate editor. Change to `5.37`, Save, confirm the BRL numbers update across the page.
  - BRL display toggle. Flip to off — all BRL side-strings in the page disappear, numbers go USD-only. Flip back on.

### 5. Low-balance banner

Temporarily set a very tight spending cap at OpenRouter — e.g. `$5` total, with current usage `>$4` — so `limit_remaining / limit < 0.20`.

Reload any page under `/admin/*`. The sticky banner at the very top should render:

> **Low balance: 18% left** ($0.92 · R$4.60) Top up → · See details

Clear the banner by either topping up at OpenRouter or raising the cap.

**Non-admin check**: log in as a non-admin user. Navigate to any page — the banner does not appear. The Rail at `/mirror` has no cost field (`rail-cost` is present but `data-hidden=true`). Regular users never see or hear about cost.

### 6. OpenRouter dashboard tagging

Log in at openrouter.ai and go to the dashboard / activity log for your dedicated account.

Calls from the mirror should appear tagged with:
- **App**: `mirror-mind` (from `X-Title`)
- **Origin**: your `MIRROR_BASE_URL` (or `localhost:3000` default)

If you have other apps using the same account, you can filter by the mirror-mind tag to see exactly what this install is spending.

### 7. dev vs prod isolation

Deploy to prod with `MIRROR_ENV=prod` and a distinct API key (the `mirror-prod` key from your dedicated OpenRouter account). After some prod traffic, verify:

- `/admin/budget` on prod shows the prod key's credit balance.
- `/admin/budget` shows `prod` rows under the "By environment" breakdown when you visit from the prod install.
- Dev and prod see the SAME credit balance if you use the same OpenRouter account; they see different credit balances if you use different accounts/keys.

---

## Laptop → server bootstrap recap

Setup pattern for a fresh install:

1. Create a dedicated OpenRouter account (or use an existing non-shared one).
2. At `openrouter.ai/settings/keys`, create two keys labeled `mirror-dev` and `mirror-prod`.
3. Set a monthly spending cap (suggestion: start with $10-20 to validate the pattern). The cap is essential for the budget UX — without it, the "X% remaining" math doesn't work.
4. Deposit initial credit ($10 or whatever you want to prepay).
5. In local `.env`: `OPENROUTER_API_KEY=<mirror-dev key>` and `MIRROR_ENV=dev`.
6. In VPS systemd: `OPENROUTER_API_KEY=<mirror-prod key>`, `MIRROR_ENV=prod`, `MIRROR_BASE_URL=<your prod origin>`.
7. First use triggers the seed of `usd_to_brl_rate = 5.0` in the settings table. Adjust from `/admin/budget` when the actual rate drifts.

---

## What "done" feels like

- Every LLM call shows up in `usage_log` within seconds, with `cost_usd` populated by the background reconciler.
- `/admin/budget` gives you a glance-and-understand picture of this month's spend.
- Burn rate + days-left projection matches your intuition ("I'm at ~$0.50/day, so $10 lasts 20 days" — the numbers align).
- Non-admin users never encounter a cost number anywhere.
- When credit drops below 20%, the banner appears on admin pages; it vanishes as soon as you top up.
- The OpenRouter dashboard shows mirror-mind traffic tagged distinctly from your other OpenRouter activity.
