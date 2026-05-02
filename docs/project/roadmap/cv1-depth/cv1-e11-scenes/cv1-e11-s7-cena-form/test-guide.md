[< Story](index.md)

# Test guide — CV1.E11.S7 Cena form smoke

End-to-end manual smoke for the form. Run after each phase ships (Tests 1-2 after P3, Tests 3-4 after P4, Test 5 after P5).

## Pre-conditions

- `npm run dev` running locally with the latest build.
- Hard reload (Cmd-Shift-R) to pick up `cenas-form.js?v=cenas-form-1`.
- Logged in as Alisson (admin).
- A backup of `data/mirror.db` taken before the run (safety: this exercises real CRUD on the prod-shape DB).

## Test 1 — Persona cena: create + edit + delete (P3)

1. Navigate to `http://localhost:3000/cenas/nova`.
2. Fill:
   - **Título:** "Aula Nova Acrópole"
   - **Padrão temporal:** "qua 20h"
   - **Briefing:** (paste a 2-3 sentence description)
   - **Voz:** Persona (default)
   - **Elenco:** type `pensadora` (assumes the persona exists; if not, leave empty for now — Test 3 covers stub creation)
   - **Organização:** type `nova-acropole` if it exists; else leave empty
   - **Travessia:** type `vida-filosofica` if it exists; else leave empty
   - **Avançado:** leave auto/auto
3. Click `[Salvar]`.
4. **Expected:** redirected to `/cenas/aula-nova-acropole/editar?saved=created`. All fields pre-filled with what you entered.
5. Change the title to "Aula Nova Acrópole — quartas". Click `[Salvar]`.
6. **Expected:** title persists. SQL sanity:

```bash
sqlite3 data/mirror.db "SELECT key, title, voice FROM scenes WHERE key='aula-nova-acropole'"
# Expected: aula-nova-acropole|Aula Nova Acrópole — quartas|
```

7. Click `[Excluir]` (or POST manually to `/cenas/aula-nova-acropole/delete`).
8. **Expected:** redirected to `/`. SQL confirms cena gone:

```bash
sqlite3 data/mirror.db "SELECT key FROM scenes WHERE key='aula-nova-acropole'"
# Empty result.
```

**Validates:** create + edit + delete + slugified key derivation + form pre-fill on edit.

## Test 2 — Voz da Alma cena: voice mutex + Salvar e iniciar (P3)

1. Navigate to `/cenas/nova`.
2. Fill **Título:** "Voz da Alma".
3. Click the **Voz: Voz da Alma** radio.
4. **Expected:** the **Elenco** field hides immediately (no page reload).
5. Click **Voz: Persona** to flip back. Elenco reappears empty.
6. Flip to Alma again. Click `[Salvar e iniciar conversa]`.
7. **Expected:** redirected to `/conversation/<sessId>` (some UUID).
8. Look at the URL — copy the session id. SQL:

```bash
SESS_ID=<uuid-from-url>
sqlite3 data/mirror.db "
  SELECT s.scene_id, sc.key, sc.voice
  FROM sessions s LEFT JOIN scenes sc ON sc.id = s.scene_id
  WHERE s.id = '$SESS_ID'
"
# Expected: <scene-uuid>|voz-da-alma|alma
```

9. Send a message in the conversation (e.g., "estou em um momento difícil hoje à noite"). The cena's briefing is NOT yet wired into composition (S1 territory) — but the session does carry the `scene_id`. Confirm via SQL above.

**Validates:** voice mutex (UI side), Alma cena creation, `[Salvar e iniciar conversa]` chains create-cena → create-session → redirect.

## Test 3 — Stub-first: inline persona creation (P4)

1. Navigate to `/cenas/nova`.
2. Fill **Título:** "Diário".
3. In **Elenco**, type `diaristra-test` (a persona that doesn't exist).
4. **Expected:** autocomplete dropdown shows `+ Criar persona "diaristra-test"` as the only/last item.
5. Click it. A mini-form expands inline:
   - **Nome:** `diaristra-test` (pre-filled from typed text)
   - **Key:** `diaristra-test` (auto-derived, editable)
   - **Descrição:** (empty)
6. Type a one-line description: `Lente para registros de diário e fragmentos do dia.`
7. Click `[Salvar como rascunho]`.
8. **Expected:** mini-form collapses; chip `diaristra-test` appears in Elenco. SQL sanity:

```bash
sqlite3 data/mirror.db "
  SELECT layer, key, is_draft, substr(content, 1, 60) as preview
  FROM identity
  WHERE user_id = (SELECT id FROM users WHERE name='Alisson Vale')
    AND key='diaristra-test'
"
# Expected: persona|diaristra-test|1|Lente para registros de diário e fragmentos do dia.
```

9. Click `[Salvar]` on the cena form.
10. Navigate to `/personas/diaristra-test`.
11. **Expected:** workshop opens with `rascunho` badge near the title. Description is the one-line text.
12. Edit the description (add a paragraph), save.
13. **Expected:** `rascunho` badge disappears. SQL: `is_draft=0` now.
14. Cleanup: delete the cena, delete the persona via the workshop.

**Validates:** stub persona creation, draft flag, promote-on-edit, autocomplete UX.

## Test 4 — Stub-first: org and journey (P4)

Same flow as Test 3 but for org and journey:

1. `/cenas/nova` → Título "Test Org Stub" → Organização: type `test-org-stub-2026` → autocomplete suggests `+ Criar organização` → mini-form → save as draft.
2. SQL: `SELECT key, is_draft FROM organizations WHERE key='test-org-stub-2026'` → `test-org-stub-2026|1`.
3. Same for journey: `/cenas/nova` → Travessia: type `test-journey-stub-2026` → save as draft → SQL confirms `is_draft=1`.
4. Cleanup: delete the cenas; delete the org and journey via their workshops.

**Validates:** symmetric stub creation across all three sub-entity types.

## Test 5 — Stub commits survive cena form cancellation (P4)

1. `/cenas/nova` → Título "Cancel Test" → Elenco: create stub persona `cancel-test-persona` via the inline flow.
2. **Without saving the cena**, navigate away (click another sidebar link, or close the tab).
3. **Expected:** confirm prompt fires (beforeunload — "you have unsaved changes"). Click "Leave".
4. SQL:

```bash
sqlite3 data/mirror.db "SELECT key, is_draft FROM identity WHERE key='cancel-test-persona'"
# Expected: cancel-test-persona|1
```

The persona stub persists even though the cena was never saved. This is intentional — creation has cognitive cost; undoing surprises.

5. Cleanup: delete the persona.

**Validates:** stub commits are NOT transactional with the cena form; the "Salvar como rascunho" label correctly signals the commit.

## Sign-off

If all 5 tests pass, S7 is ready for the wrap-up phase (P5 docs/badges). The cena form is now the entry point for cena CRUD; S1 can render real cards from the resulting data.
