[< Story](index.md)

# Plan — CV1.E11.S4 Backend

## Premise

Five phases. Each phase ends with `npm test` green and a commit. P1 is docs only (this folder). P2 adds schema. P3 adds CRUD. P4 adds match logic. P5 closes the story (worklog, decisions, badges).

## Phase 1 — Story docs

**Files:**
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/index.md` (new — opens the epic)
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/cv1-e11-s4-backend/{index,plan,test-guide}.md` (new — this story)
- `docs/project/roadmap/cv1-depth/index.md` (edit — turn the CV1.E11 entry into a real link)

**Validation:** Alisson reads index.md and plan.md, confirms the scope.

**Commit:** `docs(cv1-e11): open epic and CV1.E11.S4 story docs`

## Phase 2 — Schema

**File:** `server/db.ts`

**SCHEMA additions** (inside the SCHEMA template literal, alphabetical between existing tables):

```sql
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  temporal_pattern TEXT,
  briefing TEXT NOT NULL DEFAULT '',
  voice TEXT,
  response_mode TEXT,
  response_length TEXT,
  organization_key TEXT,
  journey_key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS scene_personas (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  persona_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, persona_key)
);

CREATE INDEX IF NOT EXISTS idx_scenes_user ON scenes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_scene ON sessions(scene_id);
```

**Migration** (inside the existing `migrate()` function, after the existing `sessions.voice` block):

```ts
// sessions.scene_id added in CV1.E11.S4 — links a session to the cena
// it was started from (NULL when the session was started unscoped from
// the free input). ON DELETE SET NULL: deleting a cena unscopes its
// conversations rather than destroying them. Existing rows stay NULL.
if (!sessionCols.some((c) => c.name === "scene_id")) {
  db.exec("ALTER TABLE sessions ADD COLUMN scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL");
}
```

**Note on FK behavior:** SQLite needs `PRAGMA foreign_keys = ON` to enforce `ON DELETE SET NULL`. The codebase doesn't currently enable foreign_keys (the existing `session_personas` etc. are cleaned up explicitly in `forgetSession`). For S4, we'll match the established pattern — `deleteScene` will explicitly UPDATE `sessions SET scene_id = NULL WHERE scene_id = ?` and DELETE from `scene_personas`, rather than relying on the engine. The FK declaration documents intent but isn't load-bearing.

**Validation:**
- `npm test` — all 909+ existing tests pass.
- New DB on first boot: `scenes`/`scene_personas` tables exist; `sessions.scene_id` column exists.
- Existing DB on upgrade: ALTER fires once, idempotent on re-boot.

**Commit:** `feat(scenes): add scenes / scene_personas tables + sessions.scene_id`

## Phase 3 — CRUD helpers

**New file:** `server/db/scenes.ts`

**Module shape:**

```ts
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  isResponseMode,
  isResponseLength,
  type ResponseMode,
  type ResponseLength,
} from "../expression.js";

export type SceneVoice = "alma";
export type SceneStatus = "active" | "archived";

export function isSceneVoice(value: unknown): value is SceneVoice {
  return value === "alma";
}

export interface Scene { /* see index.md */ }

export interface SceneFields {
  title?: string;
  temporal_pattern?: string | null;
  briefing?: string;
  voice?: SceneVoice | null;
  response_mode?: ResponseMode | null;
  response_length?: ResponseLength | null;
  organization_key?: string | null;
  journey_key?: string | null;
}

export function createScene(
  db: Database.Database,
  userId: string,
  key: string,
  fields: SceneFields & { title: string },   // title required at create
): Scene { ... }

export function getSceneById(db, sceneId, userId): Scene | undefined
export function getSceneByKey(db, userId, key): Scene | undefined

export interface ListScenesOptions {
  status?: SceneStatus;       // default: 'active'
}

export function listScenesForUser(db, userId, opts?: ListScenesOptions): Scene[]
// SQL: SELECT s.*, COALESCE(MAX(sess.created_at), s.created_at) as last_activity
//      FROM scenes s LEFT JOIN sessions sess ON sess.scene_id = s.id
//      WHERE s.user_id = ? AND s.status = ?
//      GROUP BY s.id
//      ORDER BY last_activity DESC

export function updateScene(db, userId, key, fields: SceneFields): Scene | undefined
export function archiveScene(db, userId, key): boolean
export function unarchiveScene(db, userId, key): boolean
export function deleteScene(db, userId, key): boolean
// Transactional: UPDATE sessions SET scene_id=NULL → DELETE scene_personas
// → DELETE scene. Ownership-checked.

export function setScenePersonas(
  db: Database.Database,
  sceneId: string,
  personaKeys: string[],
): void
// Forbidden when scene.voice='alma' — throws Error('Cannot set personas on
// an Alma cena'). Transactional rewrite: DELETE existing rows for sceneId,
// INSERT new rows with sort_order = index.

export function getScenePersonas(db, sceneId): string[]
// ORDER BY sort_order ASC
```

**Voice mutex implementation:**

In `updateScene` and `createScene`, when `voice` is being set to `'alma'`, the helper executes a transaction that updates the row AND deletes any existing `scene_personas` rows for that scene. Symmetric with `setSessionVoice` (see `server/db/sessions.ts:255-280`).

**Extension to `server/db/sessions.ts`:**

```ts
export function getSessionScene(
  db: Database.Database,
  sessionId: string,
  userId: string,
): string | null {
  const row = db
    .prepare("SELECT scene_id FROM sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as { scene_id: string | null } | undefined;
  return row?.scene_id ?? null;
}

export function setSessionScene(
  db: Database.Database,
  sessionId: string,
  userId: string,
  sceneId: string | null,
): void {
  db.prepare(
    "UPDATE sessions SET scene_id = ? WHERE id = ? AND user_id = ?",
  ).run(sceneId, sessionId, userId);
}
```

Also add `scene_id` to the `Session` interface, `rowToSession`, and the SELECT lists in `getSessionById` and `listRecentSessionsForUser` (so callers that already read sessions get the cena id without an extra query).

`forgetSession` already cascades `session_personas` etc. — no change needed; the session's `scene_id` is just data on the row that goes away with it.

**Re-exports in `server/db.ts`:** add the new types and functions to the `export {}` blocks.

**Tests:** new file `tests/scenes.test.ts`. Pattern follows `tests/organizations.test.ts` and `tests/sessions.test.ts` (open `:memory:` DB, set up a user, exercise each helper, assert SQL state).

Cases (one `test()` each):
1. Create + read by id + read by key
2. Update fields (partial — only changed fields modified, updated_at bumped)
3. Unique (user_id, key) — second create with same key throws
4. Archive / unarchive — status toggles
5. Delete — sessions get scene_id=NULL, scene_personas deleted, scene gone
6. Voice='alma' on create clears persona junction (insert via setScenePersonas, then update voice=alma, assert empty)
7. setScenePersonas throws when voice='alma'
8. setScenePersonas rewrites the junction transactionally (passing different list overwrites)
9. listScenesForUser orders by recent activity (cena A used today > cena B used yesterday > cena C never used)
10. listScenesForUser default filters to active (archived hidden)
11. Ownership: helpers no-op for foreign user/key (return undefined / false / no rows changed)
12. getSessionScene + setSessionScene round-trip

**Validation:** new test file green; full suite green (909+12=921+ tests).

**Commit:** `feat(scenes): CRUD helpers + session scene linking`

## Phase 4 — Match logic

**New file:** `server/scenes-match.ts`

```ts
import Database from "better-sqlite3";
import type { ReceptionResult } from "./reception.js";
import { listScenesForUser, getScenePersonas, type Scene } from "./db/scenes.js";

export function findMatchingScene(
  db: Database.Database,
  userId: string,
  receptor: ReceptionResult,
): Scene | null {
  if (receptor.is_trivial) return null;

  const scenes = listScenesForUser(db, userId);  // ordered by recent activity
  if (scenes.length === 0) return null;

  // Alma takes precedence over persona match.
  if (receptor.is_self_moment) {
    const almaCena = scenes.find((s) => s.voice === "alma");
    if (almaCena) return almaCena;
  }

  // Persona match — strict axis-based.
  const lead = receptor.personas[0];
  if (!lead) return null;

  for (const scene of scenes) {
    if (scene.voice === "alma") continue;            // Alma cenas only match via is_self_moment
    const cast = getScenePersonas(db, scene.id);
    if (!cast.includes(lead)) continue;
    if (!scopesMatch(scene.organization_key, receptor.organization)) continue;
    if (!scopesMatch(scene.journey_key, receptor.journey)) continue;
    return scene;  // first match wins (most-recent activity)
  }

  return null;
}

function scopesMatch(sceneScope: string | null, receptorScope: string | null): boolean {
  if (sceneScope === null && receptorScope === null) return true;
  return sceneScope === receptorScope;
}
```

**Performance note:** `listScenesForUser` is one query; `getScenePersonas` is one per cena iterated. For typical cena counts (< 20) this is fine. If profiling later shows pressure, the query can be rewritten with a JOIN that aggregates personas via `GROUP_CONCAT`.

**Tests:** new file `tests/scenes-match.test.ts`. One `test()` per matrix row from index.md, plus border cases:

1. Trivial turn → null (no other axes evaluated)
2. Alma match: is_self_moment=true + alma cena exists → returns alma cena
3. Alma match wins over persona match: is_self_moment=true + alma cena AND persona cena both qualify → returns alma cena
4. Persona match: leading persona ∈ cast + matching org + matching journey → match
5. Persona match with both org/journey null on cena and receptor → match
6. Persona miss: cena requires org=X but receptor.organization=Y → null
7. Persona miss: cena requires journey=X but receptor.journey=null → null
8. Persona miss: leading persona not in any cast → null
9. Multi-match tie-break: two persona cenas qualify → most-recent activity wins (the cena whose linked sessions have the latest created_at)
10. Zero-cena tenant → null
11. is_self_moment=true but no alma cena exists → falls through to persona match (returns persona cena if one matches)
12. Empty receptor.personas → no persona match attempted → null (when no alma cena available)

**Validation:** new test file green; full suite green.

**Commit:** `feat(scenes): findMatchingScene helper for receptor cold-start`

## Phase 5 — Wrap-up

**Files:**
- `docs/process/worklog.md` — new "Done" entry: CV1.E11.S4 with what shipped + test count delta + commits.
- `docs/project/decisions.md` — new entry: "2026-05-02 — CV1.E11.S4 scenes data model" recording the asymmetric cardinality decision (persona = junction; org/journey = single-key column), the SET NULL cascade choice, and the Alma-precedence rule in match.
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/index.md` — flip S4 status to ✅.
- `docs/project/roadmap/cv1-depth/index.md` — update CV1.E11 status line ("S4 (backend) ✅").
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/cv1-e11-s4-backend/index.md` — flip status badge to ✅.

**Validation:** Test guide smoke completes; user gives go to mark done; commit pushed only on explicit ask (per [feedback_no_auto_push.md](../../../../../../../.claude/projects/-Users-alissonvale-Code-mirror-poc/memory/feedback_no_auto_push.md)).

**Commit:** `docs(cv1-e11-s4): close story — backend ready for S1/S7`

## Risks across phases

- **Schema's `scene_id` references an as-yet-uncreated `scenes` row.** SQLite tolerates this when `PRAGMA foreign_keys = OFF` (current default). When enabled in the future, the `scenes` table must exist before the `sessions.scene_id` ALTER. Schema literal places `scenes` before the ALTER block, so order is fine; also covered by the migration running after `db.exec(SCHEMA)`.
- **`ResponseMode` / `ResponseLength` import.** `expression.ts` is the source of truth for these types. Importing from there in `db/scenes.ts` is consistent with how `db/sessions.ts` does it (line 4-9). No new abstraction needed.
- **Test pollution.** All scene tests use `:memory:` databases per file/test; no shared state. Pattern matches `tests/sessions.test.ts`.
- **`listRecentSessionsForUser` change.** Adding `scene_id` to the SELECT and the returned interface is backward-compatible (callers ignore extra fields), but if any test asserts the exact shape, it'll fail until updated. Sweep `tests/sessions.test.ts` for object-equality checks during P3.

## Out of scope (re-affirmed)

- No streaming-pipeline change. Even though `Session` now carries `scene_id`, the composer doesn't read it yet. S1 is where the read happens.
- No HTTP routes (no `POST /scenes`, no `/cenas/...`). S7 builds the form on top of these helpers.
- No admin CLI command for scenes. If admin scripting becomes useful before S7 ships, add a small `admin scene create` then; not pre-emptively.
- No `is_draft` column on personas/orgs/travessias. S7's stub-first creation owns that decision.
