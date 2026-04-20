[< Story](index.md)

# Test guide: CV1.E4.S1 — Scope identity + routing

Validation for the story. The automated layer runs via `npm test`; the
manual layer walks the web surfaces and reception end-to-end.

---

## Automated

### Test count after S1

Before S1: 162 passing (as of v0.7.0).
After S1: **237 passing** across 8 test files.

### Unit (`tests/db.test.ts`)

27 new cases — 3 new describe blocks:

- **`organizations`** — CRUD, unique `(user_id, key)`, archive/unarchive lifecycle, summary writes, delete with journey unlink, active-only default on `getOrganizations`.
- **`journeys`** — CRUD, FK link/unlink via `linkJourneyOrganization`, archive lifecycle, filter by `organizationId` (concrete id + `null` for personal), getter options.
- **`deleteUser cascade on scopes`** — user deletion cascades through both new tables, and does not touch other users' scopes.

Run:

```bash
npm run test:unit
```

### Reception (`tests/reception.test.ts`)

17 cases split across four describe blocks (persona axis, organization axis, journey axis, combined axes). Uses a capturing `completeFn` to verify prompt structure without hitting an LLM.

Run:

```bash
npx vitest run tests/reception.test.ts
```

### Identity / composition (`tests/identity.test.ts`)

10 new cases under `composeSystemPrompt — scope injection`: briefing-only, situation-only, empty-skip, unknown-key, archived-skip, placement order, journey without org, and all four scope combinations (none / org only / journey only / both).

Run:

```bash
npx vitest run tests/identity.test.ts
```

### Web (`tests/web.test.ts`)

28 new cases — three describe blocks:

- **`web routes — organizations`** — list render, create happy path + rejections (invalid key, duplicate), workshop render, update, 404, archive lifecycle visibility, delete, archived-view toggle, auth, role.
- **`web routes — journeys`** — list render (grouping verified via group classes), create (personal + linked), unknown-org rejection, workshop with selector, update with link change, unlink, 404, archive toggle, delete, auth.
- **`web routes — composed drawer + rail`** — Cognitive Map contains the new dropdowns, `/map/composed` threads organization into the prompt, `/mirror` renders scope rows hidden with no history, and `buildRailState` derives scopes from stored `_organization` / `_journey` meta on assistant entries.

Run:

```bash
npx vitest run tests/web.test.ts
```

### Full suite

```bash
npm test
```

Should show 237 passing.

### Eval (requires real DB with seeded orgs and journeys)

```bash
npm run eval:scope-routing
```

Threshold: 0.80. Calibrate after first run against real data. Skipped if `data/mirror.db` has no organizations or journeys for the primary user (`Alisson Vale`).

---

## Manual — happy path

Seed data on the primary user first. Either through the UI (`/organizations/new` + `/journeys/new`) or directly via SQL / the admin CLI if that path exists.

### 1. Create an organization

1. Log in as the primary user.
2. Sidebar → **Organizations**.
3. In the create form, fill:
   - Name: *Software Zen*
   - Key: `software-zen`
4. Click **Create**.
5. Expected: redirect to `/organizations/software-zen` workshop.

### 2. Write briefing + situation

1. In the workshop, fill:
   - Briefing: *"Software Zen forma uma geração de profissionais..."* (paste a paragraph).
   - Situation: *"Em transição. Sem receita recorrente..."* (paste current state).
2. Click **Save**.
3. Expected: redirect back to the same workshop. Summary block should eventually show the generated descriptor (may take ~5 seconds; refresh if needed).

### 3. Create a linked journey

1. Sidebar → **Journeys**.
2. Fill:
   - Name: *O Espelho*
   - Key: `o-espelho`
   - Organization: **Software Zen**
3. Click **Create**.
4. Expected: redirect to `/journeys/o-espelho`. Breadcrumb shows *"Software Zen / O Espelho"*.
5. Fill briefing and situation, **Save**.

### 4. Create a personal journey

1. Back to **Journeys**.
2. Fill:
   - Name: *Vida econômica*
   - Key: `vida-economica`
   - Organization: *(personal journey)*
3. Click **Create**.

### 5. Verify list grouping

1. Navigate to **Journeys** again.
2. Expected:
   - **Personal journeys** group at top with *Vida econômica* card.
   - **Software Zen** group below (link to its org page) with *O Espelho* card.

### 6. Routing via the Mirror

1. Sidebar → **My Mirror**.
2. Send: *"quais prioridades da Software Zen este trimestre?"*.
3. Expected:
   - Response streams with a voice informed by the org's content.
   - Rail **Composed** block shows `organization: software-zen` row.
   - Rail does not show a journey row (message did not match one).
4. Send: *"quanto sobrou no caixa este mês?"*.
5. Expected: Rail shows `journey: vida-economica`; no organization row.
6. Send: *"como está a travessia do Espelho?"*.
7. Expected: Rail shows both `organization: software-zen` AND `journey: o-espelho`.

### 7. Composed-prompt drawer

1. From `/map` or any layer workshop, click *"composed prompt →"*.
2. In the drawer, change the **Organization** dropdown to `software-zen`.
3. Expected: drawer content updates to include the briefing + `Current situation:` block for the org.
4. Change **Journey** to `o-espelho`. Drawer includes both blocks in order org → journey.
5. Change **Persona** to any key, then **Adapter** to `web`. Drawer updates composition with all four axes.

### 8. Archive lifecycle

1. On `/organizations/software-zen`, click **Archive**.
2. Expected: workshop reloads with `archived` badge.
3. Go to `/organizations`. Expected: Software Zen not visible; a *"Show 1 archived organization →"* link appears.
4. Click the link. Archived section shows Software Zen; click to return to the workshop.
5. Click **Unarchive**. Status resets.
6. Repeat for a journey.

### 9. Archived scopes do not route

1. Archive *Software Zen* again.
2. Send: *"quais prioridades da Software Zen?"*.
3. Expected: rail does NOT show `organization: software-zen`. The composer does not inject its content.
4. Unarchive it to continue the happy path.

### 10. Delete organization preserves journeys

1. On `/organizations/software-zen`, click **Delete this organization** and confirm.
2. Expected: redirect to `/organizations` list (now empty).
3. Navigate to `/journeys/o-espelho`.
4. Expected: the journey exists; the *Organization* dropdown shows *(personal journey)*; breadcrumb no longer mentions Software Zen.

### 11. GET /mirror preserves scope awareness across reload

1. After a turn that activated a scope (step 6), reload `/mirror`.
2. Expected: rail still shows the scope rows — derived from the last assistant entry's stored `_organization` and `_journey` meta.

---

## Manual — edge cases

- **Empty scope (briefing and situation blank)**: does not inject in the composed prompt. Verify via the drawer — selecting an empty scope should show no block for it.
- **Key validation on create**: typing `Name With Spaces` in the key field should be rejected by browser validation (`pattern` attribute); server returns 400 if bypassed.
- **Duplicate key**: creating a second scope with the same key returns 409 "An organization with that key already exists".
- **Unknown org in journey selector**: if you manually edit the form to submit a garbage org id, the server returns 400.
- **Long briefing**: try a 2,000-word briefing. Composed prompt includes all of it. Summary truncates to ~40 words.

---

## Known limits / not yet

- **Telegram and CLI adapters do not yet thread scope routing.** Web is the only channel that activates org/journey in v1 of this story. When those adapters need it, they thread reception's fields into `composeSystemPrompt` with the `scopes` parameter — same pattern as `adapters/web/index.tsx`.
- **No `/library` or attachments surface.** Attachments ship in CV1.E4.S2.
- **No scope-filtered memory browse.** That's CV1.E4.S4 + CV1.E6.
- **Summary prompt tuning is first-draft.** Regenerate summaries after several save cycles; expect some formulaic openings. Refine when the eval shows real miss patterns.
