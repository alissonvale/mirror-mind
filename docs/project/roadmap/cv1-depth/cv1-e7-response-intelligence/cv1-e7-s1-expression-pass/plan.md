[< Story](index.md)

# Plan: CV1.E7.S1 — Expression as a post-generation pass

**Roadmap:** [CV1.E7.S1](index.md)
**Framing:** The Product Use Narrative (v0.13.0) populated the system with four family members whose conversations are dominated by short, lived-in exchanges — *"Had coffee with Mike Fraser this morning."* The mirror's current answers are long by default. The single mega-prompt conflates form rules (`ego/expression`) with identity (`self/soul`, `ego/identity`), domain (`persona`), and situation (`organization`, `journey`) — so shape competes with substance inside a single weight budget. Moving shape into its own step lets substance and shape each get a model sized for their job, and it installs the first pipeline extension point — the handle that the rest of [CV1.E7](../index.md) will reuse.

---

## Goal

A chat response passes through **two** LLM calls instead of one:

1. **Main generation** — Agent with a composed system prompt that omits `ego/expression`. Produces a *draft reply*: the substance, possibly in any form.
2. **Expression pass** — small LLM call that receives the draft, the user's original message, the persona in effect, the user's `ego/expression` text, and the response mode. Produces the *final reply*: same substance, shaped.

The pass is always on (not conditional on heuristics this round). The response mode is auto-detected by reception (fourth axis added to the classifier) and can be overridden by the user from the Context Rail, where it persists per session.

**Validation criterion:** sending *"Had coffee with Mike Fraser this morning."* into a fresh Dan Reilly session produces a short, conversational reply (one or two sentences, no headers, no lists). Sending *"How should I think about VMware vs Proxmox for the homelab migration?"* produces a compositional reply (structured, list if appropriate, headers if the answer branches). Both sessions show, during generation, the two-phase status indicator: *Composing…* then *Finding the voice…*. Overriding the mode from the rail to **essayistic** on the first message and re-asking produces a longer, more reflective version of the same answer.

## Non-goals (this story)

- **General pipeline abstraction.** No `Step<In, Out>` interface, no registry, no named-stage runtime. Expression gets wired as a concrete function on the hot path. Abstraction earns its place after 3+ steps exist ([CV1.E7.S7](../index.md)).
- **Conditional skip.** Expression runs on every turn. Custom heuristics ("skip when the draft is already short") are a next-round decision informed by real latency data, not a guess.
- **Semantic retrieval / memory search.** Parked for [CV1.E7.S6](../index.md).
- **Structuring `ego/expression` into fields.** Markdown-free form stays. If per-user expression needs richer shape later, we'll see it in the wild first.
- **Per-adapter differentiation of the expression pass.** Adapter already shapes the main prompt ([CV1.E2](../../cv1-e2-adapter-awareness/)). Expression inherits that shape via the draft; no adapter awareness inside the expression call itself in v1.
- **Mode on Telegram / CLI.** The rail is a web-only surface. Telegram and CLI use the auto-detected mode from reception, with no override. Fine for now.
- **Retroactive re-expression of past responses.** Expression applies turn-forward only. Old entries in `entries` keep the original, un-expressed text. No migration.
- **User-defined additional modes.** Three modes fixed in v1: `conversational`, `compositional`, `essayistic`. Adding a fourth (e.g., `poetic`) is a config change later; not designing the extension shape now.

## Decisions

### D1 — Expression is a post-generation pass, not a prompt layer

`ego/expression` stops being concatenated into the main system prompt. It becomes structured input to a second, smaller LLM call that operates on the draft.

**Why not keep it in the prompt and add a pass on top.** The point of the pass is that form rules compete with substance rules for the model's attention when they live in the same prompt. Leaving expression in the prompt *and* adding a pass would double-weight form at the expense of substance — not what we want.

**Why expression first (and not, say, `ego/behavior`).** Expression is the smallest identity footprint and the clearest pain signal. Behavior is about conduct/method; moving it is a larger, more delicate change. Start with the layer whose output is most visibly "form."

### D2 — Always on; no conditional skip in v1

Every turn runs the pass. If real latency / cost becomes painful (measurable: p95 turn latency, per-turn BRL cost), condition the pass in a follow-up story with actual signal.

**Why not "skip when draft is already short."** The whole point of the pass is that we don't know what "short" should be per user — that's what `ego/expression` + mode define. Heuristics in code would leak back into the problem we're moving out of.

### D3 — Dedicated small model via a new `expression` role

New entry in `config/models.json`:

```json
"expression": {
  "provider": "openrouter",
  "model": "google/gemini-2.5-flash",
  "timeout_ms": 10000,
  "price_brl_per_1m_input": 1.5,
  "price_brl_per_1m_output": 12.5,
  "purpose": "..."
}
```

Same shape and ops as the existing `reception` and `title` roles — admin-overridable at `/admin/models`, falls back silently on failure (in expression's case: fall back to the draft unchanged).

**Why Gemini 2.5 Flash to start.** Calibrated by the reception eval ([decisions.md 2026-04-21](../../../../decisions.md)) — fast, cheap, good enough for text transformation. Small risk of reasoning-over-reach; we'll apply `reasoning: "minimal"` here too, same rationale as reception.

**Alternative held in reserve:** Haiku 4.5 if Flash proves unstable at text transformation.

### D4 — Mode auto-detected by reception (fourth axis)

`ReceptionResult` extends from three nullable axes to four, with `mode` non-null (defaults to `"conversational"` on any failure or silence):

```ts
interface ReceptionResult {
  persona: string | null;
  organization: string | null;
  journey: string | null;
  mode: "conversational" | "compositional" | "essayistic";
}
```

Reception's prompt grows a small section describing the three modes and when each applies. The classification LLM already looks at the message — adding this axis is marginal cost.

**Why default `"conversational"` on silence.** Most messages in lived-in use are conversational. Defaulting to the loud mode (essayistic) every time reception fails would regress the current behavior. Defaulting to `compositional` (today's de facto mode) is an option, but the point of the story is that most messages do not deserve that shape. Pick the lightest default; reception's opinion overrides.

### D5 — Mode is overridable from the Context Rail and persists per session

New field `sessions.response_mode TEXT` (nullable; `NULL` = follow reception). Rail shows the current mode with a selector (three options + "auto"). Changing the mode writes the session row; subsequent turns of the same session use it and skip reception's `mode` axis (or use it for display only — resolved during implementation).

**Why per-session, not per-turn.** User stance rarely changes within a conversation; per-turn override would need a UI on every message. Per-session keeps the rail's existing posture (scope tags, persona pool) consistent.

**Why not per-user default.** Users' own material varies across sessions (journal entry vs homelab debug). A global default would push users back into today's "one mode fits all" pain.

### D6 — `ego/expression` stays markdown-free in v1

The expression pass reads `ego/expression` as opaque markdown and threads it into its own system prompt. No structuring into `{ length, avoid, prefer, tone }` yet.

**Why not structure now.** We have one real non-empty expression (Alisson's) and one template (everyone else's). Not enough variance to know what the fields should be. Structuring now would invent the shape before the need.

### D7 — Two-phase streaming UX: `Composing…` → `Finding the voice…`

The user sees the status indicator transition between the two phases, then the expressed version streams character by character.

- **Composing…** while the Agent generates the draft. Draft is *not* streamed to the UI; it's accumulated in server memory. (This is the UX cost of the pass — the old direct-stream is gone.)
- **Finding the voice…** while the expression pass starts consuming the draft.
- **Streaming** switches on when the expression pass emits its first delta; the bubble fills with the final text as it arrives.

**Why not stream the draft and replace it.** The "replace" flicker is jarring and teaches the user the wrong thing about what the mirror is doing. Hidden draft + labeled stages is honest: *the mirror is thinking, then phrasing, then speaking*.

**Why these exact labels.** `Composing` captures "organizing substance"; `Finding the voice` captures "matching your register." Both carry vocabulary soberano (from the IA Espelho constitution) and avoid operational flavor ("processing", "analyzing"). Can be retuned during review if either feels off.

### D8 — Expression is scoped to the assistant turn, not the session

The pass sees: the draft, the user's current message, the active persona (if any), the user's `ego/expression` content, the mode. It does *not* see prior entries of the session. Expression is about *this* turn's form.

**Why.** Conversation history is substance, not form. Letting expression see history would blur the separation this story is creating. If the pass needs more form context in the future (e.g., "keep form consistent across the session"), revisit explicitly.

### D9 — Empty `ego/expression` is a valid input

When the user hasn't written their expression (the common case in the family narrative's newly-loaded users), the pass still runs. The expression prompt handles the empty case with a neutral default ("apply the chosen mode's general conventions"). No special branch in code.

**Why.** Makes the hot path uniform and keeps the pass testable with or without per-user expression content. Users without expression still get mode-shaped replies, which is almost all of the v1 value.

### D10 — Main generation timeout unchanged; expression adds its own budget

Main turn latency budget is roughly the current p95 (~6–12s depending on model). Expression adds ~1–3s on top with Flash. Total is worse. Accepted for v1; if painful, D2 gets revisited with data.

## Phases

Each phase commits on its own, green tests, descriptive message. No commits skipped or batched.

### Phase 1 — Remove `ego/expression` from compose

**File:** `server/identity.ts`

- Delete the two lines that append `ego/expression` to `parts` ([current code at `identity.ts:101-102`](../../../../../server/identity.ts)).
- Update the composition-order docstring ([lines 29–42](../../../../../server/identity.ts)) to reflect the new order: `self/soul → ego/identity → [persona] → [organization] → [journey] → ego/behavior → [adapter]`.
- Update `docs/product/journey-map.md §Composition order` if it hardcodes the current order.

**Tests:**
- Update any compose-prompt tests that asserted expression was in the output. Those tests should now assert it is *not* in the composed prompt.
- Add an assertion that the composed prompt still contains behavior and adapter blocks (regression guard).

**Validation:** `./run_tests.sh` green. Manual: compose a prompt for Alisson, grep for a phrase from his expression — absent.

### Phase 2 — `expression` model role

**Files:**
- `config/models.json` — new `"expression"` entry (D3).
- `server/db/models.ts` — if it enumerates roles, extend the union type (otherwise no change; roles are strings).
- Seed path for new installations — mirror the pattern reception uses.

**Tests:**
- Existing models tests should enumerate roles; add expression to the expected set.

### Phase 3 — Expression pass implementation

**New file:** `server/expression.ts`

```ts
export type ResponseMode = "conversational" | "compositional" | "essayistic";

export interface ExpressionInput {
  draft: string;
  userMessage: string;
  expressionLayer: string | null;  // ego/expression content, or null
  personaDescriptor: string | null; // short descriptor, not full persona prompt
  mode: ResponseMode;
}

export interface ExpressionResult {
  text: string;
  /** Stream iterator for delta-by-delta yield — mirror the Agent API shape. */
  stream?: AsyncIterable<string>;
}

export async function express(
  db: Database.Database,
  userId: string,
  input: ExpressionInput,
  completeFn?: typeof complete,
): Promise<ExpressionResult>;
```

- Mirrors `reception.ts` shape (injectable `completeFn` for tests, silent fallback on error — return `{ text: input.draft }` unchanged).
- Builds its own compact system prompt: *"You are a form editor. You rewrite the draft to match the chosen response mode and the user's expression rules. You do not change substance. You do not add content. You do not answer the user — you only re-phrase the draft."* + mode description + optional expression block.
- Uses pi-ai's streaming `complete` so the final text streams back to the SSE handler.
- Usage logged via `logUsage(db, "expression", ...)` (reuses the existing CV0 stats plumbing).

**Tests:** `tests/expression.test.ts` (new)
- Each mode applied to a fixed draft produces a shape-conformant output (spy on the prompt passed to `completeFn`).
- Empty expression layer → pass still runs, prompt omits the expression block.
- Error path → returns draft unchanged.
- Usage logged with the right role.

### Phase 4 — Reception extends with `mode` axis

**File:** `server/reception.ts`

- Extend `ReceptionResult` with `mode: ResponseMode` (D4).
- Extend the reception prompt with the three-mode block and classification rule.
- Default to `"conversational"` on any fallback path.

**Tests:**
- New probes: 3–5 messages whose expected mode is obvious (`"Had coffee with…"` → conversational; `"Explain VMware vs Proxmox"` → compositional; `"How should I think about the empty nest?"` → essayistic).
- Update existing probes to assert the new field.

### Phase 5 — `response_mode` on sessions + override writes

**Files:**
- `server/db.ts` — schema `sessions.response_mode TEXT` column; `migrate()` adds it to pre-existing installs.
- `server/db/sessions.ts` — `setSessionResponseMode(db, sessionId, mode | null)`; getter already handled by existing `getSessionById`.
- `adapters/web/` — POST endpoint to set mode (mirror `/conversation/tag` shape).

**Tests:**
- DB tests for setter + getter.
- Route tests for POST (auth required, ownership check, null/enum validation).

### Phase 6 — Pipeline wire-up in the chat stream

**File:** `adapters/web/index.tsx`, handler at `/conversation/stream` ([~line 978](../../../../../adapters/web/index.tsx)).

Current flow:
```
reception → compose → new Agent → agent.prompt(text) — stream deltas directly
```

New flow:
```
reception (with mode)
  → compose (no expression)
  → new Agent
  → agent.prompt(text) — accumulate draft in memory, do NOT stream to client
  → express(draft, ...)
  → stream expression output to client
```

- The SSE handler emits a new event type `status` with `{ phase: "composing" | "finding-voice" }` before each phase, so the client can swap the microtext.
- The existing `delta` event fires during the expression stream only.
- `done` event unchanged (`rail` payload already carries everything).
- Entry persistence: the assistant `entry.data.content` is the expressed text. The draft is **not** persisted in v1 (explicit decision — can be added as a debug field later).

**Tests:** `tests/web.test.ts`
- End-to-end probe of the stream shape: `status(composing)` → `status(finding-voice)` → N `delta` events → `done`.
- Expression error path: falls back to draft, still streams, `status(finding-voice)` still emits (the user-visible UX stays consistent).

### Phase 7 — Context Rail UI

**Files:**
- `adapters/web/pages/context-rail.tsx` — new section "Response mode" with four options (auto / conversational / compositional / essayistic), wired to the POST endpoint from Phase 5.
- `server/session-stats.ts` or wherever `RailState` is built — include the current mode + resolved source ("auto from reception" vs "set by you").
- CSS bump (`?v=expression-pass-1`) on any files touched.

**Tests:** `tests/web.test.ts`
- Rail renders the mode section, the selected option is checked.
- Submitting a different option persists and re-renders.

### Phase 8 — Client-side microtext indicator

**File:** `adapters/web/public/chat.js` (or equivalent).

- Handle the new `status` SSE event. When phase = `composing`, show "Composing…" in the assistant bubble placeholder. When phase = `finding-voice`, swap to "Finding the voice…". When first `delta` arrives, clear the microtext and start rendering the stream.

**Tests:** existing SSE tests extend to cover the two status frames (route tests via `app.request()` don't exercise the client JS, but cover the server side emitting the events in order).

**Manual validation:** Dan's session — send `"Had coffee with Mike Fraser this morning."` — observe the two microtext transitions, then the short reply.

### Phase 9 — Docs + close-out

- `docs/process/worklog.md` entry (catch up from v0.13.0 while we're at it — [worklog is defaulting to v0.12.0](../../../../process/worklog.md)).
- Mark S1 ✅ in epic index + roadmap.
- Decisions.md gets a short ADR-style entry for the pipeline-as-pattern turn (see the ADR block at the top of `docs/project/decisions.md`).
- Refactoring log per the standing story docs policy — what was cleaned up, what was left parked with criteria.

## Files likely touched

- `server/identity.ts` — remove expression from compose
- `server/reception.ts` — mode axis
- `server/expression.ts` — new
- `config/models.json` — expression role
- `server/db.ts` — `sessions.response_mode` column + migration
- `server/db/sessions.ts` — mode getter/setter
- `adapters/web/index.tsx` — stream wire-up + POST mode endpoint
- `adapters/web/pages/context-rail.tsx` — mode section
- `adapters/web/public/chat.js` — two-phase status handler
- `adapters/web/public/style.css` — microtext styling + version bump
- `docs/product/journey-map.md` — composition order reference
- `tests/expression.test.ts` (new), `tests/reception.test.ts`, `tests/db.test.ts`, `tests/web.test.ts`

## Open questions (registered, not blockers)

- **Flash vs Haiku for the expression role.** Starting with Flash (D3). If text transformation under Flash produces odd artifacts (over-simplification, over-rewrite), swap to Haiku. Keep an eval probe for this during calibration.
- **Should the draft be persisted for debugging?** Not in v1. Possible follow-up: store the draft in `entries.data.draft_text` behind a feature flag for admin inspection. Decide after first week of use.
- **Does the expression pass ever see the `conversational` mode and decide it doesn't need to rewrite?** It can no-op by returning the draft verbatim; that's fine and cheap. Explicit skip in code stays off the table (D2).
- **Mode on retroactive sessions.** Loaded narrative sessions have no `response_mode` set — they'll follow reception. Acceptable; no backfill.

## Risks

- **Latency regression.** Biggest concrete risk. Mitigation: Flash is fast, expression prompt is short, and we accept the worse total p95 for v1. If the latency teaches us something, we adjust in a follow-up.
- **Reception over-classifying mode.** Four-axis classification is a small step up in complexity. If accuracy drops on the existing three axes, roll the mode axis back into a separate call (at more cost). Monitor during calibration.
- **Expression pass corrupting meaning.** A form-editor prompt that "doesn't change substance" will sometimes change substance anyway — especially at Flash's scale. Mitigations: prompt explicitly forbids adding or removing claims; test probes verify substance preservation on a small set; user-reported regressions trigger a persona-descriptor-in-input fix or a prompt rewrite.

## Done criteria

- [ ] `./run_tests.sh` green; net new tests ≥ 12 (rough: expression 4, reception 3, sessions.response_mode 2, web route 3).
- [ ] Validation criterion above reproduces for Dan Reilly + Alisson sessions.
- [ ] Context Rail mode section renders, changes persist.
- [ ] Smoke tests pass (`./run_smoke_tests.sh`).
- [ ] Story docs present: index, plan, test guide (this plan will be split if it grows during implementation), refactoring log.
- [ ] Worklog entry catches up from v0.13.0 and records S1.
- [ ] Decisions.md carries the pipeline-turn ADR.
