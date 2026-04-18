[< CV0 — Foundation](../)

# CV0.E3 — Install Administration

The admin operates the install from the browser, not from the filesystem. Install-level configuration — models, adapters, and the family of settings that will accumulate alongside them — lives in the DB with a small admin surface. Tuning happens without restarts and without editing JSON.

**Audience:** the person running the install. Distinct from the user lens that drives CV0.E2 (Web Experience) — same web adapter, different purpose.

**Framing:** config-as-code is great for setup and reproducibility; it's the wrong surface for day-to-day operation. Moving operational config to the DB keeps the code honest (defaults and seeds stay versioned) while giving the admin a live surface to experiment.

## Stories

| Code | Story | Status |
|------|-------|--------|
| S1 | **Admin customizes models via the browser** | — |
| S2 | **Admin customizes adapters via the browser** | — |

S1 comes first because model tuning is the more frequent and higher-stakes operation (cost, quality, speed). S2 rides on the pattern S1 establishes.

## Shared design concerns (not yet resolved)

These are questions that will need answers inside S1 and will shape S2:

- **Seed vs. source of truth.** Does the JSON become install seed data only, or does it stay as a fallback? Leaning toward seed-only: the DB is the live source of truth; the JSON ships as initial values for fresh installs and as a reference for what the defaults were.
- **Reload semantics.** Today `server/config/models.ts` does `readFileSync` at module load — values are cached forever. DB-backed config has to be read per request or cached with invalidation. Per-request is simpler and correct; caching can come later if it shows up in a profile.
- **Revert to defaults.** The admin needs a way to restore shipped defaults without editing JSON. Probably a "Reset to default" button per config entry.
- **Scope: install-wide, not per-user.** These are install-level settings (which model answers for everyone). Per-user preferences are a different epic.

## Radar

Directions this epic opens up, not stories yet:

- **Pricing rules and budgets.** Admin sees monthly cost per model, can set soft limits or alerts.
- **Feature flags.** Experimental behavior toggleable per install.
- **Environment-like settings.** Anything that today lives in `.env` or code constants and might need live tuning.
