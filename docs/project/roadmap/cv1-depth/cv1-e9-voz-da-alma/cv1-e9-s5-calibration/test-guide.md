[< Story](index.md)

# Test guide — CV1.E9.S5 Calibration smoke

End-to-end manual roteiro for validating the Voz da Alma path against the live model. Run after S1-S4 ship.

## Pre-conditions

- `npm run dev` running locally with the S1-S5 build deployed.
- Hard reload (Cmd-Shift-R) to pick up the new `chat.js?v=enviar-para-1` and `style.css?v=enviar-para-1`.
- Logged in as Alisson (the user with `self/doctrine` seeded).
- Open `Look inside ›` (admin only) so you can verify the composed snapshot per turn.

## Seeding (one-time)

Before the first smoke run, seed Alisson's `self/doctrine` from the included markdown:

```bash
cd ~/Code/mirror-mind
npm run admin -- identity set "Alisson Vale" --layer self --key doctrine --file docs/seed/alisson/doctrine.md
```

Verify:

```bash
sqlite3 ~/Code/mirror-mind/data/mirror.db \
  "SELECT layer, key, length(content) AS chars FROM identity \
   WHERE user_id = (SELECT id FROM users WHERE name='Alisson Vale') \
     AND layer='self'"
```

Expected: two rows — `self/soul` (chars > 0) and `self/doctrine` (chars > 0).

## Test 1 — Casual greeting (canonical path, no Alma)

**Begin a fresh conversation** (sidebar → Begin again). **Send:** `bom dia`.

**Expected:**
- Bubble carries no Alma label, no persona signature.
- `Look inside` Composed section shows a minimal layers list — typically just `ego.behavior` (no `self.soul`, no `self/doctrine`, no `ego.identity`).
- The Alma indicator row in Look inside is hidden.
- SQL sanity:
  ```bash
  sqlite3 ~/Code/mirror-mind/data/mirror.db "
    SELECT json_extract(data, '\$._is_alma') AS alma,
           json_extract(data, '\$._touches_identity') AS ti
    FROM entries
    WHERE session_id = (SELECT id FROM sessions WHERE user_id =
                        (SELECT id FROM users WHERE name='Alisson Vale')
                        ORDER BY created_at DESC LIMIT 1)
      AND json_extract(data, '\$.role') = 'assistant'
    ORDER BY timestamp DESC LIMIT 1;
  "
  ```
  Expected: `alma=NULL, ti=0`.

**Validates:** the auto-detector doesn't fire Alma on greetings (false-positive guard).

## Test 2 — Apontamento de vida (Alma engages)

In the same or a fresh session, **send** something registry-shaped, e.g.:

> hoje terminei uma conversa com um aluno e fiquei pensando o resto da tarde

**Expected:**
- Bubble carries the **◈ Voz da Alma** label.
- No persona signature, no persona avatar, no color bar tied to a persona.
- Reply tone is impersonal-but-firm, sereno-elevado, 1-3 short paragraphs. Cites at least one of the 9 Princípios from doctrine if it ressoam organically (not forced).
- `Look inside` Composed section shows: `self.soul · self.doctrine · ego.identity · ego.behavior` (the full identity cluster). The Alma indicator row reads `◈ Voz da Alma`.
- SQL sanity: `alma=1, ti=1`.

**Validates:** the Alma path engages on a clear apontamento, the doctrine layer composes, and the rail labels the turn.

## Test 3 — Functional question (canonical path)

**Send:** `compare VMware e Proxmox para uso doméstico`.

**Expected:**
- Bubble carries a persona signature (likely `tecnica` or `engineer`-ish), NOT Alma.
- Reply has technical structure (compositional mode).
- `Look inside`: persona block + `ego.behavior` + (probably) `ego.identity` if reception flagged identity. NO `self.doctrine` if reception kept identity false.

**Validates:** functional questions go through the persona path even after Alma exists in the system. No regression.

## Test 4 — Analytical reflection (canonical path — the trap)

**Send:** something analytical-but-personal-sounding:

> estou pensando sobre estratégia de divulgação para o público da Software Zen

**Expected:**
- Bubble carries persona signature (likely `estrategista` and/or `divulgadora`), NOT Alma.
- Reply is structured / strategic, NOT Alma's wise-voice.
- `Look inside`: persona blocks present, no Alma row.

**Validates:** "first-person verb but conceptual" doesn't fire Alma. This is the most likely false-positive class; a fail here means the prompt's class definitions need iteration.

## Test 5 — Forced Alma override on a functional message

**Send (via "Enviar Para… → Voz da Alma"):** `qual a melhor forma de cobrar emolumentos?`

(I.e., type a clearly functional question, then click "Enviar Para…" and pick "◈ Voz da Alma".)

**Expected:**
- Bubble carries the ◈ Alma label.
- Reply is the Alma's wise voice, NOT a tax expert. Even on a functional question, the override forces the Alma path.
- SQL sanity:
  ```bash
  sqlite3 ~/Code/mirror-mind/data/mirror.db "
    SELECT json_extract(data, '\$._is_alma') AS alma,
           json_extract(data, '\$._forced_destination') AS forced,
           json_extract(data, '\$._reception_is_self_moment') AS auto_alma
    FROM entries
    WHERE session_id = (SELECT id FROM sessions WHERE user_id =
                        (SELECT id FROM users WHERE name='Alisson Vale')
                        ORDER BY created_at DESC LIMIT 1)
      AND json_extract(data, '\$.role') = 'assistant'
    ORDER BY timestamp DESC LIMIT 1;
  "
  ```
  Expected: `alma=1, forced=alma, auto_alma=0`.

**Validates:** the manual override wins over reception's auto verdict, and the labeled-data fields persist for future calibration analysis.

## Test 6 — Forced persona override on an apontamento

**Send (via "Enviar Para… → mentora" — assuming mentora is in the persona inventory):**

> hoje senti que travei numa conversa com um aluno

**Expected:**
- Bubble carries the ◇ mentora signature, NOT the Alma label.
- Reply is the mentora's voice, not the Alma's.
- SQL sanity: `alma=NULL` (no `_is_alma`), `forced=persona:mentora`, `auto_alma=1` (reception thought it was Alma but the user picked otherwise).

**Validates:** the manual override forces the persona path even when reception classified the message as a self-moment.

## Test 7 — F5 reload reproduces the routing

After running tests 1-6, hit **F5**.

**Expected:** every assistant bubble re-renders with the same label and the same Look inside layers. The `_is_alma` and `_forced_destination` meta fields persist; the rail's derivation honors them.

**Validates:** the meta-stamping path round-trips correctly.

## Failure modes to watch for

If any of these surface, mark calibration incomplete:

- **False Alma fire** — a clearly functional or analytical message routes to Alma. Expand the class-3 examples in `server/reception.ts`.
- **False persona fire** — a clear apontamento routes to persona. Expand the class-1 examples or sharpen the form-signal language.
- **Alma but missing doctrine** — the Alma's reply doesn't cite any principle even when the moment ressoam. Either: doctrine wasn't seeded (re-run admin command) or composer skipped it (check the composer Alma path).
- **Persona override produces Alma reply** — backend override semantics broken (S4 wiring regression).
- **Rail Alma indicator shows on persona turns** — rail labeling regression.
- **Look inside layers list disagrees with the actual reply tone** — snapshot drift; check `composedSnapshot` `isAlma` plumbing.

## Calibration loop

If smoke surfaces consistent mis-classification, iterate the reception system prompt in `server/reception.ts` (the `is_self_moment` block — class definitions, examples, form signals). Re-run the contract tests (`tests/voz-da-alma-calibration.test.ts`) after each tweak to ensure parser drift didn't sneak in. Re-run the smoke after each prompt iteration on the failing case.

## Automated coverage

The contract probe (`tests/voz-da-alma-calibration.test.ts`) covers 18 representative messages — 6 apontamento, 4 functional, 4 analytical, 4 edge cases. It validates parser → routing fidelity for the canonical class taxonomy. Live-LLM classification quality is validated by this manual smoke alone (no eval harness in v1).
