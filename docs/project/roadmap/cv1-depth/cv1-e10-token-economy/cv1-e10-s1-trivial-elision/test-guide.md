[< Story](index.md)

# Test guide — CV1.E10.S1 Trivial turn elision

End-to-end manual roteiro for validating the new minimal-composer path.

## Pre-conditions

- `npm run dev` running with the S1 build deployed.
- Hard reload (Cmd-Shift-R) for any asset changes.
- Logged in as Alisson (admin so the rail is visible).
- Open `/admin/llm-logs` in a second tab so you can inspect what the model received per turn.

## Test 1 — "boa noite" composes nothing identity-side

Begin a fresh session. Send `boa noite`.

**Expected:**
- The reply streams back briefly (1-2 sentences).
- Open `/admin/llm-logs` and find the most recent `main` row. Inspect the `system_prompt` field — it should be **just the adapter instruction** (the "You are talking in a web interface…" block), with NO `ego/behavior`, NO `self/soul`, NO `ego/identity`, NO persona.
- The `Look inside` rail's Composed block is hidden (empty layers → existing CSS hides it).
- SQL sanity:
  ```bash
  sqlite3 ~/Code/mirror-mind/data/mirror.db "
    SELECT json_extract(data, '\$._is_trivial') AS triv,
           json_extract(data, '\$._is_alma') AS alma,
           json_extract(data, '\$._touches_identity') AS ti
    FROM entries
    WHERE session_id = (SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1)
      AND json_extract(data, '\$.role') = 'assistant'
    ORDER BY timestamp DESC LIMIT 1;
  "
  ```
  Expected: `triv=1, alma=NULL, ti=0`.

**Validates:** the trivial path engages on a clean greeting, the composer skips even the always-on behavior layer, and the meta stamp persists for F5 reload.

## Test 2 — "ok" mid-session also flips trivial

Send `ok` after a previous substantive turn.

**Expected:**
- Same minimal system_prompt in the LLM log.
- Reply is a brief acknowledgment back ("De nada", "Tô aqui", or similar).
- `_is_trivial: 1` on the new assistant entry.

**Validates:** trivial isn't only about session-opening — any acknowledgment-shape turn flips it.

## Test 3 — "obrigado" trivial; "obrigado, isso ajudou demais" not trivial

Send `obrigado`.

**Expected:** `_is_trivial: 1`, minimal prompt.

In a different session (or after a reset), send `obrigado, isso ajudou demais`.

**Expected:** `_is_trivial: 0`, canonical pipeline. The reception prompt's border-case rule kicks in — acknowledgment WITH affirmation gets a real response.

**Validates:** the (trivial)↔(short-but-meaningful) line is calibrated correctly.

## Test 4 — "tô cansado hoje" is NOT trivial (apontamento)

Send `tô cansado hoje`.

**Expected:**
- `_is_trivial: 0`, `_is_alma: 1`. Apontamento de vida wins over apparent triviality.
- Alma path engages with full identity cluster.

**Validates:** mutual exclusion enforced — short first-person statement with weight is never trivial.

## Test 5 — "oi, preciso de uma coisa" is NOT trivial (greeting + ask)

Send `oi, preciso de uma coisa`.

**Expected:**
- `_is_trivial: 0`. The greeting is paired with an opening ask — the pipeline runs canonical.

## Test 6 — "Enviar Para…" override on a trivial turn

Send `boa noite` via "Enviar Para… → Voz da Alma".

**Expected:**
- The forced override wins over reception. `_forced_destination: "alma"`, `_is_alma: 1`, `_is_trivial: 0` (or NULL).
- Alma responds in voice (some flavor of greeting back integrated through the Alma preamble).

**Validates:** manual override still wins over auto routing, including over the trivial path.

## Test 7 — F5 reload reproduces routing

After running tests 1-6, hit **F5**.

**Expected:** every assistant bubble re-renders with the same composed snapshot (trivial turns show empty Composed rail block; canonical turns show their layers; Alma turns show full identity cluster + Alma indicator).

## Failure modes to watch for

- **Trivial fires on a substantive turn.** Open the LLM log for that turn — was reception's classification wrong (`is_trivial: true` for a clear apontamento)? If reproducible, expand the "NOT trivial" examples in `server/reception.ts`.
- **Trivial NEVER fires.** Send `boa noite` and check the log — is `is_trivial: false`? Reception prompt or parser regression. Verify the system_prompt content includes the trivial classification block.
- **Both is_trivial and is_alma stamped true.** Mutual exclusion broken. Pipeline guard (the `&& reception.is_self_moment !== true` check) regressed.
- **Empty system_prompt but reply feels mirror-flavored anyway.** Adapter instruction still includes form rules — that's fine. The minimal path is intentionally not "zero prompt"; it's "only adapter".
- **Reply too generic / off-tone for the mirror.** This is the v2 trigger — start collecting examples. If reproducible, S1b adds a 30-token baseline ("you are the user's personal mirror; respond briefly and warmly in their language, no preamble").

## Calibration loop

Same as the other reception axes:
1. Notice mis-classification in real use.
2. Open `/admin/llm-logs` and read reception's `system_prompt` for that turn — were the examples expressive enough?
3. Iterate the trivial section in `server/reception.ts`.
4. Re-run the contract probes (`tests/voz-da-alma-calibration.test.ts`) to ensure parser drift didn't sneak in.
5. Re-test the failing case manually.
