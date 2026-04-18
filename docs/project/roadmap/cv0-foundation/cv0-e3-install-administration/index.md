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
| [S3](cv0-e3-s3-docs-reader/index.md) | **I can read the mirror's documentation inside the mirror** | ✅ Done |

S3 shipped first. S1 comes next (model tuning is the more frequent and higher-stakes config operation — cost, quality, speed). S2 rides on the pattern S1 establishes.

## Shared design concerns (not yet resolved)

### For S1 and S2 (config stories)

- **Seed vs. source of truth.** Does the JSON become install seed data only, or does it stay as a fallback? Leaning toward seed-only: the DB is the live source of truth; the JSON ships as initial values for fresh installs and as a reference for what the defaults were.
- **Reload semantics.** Today `server/config/models.ts` does `readFileSync` at module load — values are cached forever. DB-backed config has to be read per request or cached with invalidation. Per-request is simpler and correct; caching can come later if it shows up in a profile.
- **Revert to defaults.** The admin needs a way to restore shipped defaults without editing JSON. Probably a "Reset to default" button per config entry.
- **Scope: install-wide, not per-user.** These are install-level settings (which model answers for everyone). Per-user preferences are a different epic.

### Resolved during S3

- **Runtime rendering** — confirmed. `marked` parses markdown on each request; no build step.
- **Relative link rewriting** — all internal doc links (`.md`, directories, root-relative under `/docs`) are rewritten to in-app routes by a custom marked renderer. Folder-index URLs compute their resolution base from the resolved file, not the URL.
- **Assets** — static serve under `/docs/static/`. The docs folder currently has no assets; the path is ready when they arrive.
- **Auth — admin-only.** Shifted from "logged-in users, any role" during design review: today's `docs/` is project-internal (roadmap, decisions, specs). Showing it to regular users would be a distraction. A product-level user manual is a separate future story (radar).
- **Deploy** — the `docs/` folder ships with the repo; existing deploy process already copies it.

## Radar

Directions this epic opens up, not stories yet:

- **Pricing rules and budgets.** Admin sees monthly cost per model, can set soft limits or alerts.
- **Feature flags.** Experimental behavior toggleable per install.
- **Environment-like settings.** Anything that today lives in `.env` or code constants and might need live tuning.
- **User manual surface for regular users.** A separate route, distinct voice — what the mirror is for end users, not for admins operating it. Different audience, different content; doesn't belong in `/docs` (which is project-internal).
- **Syntax highlighting in the docs reader.** Add `highlight.js` or `shiki` when code-heavy pages become a pain point.
- **Docs search.** Full-text or semantic. Register as a story if the frustration surfaces.
