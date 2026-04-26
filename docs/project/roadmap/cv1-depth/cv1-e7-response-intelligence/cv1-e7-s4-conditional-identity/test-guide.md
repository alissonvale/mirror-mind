[< Story](index.md)

# Test guide — CV1.E7.S4 Conditional identity layers

Manual roteiro to validate the new conditional composition of `self/soul` and `ego/identity` in the browser.

## Pre-conditions

- Dev server running with the S4 build deployed.
- Hard reload to pick up any client changes.
- A user with non-empty `self/soul` and `ego/identity` layers (so a non-empty block exists to be either composed or skipped).
- Open `Look inside ›` (admin only) — phase 6 of S9 added the snapshot rendering, so the rail's `Composed` section will show which layers actually composed.

## Test 1 — Casual message (identity should skip)

**Send:** `bom dia` (or any casual greeting).

**Expected:**

- The composed prompt skips `self/soul` and `ego/identity`.
- `Look inside ›` Composed section shows a reduced layers list — typically just `ego.behavior` (plus the adapter instruction at the very end, which is short).
- The reply is light, conversational, no existential framing.
- SQL sanity (optional):
  ```bash
  sqlite3 ~/Code/mirror-mind/data/mirror.db "
  SELECT json_extract(data, '\$._touches_identity') AS ti
  FROM entries
  WHERE session_id = (SELECT id FROM sessions WHERE user_id = (SELECT id FROM users WHERE name = 'Alisson Vale') ORDER BY created_at DESC LIMIT 1)
    AND json_extract(data, '\$.role') = 'assistant'
  ORDER BY timestamp DESC LIMIT 1;
  "
  ```
  Expected: `0` (false). Reception classified the greeting as non-identity.

**Why this validates:** the heaviest layers no longer compose on the modal turn. Pre-S4, soul + identity loaded on every greeting; post-S4, both stay quiet.

## Test 2 — Operational message (identity should still skip)

**Send:** something operational with no identity framing. Example: *"Compare VMware and Proxmox for my homelab migration."*

**Expected:**

- Composed prompt has persona (if reception activates one — typically a technical persona), scope (if a journey/org is pinned and matches), `ego/behavior`, and the adapter instruction. **No `self/soul`, no `ego/identity`.**
- `Look inside ›` confirms — layers list shows no `self.soul`, no `ego.identity`.

**Why this validates:** S4 doesn't accidentally turn identity on for technical questions just because they're long or compositional. Mode and identity are independent axes.

## Test 3 — Identity-touching message (identity should compose)

**Send:** something explicitly about identity, purpose, or values. Examples (pick one):

- *"Help me think about who I am right now."*
- *"How should I think about leaving vs staying?"*
- *"O que eu valorizo de verdade?"*
- *"Estou perdendo o sentido do que faço."*

**Expected:**

- Composed prompt **includes** `self/soul` and `ego/identity` (you can confirm via Look inside — both rows present in the layers list).
- The reply has the depth and framing the soul + identity layers carry.
- SQL sanity: `_touches_identity` is `1` (true) on this assistant entry.

**Why this validates:** the new axis correctly activates on identity-touching messages. The conservative default doesn't accidentally suppress identity on the turns it actually serves.

## Test 4 — Border case: short first-person on a deep topic

**Send:** *"Estou cansado hoje."* (or *"I don't know what I want anymore."*)

**Expected:**

- Composed prompt **skips** identity layers (form-beats-topic rule applies — short first-person statement is conversational + identity-conservative).
- `_touches_identity` is `false`.
- The reply matches the form: short, close, no essay.

**Why this validates:** form beats topic on the identity axis the same way it does on the mode axis. The user's chosen brevity isn't overridden by the developmental subject matter.

## Test 5 — Reload check

After running tests 1–4, hit **F5**.

**Expected:**

- The conversation re-renders with the same composed snapshots per turn (the rail reads `_touches_identity` from each entry's meta).
- Layers list per assistant turn matches what was rendered live during streaming.

**Why this validates:** the meta stamp persists the gate decision so server-render after reload reproduces the live state.

## Failure modes to watch for

If any of these surface, S4 has a regression:

- **Pre-S4 leak:** `self.soul` or `ego.identity` appears in the Look inside layers list on a clearly casual / operational turn.
- **False suppression:** an identity-touching message produces a stripped prompt (no soul/identity), yielding a generic-feeling response.
- **Snapshot drift:** Look inside shows different layers from what actually composed (e.g., layers list says skipped but the response is clearly identity-framed).
- **Reception starvation:** every turn shows `_touches_identity: false`, including identity-touching ones — suggests the prompt's classification rules need calibration.

## Calibration loop (post-smoke)

If false suppression is the dominant failure mode (identity-touching turns being missed), the most likely fix is in reception's system prompt: the examples may need expanding, the "identity-conservative tiebreaker" wording may need softening, or the candidate signals may need richer description. Calibration is iteration on the prompt; the code path itself is mechanical.

If false activation is dominant (identity firing on operational turns), the prompt is being too generous — tighten the trigger conditions, sharpen the form-beats-topic guidance for the identity axis.

Either direction, the calibration sub-story would be **CV1.E7.S2b — reception calibration** (already parked; can be expanded to cover identity classification too).

## Automated coverage

The contract is pinned at the unit level:
- `tests/reception.test.ts` — 8 tests covering the new axis (true/false/missing/null/failure/no-candidates short circuit, prompt content).
- `tests/identity.test.ts` — 8 tests covering composer gate (independence, defaults, order preservation).
- `tests/composed-snapshot.test.ts` — 4 tests covering snapshot layer filtering.

Manual smoke is the validation that the new gate integrates cleanly with reception's classification, the composer's existing layers, the snapshot UI, and the persistence path across reload.
