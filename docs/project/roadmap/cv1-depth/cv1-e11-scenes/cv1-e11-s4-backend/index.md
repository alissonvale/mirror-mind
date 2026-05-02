[< CV1.E11](../)

# CV1.E11.S4 — Backend: scenes table + CRUD + sessions.scene_id + receptor cold-start

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

CV1.E11 inverts the surface so cenas are the primary entity, but the data layer has no concept of a cena. Sessions today carry response_mode, response_length, voice, and per-session scope (via `session_personas`/`session_organizations`/`session_journeys`) — every cena attribute lives as a per-session decision, configured fresh each time. There is no row that says *"this is a recurring conversation with this voice, this cast, this scope, this briefing."*

Without a backend slot for cenas, S1 (home cards), S7 (form), and the receptor cold-start suggestion all have nothing to read or write. S4 installs the data layer they need.

## Fix

Three additive deliverables, no destructive changes:

1. **`scenes` table** — id, user_id, key, title, temporal_pattern, briefing, voice, response_mode, response_length, organization_key, journey_key, status, timestamps. Plus `scene_personas` junction (a cena's cast).
2. **`sessions.scene_id`** — nullable FK that records which cena (if any) a session was started from. `ON DELETE SET NULL` so deleting a cena unscopes its conversations rather than destroying them.
3. **`findMatchingScene(db, userId, receptorOutput)` helper** — strict axis-based matching from the design's matrix. Returns `Scene | null`. Used by S1's cold-start suggestion card.

No UI, no routes, no streaming-pipeline wiring — that's S1/S7 territory. S4 stops at the data layer plus the match helper.

## Why now (and why this scope)

S4 is the only story whose absence blocks every other story in the epic. S1's cards need to list cenas, S7's form needs to write them, S6's onboarding seed needs to insert one, S3's Memória needs to count them, and the cold-start suggestion needs the match helper. Shipping S4 first is the natural foundation move.

The scope is intentionally narrow: data + match logic, no composition. The cena's `briefing` field is the heart of how a cena affects the LLM, but **wiring the briefing into the prompt** is S1's responsibility (it's the surface that knows when to apply a cena). S4 only exposes the data; S1 reads it and composes.

## What ships

### Schema (additive)

```sql
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,                     -- slug, unique per user
  title TEXT NOT NULL,                   -- the only required user-facing field
  temporal_pattern TEXT,                 -- free text ("qua 20h", "noites")
  briefing TEXT NOT NULL DEFAULT '',     -- the heart; LLM-bound text
  voice TEXT,                            -- 'alma' | NULL (NULL = persona-driven)
  response_mode TEXT,                    -- 'conversational'|'essayistic'|'oracular'|NULL
  response_length TEXT,                  -- 'brief'|'standard'|'full'|NULL
  organization_key TEXT,                 -- single org per cena (design)
  journey_key TEXT,                      -- single journey per cena (design)
  status TEXT NOT NULL DEFAULT 'active', -- 'active'|'archived'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE scene_personas (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  persona_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, persona_key)
);

ALTER TABLE sessions ADD COLUMN scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL;

CREATE INDEX idx_scenes_user ON scenes(user_id, status);
CREATE INDEX idx_sessions_scene ON sessions(scene_id);
```

**Single org/journey per cena** — both stored as nullable string columns (not junctions) per design. Asymmetric with personas (which are a cast) by design: scope is stable, cast is mutable.

**Voice mutual exclusion** — when `voice='alma'`, the cast (scene_personas) should be empty by convention. Helper `setScenePersonas` is forbidden when voice='alma' (throws). Setting `voice='alma'` clears `scene_personas` in the same transaction. This mirrors the runtime mutex on `sessions.voice` (CV1.E9.S6).

**`organization_key` / `journey_key` as keys (not FK ids)** — symmetric with how `session_organizations` / `session_journeys` work today. Keeps cena portable across renames and avoids cross-table coupling at the schema level. Lookup is `WHERE user_id=? AND key=?`.

### CRUD helpers (`server/db/scenes.ts`)

```ts
export interface Scene {
  id: string;
  user_id: string;
  key: string;
  title: string;
  temporal_pattern: string | null;
  briefing: string;
  voice: SceneVoice | null;            // 'alma' | null
  response_mode: ResponseMode | null;
  response_length: ResponseLength | null;
  organization_key: string | null;
  journey_key: string | null;
  status: SceneStatus;                  // 'active' | 'archived'
  created_at: number;
  updated_at: number;
}

createScene(db, userId, key, fields): Scene
getSceneById(db, sceneId, userId): Scene | undefined
getSceneByKey(db, userId, key): Scene | undefined
listScenesForUser(db, userId, opts?): Scene[]   // ordered by recent activity
updateScene(db, userId, key, fields): Scene | undefined
archiveScene(db, userId, key): boolean
unarchiveScene(db, userId, key): boolean
deleteScene(db, userId, key): boolean             // hard delete; sessions unscoped via FK
setScenePersonas(db, sceneId, personaKeys): void  // transactional rewrite
getScenePersonas(db, sceneId): string[]
```

Plus session-side helpers in `server/db/sessions.ts`:

```ts
getSessionScene(db, sessionId, userId): string | null
setSessionScene(db, sessionId, userId, sceneId | null): void
```

`listScenesForUser` orders by **most recent activity** — `MAX(sessions.created_at) WHERE scene_id=...`, falling back to `scenes.created_at` for cenas that have never been used. This matches the design's ordering rule for the home cards.

### Match logic (`server/scenes-match.ts`)

```ts
findMatchingScene(
  db: Database.Database,
  userId: string,
  receptor: ReceptionResult,
): Scene | null
```

Strict matrix from `scenes-home-design.md`:

| Case | Criterion |
|---|---|
| Alma cena | `receptor.is_self_moment === true` AND `scene.voice === 'alma'` |
| Persona cena | `receptor.personas[0] ∈ scene.cast` AND (`scene.organization_key === receptor.organization` OR both null) AND (`scene.journey_key === receptor.journey` OR both null) |
| Multiple matches | most-recent activity wins |
| No matches | returns `null` |

Trivial turns (`is_trivial: true`) never match — return `null` early. Trivial is the bottom of the weight spectrum; suggesting a cena on a "boa noite" would be noisy.

The Alma case takes precedence over the persona case. If both match (a cena with voice='alma' AND `is_self_moment=true` AND a persona cena that also matches the receptor's persona), Alma wins — the user's self-moment is the dominant signal.

### Re-exports

`server/db.ts` re-exports the new types and helpers so callers import from a single module (matches the established pattern).

## Tests

`tests/scenes.test.ts` (CRUD):
- Create / read / update / archive / unarchive / delete round-trip.
- Unique constraint on (user_id, key).
- Voice='alma' clears scene_personas in the same transaction; setScenePersonas throws when voice='alma'.
- Delete cascade through `scene_personas`; sessions become `scene_id=NULL` (SET NULL), not deleted.
- `listScenesForUser` ordering: cenas with recent activity rank above never-used cenas; never-used cenas tie-break by `created_at` desc.
- Ownership: helpers no-op for foreign user/scene combinations.

`tests/scenes-match.test.ts` (match matrix):
- Alma match: `is_self_moment=true` + alma cena exists → returns the cena.
- Persona match: `personas[0]` ∈ cast + matching org + matching journey → match.
- Persona match with both org/journey null → match.
- Persona miss when org diverges (cena has org, receptor has different org).
- Persona miss when persona pool doesn't include receptor's pick.
- Trivial turn → null regardless of other axes.
- Multiple matches → most-recent-activity wins.
- Alma wins over persona when both could match.
- Zero-cena tenant → null.

All tests use `:memory:` SQLite (no mocks), per [docs/design/principles.md](../../../../design/principles.md).

## Non-goals (parked)

- **Wiring `scene.briefing` into prompt composition** — S1's job (the surface that knows when a cena is applied owns the composer change).
- **`/cenas/...` HTTP routes** — S7's form sits on top of these helpers.
- **Cena card rendering / receptor cold-start UI** — S1.
- **Onboarding seed** — S6 will use `createScene` as a building block.
- **`is_draft` on personas/orgs/journeys for stub-first creation** — S7's responsibility (the form decides what "stub" means).
- **Scene versioning / edit history** — out of scope; cena edits overwrite.
- **Cross-user cena sharing** — out of scope; cenas are user-scoped.

## Risks

- **Single org/journey constraint feels tight.** Design locked single-cardinality; if real use surfaces multi-org cenas, S4b adds junctions. Schema is forward-compatible (drop the columns, add junction tables).
- **`SET NULL` cascade leaves orphan-feeling sessions.** A session with `scene_id=NULL` after its cena is deleted looks identical to a session that started unscoped. Acceptable trade — the design says delete is a power-user action with consequences surfaced in the UI.
- **Match helper assumes `receptor.personas[0]` is the leading lens.** Already the convention (CV1.E7.S5). If multi-persona logic changes how the leader is picked, the match helper needs to follow.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Story docs** | `docs/.../cv1-e11-s4-backend/{index,plan,test-guide}.md`; update `cv1-depth/index.md` to link the new epic. | Reading by user. |
| 2 | **Schema** | `server/db.ts` (SCHEMA + migrate ALTER for `sessions.scene_id`). | `npm test` (existing suite passes; no regressions). |
| 3 | **CRUD helpers** | New `server/db/scenes.ts`; extend `server/db/sessions.ts` with `getSessionScene`/`setSessionScene`; re-exports in `db.ts`. | New `tests/scenes.test.ts` green; full suite green. |
| 4 | **Match logic** | New `server/scenes-match.ts`. | New `tests/scenes-match.test.ts` green; full suite green. |
| 5 | **Wrap-up** | `worklog.md`, `decisions.md`, story status badges. | Manual smoke from [test-guide](test-guide.md); commit per phase. |

## Docs

- [Plan](plan.md) — phase-by-phase implementation
- [Test guide](test-guide.md) — manual smoke procedure
- [Epic — CV1.E11](../) — scope and surrounding stories
- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md) — locked decisions
