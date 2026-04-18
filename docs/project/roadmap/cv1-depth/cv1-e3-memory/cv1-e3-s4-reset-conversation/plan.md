[< Story](index.md)

# Plan: CV1.E3.S4 — I can reset my conversation

**Roadmap:** [CV1.E3.S4](../index.md)
**Framing:** manual session boundary-setting, as the user-initiated complement to the future automatic topic-shift detection (S1). The user declares when one thread ends and another begins.

---

## Goal

Two actions on `/mirror`, both operating on the current session:

- **Begin again.** End the current session and create a fresh one. The old session and its entries stay in the DB, preserved for future recall (via the episodic browse surface on the CV0.E2 radar). The chat page reloads empty; the rail shows a fresh state.
- **Forget this conversation.** Destructive. Delete the current session's entries and the session row, then create a fresh new session. Irrecoverable. Requires explicit confirmation.

Both actions live in the **Rail footer** — the rail is where attention memory surfaces, and session lifecycle is an action on attention.

## Non-goals

- **Automatic topic-shift detection.** That's S1. This story is the manual version; S1 calibrates the automatic version against user patterns the manual control reveals.
- **Browse old sessions via UI.** Sessions preserved by Begin again accumulate in the DB; they're not browsable until the **Episodic memory surface** lands (CV0.E2 radar). The known incomplete is intentional — without preservation now, there'd be no history to browse later.
- **Undo for Forget.** Destructive by design; an undo would undermine the promise.
- **Session naming or tagging.** Sessions are anonymous time slices for v1. Naming would be nice later but doesn't belong to this story.
- **Cross-device session sync.** Out of scope — each client connects to one server, one user's sessions.

## Decisions

### D1 — Action placement: Rail footer

The rail shows what the mirror is paying attention to *right now*. An action that ends what it's paying attention to belongs there. Placing the actions inside the chat form or above the input would conflate "write a message" with "end this thread" in the same visual region. The rail already has a footer (the "Grounded in your identity" link); the actions join it there.

### D2 — Progressive disclosure: primary + secondary

**Begin again** is the common, safe case and gets a visible button. **Forget** is rare and destructive — lives behind a small affordance (secondary link/text below the primary). Equal-weight buttons would miscalibrate frequency and safety.

### D3 — Voice

- Primary: **Begin again.** Two words; active; mirror-voiced — "begin" carries more weight than "start", "again" suggests return.
- Destructive: **Forget this conversation.** Psychological, aligned with memory framing. Avoids the technical "delete" while still being honest about what it does.

### D4 — Confirmation

- Begin again: no confirm. The act is reversible-ish — old session is preserved, future episodic browse will surface it.
- Forget: native `window.confirm("Forget this conversation? This cannot be undone.")`. Adds honest friction without ceremony.

### D5 — What the server does

- Begin again: `POST /mirror/begin-again` → new helper `createFreshSession(db, userId)` that always INSERTs, never reuses. Redirect to `/mirror`.
- Forget: `POST /mirror/forget` → new helper `forgetSession(db, sessionId)` that deletes entries (by session_id) and the session row, then creates a fresh one. Redirect to `/mirror`.

Both paths end at the same "user lands on fresh `/mirror`" state.

## Steps

1. **DB helpers** (`server/db/sessions.ts`):
   - `createFreshSession(db, userId)` — always INSERTs and returns the new id.
   - `forgetSession(db, sessionId)` — DELETE FROM entries WHERE session_id = ?, then DELETE FROM sessions WHERE id = ?. Returns nothing.
   - Both exported from `server/db.ts`.
2. **Routes** (`adapters/web/index.tsx`):
   - `POST /mirror/begin-again` — create fresh session for current user, redirect `/mirror`.
   - `POST /mirror/forget` — read current session id from `getOrCreateSession`, call `forgetSession`, call `createFreshSession`, redirect `/mirror`.
3. **UI** (`adapters/web/pages/context-rail.tsx`):
   - Rail footer gains an action block below the "Grounded in your identity" line: a `<form>` with `POST /mirror/begin-again` and a button "Begin again", plus a secondary link/button "Forget this conversation" wired to `POST /mirror/forget` with `onclick="return confirm(...)"`.
4. **CSS** (`adapters/web/public/style.css`): small treatment for the action block; primary button muted (not screaming), secondary as small italic link in the same family as the map's destructive persona action.
5. **Tests** (`tests/web.test.ts`):
   - POST /mirror/begin-again creates a new session; old session still exists in DB.
   - POST /mirror/forget deletes entries + session row; a new fresh session is created.
   - Both redirect to /mirror.
6. **Docs**: test-guide.md, worklog, mark S4 done, review pass.

## Known incomplete

- **No UI for preserved sessions.** After a Begin again, the old session stays in the DB but there's no surface to view it. The [Episodic memory surface](../../../cv0-foundation/cv0-e2-web-experience/index.md#radar) on the CV0.E2 radar is where that lands, likely alongside CV1.E3's semantic memory work. The preservation in S4 is the foundation for that future surface.

## Files likely touched

- `server/db/sessions.ts` — two new helpers
- `server/db.ts` — re-exports
- `adapters/web/index.tsx` — two new routes
- `adapters/web/pages/context-rail.tsx` — footer actions
- `adapters/web/public/style.css` — styling
- `tests/web.test.ts` — coverage
