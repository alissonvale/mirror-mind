[< CV1.E13](../)

# CV1.E13.S2 — Organization portrait

**Status:** ✅ Done (2026-05-04). Shipped in one round; ~80% of the engine reused from S1.

> Editorial design source: [`docs/design/entity-profiles.md`](../../../../../design/entity-profiles.md).
> Reference draft: Pages Inteiras (Antonio Castro) — see `tests/organization-portrait.test.ts`.

## What changed vs S1

Orgs are *places that host*, not stories unfolding. Three named differences from the journey portrait:

1. **Lede heuristic flips to situation-first.** Org briefings tend to be identity manifestos ("Pages Inteiras é minha casa editorial..."); situation carries the diagnostic of what's alive right now. The picker pulls situation's first paragraph and optionally appends a short briefing-end punchline when both fit on a comfortable two-line read.

2. **"Quem passa por aqui" replaces "Onde ela mora".** The dominant relationship of an org is the journeys nested inside it (1:N via `journey.organization_id`). Section renders a compact list of nested journeys with status + recency, plus the most-frequent persona and anchored scene below.

3. **Accent flips to warm-amber.** `--portrait-accent: #b8956a` (the Sou-pane palette from `/espelho`), scoped via `[data-entity="organization"]` so journey portraits keep their teal even when both styles cohabit a build.

## What reuses

`adapters/web/pages/portrait-shared.tsx` — extracted from S1's `journey-portrait.tsx` — exports `<PortraitLede>`, `<NumericTilesRow>`, `<ConversationsSection>`, `<PortraitClose>`, `<PortraitFooter>`, `editPathFor`, and the `PORTRAIT_STYLES` constant. Both journey and org pages render through the same module.

`server/portraits/cache.ts` (the `entity_profile_cache` table + `getOrGenerate`) and `server/portraits/conversation-citable-line.ts` (the LLM extractor) reused unchanged. Org portrait fires its own `warmOrganizationPortraitCache` from the route handler — same fire-and-forget pattern.

`detectStructuralSection` (S1) reused. **Relaxed during S2** to accept both bold (`**A primeira é X.**`) and plain (`A primeira é uma queda...`) front markers via paragraph-based parsing. Pages Inteiras's situation activates as fronts; Pós-Lançamento (which uses bold) still works.

## Width fix shipped alongside

Portrait shells were 640px outer; system standard is 980px (workshops, lists, /espelho). All portraits now: 980px outer with 720px inner reading column for prose blocks. Lede font bumped from 1.1rem to 1.15rem to balance the wider line lengths.

## Tests

`tests/organization-portrait.test.ts` (9 tests):

- `composeOrgLede`: situation-first priority, briefing punchline appended when fits, fallback to briefing when situation empty, null when both empty.
- `composeOrganizationPortrait` integration with DB: nested journeys + adjacencies populate when present; parenthetical declares all three absences when org is fresh; nested-journeys count tile emits.
- Reference draft (Pages Inteiras): lede source = situation, structural detector returns 3 frentes (validates the relaxed regex).

8 existing CV1.E4.S5 workshop tests updated to hit `/organizations/:key/edit` (URL migration).

Suite: 1160/1160 (was 1151).

## Visual smoke pending

Reading the rendered Pages Inteiras / Lagoa Letras pages on a provisioned tenant remains the editorial validation. The structural reproduction is covered by tests.
