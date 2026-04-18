[< CV0 — Foundation](../)

# CV0.E3 — Install Administration

The admin operates the install from the browser, not from the filesystem. Two complementary capabilities live here:

1. **Configure the install.** Install-level settings — models, adapters, and the family of settings that will accumulate alongside them — live in the DB with a small admin surface. Tuning happens without restarts and without editing JSON.
2. **Understand the install.** The project's documentation is navigable inside the app itself. The admin can read the roadmap, decisions, taxonomy, and story folders without switching to an external tool that loses the interconnections.

**Audience:** the person running the install. Distinct from the user lens that drives CV0.E2 (Web Experience) — same web adapter, different purpose.

**Framing:** config-as-code is great for setup and reproducibility; it's the wrong surface for day-to-day operation. Moving operational config to the DB keeps the code honest (defaults and seeds stay versioned) while giving the admin a live surface to experiment. The docs reader extends the same logic — the knowledge of *why* the install does what it does belongs next to the install itself, not in a separate tool.

## Stories

| Code | Story | Status |
|------|-------|--------|
| S1 | **Admin customizes models via the browser** | — |
| S2 | **Admin customizes adapters via the browser** | — |
| S3 | **I can read the mirror's documentation inside the mirror** | — |

S1 comes first because model tuning is the more frequent and higher-stakes operation (cost, quality, speed). S2 rides on the pattern S1 establishes. S3 is independent of S1/S2 — it can land in any order based on which frustration hits first, but it doesn't inherit their config-in-DB pattern (docs stay on disk; the mirror reads them, doesn't own them).

## Shared design concerns (not yet resolved)

### For S1 and S2 (config stories)

- **Seed vs. source of truth.** Does the JSON become install seed data only, or does it stay as a fallback? Leaning toward seed-only: the DB is the live source of truth; the JSON ships as initial values for fresh installs and as a reference for what the defaults were.
- **Reload semantics.** Today `server/config/models.ts` does `readFileSync` at module load — values are cached forever. DB-backed config has to be read per request or cached with invalidation. Per-request is simpler and correct; caching can come later if it shows up in a profile.
- **Revert to defaults.** The admin needs a way to restore shipped defaults without editing JSON. Probably a "Reset to default" button per config entry.
- **Scope: install-wide, not per-user.** These are install-level settings (which model answers for everyone). Per-user preferences are a different epic.

### For S3 (docs reader)

- **Runtime vs build-time rendering.** Reading `docs/` at request time keeps the reader always-current with the working tree, but requires the `docs/` folder to be present in the deployed install. Build-time rendering produces static assets that ship with the bundle but drift from the repo between releases. Leaning toward runtime — the docs reader is most useful *during* development, when changes are fresh.
- **Relative link rewriting.** Markdown files link to each other with paths like `../product/memory-taxonomy.md`. The renderer has to rewrite these to in-app routes (`/docs/product/memory-taxonomy`) so navigation stays inside the web client.
- **Assets.** Images, diagrams, and other referenced files need their own serving path. Simpler if the whole `docs/` tree is served as static files, with markdown files specifically intercepted and rendered.
- **Auth.** The docs are not secret, but they're not SEO-public either. Scope to logged-in users (any role). Public access can be a follow-up if it ever matters.
- **Deploy touches the filesystem.** S3 needs the `docs/` folder present in production. Worth confirming the deploy script ships it, or changing the script to.

## Radar

Directions this epic opens up, not stories yet:

- **Pricing rules and budgets.** Admin sees monthly cost per model, can set soft limits or alerts.
- **Feature flags.** Experimental behavior toggleable per install.
- **Environment-like settings.** Anything that today lives in `.env` or code constants and might need live tuning.
