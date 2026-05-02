[< Story](index.md)

# Plan — CV1.E11.S7 Cena form

## Premise

Five phases. Each ends with `npm test` green and a commit. P1 docs only. P2–P5 each lands a working surface (no half-built phases). Manual smokes after P3 and P4 catch UX issues unit tests miss.

## Phase 1 — Story docs

**Files:**
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/cv1-e11-s7-cena-form/{index,plan,test-guide}.md` (new)
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/index.md` (edit — flip S7 status to 🟡)

**Validation:** User reads `index.md`, confirms scope.

**Commit:** `docs(cv1-e11-s7): open story — cena form (inline expander, stub-first)`

## Phase 2 — Routes + skeleton form

**Goal:** end-to-end create + edit + delete of a cena via dedicated routes, with a barebones form (no autocomplete, no sub-creation, no voice mutex JS yet — but voice IS settable via the radio).

**Files:**

`server/db/sessions.ts` — extend `createFreshSession` signature:

```ts
export function createFreshSession(
  db: Database.Database,
  userId: string,
  sceneId: string | null = null,
): string {
  const id = randomUUID();
  const { maxTs } = db
    .prepare(
      "SELECT COALESCE(MAX(created_at), 0) as maxTs FROM sessions WHERE user_id = ?",
    )
    .get(userId) as { maxTs: number };
  const createdAt = Math.max(Date.now(), maxTs + 1);
  db.prepare(
    "INSERT INTO sessions (id, user_id, scene_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, userId, sceneId, createdAt);
  return id;
}
```

Backward-compat: existing callers that pass two args get `sceneId=null` (default). No callsite needs to change unless it wants to set a scene at create time.

`adapters/web/pages/cenas-form.tsx` — new file. Single component `CenaFormPage({mode, cena?, user, sidebarScopes})` where mode is `"create" | "edit"`. Renders a `<form method="POST">` with all fields from index.md. Action is `/cenas/nova` for create, `/cenas/<key>/editar` for edit. Two submit buttons differing in `name="action"` value: `save` vs `save_and_start`. Sidebar via `loadSidebarScopes` (existing chrome).

`adapters/web/index.tsx` — seven new routes (after the journeys block, near the existing CRUD routes for orgs/journeys). All ownership-checked via the existing `web.use` auth middleware.

```ts
web.get("/cenas/nova", (c) => {
  const user = c.get("user");
  return c.html(<CenaFormPage mode="create" user={user} sidebarScopes={loadSidebarScopes(db, user.id)} />);
});

web.post("/cenas/nova", async (c) => {
  const user = c.get("user");
  const form = await c.req.formData();
  const result = handleSceneFormPost(db, user.id, form, null);
  if (result.error) return c.text(result.error, result.status);
  if (form.get("action") === "save_and_start") {
    const sessId = createFreshSession(db, user.id, result.scene.id);
    return c.redirect(`/conversation/${sessId}`);
  }
  return c.redirect(`/cenas/${result.scene.key}/editar?saved=created`);
});

web.get("/cenas/:key/editar", (c) => { ... });
web.post("/cenas/:key/editar", async (c) => { ... });
web.post("/cenas/:key/archive", (c) => { ... });
web.post("/cenas/:key/unarchive", (c) => { ... });
web.post("/cenas/:key/delete", (c) => c.redirect(`/`));   // back to old home for now; S1 will redirect to /inicio
```

The `handleSceneFormPost` helper lives in `adapters/web/pages/cenas-form.tsx` (or a sibling `cenas-form-handler.ts` if cleaner). It parses formData, validates title, derives `key` from title for create (slugify; auto-suffix `-2` if collision), calls `createScene` or `updateScene`, and parses elenco from a comma-separated `personas` field for now (P3 makes this a chip array).

**Tests:** `tests/cenas-routes.test.ts` (new) — 10 tests covering each route, ownership, validation. `tests/sessions-scene-creation.test.ts` (new) — 3 tests for the `createFreshSession` extension.

**Validation:**
- `npm test` green (942 + ~13 new = ~955).
- Manual smoke: `npm run dev`, navigate to `http://localhost:3000/cenas/nova`, fill title + briefing, submit. Lands on `/cenas/<key>/editar?saved=created` with the form pre-filled. Edit a field, submit again, see the change persist after F5.

**Commit:** `feat(cenas): routes + skeleton form — create/edit/archive/delete`

## Phase 3 — Form complete + voice mutex + dual save + i18n

**Goal:** form looks finished. Voice toggle works (Elenco shows/hides). `[Salvar e iniciar conversa]` opens a conversation in the cena. Strings in en + pt-BR.

**Files:**

`adapters/web/pages/cenas-form.tsx` — flesh out the form:
- Voice radio with `data-cena-voice` listener
- Elenco as a chip container `<div data-cena-elenco>` rendering existing personas as chips, plus a hidden `<input name="personas[]">` per chip for form submit
- Org chip with autocomplete-stub (input that on submit looks up the typed key — full autocomplete in P4)
- Journey chip same pattern
- Avançado disclosure (`<details>` element) with mode + length selects
- Cancel button as `<a href="/">` (back to home)

`adapters/web/public/cenas-form.js` (new file) — vanilla JS:
- `data-cena-voice` change listener: toggles `[hidden]` on `<fieldset data-cena-elenco-fieldset>`
- Chip remove buttons (×) → remove the corresponding hidden input
- That's it for P3 — autocomplete and sub-creation come in P4

`adapters/web/locales/en.json` and `pt-BR.json` — add `scenes.form.*` namespace:

```json
{
  "scenes.form.create.title": "Nova cena",
  "scenes.form.edit.title": "Editar cena",
  "scenes.form.title.label": "Título",
  "scenes.form.temporalPattern.label": "Padrão temporal",
  "scenes.form.temporalPattern.placeholder": "qua 20h, ou \"noites\"",
  "scenes.form.briefing.label": "Briefing",
  "scenes.form.briefing.help": "O que essa conversa é, em uma ou duas frases.",
  "scenes.form.voice.label": "Voz",
  "scenes.form.voice.persona": "Persona",
  "scenes.form.voice.alma": "Voz da Alma",
  "scenes.form.cast.label": "Elenco",
  "scenes.form.org.label": "Organização",
  "scenes.form.journey.label": "Travessia",
  "scenes.form.advanced.label": "Avançado",
  "scenes.form.mode.label": "Modo",
  "scenes.form.mode.auto": "auto",
  "scenes.form.length.label": "Tamanho",
  "scenes.form.length.auto": "auto",
  "scenes.form.action.cancel": "Cancelar",
  "scenes.form.action.save": "Salvar",
  "scenes.form.action.saveAndStart": "Salvar e iniciar conversa",
  "scenes.form.error.titleRequired": "Título é obrigatório."
}
```

(en file has English values; the keys above are the pt-BR shape but the en file translates them — `Nova cena` → `New scene`, etc.)

`adapters/web/index.tsx` (templates) — wherever `cenas-form.js` is included, version it: `<script src="/cenas-form.js?v=cenas-form-1"></script>`.

**Tests:** extend `tests/cenas-routes.test.ts` with:
- POST with `voice=alma` and `personas[]=foo` → server-side mutex wins, cena saved with voice='alma' and empty cast (the data layer's mutex from S4 protects against client misbehavior)
- POST with `action=save_and_start` → 302 to `/conversation/<sessId>`, session row has scene_id matching the new cena
- POST with empty title → 400 with i18n error message

**Validation:**
- `npm test` green
- Manual smoke (test-guide Test 1 + Test 2):
  - Create a cena with voice=Persona, add 2 personas, set org and journey, save → see in DB
  - Create a cena with voice=Alma → Elenco hidden, save → cast empty in DB
  - Use `[Salvar e iniciar conversa]` → lands in /conversation, send a message, look at composed snapshot (cena's briefing isn't composed yet — S1 wires that; for now just confirm the session has scene_id)

**Commit:** `feat(cenas): form fields complete + voice mutex + dual save + i18n`

## Phase 4 — Stub-first inline sub-creation + `is_draft`

**Goal:** typing a non-existing name in Elenco/Org/Journey creates a draft entity inline. Three new POST endpoints, three schema ALTERs, autocomplete + mini-form JS.

**Files:**

`server/db.ts` — three ALTERs in migrate():

```ts
const identityCols2 = db.prepare("PRAGMA table_info(identity)").all() as { name: string }[];
if (!identityCols2.some((c) => c.name === "is_draft")) {
  db.exec("ALTER TABLE identity ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0");
}
const orgCols2 = db.prepare("PRAGMA table_info(organizations)").all() as { name: string }[];
if (!orgCols2.some((c) => c.name === "is_draft")) {
  db.exec("ALTER TABLE organizations ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0");
}
const journeyCols2 = db.prepare("PRAGMA table_info(journeys)").all() as { name: string }[];
if (!journeyCols2.some((c) => c.name === "is_draft")) {
  db.exec("ALTER TABLE journeys ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0");
}
```

`server/db/identity.ts`, `db/organizations.ts`, `db/journeys.ts` — three new helpers:

```ts
// identity.ts (personas only)
export function setPersonaIsDraft(db, userId, key, isDraft: boolean): void
export function createDraftPersona(db, userId, key, name, description?): IdentityRow
// organizations.ts
export function setOrganizationIsDraft(db, userId, key, isDraft: boolean): void
// journeys.ts
export function setJourneyIsDraft(db, userId, key, isDraft: boolean): void
```

The `createDraftPersona` helper writes an `identity` row with `layer='persona'`, `is_draft=1`, content equal to the description (or just the name if description is empty). The dedicated entity editor (`/personas/<key>`) gets a small badge:

```jsx
{persona.is_draft ? <span class="badge-draft">rascunho</span> : null}
```

When the user edits and saves a draft persona via the workshop, set `is_draft=0` automatically (refinement = promotion). Same pattern for org and journey workshops.

`adapters/web/index.tsx` — three new POST endpoints:

```ts
web.post("/cenas/sub/persona", async (c) => {
  const user = c.get("user");
  const { name, key, description } = await c.req.json<{name: string; key: string; description?: string}>();
  if (!name || !key) return c.json({error: "name and key required"}, 400);
  if (!/^[a-z0-9-]+$/.test(key)) return c.json({error: "invalid key"}, 400);
  if (getIdentityLayers(db, user.id).some(l => l.layer === "persona" && l.key === key)) {
    return c.json({error: "key already exists"}, 409);
  }
  createDraftPersona(db, user.id, key, name, description ?? "");
  return c.json({key, name});
});
// sub/organization and sub/journey: parallel structure
```

`adapters/web/public/cenas-form.js` — extend with autocomplete:
- Each chip-input field has a `data-cena-suggest="persona|org|journey"` attribute
- On input, fetch a small JSON list (server endpoint? or pre-rendered into the page as a data attribute?) — **decision: pre-render the user's existing personas/orgs/journeys into the page as `<script type="application/json" id="cenas-form-data">` so client doesn't round-trip on every keystroke. Page is server-rendered anyway**
- Filter the list by the typed string
- If no exact match, show `+ Criar persona "X"` as the last item
- Click → expand mini-form below the input
- Mini-form submit → fetch POST to `/cenas/sub/...`, on success inject chip + collapse mini-form

**Tests:**
- `tests/cenas-sub-creation.test.ts` (new) — 6 tests:
  - POST `/cenas/sub/persona` valid → 200, identity row with `is_draft=1`
  - POST with existing key → 409
  - POST with invalid key format → 400
  - POST with empty name → 400
  - Same coverage for org and journey (~3 tests, lighter)
- Extend `tests/identity.test.ts` (or new `tests/draft-flag.test.ts`) — promote-on-edit: editing a draft persona via the existing setIdentityLayer or workshop save sets `is_draft=0`

**Validation:**
- `npm test` green
- Manual smoke (test-guide Test 3 + Test 4):
  - Create new cena, type non-existing persona name → autocomplete shows `+ Criar`
  - Click → mini-form, fill description, save as draft → chip appears, identity row exists in DB with `is_draft=1`
  - Navigate to `/personas/<key>` → see "rascunho" badge
  - Edit + save the persona via workshop → badge disappears (`is_draft=0`)
  - Same flow for org and journey
  - Cancel cena form after creating a stub → stub persists in DB (no transactional rollback)

**Commit:** `feat(cenas): stub-first inline sub-creation + is_draft on persona/org/journey`

## Phase 5 — Wrap-up

**Files:**
- `docs/process/worklog.md` — Done entry for CV1.E11.S7
- `docs/project/decisions.md` — entries for stub-first commit semantics, is_draft scoping, single org/journey single-chip vs multi-chip pattern
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/cv1-e11-s7-cena-form/index.md` — flip status to ✅
- `docs/project/roadmap/cv1-depth/cv1-e11-scenes/index.md` — flip S7 ✅
- `docs/project/roadmap/cv1-depth/index.md` — update status line

**Validation:**
- Full test-guide smoke (all 5 tests) passes
- User confirms

**Commit:** `docs(cv1-e11-s7): close story — cena form ready for S1`

## Risks across phases

- **`createFreshSession` signature change.** All existing callers expect `(db, userId)`. Adding an optional third param is backward-compat at the type level, but check callsites — particularly in any test that mocks/spies this function.
- **`is_draft` and reception scoring.** Reception's persona descriptor reads from `identity.summary` or content. A stub with empty description has thin signal; reception may simply not pick it. Acceptable — the cena's cast forces the persona into the candidate pool, so it gets the chance to be picked but not guaranteed. If real use shows "I created a stub persona via cena and it never gets used", iterate.
- **Promote-on-edit interaction.** When the user edits a draft entity via the workshop and saves with no actual changes, do we still set `is_draft=0`? Conservative answer: yes — opening the editor and saving is itself a deliberate review act. Codify in the editor handler, not in `setIdentityLayer` (the data helper stays neutral).
- **Sidebar reload after sub-creation.** A new draft persona created inline doesn't appear in the sidebar's persona list until the next page load. Acceptable — the cena form is the focus; sidebar refresh is cosmetic. Document in test-guide.
- **i18n string drift.** Adding ~25 new keys; the en file has to mirror all of them. Mitigation: write both files in the same commit; add a P3 sub-step "diff en.json vs pt-BR.json keys" to ensure parity.

## Out of scope (re-affirmed)

- No cena list view at `/cenas` — that's S3.
- No avatar top bar on /cenas/* — that's S2; S7 uses sidebar.
- No card preview in form — the home cards (S1) derive visuals automatically.
- No reordering Elenco chips, no card pinning, no auto-save.
- No conversational creation flow.
