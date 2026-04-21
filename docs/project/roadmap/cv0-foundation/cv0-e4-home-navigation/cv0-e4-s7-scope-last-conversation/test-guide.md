[< Story](index.md)

# Test Guide — CV0.E4.S7

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **339 tests passing** (was 337, +2 new). Two new assertions:
- `list shows Last conversation card for each org` — inside the CV1.E4.S1 organizations describe block. Asserts the empty-state card first; after an assistant message is injected with `_organization` meta, asserts the session title shows up.
- `list shows Last conversation card for each journey` — same shape inside the journeys describe block.

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

### Setup

- Create at least one organization (e.g. `software-zen`) and one journey (e.g. `vida-economica`) via the list pages.

### Untagged scope

1. Navigate to `/organizations` — your org card is paired with a dashed "Last conversation" card reading **No conversations tagged yet**.
2. Same on `/journeys`.

### Tagged scope

1. Open `/conversation`. Send a message whose content will make reception route to your organization (e.g. "What's going on at Software Zen this week?").
2. Go back to `/organizations`. The paired card now shows:
   - The session title (if generated — see note) or "Untitled conversation"
   - A relative time ("just now", "5 minutes ago", …)
3. Same flow for a journey — send a message that routes to your journey and check `/journeys`.

**Title note:** session titles are generated asynchronously on **Begin again** (CV1.E3.S4). If you haven't started a new session yet, the title is null and the card shows "Untitled conversation". That is expected until you trigger a new session.

### Responsive

- Resize the window. Below ~540px, the scope card and conversation card stack. Between 540px and 900px, one pair per row. At 900px and above, two pairs per row.

### Regressions to rule out

- Existing `.scope-card` hover, layout, and link behavior unchanged.
- Archived scopes still toggle and list correctly (archived section was not touched).
- Workshop pages for individual orgs/journeys still render and save.
- `/` home, `/me`, and admin surfaces unaffected.
