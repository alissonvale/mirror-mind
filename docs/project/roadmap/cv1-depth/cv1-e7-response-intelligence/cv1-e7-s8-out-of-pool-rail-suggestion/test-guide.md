[< Story](index.md)

# Test guide — CV1.E7.S8 Out-of-pool rail suggestion

Manual roteiro to validate the suggestion card + divergent run flow in the browser.

## Pre-conditions

- Dev server running with the S8 build deployed.
- Hard reload to pick up `chat.js?v=out-of-pool-1` and `style.css?v=out-of-pool-1`.
- A user with at least:
  - Two personas, one of which has a clear domain that's *outside* the area you're going to ask about. For Dan: `engineer` (IT) + a woodwork-coverage persona (`maker` or similar).
  - OR two organizations / journeys with similar separation.
- A session pinned to a constrained pool — e.g., for Dan, cast = `[engineer]` only (no `maker` in the session pool).

The whole point is to set up the constraint that S3 closes (no scope leak) and S4 closes (no identity leak) but still leaves visible: the cast is locked, and the right voice for some questions lives outside the lock.

## Test 1 — Trigger out-of-pool detection

Send a message that lives clearly outside the constrained pool's domain. For Dan:

> *"What's the difference between a Stanley No. 4 and No. 5 bench plane?"*

**Expected during streaming:**

- Canonical assistant bubble starts rendering with whatever in-pool persona reception picks (most likely `engineer`).
- The response from engineer comes back.
- **Below the bubble**, a small subtle card appears:

```
╭ ◇ maker may have something to say.       [Hear it] ╮
```

- The card is dashed, low-contrast, and clearly separate from the assistant bubble itself.

**Expected DB state** (sanity SQL after this turn):

```bash
sqlite3 ~/Code/mirror-mind/data/mirror.db "
SELECT json_extract(data, '\$._personas') AS personas,
       json_extract(data, '\$._mode') AS mode
FROM entries
WHERE session_id = (SELECT id FROM sessions WHERE user_id = (SELECT id FROM users WHERE name = 'Dan Reilly') ORDER BY created_at DESC LIMIT 1)
  AND json_extract(data, '\$.role') = 'assistant'
ORDER BY timestamp DESC LIMIT 1;"
```

Personas array should be `["engineer"]` (canonical), confirming the canonical pick wasn't swapped — only flagged.

## Test 2 — Click the suggestion

Click the **Hear it** button on the suggestion card.

**Expected:**

- Button transitions to *"Running…"* and disables.
- After 2-5s (the divergent run's pipeline call), the card collapses (button removed) and a sub-bubble renders **inside the same `.msg-body`**, below the canonical:

```
[user message]

◇ engineer canonical bubble:
[engineer's response]

  ◇ maker — divergent run            ← italic badge
  ┌─────────────────────────────────┐
  │ [maker's response, indented,    │
  │  smaller font, color bar]       │
  └─────────────────────────────────┘
```

- The maker bubble's content is markdown-rendered (lists, emphasis, code blocks all work).

**Expected DB state:**

```bash
sqlite3 ~/Code/mirror-mind/data/mirror.db "
SELECT id, parent_entry_id, override_type, override_key,
       substr(content, 1, 60) AS content_preview
FROM divergent_runs
ORDER BY created_at DESC LIMIT 1;"
```

A new row, `override_type='persona'`, `override_key='maker'`, content matching what rendered.

## Test 3 — Reload check

Hit **F5**.

**Expected:**

- The canonical bubble re-renders normally.
- The divergent sub-bubble **persists** below it (server-rendered from `divergent_runs` joined to the session's entries).
- Markdown re-renders correctly.
- The suggestion card does NOT re-appear (it was a per-streaming-turn UI, not server-rendered).

This validates the persistence + server-render path.

## Test 4 — Cast unchanged

Send another in-domain message, e.g., *"How do I move the Plex VM to the new Proxmox host?"*

**Expected:**

- Canonical assistant bubble with `engineer` (cast unchanged — `maker` did NOT enter the session pool).
- The divergent run was a one-turn override, not a permanent cast change.

**SQL sanity:**

```bash
sqlite3 ~/Code/mirror-mind/data/mirror.db "
SELECT GROUP_CONCAT(persona_key)
FROM session_personas
WHERE session_id = (SELECT id FROM sessions WHERE user_id = (SELECT id FROM users WHERE name = 'Dan Reilly') ORDER BY created_at DESC LIMIT 1);"
```

Should still be just `engineer`. No `maker`.

## Test 5 — No suggestion when reception's pick is in-pool

Send a message that the in-pool persona cleanly covers, e.g., *"How does Proxmox handle live migration?"*

**Expected:**

- Canonical bubble with `engineer` (clean fit; not a stretch).
- **No suggestion card** below the bubble.

This validates that S8 is conservative: only flags when the out-of-pool candidate is strictly better, not on every turn that has out-of-pool options.

## Test 6 — Forget cascades

Pick the parent assistant entry (the engineer bubble from Test 1) and click the × delete button. Confirm.

**Expected:**

- The user message and engineer bubble disappear from the conversation.
- The divergent sub-bubble (maker) **also disappears** — the cascade-on-delete in the divergent_runs FK takes care of it.

**SQL confirmation:**

```bash
sqlite3 ~/Code/mirror-mind/data/mirror.db "SELECT COUNT(*) FROM divergent_runs;"
```

Count should reflect that divergent runs attached to deleted entries are gone.

## Failure modes to watch for

- **Suggestion appears for clearly in-domain messages** — reception over-flagging out-of-pool. Likely needs prompt calibration (more conservative phrasing in the rule text).
- **Divergent bubble carries the wrong content / layout** — check that `data-override-type` attribute is set correctly and CSS rule for `.divergent-bubble-content` applies.
- **Cast changes after divergent run** — would mean the divergent endpoint is mutating session_personas. It shouldn't. SQL above (Test 4) catches this.
- **Divergent run enters next turn's history** — would mean `loadMessages` is reading from `divergent_runs`. It shouldn't (separate table). The `tests/divergent-runs.test.ts` regression guard catches this programmatically too.

## Automated coverage

- `tests/reception.test.ts` — 8 new tests for the would_have_X axes (success, drift guard, parser strictness, prompt structure).
- `tests/divergent-runs.test.ts` — 9 tests for persistence (insert, load, ordering, session scoping, cascade on parent delete, history exclusion).
- 689 tests passing total.

Manual smoke is what validates the integration: reception → SSE event → suggestion card → click → divergent endpoint → sub-bubble render → reload persistence.
