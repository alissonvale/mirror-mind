[< Story](index.md)

# Test Guide — CV1.E4.S4

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **362 tests passing** (was 348 after S7, +14 new in this story). New suites:
- `tests/session-tags.test.ts` — 9 tests for the DB layer (read/write, idempotent add, no-op remove, session isolation, cascade on forget, schema migration)
- `tests/reception.test.ts` — 4 new tests in `receive — session tag pool (CV1.E4.S4)` describe block
- `tests/identity.test.ts` — 5 new tests in `composeSystemPrompt — session tag pool (CV1.E4.S4)` describe block
- `tests/web.test.ts` — 5 new tests in `web routes — session scope tagging (CV1.E4.S4)` describe block

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

### Fresh session — first-turn suggestion

1. Log in; create at least one persona, one organization, and one journey if none exist yet.
2. Go to `/conversation`. Context Rail shows *Scope of this conversation* with three empty groups plus a dropdown per group.
3. Send a first message that will route cleanly (e.g. "quanto sobrou no caixa este mês?" routes to `tesoureira` + `vida-economica`).
4. Reload `/conversation` or watch the rail update after the reply. The tag pool now contains reception's picks — shown as pills (e.g. `tesoureira ×`, `vida-economica ×`).

### Manual edit — add + remove

5. From the rail's Journeys dropdown, pick another journey and click `+`. The page reloads with a new pill.
6. Click the `×` on a pill. The page reloads without that tag.
7. Send another message. Reception can no longer pick outside the tagged pool — verify by sending a message that would normally route to a different persona; the reply's signature (`◇`) should be one from the pool or absent.

### Composer multi-scope

8. Tag two organizations and send a message. The composed prompt (drawer on `/map` or `/admin/budget` won't show this, but you can infer) should include both orgs' briefings.
9. Reflect via the LLM's reply: if both orgs are about different topics, the answer should touch both contexts.

### Regressions

- **Begin again** — click, confirm a new session starts with empty tags.
- **Forget this conversation** — click, confirm a new session starts with empty tags; the junction tables have no orphan rows for the discarded session id.
- **Telegram adapter (if running)** — unchanged. Send a message, the mirror still responds. Reception runs without `sessionTags`, so no filter applies.
- `/admin`, `/me`, `/map`, `/journeys`, `/organizations` — all render normally.

### Edge cases

- Session has tags in only two of three types → reception filters those two types, considers all candidates for the third.
- Session tagged with a key whose underlying scope was deleted → tag goes dormant (no error). Remove it from the rail.
- Archived scopes — tagging an archived org/journey works at the DB level, but the composer's `renderScope` returns null for non-active scopes, so they don't compose. (Reception also excludes archived from its candidates.)
