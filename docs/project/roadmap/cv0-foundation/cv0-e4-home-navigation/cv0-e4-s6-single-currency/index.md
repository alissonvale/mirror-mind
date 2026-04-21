[< CV0.E4 — Home & Navigation](../index.md)

# S6 — Single-currency cost display

Cost surfaces used to show USD and BRL side by side when the admin had BRL conversion turned on. This story changes the model: the admin picks one currency in `/me` preferences, and every cost number across the app renders that one choice — no dual display anywhere.

**What changed:**

- `/me` preferences: the checkbox "Show cost in BRL alongside USD" becomes two radio buttons: **USD — $** / **BRL — R$**
- `/admin/budget`: all cost numbers (credit remaining, cap, lifetime spend, month total, burn rate, per-role / per-env / per-model tables) render in the preferred currency only
- Home "State of the mirror" band: renders credit in the preferred currency (was USD hardcoded)
- Context Rail: already single-currency since CV0.E3.S6; no change needed

**Data-layer stability:** the `users.show_brl_conversion` column stays — no schema migration. Its semantic shifts from *"show BRL in addition to USD"* to *"prefer BRL over USD"*. Existing data is reinterpreted correctly: users who had the toggle on (= 1) now see BRL only; users who had it off (= 0) continue to see USD only. No regression for anyone.

- [Plan](plan.md) — scope, semantic shift, files touched
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. `/me` renders two radios instead of a checkbox; the saved value of `show_brl_conversion` drives which radio is selected.
2. `formatUsdAndMaybeBrl` is gone. `formatCost(usd, rate, preferBrl)` replaces it and returns one currency string.
3. `/admin/budget` never shows the `$X · R$Y` dual format; every cost cell shows one currency.
4. Home admin band shows credit in the admin's preferred currency.
5. Column name `show_brl_conversion` is commented in code to explain the legacy naming vs the new semantic.
6. `npm test` passes (337).
