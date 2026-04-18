[< CV0 — Foundation](../)

# CV0.E3 — Admin Workspace

The admin sees the state of this mirror and operates it from the browser. A dashboard summarizes system-wide state at a glance; deeper surfaces let the admin configure, manage, and understand. Symmetric with the Cognitive Map — the map lets the mirror show itself to the user; the workspace lets this mirror show itself to the admin.

**Audience:** the person running this mirror. Distinct from the user lens that drives CV0.E2 (Web Experience) — same web adapter, different purpose.

**Two functions on the same workspace:**

1. **Seeing** — a dashboard at `/admin` with cards showing users, cost, activity, latest release, mirror memory, system health. Glance first, drill in when needed.
2. **Acting** — operations that change this mirror: user management (create, delete, role toggle), model config, adapter config, and the docs reader as a read-only complement.

**Framing:** config-as-code is great for setup and reproducibility; it's the wrong surface for day-to-day operation. Moving operational config to the DB keeps the code honest (defaults and seeds stay versioned) while giving the admin a live surface to see + act. The dashboard extends this by closing the feedback loop — you can't tune models you can't see the cost of.

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S3](cv0-e3-s3-docs-reader/index.md) | **I can read the mirror's documentation inside the mirror** | ✅ Done |
| [S4](cv0-e3-s4-admin-dashboard/index.md) | **Admin landing dashboard** — cards summarizing this mirror's state | ✅ Done |
| [S5](cv0-e3-s5-user-management/index.md) | **User management with delete and role toggle** | ✅ Done |
| [S1](cv0-e3-s1-admin-models/index.md) | **Admin customizes models via the browser** | ✅ Done |
| S2 | **Admin customizes adapters via the browser** | queued |

**Ordering rationale:**

- **S3 shipped first** because frustration with reading docs in external tools was concrete and cheap to fix.
- **S4 dashboard next** because it creates the anchor surface everything else hangs off — and its cost card contextualizes the model tuning in S1.
- **S5 user-delete** absorbs pain the admin feels today (no way to remove created users).
- **S1 models** rides on the cost visibility S4 introduces.
- **S2 adapters** rides on the pattern S1 establishes.

## Shared design concerns

### For S1 and S2 (config stories)

- **Seed vs. source of truth.** JSON becomes seed data only; DB is the live source of truth. JSON ships as initial values for fresh installs and as a reference for defaults.
- **Reload semantics.** Read per request in v1. Caching comes later if it shows up in a profile.
- **Revert to defaults.** A "Reset to default" button per config entry restores shipped values without editing JSON.
- **Scope: mirror-wide, not per-user.** Per-user preferences are a different epic.

### For S4 (dashboard)

- **Cost numbers are approximate in v1.** Aggregated from the same message-length estimation the Context Rail already uses. Real per-request usage tracking is deferred to a radar story (S6) that also handles operational alerts.
- **Drill-down pattern.** Each card is a glance + an optional link to a dedicated surface (users page, release notes, future cost-detail page).
- **No auto-refresh.** Dashboard is server-rendered; reloads are manual. Real-time comes if the need proves itself.

### For S5 (user management)

- **Delete is cascade.** Sessions, entries, identity layers all go. No soft-delete, no recovery.
- **Admin can't delete itself.** Safety guard; the admin row of the currently-logged-in user is not removable.
- **Role toggle.** A single admin ↔ user toggle on the user row. Can't demote yourself for the same safety reason as delete.
- **Confirmation.** Native `confirm()` for delete; role toggle is inline and reversible without ceremony.

### Resolved during S3 (docs reader)

- Runtime rendering via `marked`.
- Relative link rewriting for all internal doc links.
- Folder-index base resolution via `urlDirForResolvedFile`.
- Admin-only access — docs are project-internal content.
- Static assets under `/docs/static/`.

## Radar

Directions this epic opens up, not stories yet:

- **S6 — Operational alerts + usage tracking.** Per-request `usage_log` table (user, model, input tokens, output tokens, cost) populated on each LLM call; powers accurate cost numbers in the dashboard and surfaces silent failures (title generation timeouts, reception fallbacks, LLM 429s).
- **S7 — Export / Snapshot.** Admin downloads the DB; a user exports their own memory.
- **Pricing rules and budgets.** Admin sees monthly cost per model, can set soft limits or alerts (builds on S6).
- **Feature flags.** Experimental behavior toggleable per mirror.
- **Environment-like settings.** Anything that today lives in `.env` or code constants and might need live tuning.
- **User manual surface for regular users.** A separate route, distinct voice — the end-user counterpart to the admin-facing docs.
- **Syntax highlighting in the docs reader.** Add `highlight.js` or `shiki` when code-heavy pages become a pain point.
- **Docs search.** Full-text or semantic. Register as a story if the frustration surfaces.
- **Admin audit log.** Who changed what, when. Natural once there are multiple admins per mirror.
