[< CV1.E7](../)

# CV1.E7.S3 — Conditional scope activation

**Status:** ✅ Done (2026-04-25)

## Problem

Until S3, the composer carried two parallel paths for scope content. When the session had no scope tags, it rendered reception's single pick. When the session had tags of a type, it rendered **all** of them on every turn — a "tag = always present in prompt" semantics inherited from CV1.E4.S4 (manual session scope tagging), pre-dating reception's multi-axis routing.

The asymmetry surfaced once v0.13.0 populated sessions with multiple stable scopes pinned per conversation. A small-talk turn on a session tagged with org `software-zen` and journey `vida-economica` carried both full briefing+situation blocks into every system prompt — regardless of whether the message had anything to do with either. The composer was loud where reception had been deliberately quiet.

The user-facing inconsistency: the conversation header pill (session-level) said *"this conversation is in this scope"* and the bubble badge (per-turn) said *"reception didn't activate the scope here"* — and yet the prompt still carried the scope. Two surfaces disagreed about a third surface (the prompt itself).

## Fix

Reception is the **single source of truth** for which scope content composes. Session tags continue to express *"this conversation operates within this context"* and constrain reception's candidate pool — but they do not force composition. A pinned scope absent from this turn's pick produces no prompt block.

```
session tags → reception's candidate pool (constraint)
                      │
                      ▼
            reception picks at most one org
            and at most one journey per turn
                      │
                      ▼
            composer renders only what was picked
```

The two-axis pattern (org + journey when journey belongs to org) and the sole-scope-in-domain rule continue to hold — they were always reception's job, not the composer's.

## What shipped

- **`server/identity.ts`** — `ComposeScopes.sessionTags` removed from the interface. The `tags && tags.organizationKeys.length > 0` branch in scope rendering deleted; `orgKeys` and `journeyKeys` derive only from `scopes.organization` / `scopes.journey`. `SessionTags` import dropped. Docblock updated to document conditional scope activation.
- **`adapters/web/index.tsx`** — the web stream call site stopped passing `sessionTags` to `composeSystemPrompt`. Tags are still loaded and used for reception's pool constraint and for first-turn auto-seeding; only the composer call no longer reads them.
- **`tests/identity.test.ts`** — the 5-test "session tag pool (CV1.E4.S4)" describe block deleted (defunct semantics). A 4-test "conditional scope activation (CV1.E7.S3)" describe block added pinning the new contract: reception's pick wins, null-pick = no block, undefined-scopes = no block, the org+journey pair pattern.

## Tests

639 passing (was 640 at S5 close; net -1: 5 pre-S3 tests deleted, 4 new S3 tests added).

## Non-goals (parked)

- **Plural shape for reception** (`organizations: string[]`, `journeys: string[]`). The sole-scope-in-domain rule and the journey-plus-parent-org pair cover today's practical cases. Open S3b only when real use surfaces a turn that genuinely needs two orgs simultaneously.
- **"Force include this scope" override.** Out of scope; open a story if the dor surfaces.
- **Differentiating active vs inactive pill in the header.** The pill stays as the session-level indicator; per-turn signal lives in the bubble.

## Docs

- [Plan](plan.md) — design before code, the alternatives considered
- [Test guide](test-guide.md) — manual roteiro
- [decisions.md — Conditional scope activation](../../../decisions.md#2026-04-25--conditional-scope-activation-reception-is-the-source-of-truth-cv1e7s3)
- [prompt-composition](../../../../product/prompt-composition/) — updated; the pre-S3 caveat is gone

## Manual smoke close-out (2026-04-26)

The full Dan Reilly walkthrough (4 tests + reload check) ran clean against the patched build. S3's contract held everywhere: organizations and journeys composed only when reception activated them; the canonical Test 4 (Stanley plane question on a session pinned to `reilly-homelab` + `vmware-to-proxmox`) confirmed scope blocks correctly absent — pre-S3, both briefings would have leaked into a turn with no semantic relation.

Six refinements surfaced and shipped during the smoke, each a small drift that S3's tightening exposed:

- [**ego.expression in composed snapshot**](../../../improvements/) (commit `696cc34`) — the rail's "Look inside" was listing every `self.*` and `ego.*` row from the DB, including `ego.expression` which CV1.E7.S1 had moved to the post-generation pass. Snapshot was telling a different truth than the composer.
- [**Scope-pill hot-update + journey icon**](../../../improvements/scope-pill-hot-update/) (commit `edc0b63`) — the SSE routing handler had `ensureCastAvatar` for personas but no symmetric `ensureScopePill` for org/journey. Pills appeared only after a page reload. Same commit aligned the journey icon to `↝` across all surfaces (was `≡` in the header alone).
- [**Auto-seed per-axis, two passes**](../../../improvements/auto-seed-per-axis/) (commits `a7bf234`, `663c99a`) — the first-turn auto-seed gate read all three axes at once (`hasAnyTag`), so pinning the org axis suppressed the persona axis seed. Pass 1 split per-axis. Pass 2 relaxed personas further: the cast can grow on any turn while its pool is empty, matching the cast-vs-scope mutability asymmetry.
- [**Test guide expanded with worked walkthrough for Dan**](test-guide.md) (commit `ea3279a`) — the four-character narrative section had been compact tables; surfaced as confusing during the smoke. Dan now has a 20-step numbered walkthrough; Elena/Eli/Nora inherit the procedure as compact substitutions.
- [**Bubble metadata legibility**](../../../improvements/bubble-metadata-legibility/) (commits `e571770`, `74851d4`, `272c2d1`) — three iterations on the bubble. Org icon `◈` → `⌂` to break the visual collision with `◇` (persona). Mode glyph added at left of bubble text via CSS pseudo-element. Conversational mode landed silent (after iterating through 🗨 and “) — presence of a glyph now signals reception escalated above default. Implements CV1.E7.S9 phase 1 (stamp `_mode` + `_mode_source`; bubble glyph). Phase 2 (Look inside snapshot field) parked.

### Empirical evidence for CV1.E7.S8

Test 4 (Stanley plane question on a session whose persona pool was constrained to `[engineer]`) surfaced exactly the friction that [CV1.E7.S8](../) is parked to address. SQL meta confirmed reception activated `engineer` for the woodwork question — not because engineer covers the domain, but because engineer was the only candidate the pool allowed and reception's "minimum sufficient set" rule slid into "best available approximation" under that constraint.

Outcome: a Stanley plane comparison answer rendered through the engineer lens, when `maker` (or whichever persona genuinely covers woodwork in Dan's inventory) would have been the right voice. The cast didn't grow because pool-as-constraint forbids it; the user got a competent-but-misframed answer; no signal in the UI suggested an alternative was available.

This is the canonical S8 use case. When S8 enters design, the test of acceptance is *"does Test 4 from this S3 walkthrough generate a `maker` suggestion in the rail?"*. Empirical fixture for the future implementation.

### Calibration consideration (deferred)

Reception's "minimum sufficient set" prompt rule produced a pool-stretching pick (engineer for woodwork) under constrained pool. A possible refinement: tighten the prompt so that *"if no persona in the pool genuinely covers the domain (not a stretch), return an empty array rather than picking the closest approximation."* Notable only because the symptom is masked outside the cast-pool-constraint scenario — once S8 ships and out-of-pool candidates surface naturally, the stretch picks become unnecessary. Calibration parked under S8's design phase rather than as a separate story.
