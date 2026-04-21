[< CV0.E4 — Home & Navigation](../index.md)

# S7 — Last conversation per scope

Each organization and journey on the list pages gets a **Last conversation** card adjacent to it, showing the title + relative time of the most recent session the mirror tagged with that scope. The list surface stops being pure structure and starts carrying a trace of use.

**Layout:** one pair per row on narrow screens; two pairs per row on wide. The left card is the existing scope card (name, key, body); the right card is the conversation readout.

**Data source without schema change:** assistant messages already carry `_organization` and `_journey` keys in their JSON data (written by reception since CV1.E4.S1). A SQL window function (`ROW_NUMBER() OVER PARTITION BY`) returns the most recent entry per scope key; the session title and timestamp come along for the ride.

**Scope coverage:** Web turns stamp all three meta keys (`_persona`, `_organization`, `_journey`). Telegram and API currently stamp only `_persona` — so scope readouts reflect web usage for now. Once the other adapters carry the scope meta (future story), the same data path feeds them automatically.

- [Plan](plan.md) — scope, SQL approach, layout notes
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. `/organizations` renders a `Last conversation` card next to each active organization card. When no conversation has been tagged for that org, the card shows *"No conversations tagged yet"*.
2. `/journeys` renders the same pair-layout. Journey keys that appear as `_journey` on assistant messages get their most recent tagged session surfaced with title + relative time.
3. New `server/scope-sessions.ts` exports `getLatestOrganizationSessions(db, userId)` and `getLatestJourneySessions(db, userId)`, each returning `Map<string, LatestScopeSession>` keyed by scope key.
4. Reusable `ScopeRow` component lives in `organizations.tsx` (exported) and is imported by `journeys.tsx` — one component, both pages.
5. `npm test` passes (339, +2 new tests covering the tagged and untagged cases).
