[< Story](index.md)

# CV1.E4.S4 — Manual session scope tagging

## Context

Reception is the cognitive router — it picks which persona, organization, and journey apply to each turn. It works well most of the time but cannot be guaranteed. When the user thinks *"this whole conversation is about Software Zen and the vida-econômica travessia"*, the current model can't express that as a durable property of the session — each turn's context is rediscovered from scratch. If reception misroutes, the user has no way to correct without mysterious prompt engineering.

This story makes the **pool of contexts** explicit at the session level. Session tags act as:

1. A **filter** on reception's candidates — the model can't pick outside the pool
2. A **composition hint** — the prompt injects all tagged orgs and journeys, not just reception's one pick
3. A **user override** — even if reception's own pick disagrees, the tag set is the source of truth

The mirror stops depending on a perfect router and starts letting the user curate.

## Semantic split

Persona and scope tags mean different things:

- **Persona = voice.** One per turn even when tagged. Tagging persona narrows the pool reception can pick from. The mirror still speaks with one voice per reply.
- **Scope (org/journey) = context.** Multiple scopes can be active at once. The prompt injects briefing + situation for every tagged scope, broader before narrower.

## Schema

Three junction tables, each with composite PK and FK to `sessions(id)`:

```sql
CREATE TABLE session_personas (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  persona_key TEXT NOT NULL,
  PRIMARY KEY (session_id, persona_key)
);

CREATE TABLE session_organizations (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  organization_key TEXT NOT NULL,
  PRIMARY KEY (session_id, organization_key)
);

CREATE TABLE session_journeys (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  journey_key TEXT NOT NULL,
  PRIMARY KEY (session_id, journey_key)
);
```

All three reference scopes by **key**, not ID. Reception already returns keys; scope tables are addressed by key everywhere the user can see them. Trade-off: if a scope key is renamed (rare), the tag goes dormant. Acceptable — keys are stable in practice and the schema simplifies. A future migration can rewrite to IDs if needed.

## Helpers

`server/db/session-tags.ts`:

- `getSessionTags(db, sessionId)` → `{personaKeys, organizationKeys, journeyKeys}`
- `addSessionPersona(db, sessionId, key)` (idempotent via INSERT OR IGNORE)
- `removeSessionPersona(db, sessionId, key)` (no-op when missing)
- Same for `*Organization` and `*Journey`
- `clearSessionTags(db, sessionId)` wipes all three tables for the session

`forgetSession` cascades to all three junction tables.

## Reception behaviour (`server/reception.ts`)

`ReceptionContext` gains a `sessionTags?: SessionTags` field. Inside `receive()`:

- If `context.sessionTags` is present and `personaKeys.length > 0`, filter `personas` to that set.
- Same for `organizationKeys` → `orgs`, `journeyKeys` → `journeys`.
- Empty lists of a type are ignored (reception considers all of that type).

The filter happens *before* the prompt is built, so the LLM never sees candidates it shouldn't pick. Reception's existing validation layer (post-parse) rejects any LLM choice that isn't in the filtered pool — belt-and-suspenders.

## Composer behaviour (`server/identity.ts`)

`ComposeScopes` gains a `sessionTags?: SessionTags` field. The composer rules per scope type:

- **Organizations:** if `sessionTags.organizationKeys.length > 0`, render ALL tagged orgs (broader → narrower order inside the org cluster). Else fall back to `scopes.organization` (reception's single pick).
- **Journeys:** same rule, applied to journeys.
- **Personas:** still singular — composer uses `personaKey` (reception's pick). Persona tags narrow reception's pool but don't get multi-composed.

The fall-back path keeps other adapters (Telegram, API) working unchanged — they pass reception's pick without a `sessionTags` object, and the composer renders exactly one org + one journey as before.

## First-turn suggestion (`/conversation/stream`)

Before calling reception, the handler:

1. Loads `sessionTags` for the current session
2. Counts existing entries to detect `isFirstTurn`
3. Runs reception with `sessionTags` in context
4. **If** `isFirstTurn` AND the session has zero tags across all three types, writes reception's non-null picks into the session tag tables. The next turn already operates within the newly-seeded pool.
5. Reloads `sessionTags` (they may have just been written) before composing the prompt.

This honors the "sugeridas" choice: new sessions don't force the user to configure anything, the mirror proposes a starting pool, and the user can adjust from turn 2 onward.

## UI on the Context Rail

New section **Scope of this conversation**, placed between the Persona block and the Session stats block. Three groups inside — Personas, Organizations, Journeys — each with:

- Tagged keys as pills (chip with the display name + `×` submit button)
- A dropdown below containing the remaining candidates + a `+` button to add

Both operations redirect back to `/conversation` so the rail re-renders with the new pool.

A small note at the bottom clarifies the asymmetry: *"Personas: reception picks one per turn from the pool. Orgs and journeys: all tagged scopes enter the prompt."*

## Endpoints

Two endpoints, both take `type` and `key` form fields:

- `POST /conversation/tag` → dispatches to `addSession{Persona|Organization|Journey}`
- `POST /conversation/untag` → dispatches to `removeSession{Persona|Organization|Journey}`

Unknown `type` → 400. Missing `key` → no-op + redirect (prevents the placeholder `"Add persona…"` option from submitting).

## Files

**New**
- `server/db/session-tags.ts`
- `tests/session-tags.test.ts`
- Story folder: `docs/project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s4-manual-scope-tagging/{index,plan,test-guide}.md`

**Modified**
- `server/db.ts` — schema (3 junction tables) + re-exports
- `server/db/sessions.ts` — `forgetSession` cascade
- `server/reception.ts` — `ReceptionContext.sessionTags` + filter
- `server/identity.ts` — `ComposeScopes.sessionTags` + multi-scope render
- `adapters/web/index.tsx` — `/conversation/stream` wires sessionTags through reception + composer + first-turn suggestion; two new endpoints; `buildRailState` populates `tags`
- `adapters/web/pages/context-rail.tsx` — `RailState.tags`, new `Scope of this conversation` section, `ScopeTagGroup` component
- `adapters/web/public/style.css` — `.rail-scope-tags*` classes
- `tests/reception.test.ts`, `tests/identity.test.ts`, `tests/web.test.ts` — 14 new tests

## Non-goals (explicitly parked)

- **Per-turn persona override.** The rail's current-turn affordance still shows reception's pick. A user wanting a specific persona just this turn has no bypass — they'd need to adjust the pool to force it. Future story if the need becomes acute.
- **Tag Telegram / API turns.** Reception from those adapters doesn't currently receive session tags (no UI for the user to set them). Their behaviour is unchanged. When a tagging UI arrives on those adapters, the same reception path picks it up automatically.
- **Recompute S7 (last conversation per scope) from the junctions.** S7 scans `_organization`/`_journey` meta on assistant messages. Both signals exist — the meta from reception, the tags from this story. S7 could migrate, but not in this story.
- **Backfill existing sessions** with reception's past picks. New sessions start clean; old sessions stay tagless until the user tags them (or the first turn of a new one auto-populates).

## Verification

- `npm test` passes (target: 362).
- Manual:
  - Fresh session, `/conversation`. Rail shows empty "Scope of this conversation" groups.
  - Send first message. Rail reflects reception's picks as tags — the pool now has 1 persona + optional org + optional journey (whatever reception picked).
  - Add/remove tags via the pill `×` or dropdown `+`. Page reloads, rail reflects the new pool.
  - Send next message. Reception constrained to the tagged persona; composer injects all tagged orgs/journeys.
  - Click Begin again. New session; tags empty again; first-turn suggestion restarts.
