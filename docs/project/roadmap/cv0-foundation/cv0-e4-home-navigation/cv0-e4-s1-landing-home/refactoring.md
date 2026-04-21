[< Story](index.md)

# Refactoring — CV0.E4.S1

Review pass observations. Two buckets: **applied** (commits that landed) and **parked** (observations left alone, with a criterion for revisiting).

---

## Applied

### `formatRelativeTime` extracted from `adapters/web/index.tsx`

Before this story, the helper lived inline at `adapters/web/index.tsx:266`, used only by the Map's session-stats card. The Continue band on the home needs the same humanized relative time. Extracted to `server/formatters/relative-time.ts` so both call sites share one implementation.

**Why:** two places now render the same kind of timestamp; the original was a private closure with no reason to stay private.

### `computeBurnRate` extracted from `adapters/web/index.tsx`

Same shape as above — the function lived as a closure inside `setupWeb()` because only `/admin/budget` consumed it. The admin State band on the home reuses the 7-day rolling average. Extracted to `server/billing/burn-rate.ts`; now takes `db` as an explicit parameter (previously captured via closure).

**Why:** cross-surface reuse + testable signature.

### `gray-matter` as the single frontmatter reader

Added as a dependency for `getLatestRelease` in `server/admin-stats.ts`, and reused in `server/docs.ts :: renderMarkdown` to strip frontmatter before handing markdown to `marked`. Without the second change, the `---\n...\n---` block would render as a horizontal rule + literal text on the `/docs/releases/*` pages.

**Why:** one parser, two surfaces that both need to understand frontmatter.

### `getLatestRelease(releasesDir?)` accepts an override

The production call never passes anything — it still reads from `docs/releases/` under `process.cwd()`. The optional parameter lets the unit tests point at a temp directory with fixture files instead of mocking `fs` or coupling to the production docs.

**Why:** minimal test seam, no behavior change for production.

### HomePage admin data gated behind a single role check

The first draft fetched `getUserStats`, `getKeyInfo`, and `computeBurnRate` unconditionally and let the template branch on `adminState`. The shipped version branches on `user.role === "admin"` in the route handler, so non-admin requests skip the billing API call and the DB reads entirely.

**Why:** correct shape (no cost for non-admins), and easier to reason about when auditing what a regular user's request does.

---

## Evaluated but not done

### A unified `home-band` component wrapping each section

Considered while writing the JSX: each band repeats `<section class="home-band"><header class="home-band-header"><h2>...` — a 3-line preamble per band. A `<Band title="...">{children}</Band>` abstraction would reduce the repetition to one line per band.

Left alone in v1. Three bands is not enough repetition to earn the abstraction, and the shape will change in S2 (sidebar pruning may turn some bands into collapsible sections). **Revisit when:** either a fourth band lands, or the per-band shape diverges and the abstraction becomes a constraint rather than a DRY win.

### Digest authoring convention in a contributor doc

The plan noted this as "out of scope." Today the rule lives only in this story and implicitly in the 11 example frontmatters. A future contributor shipping a release has no pointer to "write a digest, keep it to two sentences, first-person mirror voice." **Revisit when:** a second person ships a release, or when the digest quality drifts.

### Per-user timezone for the greeting

The greeting uses server local time. For a single-user / family-scale mirror, this is fine. For a mirror with users scattered across timezones, the server's evening might be the user's morning. **Revisit when:** the mirror has users in more than one timezone, or a user explicitly asks.

### "Continue" clickable earlier threads

Parked per the plan — depends on **CV1.E6.S3** (Memory Map → episodic browse) landing. Until that exists, the list is a teaser showing that the mirror accumulates, not a navigation affordance.

### Active-link highlighting in the sidebar

The sidebar shows no visual cue for the current page. Adding `/` with its own "Home" link makes the absence more noticeable than before. Deferred to **CV0.E4.S2** (sidebar pruning) — the right time to address highlighting is when the sidebar shape is being decided anyway.

### Collapsible admin State band

The band takes one row today. If more items accrue (release train status, queue depth, DB health, etc.), it will warrant a collapse toggle with a preference persisted per admin — same pattern as the Context Rail. **Revisit when:** a fourth item lands in the band.
