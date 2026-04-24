[< Story](index.md)

# Plan: CV1.E7.S5 — Multi-persona per turn (integrated voicing)

**Roadmap:** [CV1.E7.S5](index.md)
**Framing:** S2 installed the UI scaffolding for multi-persona turns (Cast, bubble signature, RailState.personaColors map, forward-compat data shape) without requiring the backend to actually produce multiple personas per turn. The user's model of personas-as-cast can finally be honored in the pipeline. This story is the backend-facing half of that turn, plus the UI completion on transitions that need multiple badges.

**Segmented voicing** (the opt-in mode where the reply carries `◇ X ... ◇ Y ...` markers inside the text) is parked for a follow-up story (S5b). S5 ships **integrated voicing** only — the case where two lenses produce one coherent reply.

---

## Goal

A turn can activate zero, one, or multiple personas. When multiple, all of them compose into the prompt simultaneously under a "one unified voice, multiple lenses" instruction; the reply integrates their depth into a single coherent answer (the CLAUDE.md principle: *"o espelho tem uma única voz — o ego; as personas são lentes especializadas, não entidades separadas"*).

**Validation criterion:** send `"qual seria a estratégia de divulgação do espelho para o público da Software Zen?"` into a session with `estrategista` and `divulgadora` configured. Reception returns `{ personas: ["estrategista", "divulgadora"], ... }`. The composed prompt carries both persona blocks under a shared "these are active simultaneously" frame. The reply is a single coherent text that interleaves positioning (estrategista) with execution (divulgadora) — no `◇ estrategista ... ◇ divulgadora` markers inside the text. The Cast header shows both avatars. The bubble's color bar uses the primary persona's color. Two `◇ badge` chips appear on the bubble (one per persona added in this turn, suppressed on subsequent turns that keep the same set).

## Non-goals (this story)

- **Segmented voicing.** No `◇ X ... ◇ Y ...` transitions inside a single bubble. Reception does not classify a voicing axis; expression pass does not emit segment markers. Parked for S5b.
- **Max-personas cap.** No hard limit on how many personas reception can return. Prompt engineering nudges the model toward the smallest sufficient set; if real use shows over-activation, we tune the prompt or add a cap in a follow-up.
- **UI redesign for N personas.** Cast header already handles N avatars via flex-wrap (done in S2). Bubble color bar uses the first persona's color (not a gradient); bubble badges show each persona on transition. Richer visualizations (dual-tone bars, avatar clusters on the bubble) park for S5b or later.
- **Migration of historical entries.** Old `_persona: string` meta stays as-is; new `_personas: string[]` writes alongside. Both are read; the singular is the first element of the plural when present.
- **Cross-adapter parity for every surface.** Web gets the full treatment. Telegram and CLI adapters persist the plural shape and invoke the composer correctly but inherit the simpler single-stream UX (no bubble badges — chat doesn't apply). Tested via existing adapter smoke probes; no dedicated new UX work for them.
- **Reception prompt rebuilding.** Extend the existing prompt to return an array; don't reshuffle the axes or the examples block beyond what's needed.

## Decisions

### D1 — `ReceptionResult.personas: string[]`

The classifier contract shifts from `persona: string | null` to `personas: string[]`. An empty array replaces the null case. A single-element array is the common case for most turns (same behavior as today). Multi-element is the new.

**Why not keep `persona: string | null` and add `additionalPersonas: string[]`.** Two fields for the same axis would mean every consumer has to think about "primary vs additional" — and the semantics of "primary" would be arbitrary. One list, flat, is honest.

**Backward compat for reception callers.** Every consumer of `ReceptionResult.persona` migrates to `.personas[0]` (or empty check) in this story. No shim. The type change is load-bearing and worth paying in full.

### D2 — JSON reception output changes shape

Reception's LLM prompt instructs it to return `"personas": ["<key>", ...]` instead of `"persona": "<key>|null"`. The parser accepts the array, validates each key against the available list (drops unknowns silently, same as today for a single unknown key).

**Legacy output handling.** If the model returns the old singular shape `"persona": "<key>"`, the parser wraps it into a one-element array. This keeps us from being strict-brittle during model transitions — `config/models.json` swapping the reception model is common.

### D3 — Composer accepts multiple persona keys

`composeSystemPrompt(db, userId, personaKeys: string[], adapter, scopes)` — the third parameter becomes an array. When length > 1, the composer:
- Renders each persona's content block separated by `\n\n`.
- Prefixes the cluster with a small instruction: *"Multiple persona lenses are active simultaneously. Speak with one coherent voice that integrates all of them; do not label segments."*
- Preserves the current single-persona behavior when length === 1 (no prefix, identical block).
- Skips the cluster entirely when length === 0.

**Why the prefix.** Without it, the model reads N separate system-prompt blocks and may interpret them as contradictory roles. The prefix names the intent: these are complementary lenses, not competing instructions.

### D4 — Composer block ordering is stable and deterministic

When multiple personas enter the prompt, their order matters (first persona's voice leads). We order by:
1. Reception's return order (which itself is governed by prompt engineering to surface the "leading lens" first).
2. Fallback tiebreaker: alphabetical by key.

This keeps identical input to identical output, which matters for debugging and for eventual caching strategies.

### D5 — Expression pass receives the list

`ExpressionInput.personaKey: string | null` becomes `personaKeys: string[]`. The system prompt of the expression pass names them all and reminds: *"one unified voice; preserve each lens's distinctive contribution to the draft; do not add segment markers."* When the list is empty, same behavior as today's null (no persona block in the expression prompt).

### D6 — Per-turn meta stamps both shapes

Assistant entries stamp two fields in their `data` blob:
- `_personas: string[]` — the canonical new shape.
- `_persona: string | null` — for backward compat: the first element of `_personas`, or `null` when empty.

This lets every current consumer of `_persona` (conversation-list filter, me-stats, persona-turn-counts, scope-sessions last-persona read) keep working without changes. Follow-up stories can migrate consumers one-at-a-time to `_personas`.

### D7 — Bubble signature carries multiple badges on transition

`computeBubbleSignatures(messages)` becomes set-based. For each assistant turn, it compares `currentPersonas` with the previous assistant's `previousPersonas` and returns:
- `showSignature: boolean` — true when at least one persona is present.
- `primaryPersona: string | null` — the first persona (for color bar).
- `newPersonasThisTurn: string[]` — personas present now that were **not** in the previous assistant turn. These are the badges that render.
- Same run (identical set) → no new badges, but color bar continues.

**Why compare sets, not order.** If a turn has `[estrategista, divulgadora]` and the next has `[divulgadora, estrategista]`, no new persona entered — the set is unchanged. Don't re-badge.

### D8 — Color bar uses the primary persona (first in the list)

Simpler than a gradient. The primary is the first in the list — which is reception's "leading lens." Most turns will have just one persona anyway, so the heuristic is almost always irrelevant. When two are active, the color bar hints at the lead without trying to show both.

A gradient or dual-tone bar is S5b territory, alongside segmented voicing.

### D9 — Cast auto-seed writes every picked persona

First-turn seeding today writes `reception.persona` (single) into `session_personas` when the pool is empty. Now it writes each of `reception.personas` individually. A session that activates two personas on turn 1 ends turn 1 with both in the pool — the Cast shows both from turn 2 onward.

### D10 — Streaming routing event carries the array

The SSE `routing` event today emits `persona: string | null` and `personaColor: string | null`. Now emits:
- `personas: string[]`
- `personaColors: Record<key, color>` (scoped to the turn's picks — the client already has the session-wide map from page-render data attrs, but the per-turn map keeps the event self-contained).

`chat.js` `attachPersonaSignature` + `ensureCastAvatar` both loop over the array. The helpers already exist; they just call in a loop now.

## Phases

Each phase commits on its own, with green tests at commit time.

### Phase 1 — Reception returns `personas: string[]`

**Files:**
- `server/reception.ts` — `ReceptionResult.persona: string | null` → `.personas: string[]`. JSON parser accepts `{"personas": [...]}` with legacy-shape fallback `{"persona": "..."}` → `[...]`. Prompt updated: the return contract line changes; the examples block is adapted (one-liner note that multiple keys are allowed when multiple lenses clearly apply).

**Tests:**
- Update existing reception-axes tests to read `.personas[0]` where they previously read `.persona`.
- New probes: LLM returns `["mentora"]` → `personas: ["mentora"]`; returns `["mentora", "tecnica"]` → both; returns legacy `"mentora"` → wrapped to `["mentora"]`; returns unknown key mixed with valid → valid survives, unknown dropped; empty array → empty.

### Phase 2 — Composer accepts `personaKeys: string[]`

**Files:**
- `server/identity.ts` — `composeSystemPrompt` third parameter shape changes. Single-key callers update to pass a one-element array. Multi-persona case renders the cluster with the shared instruction prefix.
- `server/composed-snapshot.ts` — mirror change for the inspection surface.

**Tests:**
- Existing compose tests: `composeSystemPrompt(..., "mentora", ...)` → `composeSystemPrompt(..., ["mentora"], ...)`. No behavior change when the array has one element.
- New: empty array renders no persona block; two-element array renders both with the shared prefix; order is stable (input order wins).

### Phase 3 — Expression pass accepts `personaKeys: string[]`

**Files:**
- `server/expression.ts` — `ExpressionInput.personaKey` → `.personaKeys: string[]`. System prompt block rewrites to name all active personas and reiterates the one-voice rule.

**Tests:**
- Existing expression tests that passed `personaKey: "mentora"` → pass `personaKeys: ["mentora"]`. Prompt assertions updated (the block now lists personas as a bullet or comma-joined line).
- New: empty array omits the persona section; two-element list names both.

### Phase 4 — All three adapters rewired to the plural shape

**Files:**
- `adapters/web/index.tsx` — `/conversation/stream` reads `reception.personas`, auto-seeds all of them into `session_personas` on first-turn, composes with the array, calls `express` with the array. Routing SSE event emits `personas: string[]` + `personaColors: Record<key, color>` instead of `persona` + `personaColor`. Assistant entry writes `_personas` + `_persona` (first element / null).
- `adapters/telegram/index.ts` — same changes at a smaller scale (no UI, no streaming).
- `server/index.tsx` — API `/message` endpoint, same shape migration.

**Tests:**
- `tests/web.test.ts` — the bubble signature describe block migrates to the new data shape; at least one new probe verifies that two personas in a turn both get badges on the transition.

### Phase 5 — UI signature rewrite (set-based transitions)

**Files:**
- `adapters/web/pages/mirror.tsx` — `computeBubbleSignatures` rewrites to set comparison. Returns `{ showSignature, showAvatarBadges: string[], primaryPersona, primaryColor }` per message. Render maps over `showAvatarBadges` to emit one `◇ key` span per new persona.
- `adapters/web/pages/conversation-header.tsx` — Cast auto-seed client-side painter iterates over the routing event's `personas`.
- `adapters/web/public/chat.js` — `attachPersonaSignature` and `ensureCastAvatar` accept arrays (loop internally).

**Tests:**
- Bubble with one persona: one color bar, one badge on first turn.
- Bubble with two personas on turn 1: color bar matches first persona, two badges.
- Turn 2 with same set: color bar same, no new badges.
- Turn 3 with superset (add a third): color bar still first persona of turn 1, one new badge (for the third).
- Turn with subset (drop one): color bar now first of reduced list, no new badges.

### Phase 6 — Close-out

- `docs/process/worklog.md` entry.
- `docs/project/decisions.md` entry expanding the 2026-04-24 cast-vs-scope entry to name the S5a shape.
- Mark S5 ✅ (or S5a-complete) in the epic and roadmap indexes. Decide whether to leave S5b as a distinct pending line item or fold it as a follow-up inside the same box.
- Refactoring log with applied + parked items.

## Files likely touched

- `server/reception.ts` + `tests/reception.test.ts`
- `server/identity.ts` (compose) + `tests/identity.test.ts`
- `server/composed-snapshot.ts`
- `server/expression.ts` + `tests/expression.test.ts`
- `adapters/web/index.tsx` (stream handler, auto-seed, routing event, entry writes)
- `adapters/telegram/index.ts`
- `server/index.tsx` (API /message)
- `adapters/web/pages/mirror.tsx` (computeBubbleSignatures + render)
- `adapters/web/pages/conversation-header.tsx` (routing event reader, if any)
- `adapters/web/public/chat.js` (attachPersonaSignature loop, ensureCastAvatar loop)
- `tests/web.test.ts` (bubble signature, cast, streaming event)

## Open questions (registered, not blockers)

- **Reception prompt calibration.** The prompt needs enough guidance to prefer one persona when one suffices, and to reach for multiple only when two lenses clearly share a turn. Draft language: *"Prefer the minimum number of personas. Return more than one only when a single persona cannot carry the answer's full substance without the model acting outside its descriptor."* Refine after real use.
- **Cost/latency impact.** Two personas in the composed prompt means more tokens in the main generation call. Typical persona block is ~200-500 tokens; two is ~1000 extra. Acceptable; if it becomes a budget pressure, follow-up explores compacting.
- **`_persona` consumers that need to show all personas.** `/conversations` listing filter, me-stats "most active persona," scope-sessions "last persona" — each continues to work via the first-element fallback. When they read `_persona` and get "estrategista" for a turn that had `["estrategista", "divulgadora"]`, that's a minor information loss for downstream analytics. Parked; audit candidate for S5b cleanup.
- **Reception order stability.** The LLM's return order isn't strictly reproducible. For D4 determinism, consider post-sorting by reception-specified "leading" key (out of scope; today prompt just asks for array, order = first-mentioned).

## Risks

- **Reception over-activation.** Model returns three personas when one suffices; prompt bloats, expression pass has more to integrate, voice feels muddy. Mitigation: explicit "minimum sufficient set" rule, plus a probe set at calibration time that probes single-persona turns and fails if reception hits 2+.
- **Integrated voicing producing shallow merges.** The expression pass must actually weave both lenses. If it produces a bland middle, we'll see it on real messages; calibration fix is prompt engineering in the expression role first.
- **Badge noise on turns with three personas.** Three `◇ X ◇ Y ◇ Z` chips stacked above the bubble could look busy. First-turn-only display (S5's rule) suppresses most of it; if still noisy, cap at N visible + "+more" affordance (S5b-ish).
- **Telegram / CLI parity for array writes.** Smaller surface, easier to regress. Mitigated by adapters passing through the same composer and expression modules.

## Done criteria

- [ ] `./run_tests.sh` green; net new tests ≥ 10 across reception, compose, expression, web.
- [ ] Manual validation: the divulgação-do-espelho probe reproduces the integrated voicing behavior; Cast shows two avatars; bubble shows two `◇` badges on the first transition.
- [ ] Backward-compat read path: sessions created before this story still render correctly (their `_persona` stamping is honored via the fallback in `_personas`).
- [ ] Reception output shape migrated for all three adapters; no caller still reads `.persona` (singular).
- [ ] Story docs present: index, plan, refactoring log.
- [ ] Worklog + decisions log entries.
