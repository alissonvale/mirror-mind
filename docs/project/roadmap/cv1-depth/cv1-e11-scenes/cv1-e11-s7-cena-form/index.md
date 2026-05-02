[< CV1.E11](../)

# CV1.E11.S7 — Form de criação/edição de cena

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

S4 shipped the data layer (scenes table, junction, match helper) but no surface lets a user create or edit a cena. Today the only path is SQL or REPL — useless for actual use, and a hard prerequisite for S1's home cards to mean anything (they need real cenas to render).

The cena form is also where the **stub-first** principle lives: when a user is creating a cena and references a persona/org/travessia that doesn't exist yet, the form has to allow inline creation of a draft entity rather than forcing a side-trip through dedicated CRUD pages.

## Fix

Two new pages on dedicated routes — `/cenas/nova` (create) and `/cenas/<key>/editar` (edit) — sharing a single form component. The form is an **inline expander**: title, padrão temporal (free text), briefing (large textarea, the heart), voice toggle (Persona / Voz da Alma), elenco (persona chips with autocomplete), organização and travessia (single chips), Avançado disclosure (mode + length, both auto by default). Two save buttons: `[Salvar]` returns to the list/origin; `[Salvar e iniciar conversa]` creates a fresh session linked to the cena and redirects to `/conversation/<sessId>`.

**Stub-first sub-creation** ships in the same story (P4): when the user types a name in Elenco/Organização/Travessia that doesn't match an existing entity, the autocomplete shows `Criar X "name"`. Click expands a mini-form (name, key auto-derived, one-line description). Saving creates the entity as a draft (`is_draft=1`); refinement happens later in the dedicated entity editor.

**Chrome:** `/cenas/*` reuses the existing sidebar during the strangler period. When S2 lands the avatar top bar, these pages migrate alongside `/inicio` and `/memoria`. No new shared chrome component invented in S7.

## What ships

### Routes (in `adapters/web/index.tsx`, web sub-app)

```
GET  /cenas/nova                 — empty form
POST /cenas/nova                 — create + redirect
GET  /cenas/:key/editar          — pre-filled form
POST /cenas/:key/editar          — update + redirect
POST /cenas/:key/archive         — archive + redirect
POST /cenas/:key/unarchive       — unarchive + redirect
POST /cenas/:key/delete          — hard delete + redirect

POST /cenas/sub/persona          — create stub persona, returns JSON {key, name}
POST /cenas/sub/organization     — create stub org, returns JSON {key, name}
POST /cenas/sub/journey          — create stub journey, returns JSON {key, name}
```

The `/cenas/sub/*` endpoints are JSON-returning rather than HTML-redirecting because they're called via fetch from the form's autocomplete; the result is consumed by JS that injects the new chip without page reload.

### Form anatomy (top to bottom)

```
Título                    [text input, required]
Padrão temporal           [text input, optional, placeholder "qua 20h, noites"]
Briefing                  [large textarea, dominant visual weight]
Voz                       (◉) Persona  ( ) Voz da Alma
Elenco                    [persona chips + autocomplete]      hidden when voz=Alma
Organização               [single org chip + autocomplete]
Travessia                 [single journey chip + autocomplete]
Avançado ▾                [collapsed by default]
  Modo                    auto | conversational | essayistic | oracular
  Tamanho                 auto | brief | standard | full

[Cancelar]   [Salvar]   [Salvar e iniciar conversa]
```

**Voice mutex behavior:** when voice flips to Alma, the Elenco field is hidden (not just disabled). Toggling back to Persona makes Elenco reappear empty — preserving stale state across the toggle would surprise. The data layer mutex (CV1.E11.S4 + CV1.E9.S6) guarantees the same outcome server-side regardless of what the client posts.

**Validation:** only `title` is required. Empty briefing is a legitimate degenerate case ("I have a name, will populate later").

**Stub-first autocomplete (P4):** typing in any of Elenco/Organização/Travessia queries existing entities in real-time. If the typed string matches no existing key/name, the dropdown's last item is `+ Criar persona "name"` (or org / travessia). Clicking expands a mini-form inline:

```
Criar persona "filosofa"
  Nome           [filosofa                       ]
  Key            [filosofa                       ]   (auto-derived, editable)
  Descrição      [Lente filosófica para...       ]   (one line, optional)
  [Salvar como rascunho]   [Cancelar]
```

`Salvar como rascunho` POSTs to `/cenas/sub/persona`, server creates the entity with `is_draft=1`, JSON response `{key, name}` is consumed and a chip is added to the form's elenco. The mini-form collapses. The **stub creation is committed**, not transactional with the cena form — cancelling the cena does NOT undo the stub (creation has cognitive cost; undoing surprises). The "rascunho" label makes the commit explicit.

### Schema additions (P4)

`is_draft INTEGER NOT NULL DEFAULT 0` on three tables:
- `identity` — applies only to `layer='persona'` rows; other layers ignore it
- `organizations`
- `journeys`

Default `0` for all existing rows (they're real, not stubs). Setter helpers `setPersonaIsDraft`, `setOrganizationIsDraft`, `setJourneyIsDraft`. UI surface: subtle `rascunho` badge in the dedicated entity editors (`/personas/<key>`, `/organizations/<key>`, `/journeys/<key>`); does NOT filter the entity from any list. Reception treats drafts identically to non-drafts (their thin descriptors naturally score lower without an explicit gate).

### Session creation extension

`createFreshSession(db, userId, sceneId?: string | null)` gains an optional `sceneId` parameter. When provided, the new session row is INSERTed with `scene_id` set in one shot (no follow-up UPDATE). Used by `[Salvar e iniciar conversa]` to chain create-cena → create-session → redirect-to-conversation atomically.

### i18n

All form strings carry i18n keys from day one (en + pt-BR), per the project pattern (CV2.E1). Namespace: `scenes.form.*`. Examples: `scenes.form.title.label`, `scenes.form.voice.alma`, `scenes.form.action.saveAndStart`.

### Cache busting

New JS file `cenas-form.js` (autocomplete + sub-creation + voice toggle) carries `?v=cenas-form-1` in the script tag. CSS additions inline in the page template — no separate file in v1.

## Tests

Server-side (Vitest):

- `tests/cenas-routes.test.ts` (web routes):
  - GET `/cenas/nova` returns 200 + form HTML
  - POST `/cenas/nova` with title only → redirect to `/cenas/<key>/editar`
  - POST `/cenas/nova` with title + voice=alma → cena created with voice='alma', no cast
  - POST `/cenas/nova` with `start=1` → redirect to `/conversation/<sessId>`, session has scene_id set
  - GET `/cenas/<key>/editar` pre-fills with existing data
  - POST `/cenas/<key>/editar` updates fields
  - POST `/cenas/<key>/archive` and `/unarchive` flip status
  - POST `/cenas/<key>/delete` hard-deletes; sessions become scene_id=NULL
  - Ownership: foreign user gets 404 on edit/update/delete
  - Validation: missing title returns 400

- `tests/cenas-sub-creation.test.ts`:
  - POST `/cenas/sub/persona` with new key → 200 JSON `{key, name}`, identity row exists with `is_draft=1`
  - POST with existing key → 409
  - Same for org and journey
  - Stub commit survives cena form cancellation (no transactional rollback)

- `tests/sessions-scene-creation.test.ts`:
  - `createFreshSession(db, userId, sceneId)` creates session with scene_id set
  - `createFreshSession(db, userId)` (no sceneId) keeps backward-compat (scene_id NULL)
  - `createFreshSession(db, userId, null)` explicit null → scene_id NULL

Client-side: covered by manual smoke (test-guide). The autocomplete + sub-creation JS doesn't get unit tests — too thin to justify a JSDOM harness.

## Non-goals (parked)

- **Cena list view** at `/cenas` — that's S3 Memória dashboard. The form's `[Cancelar]` and `[Salvar]` redirect to the home (or back to wherever the user came from) for now; the explicit list lives in Memória > Cenas.
- **Drafts of incomplete cenas.** Closing the form discards in-progress work. Auto-save is a follow-up if pain surfaces (`beforeunload` confirm prompt is good enough for v1).
- **Reordering personas in Elenco.** Insertion order is enough; multi-persona behavior already exists (CV1.E7.S5).
- **Card color preview in the form.** Card color is derived from the dominant glyph automatically (CV1.E7.S2 colors); making it editable would invent UX without clear payoff.
- **Promote-stub-to-full action in the cena form itself.** Stub refinement happens in the dedicated entity editor. The cena form just creates stubs; promoting them to full is the entity editor's job.
- **Conversational creation** ("mirror interviews user to build cena") — parked entirely.

## Risks

- **Form complexity.** This is the largest single page S7's epic ships. Mitigation: phase the work — P3 lands form fields without sub-creation; P4 layers sub-creation on top. Each phase ends with a working surface.
- **JS bloat in `cenas-form.js`.** Autocomplete + sub-creation modal + voice mutex toggle → real client logic. Mitigation: keep it framework-free (vanilla JS, fetch, DOM manipulation), match the existing `chat.js` style, no new bundler step.
- **`is_draft` interplay with reception.** A stub persona in a cena's cast will be picked by reception when the cena is applied. If the descriptor is too thin, reception's fallback behavior (skip persona on parse drift) keeps the system safe — but the user might see "no persona applied" without obvious cause. Mitigation: the stub mini-form's optional `descrição` field becomes the persona's content stub, giving reception something to work with. Edge case documented in test-guide.
- **Strangler chrome.** /cenas/* using sidebar in S7 → migrating to avatar bar in S2 means a small chrome refactor when S2 lands. Acceptable cost; the page content (the form) doesn't change.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Story docs** | `docs/.../cv1-e11-s7-cena-form/{index,plan,test-guide}.md` | User reads. |
| 2 | **Routes + skeleton form** | `adapters/web/index.tsx` (7 routes); `adapters/web/pages/cenas-form.tsx` (form skeleton, no autocomplete); `server/db/sessions.ts` (createFreshSession extension) | New tests in `tests/cenas-routes.test.ts` + `tests/sessions-scene-creation.test.ts` green; full suite green. |
| 3 | **Form complete + voice mutex + dual save + i18n** | Form fields fully wired; `[Salvar e iniciar conversa]` flow; en + pt-BR strings in `adapters/web/locales/`; `cenas-form.js` minimal (voice toggle, no autocomplete yet) | Manual smoke (Test 1, 2 of test-guide); full suite green. |
| 4 | **Stub-first inline sub-creation + is_draft** | Schema ALTER for is_draft (3 tables); helpers in `db/identity.ts`/`organizations.ts`/`journeys.ts`; autocomplete + mini-form in `cenas-form.js`; `tests/cenas-sub-creation.test.ts` | New tests green; manual smoke (Test 3, 4 of test-guide); full suite green. |
| 5 | **Wrap-up** | worklog, decisions, badges; cache-bust bump | Full smoke (test-guide all tests); commit per phase. |

## Docs

- [Plan](plan.md) — phase-by-phase implementation
- [Test guide](test-guide.md) — manual browser smoke
- [Epic — CV1.E11](../) — scope and surrounding stories
- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md) — locked decisions
