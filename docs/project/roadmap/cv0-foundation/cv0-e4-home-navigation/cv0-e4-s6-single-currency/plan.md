[< Story](index.md)

# CV0.E4.S6 — Single-currency cost display

## Context

S6 (the budget story, CV0.E3.S6) introduced a toggle that let admins show BRL alongside USD on the budget dashboard. Over the weeks since, two learnings emerged: (1) the dual display is noisy — cost cells become twice as wide and the eye has to pick one of the two values anyway; (2) the Context Rail was already single-currency (per S6's own copy "USD when off, BRL when on"), which means only the budget page was dual. The asymmetry was unintentional.

This story collapses the model to **one currency, everywhere**. The admin picks their preferred currency in `/me` preferences; the app renders only that currency in every cost surface.

## Semantic shift without migration

The `users.show_brl_conversion` column stays. Its meaning changes from:

| Before | After |
|--------|-------|
| `1` = show BRL in addition to USD | `1` = prefer BRL over USD |
| `0` = hide BRL, show USD | `0` = prefer USD over BRL |

This re-reading preserves every user's current experience:
- Anyone who had the toggle on was seeing the BRL value anyway (along with USD) — now they see BRL only. Small reduction in noise.
- Anyone who had it off was seeing USD only — continues to see USD only. No change.

No ALTER TABLE, no data migration. The column name becomes a historical artifact — documented in a one-line code comment wherever the column is read.

## UI change on `/me`

### Before

```
☑  Show cost in BRL alongside USD

Applies to the Context Rail and the budget dashboard. USD-only when unchecked.
```

### After

```
Preferred currency for cost display

○ USD — $
● BRL — R$

Applies to the Context Rail and the budget dashboard.
```

Radios make the choice explicit (one of two) instead of framing it as an additive flag. Form action stays `/me/show-brl`; form field stays `name="show_brl"` with `value="0"` for USD and `value="1"` for BRL — so the server handler doesn't change.

## Files

**Modified**
- `adapters/web/pages/me.tsx` — checkbox → two radios; rename local var `showBrl` to `preferBrl` for clarity; legacy-name comment on the column read
- `adapters/web/pages/admin/budget.tsx` — `formatUsdAndMaybeBrl` removed, replaced with `formatCost(usd, rate, preferBrl)` returning one string; `showBrl` → `preferBrl` throughout including `BudgetTable` prop
- `adapters/web/pages/home.tsx` — `AdminState` gains `usdToBrlRate` + `preferBrl` fields; `formatCredit` takes the rate and preference and renders one currency
- `adapters/web/index.tsx` — home route handler passes `usdToBrlRate` and `preferBrl` into `adminState`
- `adapters/web/public/style.css` — new `.me-pref-title` / `.me-pref-radio` classes; old `.me-pref-label` replaced
- `tests/web.test.ts` — admin-sees-preference test updated to assert the radio shape (`type="radio"`, both values, both labels)

**Unchanged by design**
- `server/db/users.ts` — column schema stays; handlers stay
- `adapters/web/pages/context-rail.tsx` — already renders single currency
- `adapters/web/public/chat.js` — live cost update already respects `rail.showBrl`

## Verification

- `npm test` passes (337 — no change in count, existing admin-me test updated to assert radios).
- Manual:
  - Log in as admin, `/me`. Switch between USD and BRL radios; each submit persists and reloads with the new choice selected.
  - `/admin/budget` — all numbers render in the selected currency, no `$ · R$` dual format anywhere.
  - Home as admin — State of the mirror band shows credit in the selected currency.
  - Context Rail on `/conversation` — cost already single-currency, no regression.
