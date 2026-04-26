[< CV1.E7](../)

# CV1.E7.S8 — Out-of-pool rail suggestion

**Status:** ✅ Done (2026-04-26)

## Problem

Pool-as-constraint (CV1.E4.S4 → CV1.E7.S3) keeps conversations focused: reception filters candidate personas/scopes by what the user pinned, the composer renders only what reception activated, the prompt stays clean. But the constraint silently locks out genuinely better picks when the conversation drifts outside the declared frame.

The canonical empirical case lives in [S3's manual smoke close-out](../cv1-e7-s3-conditional-scope/#empirical-evidence-for-cv1e7s8): Dan asked about Stanley plane comparison on a session whose cast was restricted to `[engineer]`. Reception had no choice but to activate `engineer` (the only candidate). The response came back competent-but-misframed — engineer's lens applied to woodwork. Dan had no signal that `maker` existed in his data and would have been the right voice.

## Fix

Reception emits a "would have picked" signal alongside the canonical pick. The UI surfaces it as a non-modal card below the bubble. Click triggers a divergent one-turn response through the suggested persona/scope, rendered inline. The session pool is unchanged.

## What shipped

**Reception (Phase 1).** Three new fields — `would_have_persona`, `would_have_organization`, `would_have_journey` — added to `ReceptionResult`. NULL_RESULT carries `null` for all three. The system prompt grows: when the session's filtered pool differs from the full pool, both lists render under explicit `SESSION POOL` and `OUT-OF-POOL` headers, with rules instructing reception to pick canonical from session pool only and flag would_have_X only for clear out-of-pool wins. Strict parser — out-of-pool keys validated against the actual out-of-pool set; any drift (session-pool key, unknown key, missing field) falls to null.

**Persistence (Phase 2).** New `divergent_runs` table with FK cascade on parent_entry_id deletion. Helpers in `server/db/divergent-runs.ts` for insert, load by parent, load by session (grouped by parent_entry_id), and delete by id. Lives separate from `entries` so `loadMessages` (the agent's history feed) automatically excludes divergent runs without any filter logic.

**Divergent endpoint (Phase 3).** `POST /conversation/divergent-run` accepts `{ sessionId, parentEntryId, type, key }`. Validates ownership through the parent entry's session. Reads parent meta to inherit other axes (the override only swaps the chosen axis). Composes a new system prompt with the override, runs main + expression, persists to `divergent_runs`, returns one-shot JSON.

**SSE event extension (Phase 4).** The streaming `routing` event payload gains `wouldHavePersona`, `wouldHaveOrganization`, `wouldHaveJourney` fields. Null when reception didn't flag; otherwise the out-of-pool key.

**Suggestion card UI (Phase 5).** Client-side: on routing event with non-null would_have_X, the streaming bubble's `data-would-have-*` attributes are set. On `done` event (when the assistant entry id is known and the POST target exists), `attachOutOfPoolSuggestions` appends one card per axis with a label and an action button. Button posts to `/conversation/divergent-run`, handles loading state, and on success renders the result inline.

**Sub-bubble render (Phase 6).** Both client (after click) and server (on F5 / page load via `MirrorPage`) render divergent runs as indented sub-bubbles inside the parent's `.msg-body`. Distinct visual treatment: dashed-card suggestion → solid sub-bubble below; persona divergences carry a color bar; org/journey divergences use the icon badge. Markdown renders for both paths (server-rendered content gets the same `md()` pass as canonical bubbles via a CSS-class targeted query in `chat.js`).

**History exclusion (Phase 7).** No code change needed — divergent_runs in a separate table means `loadMessages` (and `loadMessagesWithMeta`) automatically don't see them. A regression test in `tests/divergent-runs.test.ts` pins this contract.

**Asset version bumps:** `chat.js?v=out-of-pool-1`, `style.css?v=out-of-pool-1`.

## Tests

689 passing (was 670 at S4 close; +19 new):

- `tests/reception.test.ts` — 8 new tests for the would_have_X axes: returns the flag when LLM emits it, drift guard rejects session-pool keys in the would_have axis, drift guard rejects unknown keys, missing field defaults to null, LLM failure → all null in NULL_RESULT, system prompt shows OUT-OF-POOL section when constrained.
- `tests/divergent-runs.test.ts` (new file) — 11 tests covering insert/load round-trip, ordering by created_at, grouping by parent for session-wide load, scope to single session, cascade on parent delete, single-row delete, null meta, history exclusion (loadMessages doesn't see divergent_runs).

## Non-goals (parked)

- **Streaming the divergent response.** One-shot JSON for MVP. Stream as refinement if latency feels bad in real use.
- **Library / audit view of all divergent runs.** Useful for the future eval surface (CV1.E8.S2 model switching) — a cross-conversation view of what alternatives the user explored. Out of scope for S8.
- **Promote-to-pool action.** A button to also add the suggestion permanently to the session pool ("convoke maker permanently"). Distinct UX intent from on-demand divergence; registered as the third design point in [parked alternatives](../../../../product/prompt-composition/index.md#parked-alternatives--three-design-points). Open as S8b if friction surfaces.
- **Multi-axis divergence in one click.** "Add maker AND vida-economica context to this answer in one go" — too much for one button. User clicks each card separately if reception flagged multiple.
- **Divergent run citation in canonical thread.** The canonical bubble doesn't reference the divergent run. They live side by side; the canonical is unchanged.
- **User-customizable suggestion threshold.** Reception's identity-conservative + minimum-sufficient-set defaults already filter weak matches. No threshold UI.
- **Discard button on divergent bubbles.** Helper exists in the persistence module (`deleteDivergentRun`); UI affordance deferred until users actually want to clean up.

## Docs

- [Plan](plan.md) — design with diagrams, phase breakdown, persistence schema, UX, risks
- [Test guide](test-guide.md) — six-test manual roteiro for browser validation
- [Decisions — Out-of-pool rail suggestion](../../../decisions.md#2026-04-26--out-of-pool-rail-suggestion-cv1e7s8)
- [Prompt-composition § 1 Reception](../../../../product/prompt-composition/index.md#1-reception) — output table updated for the three would_have_X axes; decision rules section gains the out-of-pool rules
- [Prompt-composition § Parked alternatives](../../../../product/prompt-composition/index.md#parked-alternatives--three-design-points) — second design point ("On-demand divergent response via the rail") promoted from parked to shipped

## Empirical observations from S8 manual smoke (2026-04-26)

The full six-test roteiro ran clean against the S8 build. The canonical fixture (Stanley plane on Dan's session with cast=[engineer]) reproduced exactly the situation S3's close-out described — and S8 closed it.

**The contrast captured in one turn.**

| Lens | Response on *"Stanley No. 4 vs No. 5?"* |
|---|---|
| `engineer` (canonical, in-pool pick) | *"The main difference is their length. No. 4 are 9-10 inches... No. 5 are 13-14 inches..."* — correct but shallow, geometric framing |
| `maker` (divergent run, out-of-pool) | *"The No. 4 is a smoothing plane... taking very thin shavings... The No. 5 is a jack plane (sometimes called fore plane)... aggressive stock removal..."* — woodwork terminology, function, weight, intent |

The two responses occupy the same turn. Dan saw both, and the second was the one that actually answered his question. The session pool stayed `[engineer]`; cast didn't grow.

**Test results in detail:**

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Trigger out-of-pool | ✅ | Suggestion card *"`maker` may have something to say [Hear it]"* appeared below engineer's bubble |
| 2 | Click → divergent run | ✅ | Sub-bubble rendered inline with persona color bar, *"divergent run"* badge, and a clearly different lens than engineer |
| 3 | Reload (F5) | ✅ | Divergent sub-bubble persisted; suggestion card correctly did not re-appear (it's streaming-only by design) |
| 4 | Cast unchanged | ✅ | Next turn (in-domain, *"first step for staging cluster?"*) activated engineer normally; maker did not enter the session pool |
| 5 | No suggestion when in-domain | ✅ | The same in-domain follow-up turn produced no suggestion card — reception's conservative threshold filtered correctly |
| 6 | Cascade on delete | ✅ | Forgetting the parent assistant turn cascaded to the divergent run; `divergent_runs` count dropped accordingly |

**Tests 4 and 5 together** are the crucial proof that the divergence is genuinely **opt-in and ephemeral**. The cast didn't grow on click; reception didn't start surfacing `maker` everywhere because it once worked. The user took one off-domain detour, got the right voice, and the conversation continued in its declared frame. That's the cast-vs-scope philosophy made operational.

**Lateral observation about turn 1.** In the smoke run, the user's first turn (Plex/Proxmox) showed bubble badges `⌂ reilly-homelab` + `↝ vmware-to-proxmox` — divergence indicators because the session was fresh and reception activated those scopes for the first time. Auto-seed Pass 2 populated the session pool on that turn, so subsequent turns benefit from pool-suppression normally. Not a regression — expected behavior of a session's first productive turn under the auto-seed-per-axis model.
