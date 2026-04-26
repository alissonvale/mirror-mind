[< Story](.)

# Plan — CV1.E7.S8 Out-of-pool rail suggestion

## Premise

Pool-as-constraint (CV1.E4.S4 → CV1.E7.S3) is great for predictability — the user's pinned scopes/personas frame the conversation, and reception respects the boundary. But it locks out genuinely better picks when a turn drifts outside that frame.

The canonical example is in [S3's close-out](../cv1-e7-s3-conditional-scope/#empirical-evidence-for-cv1e7s8): Dan asked about Stanley plane comparison on a session with cast restricted to `[engineer]`. Reception activated `engineer` (only candidate) even though `maker` (woodwork persona) would have been the right voice. The system silently produced a misframed answer; Dan had no way to discover that `maker` existed in his data and could have answered.

S8 makes the lockout **visible and opt-in**. Reception emits a "would have picked" signal alongside the canonical pick. The UI surfaces a non-modal suggestion below the bubble: *"`maker` may have something to say. Hear it?"*. Click triggers a divergent one-turn response through the suggested persona/scope, rendered inline. The session pool is not modified — the divergence is paid in tokens but free in commitment.

## Design overview

```
┌──────────────────────────────────────────────────────────────────┐
│ Reception extends with a 6th output:                             │
│   { ... existing 5 axes ...                                      │
│     would_have_persona: string | null,                           │
│     would_have_organization: string | null,                      │
│     would_have_journey: string | null }                          │
│                                                                  │
│ Populated only when an out-of-pool candidate would have been     │
│ a strictly better fit (strong domain match) than the in-pool    │
│ pick. The in-pool pick (canonical) drives the actual response.  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Server emits SSE 'suggestion' event when any would_have_X is    │
│ non-null. Client renders a small card below the assistant       │
│ bubble:                                                          │
│                                                                  │
│   ╭ ◇ maker may have something to say. [Hear it]  ╮              │
│                                                                  │
│ Or for scopes:                                                   │
│   ╭ Add ↝ vida-economica to this answer? [Yes]   ╮              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (user clicks)
┌──────────────────────────────────────────────────────────────────┐
│ POST /conversation/divergent-run                                 │
│   { sessionId, parentEntryId, type: 'persona', key: 'maker' }    │
│                                                                  │
│ Server:                                                          │
│  1. Loads canonical history up through parentEntryId            │
│  2. Composes a NEW system prompt with the divergent override     │
│     (persona = ['maker'], or scope = X) plus other axes from    │
│     the parent entry's meta                                      │
│  3. Runs main + expression as usual                             │
│  4. Persists to NEW table `divergent_runs` (separate from       │
│     entries — doesn't enter conversation history)                │
│  5. Streams or returns the result                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Client renders sub-bubble inline below the canonical bubble:    │
│                                                                  │
│   You: Stanley No.4 vs No.5?                                    │
│                                                                  │
│   ◇ engineer (canonical bubble)                                  │
│   [engineer's response — pool pick]                             │
│        └ ◇ maker (sub-bubble, indented, maker's color bar)      │
│          [maker's response — divergent run]                     │
└──────────────────────────────────────────────────────────────────┘

Next turn: divergent_runs are NOT sent to the agent's history. The
canonical conversation continues as if the divergence didn't happen.
The cast stays as-is; reception sees the same pool next turn.
```

## Reception emits `would_have_X`

### Single LLM call, expanded prompt

Reception today filters the candidate pool BEFORE giving it to the LLM. For S8, reception sees both the **session pool** (filtered) and the **full pool** (everything), and outputs both an in-pool pick and an optional out-of-pool would-have-pick.

New input shape to reception's prompt: two lists per axis when they differ.

```
Available personas (session pool — pick from these):
  - engineer: ...
  
Available personas (full pool — outside the session, do not pick canonically):
  - maker: works wood, restores tools, talks about hand planes...
  - tecnica: technical advisor for IT / DevOps
  - ...
```

The prompt asks reception to:
1. Pick canonically from the session pool (existing behavior — `personas`, `organization`, `journey`).
2. **Additionally,** if the full pool contains a candidate that would clearly be a better fit AND is *not* already in the session pool, return its key as `would_have_persona` / `would_have_organization` / `would_have_journey`.

### When to populate would_have_X

Conservative, like other axes. Reception only flags when the out-of-pool candidate is a **strong domain match** AND the in-pool pick is a stretch (or the in-pool pool returned empty). Some explicit cases:

- The full-pool candidate's descriptor cleanly covers the message's domain
- Every in-pool candidate would be a stretch for this domain
- The user did not explicitly opt for a constrained frame ("pretend you don't know X" type asks — those defeat the suggestion)

Default `null` for all three on uncertainty / failure. The UI shows nothing when there's nothing to suggest.

### Output shape

```ts
interface ReceptionResult {
  // existing fields
  personas: string[];
  organization: string | null;
  journey: string | null;
  mode: ResponseMode;
  touches_identity: boolean;
  // NEW (CV1.E7.S8)
  would_have_persona: string | null;
  would_have_organization: string | null;
  would_have_journey: string | null;
}
```

NULL_RESULT carries `null` for all three would_have_X (consistent with the no-suggestion-on-failure principle).

## Suggestion UX

### Where it appears

**Below the canonical assistant bubble**, as a small inline card. Not modal. Subtle styling — light background, small font, no strong color.

```
[user message]
[canonical assistant bubble]
   ╭ ◇ maker may have something to say.        [ Hear it ] ╮
```

For scopes, framing changes:
- **Persona** suggestion: *"`<key>` may have something to say"* — voice/lens semantics
- **Org** suggestion: *"Add `<name>` context to this answer?"* — context semantics
- **Journey** suggestion: same as org

### Multiple suggestions in same turn

If reception flags more than one (e.g., would_have_persona AND would_have_journey), each gets its own card.

### Visibility rule

- Surface the card whenever the corresponding `would_have_X` is non-null
- Card disappears once user clicks (whether they say yes or close the card)
- One-time per assistant turn — don't re-prompt

### Rejected alternatives

- **Rail panel only** — too discreet, non-admin users wouldn't even see it
- **Modal popup** — too invasive
- **Always show with checkbox to opt-out** — user opt-out fatigue

## Divergent run endpoint

### Route shape

`POST /conversation/divergent-run`

Body:
```ts
{
  sessionId: string;
  parentEntryId: string;  // the canonical assistant entry to run "alongside"
  override: {
    type: "persona" | "organization" | "journey";
    key: string;
  };
}
```

Response: streamed (SSE) like `/conversation/stream`, or one-shot JSON with the final text. Probably one-shot for simplicity — the divergent run is a "side experiment", less need for the typing-feel.

### Server behavior

1. **Auth / ownership** — confirm session belongs to user
2. **Load context up through parentEntryId**:
   - Canonical user message that triggered parentEntryId
   - History before that (canonical, no prior divergent_runs)
   - Meta of parentEntryId (has `_personas`, `_organization`, `_journey`, `_mode`, `_touches_identity`)
3. **Compose system prompt with override:**
   - Take parent's meta as the base
   - Replace the relevant axis (persona / org / journey) with the override key
   - Compose normally — same composer, just different inputs
4. **Run main + expression** — same pipeline as the canonical
5. **Persist to `divergent_runs` table** (see persistence section)
6. **Return** the divergent text + metadata

### Important: reception is NOT re-run

The override picks the override. We don't re-classify; we trust the user's click.

This avoids:
- Latency of a second reception call
- Reception possibly disagreeing and overriding the user's intent
- Cost

### Composer integration

The composer doesn't need changes. The divergent endpoint just calls `composeSystemPrompt` with the appropriate persona/scope keys constructed from parent meta + override.

## Persistence — `divergent_runs` table

### Schema

```sql
CREATE TABLE divergent_runs (
  id TEXT PRIMARY KEY,
  parent_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL,            -- 'persona' | 'organization' | 'journey'
  override_key TEXT NOT NULL,
  content TEXT NOT NULL,                  -- the divergent response text
  meta TEXT,                              -- JSON: model/provider/tokens/cost — for cross-ref with future S1 logging
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_divergent_runs_parent ON divergent_runs(parent_entry_id);
```

### Why a separate table (not just an `entries` row with `type='divergent_run'`)

- **Cleanliness of `entries`.** Loading history (which feeds the next turn's Agent) needs to *exclude* divergent_runs. Putting them in entries means filtering on every history load — error-prone.
- **Different lifecycle.** Divergent runs are pinned to a parent_entry_id; they don't form a chain. Entries are append-only with parent_id forming the conversation tree.
- **Different access patterns.** The conversation timeline never shows divergent_runs out-of-context — they always render adjacent to a parent.

### Cascade on parent delete

If the user "Forget"s a turn (deletes the parent entry), divergent_runs attached to it cascade. Logical — without the parent, the divergent has no reference.

## Inline rendering

### Layout

```
┌─ [user message] ──────────────────────────────┐
│                                                │
└────────────────────────────────────────────────┘

┌─ [canonical assistant bubble] ────────────────┐
│ ◇ engineer                                     │
│ [response]                                     │
│                                                │
│   ╭─ ◇ maker may have something to say. [Hear it] ─╮
└────────────────────────────────────────────────┘

(after click:)

┌─ [user message] ──────────────────────────────┐
│                                                │
└────────────────────────────────────────────────┘

┌─ [canonical assistant bubble] ────────────────┐
│ ◇ engineer                                     │
│ [response]                                     │
│                                                │
│   ┌─ ◇ maker (divergent) ──────────────────┐  │
│   │ [maker's response — indented sub-bubble]│  │
│   └─────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Visual differentiation from canonical

- Indented (margin-left ~1.5rem) so it reads as "side branch"
- Smaller font (~0.92em) to signal "supplementary"
- Color bar from the divergent persona's color (or scope icon for scope divergence)
- Optional small label: *"divergent run"* above the bubble

### Multiple divergent runs per parent

If reception flagged two would_have_X (e.g., a persona AND a scope), and the user clicks both, both render in order they were triggered. Listed below the canonical, before the next user turn.

### Discard

Optional small `×` on each divergent bubble. Clicking deletes the row from `divergent_runs`. Stretch goal — defer to a follow-up if it bloats the MVP.

## History loading

### `loadMessages` and `loadMessagesWithMeta`

The Agent's history feed comes from `loadMessages(db, sessionId)`. This must continue to **exclude** divergent_runs — they are not part of the conversation flow the next turn's LLM should see.

For the UI, `MirrorPage` needs to load divergent_runs separately and inject them into the rendered tree.

Approach: add a helper `loadDivergentRunsBySession(db, sessionId)` that returns all divergent_runs for the session, grouped by `parent_entry_id`. The page render iterates entries and injects divergent runs after each entry that has them.

### Streaming flow

When the divergent endpoint completes:
- Server returns `{ id, parentEntryId, overrideKey, content, meta }`
- Client receives, builds the sub-bubble DOM, inserts after the parent bubble's body
- No SSE for divergent (one-shot for simplicity); if latency feels bad, can add streaming as a refinement

## Phases

| # | Phase | Files | Notes |
|---|---|---|---|
| 1 | **Reception extension** | `server/reception.ts` | Add `would_have_X` fields to ReceptionResult + NULL_RESULT; expand system prompt to show full pool when it differs from session pool; parser; tests |
| 2 | **Persistence** | `server/db/divergent-runs.ts` (new), `server/db.ts` (re-export), `server/db/schema.ts` (CREATE TABLE) | New table, helpers (insert/load/deleteByParent/cascade), unit tests |
| 3 | **Divergent endpoint** | `adapters/web/index.tsx` (new route) + helper | POST /conversation/divergent-run; load context, compose with override, run pipeline, persist, return; tests |
| 4 | **SSE event for suggestion** | `adapters/web/index.tsx` stream handler | Routing event already carries reception data — extend to include would_have_X |
| 5 | **Suggestion card UI** | `adapters/web/public/chat.js`, `adapters/web/public/style.css` | Render below the assistant bubble when SSE routing event has would_have_X populated; click handler that POSTs to divergent endpoint |
| 6 | **Inline divergent bubble render** | `adapters/web/public/chat.js`, `adapters/web/public/style.css`, `adapters/web/pages/mirror.tsx` (server-render path) | Insert sub-bubble below canonical after divergent endpoint returns; server-render reads divergent_runs grouped by parent_entry_id |
| 7 | **History exclusion** | `server/db/entries.ts` (loadMessages stays the same — divergent in separate table, no change needed) + verification tests | Ensure agent history doesn't accidentally see divergent runs |
| 8 | **Manual smoke** | navegador | Test 4 of Dan walkthrough (Stanley plane on cast=[engineer]) should now offer maker suggestion. Click → maker bubble appears. Reload → maker bubble persists. Next turn → reception sees pool unchanged. |
| 9 | **Docs close-out** | epic, decisions, prompt-composition, story folder | Same pattern as S3/S4 |

## Non-goals (parked)

- **Streaming the divergent response.** One-shot JSON for MVP. Stream as refinement if latency feels bad.
- **Rail-driven view of "all divergent runs in this session".** A library/audit view of every divergence — useful for the future eval surface (CV1.E8.S2 model switching) but not for S8.
- **Promote-to-pool action.** A button to also add the suggestion to the session pool ("convoke maker permanently"). Different UX (suggest-and-add vs on-demand divergence) — registered in [parked alternatives](../../../../product/prompt-composition/index.md#parked-alternatives--three-design-points). Open as S8b if the dor surfaces.
- **Multi-axis divergence in one click.** "Add maker AND vida-economica context to this answer in one go" — too much for one button. Click each separately.
- **Divergent run citation in the canonical thread.** The canonical bubble doesn't reference the divergent. They live side by side; the canonical doesn't change.
- **User-customizable suggestion threshold.** Reception's identity-conservative defaults already filter weak matches. No threshold UI.

## Risks

**Latency on click.** Divergent endpoint runs the full pipeline (compose + main + expression). Same cost as a regular turn — typically 2-5s. UX needs a loading state on the suggestion card during the call.

**Reception over-suggests or under-suggests.** Calibration concern. Mitigation: conservative defaults in the prompt; iterate based on real-use signal. If users complain "suggestions everywhere" or "never sees the right alternative", S2b (reception calibration) covers tuning.

**Database growth.** Each divergent run is another text blob. For an active user, dozens per week. Acceptable in the foreseeable future; if becomes a concern, add a TTL or "delete divergent runs older than N days" maintenance task.

**Visual confusion.** User sees two bubbles for one user message and might think the divergent is the canonical answer or vice versa. Mitigation: clear visual differentiation (indent, smaller font, label "divergent"). Manual smoke should reveal if confusion happens.

**Reception cost increase.** The expanded prompt (showing both pools when they differ) adds tokens to every reception call. For sessions where session pool == full pool, no overhead. For sessions with constraint, overhead is the listing of unconstrained candidates. Manageable.

## Test strategy

### Unit tests

- Reception: would_have_X populated correctly when full pool has a strong match; null when no clear out-of-pool winner; null on failure. (~6 tests)
- Persistence: insert / load / cascade-on-parent-delete. (~4 tests)
- Divergent endpoint: composes with override; persists; returns shape; auth check. (~4 tests)
- History loading: divergent_runs do NOT enter `loadMessages` output; do enter `loadMessagesWithDivergentRuns` (or whatever helper renders the page). (~3 tests)

### Manual smoke (Dan walkthrough Test 4 reused)

- Setup: Dan session with cast = [engineer], scopes = [reilly-homelab, vmware-to-proxmox]
- Send: *"Stanley No.4 vs No.5?"*
- Expected: canonical bubble (engineer's response). Below it, suggestion card "`maker` may have something to say."
- Click: maker bubble renders inline, indented, with maker's color
- F5: state persists
- Send next message: reception sees unchanged pool (no maker), conversation continues normally

## Estimated effort

Largest of S3/S4/S8 trio. Probably 2-3 sessions of focused work spread over phases. Not a one-sitting story.

## What stays unchanged

- Reception's existing 5 axes — no breaking changes
- Composer — no signature change
- Existing `entries` schema — no migration
- Conversation flow — divergent runs don't affect canonical
- Pool semantics — pool is still a contract; S8 just makes the contract permeable on opt-in
