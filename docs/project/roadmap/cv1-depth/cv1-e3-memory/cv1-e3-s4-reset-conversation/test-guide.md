[< Story](index.md)

# Test Guide: CV1.E3.S4 — Reset conversation

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- **POST /mirror/begin-again** creates a new session while preserving the old one and its entries. `getOrCreateSession` returns the new, empty session on the next call.
- **POST /mirror/forget** deletes the current session's entries and the session row entirely, then creates a fresh one. Old rows gone, new session empty.
- **The mirror page renders the Begin again and Forget actions** in the rail.

Total: **126 passing**.

## Manual (browser)

### Begin again

1. Open `/mirror`, send a few messages.
2. Scroll the rail to the footer — below "Grounded in your identity" you see the session actions block.
3. Click **Begin again**. The page reloads with an empty chat. The rail resets: `0 messages`, no persona badge, base composition only.
4. In the DB, the old session row is still there with its entries. A new session row was created. In the background, the cheap `title` model generates a short label for the old session (fire-and-forget — the redirect didn't wait for it). Check with:
   ```bash
   sqlite3 ~/.mirror/mirror.db "SELECT id, title, created_at FROM sessions WHERE user_id = <your-id> ORDER BY created_at;"
   ```
   The earlier row should have a title within a few seconds.
5. No UI surfaces the old session yet. That's the [Episodic memory surface](../../../cv0-foundation/cv0-e2-web-experience/index.md#radar) on the CV0.E2 radar.

### Forget this conversation

1. From `/mirror` with messages in the current session, click the small italic link **Forget this conversation**.
2. A native confirm dialog appears: *"Forget this conversation? This cannot be undone."* Cancel and nothing happens; confirm to proceed.
3. On confirm, the page reloads empty. In the DB, the session row and its entries are both gone — no title, no history.
4. The action created a fresh session; you can start typing immediately.

### Title generation failure

If the `title` model API fails (offline test, bad `OPENROUTER_API_KEY`), the flow keeps working — the old session just stays with `title = NULL`. The server logs a single line:
```
[title] generation failed, session stays untitled: <reason>
```
The browser experience is unaffected.

### What's not here (by design)

- **No UI to browse preserved sessions.** Begin again preserves history in the DB; reading it back is the job of the episodic browse surface (radar).
- **No undo for Forget.** Destructive by design.
- **No session naming.** Titles are auto-generated; renaming is a future refinement.
