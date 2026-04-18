[< Story](index.md)

# Refactoring: CV0.E2.S9 — Context Rail

Refactorings evaluated during and after the S9 implementation, executed across a review pass on 2026-04-17 after the story was validated in the browser. The cycle follows the mirror-mind principle of *refactoring in cycle* — no debt carried forward without a reason, and every parked item has a revisit criterion.

---

## Applied

### 1. `session-stats.ts` reuses `loadMessages` instead of raw SQL

**Commit:** `0eac6e9`

The stats aggregator was running its own `SELECT data FROM entries WHERE session_id = ? AND type = 'message' ORDER BY timestamp` and parsing the JSON inline. The exact query already existed in `loadMessages` (server/db/entries.ts).

**Change:** switch to `loadMessages(db, sessionId)` as the source of iteration. Saves one `JSON.parse` per message, keeps the strip-internal-fields discipline consistent across readers.

**Why it landed:** pure deduplication, no behavior change, 78 tests still green.

---

### 2. Shared `extractPersonaDescriptor` between reception and rail

**Commit:** `8aedcfd`
**New file:** `server/personas.ts`

Reception (`server/reception.ts`) and the rail (`adapters/web/index.tsx`) were both computing the same "first non-heading non-empty line, truncated at 120 chars" from persona content. They had drifted slightly — the rail appended `…` on truncation, the classifier did not.

**Change:** extracted the core to `extractPersonaDescriptor(content, { ellipsis?, maxLength? })` in a new `server/personas.ts`. Reception calls it with defaults; the rail calls it with `ellipsis: true`. The local helper in `adapters/web/index.tsx` was inlined into `buildRailState` (five-line wrapper, no longer worth a standalone function; also removed the `personaDescriptor` field/function name collision).

**Why it landed:** the two callers had the same intent and were starting to diverge. Consolidating eliminates future drift risk at the cost of a tiny new module.

---

### 3. Footer link points to the current user's profile

**Commit:** `267c450`

The rail footer rendered `Grounded in your identity → open` but linked to `/admin/users` (the full list). A user clicking it had to find their own name and click again.

**Change:** added `userName` to `RailState`, propagated from `buildRailState` via a full `User` object instead of a raw `userId`. Footer now links to `/admin/users/${userName}`.

**Why it landed:** the link text promised specificity the href did not deliver. One extra field in the state, one new route-level test.

---

### 4. Dedupe cost formatting in `context-rail.tsx`

**Commit:** `267c450`

Two identical ternaries — one in the expanded `#rail-cost` row, one in the `#rail-collapsed-cost` row — formatted `costBRL` or returned empty string.

**Change:** compute `costText` once near the top of the component and reference it in both places.

**Why it landed:** pure cosmetic deduplication; no behavioral effect.

---

### 5. Three cleanups in `chat.js`

**Commit:** `d073fef`

A review pass of the rail-related JS surfaced three small issues:

- **Dead code:** a `setAttr` helper defined early, never called. Removed.
- **Duplicate cost formatting:** the cost cell and the collapsed strip cost each had their own eight-line conditional. Extracted `setCost(id, costBRL)` and routed both through it.
- **Inconsistent avatar updates:** `applyAvatarStyle(id, ...)` worked for the main avatar (which had an id) but the collapsed avatar used `querySelector` and inline style because it had no id. Added `id="rail-collapsed-avatar"` in the component and routed both avatars through the helper.

**Why they landed:** all three were pure tidy-ups with zero behavior change. Leaving the dead function in particular would quietly rot.

---

## Evaluated but not done

### A. Extract `getBaseLayers(db, userId)` helper

**Where the duplication lives:**
- `server/identity.ts` (`composeSystemPrompt`) — filters `self` and `ego` layers to build the prompt text.
- `server/composed-snapshot.ts` — filters `self` and `ego` layers to list their names in the rail.

Both do the same one-line filter for different purposes (build text vs. list names).

**Decision:** leave as-is.

**Revisit when:** a third caller needs the same filtered list. Current two occurrences are short (one line each) and the abstraction cost would outweigh the saved duplication at this scale.

---

### B. Split `adapters/web/index.tsx` into route modules

**Where the concern lives:** `adapters/web/index.tsx` has grown to ~276 lines covering login + chat + admin + rail helpers. The SSE callback in `/chat/stream` alone is ~100 lines. The file crosses several review heuristics (size > 250, 3+ independent concerns, helpers with different domain cohesion).

**Proposed structure:**

```
adapters/web/
├── index.tsx        — setupWeb orchestrator + static files + login/logout
├── chat-routes.tsx  — GET /chat + GET /chat/stream (SSE)
├── admin-routes.tsx — /admin/users (list/create/view/save/delete)
└── rail.ts          — buildRailState (persona descriptor lookup + state assembly)
```

**Decision:** leave out of the S9 window.

**Revisit criteria:** tracked as task `bba04585` in the mirror-mind task system. Execute as a dedicated refactor session with tests green before and after. Touching this file now would mix the S9 review with structural cleanup of code S9 didn't introduce — risk of regression in admin/login areas that aren't this story's scope.

---

### C. Refactor the long SSE callback in `/chat/stream`

**Where the concern lives:** the `streamSSE` callback inside `/chat/stream` is ~100 lines covering reception, history load, prompt composition, Agent setup, streaming subscription, fallback extraction, entry persistence, and rail emission.

**Decision:** leave as-is.

**Revisit when:** the same pattern (pre-run + stream + post-persist + emit) is needed in a second route. At that point, extract a shared streaming helper. Today there is exactly one caller — abstraction would be hypothetical.

---

### D. CSS variables for palette and mono font stack

**Where the duplication lives:** color hexes (`#8b7d6b`, `#2a2520`, `#faf8f5`, etc.) and the monospace font stack are repeated throughout `style.css`.

**Decision:** leave as-is.

**Revisit when:** the project as a whole decides to adopt design tokens. The rail is stylistically consistent with the rest of the stylesheet; introducing CSS variables here alone would fragment the convention.

---

### E. `user` prop declared but unused in `chat.tsx`

**Where the concern lives:** `ChatPage` accepts `user: User` but the JSX never references it.

**Decision:** leave as-is.

**Revisit when:** S7 ("I know who's logged in") lands. S7 will use `user.name` in the sidebar or nearby, at which point the prop becomes live. Removing it now only to add it back a story later is churn.

---

### F. Trailing space in `layout.tsx` class concatenation

**Where the concern lives:** `class={`content ${wide ? "content-wide" : ""}`}` produces `"content "` (with trailing space) when `wide` is false.

**Decision:** leave as-is. Cosmetic, no render impact.

---

## See also

- [Plan](plan.md) — scope and wireframe
- [Test Guide](test-guide.md) — how to verify
- [Decisions 2026-04-17](../../../../decisions.md) — the rail's framing decisions
- [Memory Taxonomy](../../../../../product/memory-taxonomy.md) — why the rail is "Attention Memory made visible"
