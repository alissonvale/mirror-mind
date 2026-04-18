[< Story](index.md)

# Test Guide: CV0.E2.S9 — Context Rail

## Automated

```bash
npm test
```

Relevant files:
- `tests/session-stats.test.ts` — 6 tests covering the stats aggregator (empty session, counting, token approximation, cost derivation, `_meta` stripping, non-message entry filtering).
- `tests/web.test.ts` (last `describe`) — 4 tests verifying the rail renders, empty state shows `voz base`, last persona is reflected, composed layers are listed.

Expected: 78 tests passing total (68 pre-S9 + 10 new).

## Manual

### Setup

Start the server locally pointing to a dev DB:

```bash
MIRROR_DB_PATH=/tmp/mirror-s9.db npm run dev
```

Create a user + import identity if needed:

```bash
MIRROR_DB_PATH=/tmp/mirror-s9.db npx tsx server/admin.ts user add dev
MIRROR_DB_PATH=/tmp/mirror-s9.db npx tsx server/admin.ts identity import dev --from-poc
```

Log in at `http://localhost:3000/login` with the printed token.

### Verifications

**1. Rail is visible on the chat page.** Open `/chat`. The rail appears on the right side of the chat, with three blocks: Persona, Session, Composed, plus a footer link "Grounded in your identity".

**2. Empty state.** On a fresh session (no messages yet), the Persona block shows a dashed circle and `ego · voz base`. Session block shows `0 messages`, tokens, cost. Composed lists the three base layers (`self.soul · ego.identity · ego.behavior`).

**3. Persona appears after first response.** Send a message. After the reply streams in, the Persona block updates: avatar with initials and a warm color, persona name, and a one-line descriptor from the persona's content. Composed gains the `◇ <persona>` row.

**4. Session stats grow.** Send two more messages. `messages` count goes up by 2 per round-trip (user + assistant). Tokens and cost accumulate. Model name stays consistent.

**5. Collapse persists.** Click the `✕` in the rail header. Rail shrinks to a 56px strip showing the avatar + cost. Click again to reopen. Refresh the page — the state you left is remembered.

**6. Mobile drawer.** Resize the viewport under 768px (or open DevTools mobile). The rail moves below the chat with a cap on height. Collapsed state still works.

**7. No persona mid-session.** If the reception layer fails or returns `null`, the Persona block reverts to `ego · voz base` and Composed omits the `◇` row. Simulate by sending a message to a user that has zero persona layers.

**8. Cost null gracefully.** Temporarily remove the `price_brl_per_1m_*` fields from `config/models.json` and restart. Verify the cost line disappears from the rail without breaking the layout. Restore after verifying.

### Smoke check

After any code change to rail-related files, run:

```bash
npm test
```

And hit `/chat` with `curl` to confirm the HTML still contains the rail container:

```bash
curl -s -b "mirror_token=<your-token>" http://localhost:3000/chat | grep -c 'id="context-rail"'
# Expected: 1
```

---

**See also:** [Plan](plan.md) · [Epic index](../index.md)
