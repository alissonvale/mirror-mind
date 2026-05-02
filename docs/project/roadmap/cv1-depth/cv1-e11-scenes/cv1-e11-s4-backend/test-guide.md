[< Story](index.md)

# Test guide — CV1.E11.S4 Backend smoke

End-to-end manual smoke for validating the scenes data layer + match helper after P3 and P4 ship. The story has no UI surface, so all probes are SQL or short Node REPL snippets against the local DB.

## Pre-conditions

- All four phases shipped (P1 docs, P2 schema, P3 CRUD, P4 match).
- `npm test` clean (full suite green).
- `data/mirror.db.bak-<timestamp>` in place (`cp data/mirror.db data/mirror.db.bak-$(date +%Y%m%d-%H%M%S)`) before exercising destructive helpers.
- `npm run dev` doesn't need to be running — S4 has no HTTP surface.

## Test 1 — Schema migrated cleanly on existing DB

Open the DB and inspect the new schema artifacts:

```bash
sqlite3 data/mirror.db ".schema scenes"
sqlite3 data/mirror.db ".schema scene_personas"
sqlite3 data/mirror.db "PRAGMA table_info(sessions);" | grep scene_id
```

**Expected:**
- `scenes` table exists with all columns from index.md.
- `scene_personas` exists with composite PK.
- `sessions.scene_id` column present (TEXT, nullable, no default).
- Old data intact — `SELECT COUNT(*) FROM sessions` matches the pre-migration count.

**Validates:** P2 ALTER + SCHEMA additions are idempotent and non-destructive.

## Test 2 — CRUD round-trip (Node REPL)

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb }) => {
  const { createScene, getSceneByKey, setScenePersonas, getScenePersonas, listScenesForUser, archiveScene, deleteScene } = await import('./server/db/scenes.ts');
  const db = openDb();
  const userRow = db.prepare(\"SELECT id FROM users WHERE name = 'Alisson Vale'\").get();
  const userId = userRow.id;

  const cena = createScene(db, userId, 'aula-nova-acropole-test', {
    title: 'Aula Nova Acrópole (test)',
    temporal_pattern: 'qua 20h',
    briefing: 'Conversa durante aula de filosofia.',
    response_mode: 'conversational',
  });
  console.log('Created:', cena.id);

  setScenePersonas(db, cena.id, ['s4-test-persona']);
  console.log('Cast:', getScenePersonas(db, cena.id));

  console.log('Listed:', listScenesForUser(db, userId).map(s => s.key));

  archiveScene(db, userId, 'aula-nova-acropole-test');
  console.log('After archive (active only):', listScenesForUser(db, userId).map(s => s.key));

  deleteScene(db, userId, 'aula-nova-acropole-test');
  console.log('After delete:', getSceneByKey(db, userId, 'aula-nova-acropole-test'));
});
"
```

**Expected:**
- `Created:` prints a UUID.
- `Cast: [ 's4-test-persona' ]`.
- `Listed:` includes `aula-nova-acropole-test` (and any other active cenas).
- After archive: the test cena is absent from the active list.
- After delete: `getSceneByKey` returns `undefined`.

**Validates:** create → setPersonas → list → archive → delete works end-to-end against the production DB shape (with backup safety).

## Test 3 — Voice mutex enforced

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb }) => {
  const { createScene, setScenePersonas, getScenePersonas, updateScene, deleteScene } = await import('./server/db/scenes.ts');
  const db = openDb();
  const userId = db.prepare(\"SELECT id FROM users WHERE name='Alisson Vale'\").get().id;

  const c = createScene(db, userId, 's4-test-mutex', { title: 'mutex test' });
  setScenePersonas(db, c.id, ['s4-test-persona-a', 's4-test-persona-b']);
  console.log('Cast before voice flip:', getScenePersonas(db, c.id));

  updateScene(db, userId, 's4-test-mutex', { voice: 'alma' });
  console.log('Cast after voice=alma:', getScenePersonas(db, c.id));   // expect []

  try {
    setScenePersonas(db, c.id, ['s4-test-persona-c']);
    console.log('Should not reach here');
  } catch (err) {
    console.log('Throws as expected:', err.message);
  }

  deleteScene(db, userId, 's4-test-mutex');
});
"
```

**Expected:**
- Cast before flip: `[ 's4-test-persona-a', 's4-test-persona-b' ]`.
- Cast after voice=alma: `[]` (cleared transactionally).
- `setScenePersonas` throws with message containing "Alma".

**Validates:** the runtime mutex from CV1.E9.S6 is mirrored on the cena entity.

## Test 4 — Session linkage + delete-cena leaves session intact

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb, getOrCreateSession, getSessionScene, setSessionScene }) => {
  const { createScene, deleteScene } = await import('./server/db/scenes.ts');
  const db = openDb();
  const userId = db.prepare(\"SELECT id FROM users WHERE name='Alisson Vale'\").get().id;

  const sessId = getOrCreateSession(db, userId);
  const cena = createScene(db, userId, 's4-test-linkage', { title: 'linkage' });
  setSessionScene(db, sessId, userId, cena.id);
  console.log('After link:', getSessionScene(db, sessId, userId));   // cena.id

  deleteScene(db, userId, 's4-test-linkage');
  console.log('After delete:', getSessionScene(db, sessId, userId)); // null
  console.log('Session still exists:', !!db.prepare('SELECT 1 FROM sessions WHERE id=?').get(sessId));
});
"
```

**Expected:**
- After link: prints the scene UUID.
- After delete: prints `null` (scene_id was set to NULL by the deleteScene helper).
- Session row still present (only the scene was deleted).

**Validates:** delete-cena is non-destructive at the session layer; sessions become unscoped, not erased.

## Test 5 — Match: Alma cena via is_self_moment

Set up an Alma cena via the helper, then fabricate a `ReceptionResult` and call `findMatchingScene`:

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb }) => {
  const { createScene, deleteScene } = await import('./server/db/scenes.ts');
  const { findMatchingScene } = await import('./server/scenes-match.ts');
  const db = openDb();
  const userId = db.prepare(\"SELECT id FROM users WHERE name='Alisson Vale'\").get().id;

  createScene(db, userId, 's4-test-alma', { title: 'Voz da Alma (test)', voice: 'alma' });

  const receptor = {
    personas: [],
    organization: null, journey: null,
    mode: 'conversational', touches_identity: true,
    is_self_moment: true, is_trivial: false,
    would_have_persona: null, would_have_organization: null, would_have_journey: null,
  };
  const match = findMatchingScene(db, userId, receptor);
  console.log('Alma match:', match?.key);   // 's4-test-alma'

  deleteScene(db, userId, 's4-test-alma');
});
"
```

**Expected:** prints `Alma match: s4-test-alma`.

**Validates:** the Alma branch of the match matrix.

## Test 6 — Match: persona cena with org/journey constraints

Create two cenas with synthetic keys — one matching, one not — and confirm only the matching one returns. The match helper does not validate that the persona/org/journey keys exist elsewhere; it just compares strings against the cena's columns and junction.

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb }) => {
  const { createScene, setScenePersonas, deleteScene } = await import('./server/db/scenes.ts');
  const { findMatchingScene } = await import('./server/scenes-match.ts');
  const db = openDb();
  const userId = db.prepare(\"SELECT id FROM users WHERE name='Alisson Vale'\").get().id;

  // Matching cena: synthetic persona + synthetic org + synthetic journey
  const matchCena = createScene(db, userId, 's4-test-match', {
    title: 'Match', organization_key: 's4-test-org-a', journey_key: 's4-test-journey-a',
  });
  setScenePersonas(db, matchCena.id, ['s4-test-persona']);

  // Non-matching cena: same persona but different org
  const noMatchCena = createScene(db, userId, 's4-test-no-match', {
    title: 'No match', organization_key: 's4-test-org-b',
  });
  setScenePersonas(db, noMatchCena.id, ['s4-test-persona']);

  const receptor = {
    personas: ['s4-test-persona'],
    organization: 's4-test-org-a', journey: 's4-test-journey-a',
    mode: 'conversational', touches_identity: false,
    is_self_moment: false, is_trivial: false,
    would_have_persona: null, would_have_organization: null, would_have_journey: null,
  };
  const match = findMatchingScene(db, userId, receptor);
  console.log('Match key:', match?.key);   // 's4-test-match'

  deleteScene(db, userId, 's4-test-match');
  deleteScene(db, userId, 's4-test-no-match');
});
"
```

**Expected:** `Match key: s4-test-match`.

**Validates:** strict axis match including org and journey, reject when either diverges. Synthetic keys mean the test runs identically on any DB regardless of which personas/orgs/journeys the user has provisioned.

## Test 7 — Match: trivial turn returns null

```bash
node --experimental-vm-modules -e "
import('./server/db.ts').then(async ({ openDb }) => {
  const { findMatchingScene } = await import('./server/scenes-match.ts');
  const db = openDb();
  const userId = db.prepare(\"SELECT id FROM users WHERE name='Alisson Vale'\").get().id;

  const receptor = {
    personas: ['s4-test-persona'],
    organization: null, journey: null,
    mode: 'conversational', touches_identity: false,
    is_self_moment: false, is_trivial: true,
    would_have_persona: null, would_have_organization: null, would_have_journey: null,
  };
  console.log('Trivial → null:', findMatchingScene(db, userId, receptor));
});
"
```

**Expected:** `Trivial → null: null`.

**Validates:** is_trivial short-circuit at the top of `findMatchingScene`.

## Cleanup

The test cenas above all delete themselves. Verify nothing leaked:

```bash
sqlite3 data/mirror.db "SELECT key FROM scenes WHERE key LIKE 's4-test-%'"
```

**Expected:** empty result.

If something leaked, restore the backup:

```bash
cp data/mirror.db.bak-<timestamp> data/mirror.db
```

## Sign-off

If all 7 tests pass, S4 is ready for the wrap-up phase (P5 docs/badges) and S1/S7 can start consuming the helpers.
