[< Docs](../../index.md)

# Prompt Composition

How a turn becomes a response. The mirror's intelligence lives in a **pipeline of named steps**; each step earns its place. This is the canonical reference for how the system prompt is built and how the response is shaped, in the *current* state of the codebase.

> **Living document.** Every story that touches reception, identity composition, or the expression pass MUST update this file as part of close-out. See [Development Guide §4](../../process/development-guide.md).

> **Last update:** 2026-04-25 (after CV1.E7.S3 — conditional scope activation).

---

## The pipeline

```
user message
    │
    ▼
┌────────────────────────────────────────────┐
│ 1. Reception (small LLM)                   │
│    classifies on 4 axes:                   │
│    personas + organization + journey + mode│
└──────────────┬─────────────────────────────┘
               ▼
┌────────────────────────────────────────────┐
│ 2. Composition                             │
│    builds system prompt from layers,       │
│    activated by reception's signals        │
└──────────────┬─────────────────────────────┘
               ▼
┌────────────────────────────────────────────┐
│ 3. Main generation (large LLM, Agent)      │
│    produces a draft (in memory only)       │
└──────────────┬─────────────────────────────┘
               ▼
┌────────────────────────────────────────────┐
│ 4. Expression pass (small LLM)             │
│    rewrites draft to match mode + rules    │
└──────────────┬─────────────────────────────┘
               ▼
┌────────────────────────────────────────────┐
│ 5. Adapter formatting + meta stamping      │
└──────────────┬─────────────────────────────┘
               ▼
            response
```

Motto: *every token in the prompt must earn its place* ([briefing #5](../../project/briefing.md)).

---

## 1. Reception

A pre-classification LLM call. Fast, cheap, low-stakes. Its output drives every downstream decision in the pipeline — which persona's voice answers, which scope content composes, what shape the response takes, whether the deep identity layers participate. Reception is the single arbiter; the composer respects.

- **File:** [`server/reception.ts`](../../../server/reception.ts)
- **Model role:** `reception` in `config/models.json` (default: Gemini 2.5 Flash, `reasoning: "minimal"`, 5s timeout)

### Output — 5 canonical axes + 3 auxiliary axes

```ts
interface ReceptionResult {
  // Canonical — drive the response composition:
  personas: string[];                                       // CV1.E7.S5 — ordered, leading lens first
  organization: string | null;
  journey: string | null;
  mode: "conversational" | "compositional" | "essayistic";  // CV1.E7.S1 — never null
  touches_identity: boolean;                                // CV1.E7.S4 — gates self/soul + ego/identity
  // Auxiliary — drive the rail's out-of-pool suggestion (CV1.E7.S8):
  would_have_persona: string | null;
  would_have_organization: string | null;
  would_have_journey: string | null;
}
```

| Axis | Type | Drives | Default on uncertainty |
|---|---|---|---|
| `personas` | `string[]` | Persona block(s) in composition; bubble color bar / chip | `[]` |
| `organization` | `string \| null` | Organization briefing+situation block | `null` |
| `journey` | `string \| null` | Journey briefing+situation block | `null` |
| `mode` | enum | Expression pass shaping (conversational / compositional / essayistic) | `"conversational"` (lighter-mode tiebreaker) |
| `touches_identity` | `boolean` | `self/soul` + `ego/identity` composition | `false` (identity-conservative) |
| `would_have_persona` | `string \| null` | Rail's out-of-pool suggestion card; click triggers divergent run | `null` (no suggestion) |
| `would_have_organization` | `string \| null` | Same — for organization | `null` |
| `would_have_journey` | `string \| null` | Same — for journey | `null` |

### Candidate pool — what reception is allowed to pick from

Reception is given a list of available candidates drawn from the user's data:

| Pool | Source | Filter |
|---|---|---|
| Personas | `identity` table, `layer=persona` | none |
| Organizations | `organizations` table | `status` ∈ {active, concluded}; archived excluded |
| Journeys | `journeys` table | same as orgs |

If the **session has scope tags** (CV1.E4.S4), each non-empty tag list **constrains** the corresponding pool to that subset. Empty tag lists leave the pool unfiltered. The constraint applies before the LLM sees candidates — a journey absent from the tagged pool is invisible to reception, even if the message names it explicitly. See [§ Session scope lifecycle](#session-scope-lifecycle) for the full contract.

`touches_identity` is **not** pool-constrained — it's a property of the message register, not of the user's available content.

**Edge case — no candidates:** when all three pools end up empty (no personas, no orgs, no journeys configured for the user), reception skips the LLM call entirely and returns the null-result. Greetings on a fresh blank session never pay a round-trip. `touches_identity` stays `false` in that path (matches the conservative default).

### Decision rules — accumulated across stories

These rules live in the reception system prompt and are the canonical decision logic. Each story added or refined a subset:

**Personas (CV1.E1, refined CV1.E4, plural in CV1.E7.S5):**
- **Minimum sufficient set.** Empty when no clear domain. One when one lens covers the message's substance. Multiple **only** when the message genuinely spans domains that need to cooperate.
- **Order matters.** First entry is the **leading lens** (used by the composer's multi-persona prefix and the UI's bubble color bar).
- **Action verbs dominate topic.** Imperative production verbs ("write", "draft", "compose") activate the production persona even if the topic is conceptual.

**Organization and journey (CV1.E4.S1, refined CV1.E7.S3):**
- **Sole-scope-in-domain rule (MANDATORY).** If exactly one scope's descriptor covers the message's domain, that scope activates. Returning null when there is a sole match is a routing bug.
- **Pair journey + parent org.** When a journey belongs to an org and applies to the message, return both keys. Composer renders broader (org) before narrower (journey).
- **Independent from personas.** A question about a domain activates both the persona that handles it AND the scope that IS the context within it.

**Mode (CV1.E7.S1):**
- **Form beats topic.** Register (length, statement vs question, explicit ask for depth) is the primary signal. Topic is secondary. Short first-person statements are conversational *even when the topic is existential*.
- **Lighter-mode tiebreaker.** When in doubt, pick `conversational` over `compositional` over `essayistic`. The cost of under-shaping is small (user can ask for more depth); the cost of over-shaping is large (user feels lectured).

**Identity (CV1.E7.S4):**
- **Identity-conservative tiebreaker.** When in doubt, prefer `false`. Identity-touching turns are the minority case; the modal turn is operational. A miss in the false direction is recoverable; a miss in the true direction is silent token waste plus tonal mismatch.
- **Form beats topic on identity too.** A short first-person statement on a deep topic is `touches_identity: false`. Both the mode axis and the identity axis respect the user's chosen form.
- **Explicit framing flips true.** Essayistic register OR explicit framing about identity / purpose / values is what unlocks `true`.

**Out-of-pool would-have-picked (CV1.E7.S8):**
- **Conservative threshold.** Flag a `would_have_X` only when the out-of-pool candidate is a clean domain match AND every in-pool option would be a stretch. Default null.
- **Strict pool separation.** The canonical axes (`personas`, `organization`, `journey`) pick from the SESSION POOL only. The would-have axes pick from the OUT-OF-POOL list only. Reception's prompt enforces both directions.
- **Single LLM call.** Both axes resolved in the same classification — when session pool == full pool for an axis (no constraint), the would-have axis stays null without extra reasoning.

### Backward compatibility

Reception accepts the legacy singular `persona: "<key>"` shape produced by older models — it wraps into a one-element `personas` array. Unknown keys (drift, deleted scopes) are silently dropped. Missing axes default to their identity-conservative values: `personas` → `[]`, scopes → `null`, mode → `"conversational"`, `touches_identity` → `false`.

See [decisions 2026-04-24 — Multi-persona per turn](../../project/decisions.md#2026-04-24--multi-persona-per-turn-integrated-voicing-first-cv1e7s5) for the persona array compat path; [decisions 2026-04-26 — Conditional identity layers](../../project/decisions.md#2026-04-26--conditional-identity-layers-cv1e7s4) for the identity default rationale.

### Failure modes — NULL_RESULT

Timeout (5s), invalid JSON, missing model role, missing API key — all paths fall back to `NULL_RESULT`:

```ts
const NULL_RESULT: ReceptionResult = {
  personas: [],
  organization: null,
  journey: null,
  mode: "conversational",   // lighter-mode tiebreaker
  touches_identity: false,  // identity-conservative
};
```

The response continues with base identity (just `ego/behavior` + adapter, since identity is also gated off on failure). Reception is best-effort, never blocking — the user always gets a reply, even if reception silently degrades to the null path.

### Worked example

User message: *"Should I move the Plex VM to the new Proxmox host first, or start with the staging cluster?"*

Reception sees:
- **personas** pool (filtered by session tags if any): contains `engineer`, `tecnica`, plus others
- **orgs** pool: contains `reilly-homelab` (tagged) — the only org allowed in pool
- **journeys** pool: contains `vmware-to-proxmox` (tagged)

Reception applies the rules:
- *Plex VM and Proxmox host* → IT/sysadmin domain → `engineer` covers it → **personas: ["engineer"]**
- *"the new Proxmox host"* + *"staging cluster"* → references the homelab → sole-scope rule activates **organization: "reilly-homelab"**
- *migration cutover order* → journey `vmware-to-proxmox` covers it → **journey: "vmware-to-proxmox"** (pair pattern with the org)
- *Compare/decide structure* → **mode: "compositional"** (or conversational — lighter-mode tiebreaker if borderline)
- No identity / purpose / values framing → **touches_identity: false**

Final: `{ personas: ["engineer"], organization: "reilly-homelab", journey: "vmware-to-proxmox", mode: "compositional", touches_identity: false }`. Composer assembles the prompt with engineer persona block, both scopes' briefing+situation, but skips soul/identity. The expression pass reshapes the draft toward compositional form.

---

## 2. Composition

Builds the system prompt for the main generation. Skips layers that aren't activated.

- **File:** [`server/identity.ts :: composeSystemPrompt`](../../../server/identity.ts)

### Layer activation rules — current state

| Layer | Source | Activates when | Notes |
|---|---|---|---|
| `self/soul` | `identity` row `layer=self, key=soul` | reception returned `touches_identity: true` (CV1.E7.S4) | Opens the identity cluster when active. Identity-conservative default — silence (missing field, fail) skips both this layer and `ego/identity`. |
| `ego/identity` | `identity` row `layer=ego, key=identity` | reception returned `touches_identity: true` (CV1.E7.S4) | Gated together with `self/soul`. Operational positioning when active. |
| `persona/<key>` | `identity` row `layer=persona` | reception returned the key in `personas[]` | Multiple keys → multi-lens block (see below) |
| organization | `organizations` table | reception returned the key as `organization` | Session tags constrain reception's pool, not composition (CV1.E7.S3) |
| journey | `journeys` table | reception returned the key as `journey` | Same as organization |
| `ego/behavior` | `identity` row `layer=ego, key=behavior` | **always** (when row exists) | Opens the form cluster. Stays unconditional — form is transversally relevant; the cost of stripping it is too high. |
| `ego/expression` | n/a in composition | **never** | Moved to expression pass (§4) since CV1.E7.S1 |
| adapter instruction | `config/adapters.json` | adapter is one of `web` / `telegram` / `cli` / `api` | `api`'s instruction is empty string |

### Composition order

```
self/soul → ego/identity → [persona blocks] → [organization] → [journey] → ego/behavior → adapter
```

Two clusters: **identity** ("who I am, in this turn's lens") opens; **form** ("how I act here") closes. Personas sit inside the identity cluster as specializations, not final overrides. Behavior closes the substance side; the adapter instruction (when present) is the very last block so its constraints (e.g., Telegram's "no headers") get maximum recency weight.

Layers join with `\n\n---\n\n`.

### Multi-persona block (CV1.E7.S5)

When `personas.length === 1`, the persona's content renders as-is — single-persona behavior is identical to pre-S5.

When `personas.length > 1`, all blocks render in array order, prefixed by:

> *Multiple persona lenses are active simultaneously for this turn. Speak with one coherent voice that integrates all of them — each lens contributes its depth to the reply, but the voice is unified. Do not label segments or mark transitions between lenses inside the text; weave them into a single answer.*

Voicing default is **integrated**. Segmented voicing (`◇ X ... ◇ Y` markers inside a reply) is parked for S5b.

### Scope rendering

A scope's prompt block uses both `briefing` and `situation` fields:

| Fields present | Rendered block |
|---|---|
| both | `briefing\n\n---\n\nCurrent situation:\nsituation` |
| briefing only | just `briefing` |
| situation only | `Current situation:\nsituation` |
| neither | block dropped entirely |

`status !== "active"` scopes never compose, even if a key was passed in (defense in depth — reception is supposed to filter them, but the composer is the second wall).

### Conditional scope activation (CV1.E7.S3)

A scope's content reaches the prompt **only when reception picks it for this turn**. Session tags continue to express *"this conversation is in this context"* and constrain reception's candidate pool — but they no longer force composition. A pinned scope absent from reception's pick produces an empty block.

The two-axis path:

```
session tags → reception's candidate pool (constraint)
                      │
                      ▼
            reception picks at most one org
            and at most one journey per turn
                      │
                      ▼
            composer renders only what was picked
```

Effect on the user-facing surface:

- The scope pill in the conversation header (`⌂ org`, `↝ journey`) reflects the **session-level tag** — it does not flicker per turn.
- The bubble-level badges reflect the **per-turn activation** — they appear only when the scope was composed.
- The "Look inside" snapshot shows the actual composed prompt, so a small-talk turn on a tagged session shows no scope block; a domain-relevant turn shows the full briefing + situation.

Reception is the single source of truth for composition. When in doubt: read `server/identity.ts :: composeSystemPrompt`.

---

## 3. Main generation

The Agent ([pi-agent-core](https://github.com/mariozechner/pi)) is constructed with `{ systemPrompt: composedPrompt, messages: history + userMessage }` and run.

- **Files:** [`adapters/web/index.tsx`](../../../adapters/web/index.tsx), [`adapters/telegram/index.ts`](../../../adapters/telegram/index.ts), [`server/index.tsx`](../../../server/index.tsx)
- **Model role:** `main` in `config/models.json`

The main pass produces a **draft** that lives in memory only — never persisted, never shown to the user. The draft is the input to §4.

The Agent emits streaming deltas, but for the user-facing surface those deltas are buffered and replaced by the expressed text. Web emits a `composing` SSE status frame while the main pass runs.

---

## 4. Expression pass

A second LLM call that rewrites the draft to match the chosen mode and the user's `ego/expression` rules.

- **File:** [`server/expression.ts`](../../../server/expression.ts)
- **Model role:** `expression` in `config/models.json` (default: Gemini 2.5 Flash, `reasoning: "minimal"`, 10s timeout)

### Inputs

```ts
interface ExpressionInput {
  draft: string;
  userMessage: string;
  personaKeys: string[];   // for "preserve each lens's contribution" framing
  mode: ResponseMode;
}
```

### Mode guides (canonical)

These short descriptors are the sole source of truth for how modes differ — verbatim from `expression.ts`.

| Mode | Guide |
|---|---|
| `conversational` | Short and close. One to three sentences. No headers, no bullet lists, no preamble. Meet the message on its own register — the kind of answer you'd give in a real exchange. If the draft is already short and plain, leave it almost untouched. |
| `compositional` | Structured but tight. Use headers and lists only when the content is genuinely list-shaped (steps, comparisons, enumerations). Prefer short paragraphs to long ones. Think 'clean answer', not 'essay'. |
| `essayistic` | Reflective and fuller. Develop the thought across paragraphs with connective tissue between ideas. Prose over lists. The reader is after depth, not a summary. |

### What expression preserves and what it changes

**Preserves:** every claim, fact, name, number, conclusion. The mirror's voice (first person, the draft's tone). Each persona's contribution to the draft.

**Changes:** length, pacing, paragraph shape, vocabulary, punctuation, use of headers and lists.

If the draft is wrong, the final text stays wrong — expression is a **form editor**, not a fact-checker.

### Mode override per session

Users can pin a mode for a session via the rail (`POST /conversation/response-mode`). When pinned, reception's mode is ignored. NULL = follow reception (default). Stored on `sessions.response_mode`.

### Failure modes

Missing role, missing API key, timeout (10s), empty response → fallback returns `{ text: input.draft, mode, applied: false }`. The user sees the draft unchanged. Expression is best-effort.

### UI staging (web)

Web emits two SSE status frames before content streams:

1. `status: composing` while the main draft generates (chat reads *Composing…*)
2. `status: finding-voice` when the expression pass begins (chat reads *Finding the voice…*)
3. word-boundary deltas of the **expressed** text (not the draft)

Telegram and CLI receive the final expressed text in one block (no streaming).

---

## 5. Meta stamping + adapter formatting

After expression returns, the assistant message is persisted with meta tags that downstream readers (rail, conversation list, scope page, me-stats) consume.

### Meta fields stamped on `entries.data` (assistant entries)

| Field | Type | Set by | Read by |
|---|---|---|---|
| `_personas` | `string[]` | reception result (canonical) | rail, conversation list, scope-sessions, bubble signature |
| `_persona` | `string \| null` | first of `_personas` (legacy mirror) | older readers (backcompat) |
| `_organization` | `string \| null` | reception result | scope-sessions, me-stats (last conversation per scope) |
| `_journey` | `string \| null` | reception result | scope-sessions |
| `_mode` | `"conversational" \| "compositional" \| "essayistic"` | resolved mode (override or reception) | bubble per-turn glyph |
| `_mode_source` | `"reception" \| "session"` | which path produced `_mode` | (read for diagnostics, no consumer in UI yet) |
| `_touches_identity` | `boolean` | reception result | rail snapshot's layers list (filters out `self.soul` + `ego.identity` when false on F5) |

Readers normalize at the edge: prefer `_personas`, wrap singular into one-element array, empty array when neither field present. See [decisions 2026-04-24 — Multi-persona](../../project/decisions.md#2026-04-24--multi-persona-per-turn-integrated-voicing-first-cv1e7s5).

`_mode` and `_mode_source` were added by the [bubble-metadata-legibility improvement](../../project/roadmap/improvements/bubble-metadata-legibility/) (CV1.E7.S9 phase 1). The bubble's per-turn mode glyph reads from `_mode` via a `data-mode-icon` attribute when reception escalated above the default — `☰` for `compositional`, `¶` for `essayistic`. `conversational` is silent on the bubble (it's the default mode; presence of any glyph signals escalation). The same `_mode` field also surfaces as a `mode: <value>` row in the `Look inside` composed snapshot (S9 phase 2 — closes the transparency loop).

### Per-adapter formatting

| Adapter | Post-expression formatting |
|---|---|
| `web` | Pass through (browser renders markdown) |
| `telegram` | MarkdownV2 conversion → HTML fallback → plain text fallback |
| `cli` | Pass through |
| `api` | Pass through |

### Persona signature in the bubble

- **Web:** 3px lateral color bar on every persona'd assistant bubble (color from `identity.color` or the hash fallback). A circular mini-avatar chip renders **only on persona-set transitions** — the set diff against the previous assistant turn. Reordering `[A, B]` to `[B, A]` produces no fresh chip. The per-message `◇ persona` text badge was retired in CV1.E7.S2; its signal lives in the color bar + chip.
- **Telegram, CLI:** the server prepends a `◇ <leading-persona>\n\n` text signature when at least one persona is active. Multi-persona turns list every key.

---

## Cast vs Scope — the asymmetry

Three context axes — persona, organization, journey — used to be treated symmetrically in the UI and in composition. CV1.E7.S2 broke the symmetry; the asymmetry now governs both surfaces and rules.

| Property | Persona (cast) | Organization / Journey (scope) |
|---|---|---|
| Mutability | Mutable ensemble — forms across a conversation | Stable context — changes rarely |
| Multi-active per turn | Yes (S5) | One of each axis (pair pattern: journey + parent org) |
| Visual language | Avatars (color, accumulation, timeline) | Pills (`⌂` org, `↝` journey) — quiet, secondary |
| UI in conversation header | "Cast" zone | "Scope" zone |
| Composition rule | Reception picks; composer renders the picked set | Reception picks; composer renders the picked set. Session tags constrain the candidate pool, not composition |

The composition rule is now symmetric across cast and scope (CV1.E7.S3): in both cases, reception is the single arbiter of what reaches the prompt. The asymmetry lives elsewhere — in mutability (cast can grow within a conversation; scope is stable) and in plurality per turn (cast is multi by design; scope is at most one per axis, with the journey-plus-parent-org pair as the only two-active case).

See [decisions 2026-04-24 — Personas are a cast; orgs and journeys are a scope](../../project/decisions.md#2026-04-24--personas-are-a-cast-orgs-and-journeys-are-a-scope-cv1e7s2).

---

## Session scope lifecycle

The cast-vs-scope asymmetry above tells you *what* a scope is. This section tells you *how* the scope of a session evolves over time — the contract between the user, reception, and the composer.

### Three states of a session's scope pool

A session moves through up to three states. Each state changes how reception treats the candidate pool and whether the system can write to it.

| # | State | When | Reception behavior | Auto-write to pool |
|---|---|---|---|---|
| 1 | **Empty** | Fresh session before its first message | Considers all of the user's active+concluded orgs/journeys as candidates | n/a — no message yet |
| 2 | **Auto-seeded** | First turn of a previously-empty session | Considers all candidates, picks freely | **Yes — once.** Reception's picks are written into `session_personas`, `session_organizations`, `session_journeys` |
| 3 | **Manually managed** | Any subsequent turn, or any turn of a session that arrived at turn 1 with at least one tag already set | Pool is filtered to whatever is currently tagged | **No.** The user adds and removes tags explicitly |

```
         ┌──────────┐  first message,  ┌──────────────┐  any later turn,  ┌────────────────┐
new ───▶ │  Empty   │ ───────────────▶ │ Auto-seeded  │ ─────────────────▶│  Manually      │
session  │ no tags  │  reception picks │  pool now    │  pool stays as-is │  managed       │
         │          │  ↳ writes to DB  │  has tags    │                   │ (you add/remove)│
         └──────────┘                  └──────────────┘                   └────────────────┘
                                              ▲
                                              │
                                          New topic
                                       (begin again)
                                       opens a fresh
                                       session — back
                                       to Empty
```

The auto-seed window is **deliberately narrow**: it exists so that a brand-new conversation doesn't require any setup before the first message — the user types, reception classifies, the pool is born. After that single moment, the system stops writing tags on its own.

**Per-axis, not per-session — and asymmetric.** The auto-seed gate is evaluated independently for each of the three axes (personas, organization, journey), and the gate itself differs across them.

- **Personas (cast)** seed whenever the persona pool was empty before this turn, **regardless of whether it's the first turn**. The cast is mutable by design (CV1.E7.S2) — it forms across the conversation. A session that opens with a casual greeting, then surfaces a persona on turn 2, will have the cast form on turn 2. Once any persona enters the pool, reception is constrained and the auto-grow stops.
- **Organization and journey (scope)** seed only on the first turn, and only if the corresponding pool was empty. Scope is the conversation's stable context, declared at session start. Auto-growing scopes across turns would let casual mentions silently broaden the conversation's framing — exactly the kind of leakage S3 just closed at the composition layer.

The asymmetry is the point. The code now reflects the philosophical asymmetry CV1.E7.S2 installed at the visual layer (cast = avatars/mutable; scope = pills/stable). See [improvement: auto-seed-per-axis](../../project/roadmap/improvements/auto-seed-per-axis/) for the failure modes the all-or-nothing and first-turn-only gates produced before this asymmetric gate landed.

### The contract semantics

Once the session has any tag in any axis, the pool becomes a **declared boundary**. Reception applies the constraint *before* the LLM sees the candidate list (`server/reception.ts`, lines 102–115):

```ts
if (tags.organizationKeys.length > 0) {
  const allowed = new Set(tags.organizationKeys);
  orgs = orgs.filter((o) => allowed.has(o.key));
}
```

Concretely: a journey that exists in your data but isn't tagged on this session is **filtered out of reception's view**. The classification LLM never sees it as a candidate. A user message can name that journey explicitly — *"about my vida-economica situation, …"* — and reception will still return `journey: null`, because no journey in its filtered list matches.

The quietness is proposital. The pool is a contract, not a suggestion. Without it, casual mentions of unrelated travessias would pull their full briefing+situation into the prompt — exactly the kind of leakage that CV1.E7.S3 just removed at the composition layer. Pool-as-constraint is the same principle one level up: at the candidate-entry layer instead of the composition layer.

### Two paths to extend the pool

When a scope outside the current pool becomes genuinely relevant, the user has two manual moves:

1. **Add the tag in place** — the conversation header offers `↝ +` (journey) and `⌂ +` (organization) affordances, or `Edit scope ›` in the rail. Adds to `session_*` tables; the new tag is in the pool from the next turn onward and stays until removed.
2. **Open a fresh session** — `⋯ → New topic` (begin again) creates a new session that re-enters the auto-seed window. The previous session is preserved with its old pool intact.

There is no third "automatic expansion" path today. The system never adds tags to an existing pool on its own.

### The trade-off

| Choice | Wins | Loses |
|---|---|---|
| Pool grows only by manual action (current rule) | Predictable. A pinned scope cannot leak into composition just because a related word appeared. The user's stated context becomes a contract the system honors. | When another scope is genuinely relevant on a turn, the user pauses to add a tag. Friction proportional to how often this comes up. |
| Pool grows automatically on strong match (alternative, parked) | Convenience. The conversation "broadens" itself when reception detects clear domain shifts. | Leakage. A casual mention of a domain pulls in the full briefing+situation, often surprising the user. The contract weakens to a default. |

The current rule is the conservative side of [briefing #5](../../project/briefing.md): every token (and every scope's worth of tokens) must earn its place. Pre-S3, the pool was already a contract for the *candidate* list but the composer overrode it with "tag = always present" — so the contract leaked the other way. S3 closed that direction; this section documents the half-of-the-contract that S3 *didn't* change (and why it stays this way).

### Heuristic: tag or just mention?

When you type a message that references a scope outside the current pool, two questions separate cleanly:

| Question | Answer |
|---|---|
| Do I want this scope's full briefing + situation block injected into the prompt? | Add the tag. |
| Do I just want to reference the concept by name, letting the active persona reason over the words I wrote? | Mention inline; don't tag. |

The second is the lighter move and often the right one. The persona has access to your message text — *"my journey through the economic crossing affects how I think about strategy"* gives the model enough to operate on without loading the journey's full descriptor block. The tag is for when you need the **persisted context** (briefing + situation written into that journey's record), not just the word.

### Personas under the same rule — and the tension

The lifecycle above is framed as "scope" but the underlying mechanism — pool-constraint on reception's candidate list — applies to **personas** in `session_personas` exactly the same way. A session that has any persona pinned filters reception's persona pool to that subset, and reception cannot activate a persona that isn't in the pool. Mechanically symmetric across all three axes.

This is **conceptually in tension** with the cast-vs-scope model from CV1.E7.S2. The cast is supposed to be a *mutable ensemble that forms across a conversation* — but in the current implementation, "forms" means user-driven only (`+ Convoke a persona` in the header), not auto-grown by reception. A turn whose substance falls cleanly into a persona outside the pool will get the base ego voice instead. Correct under the current rule, but feels strange when the user expected the cast to widen on its own.

**Heuristic when the message reaches outside the pool's personas:**

| Question | Move |
|---|---|
| Recurring topic worth a permanent voice on this session? | Convoke the persona via the header `+`. The cast widens; future relevant turns activate it. |
| One-off curiosity outside the conversation's main domain? | Send the message; accept the base ego voice. The cast stays focused on the work the session is for. |
| Want a specific persona's reading on this single turn, without committing the cast? | Today: name the persona inline (*"how would the technical lens read this?"*). Future: see "On-demand divergent response" below. |

**A note on the design call.** Making the persona pool more permissive than the scope pool — letting reception activate a persona outside the pool when domain match is strong — is qualitatively different from doing the same for scopes. Persona blocks are light (~1–3K chars per lens). Scope blocks (briefing + situation) are heavier and accumulate. The cost of accidentally widening the cast is small; the cost of accidentally widening the scope is the leakage S3 just closed. Whichever direction is chosen for the cast doesn't have to apply uniformly to scopes.

### Parked alternatives — three design points

When the manual-extension friction surfaces enough to warrant a fix, the design space has three clean options. Each trades off commitment, visibility, and ease:

- **Force-include in-message syntax** (`@key` or similar). One-turn override that composes the named scope (or activates the persona) for *this* turn only, without modifying the session pool. Lowest UI cost; requires the user to know the syntax. Best fit when the user has the key in their head and just wants to reach for it.

- ~~**On-demand divergent response via the rail**~~ → **Shipped as [CV1.E7.S8](../../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s8-out-of-pool-rail-suggestion/)** (2026-04-26). Reception flags `would_have_persona` / `would_have_organization` / `would_have_journey` for out-of-pool candidates whose descriptors would have matched. The bubble surfaces a non-modal suggestion card — *"`maker` may have something to say. [Hear it]"* — that triggers a divergent one-turn response, persisted to a separate `divergent_runs` table and rendered inline as a sub-bubble. Session pool unchanged; the cast doesn't grow.

- **Suggest-and-add (auto-promote on click)**. Same out-of-pool detection signal. The rail suggestion, when clicked, **adds the candidate to the pool permanently** — the conversation shifts into that domain from this turn forward. Heavier; appropriate when the user realizes mid-conversation that they want to actually broaden the work, not just sample one persona's voice.

The three are not mutually exclusive. A future implementation could mix them — e.g., on-demand response by default, with a *"+ Add permanently"* sub-option after the divergent reply. Each is deliberately deferred behind real-use signal: adding any of them before the friction is felt risks designing for a problem that doesn't exist.

---

## Where each piece is configured

| Element | Storage | How to edit |
|---|---|---|
| `self/soul` content | `identity` table | Web Psyche Map workshop, or `admin.ts identity set` |
| `ego/*` content | `identity` table | same |
| `persona/<key>` content | `identity` table | same |
| `persona/<key>` color | `identity.color` | `/map/persona/<key>` color picker |
| Organization briefing/situation | `organizations` table | Web `/organizations/<key>` workshop |
| Journey briefing/situation | `journeys` table | Web `/journeys/<key>` workshop |
| Adapter instruction | `config/adapters.json` | edit file, restart server |
| Model per role | `models` table (seeded from `config/models.json`) | `/admin/models` |
| Session scope tags | `session_personas`, `session_organizations`, `session_journeys` | rail "Edit scope ›" or conversation header |
| Per-session mode override | `sessions.response_mode` | rail mode selector |

---

## Example prompts

Real prompts as they reach the LLM, by adapter:

- [Base — soul + ego/identity + ego/behavior](prompt-base.md) (no persona, no scope, no adapter)
- [Web — base + web instruction](prompt-web.md)
- [Telegram with one persona](prompt-telegram.md)

These regenerate when composition rules change. Each example carries its own "as of" marker.

---

## See also

- [Briefing #5](../../project/briefing.md) — *every token in the prompt must earn its place*
- [Decisions log](../../project/decisions.md) — incremental design choices
- [CV1.E7 — Response Intelligence](../../project/roadmap/cv1-depth/cv1-e7-response-intelligence/) — the epic moving intelligence from prompt to pipeline
- [Memory Taxonomy](../memory-taxonomy.md) — what the mirror remembers (orthogonal to prompt composition)
- [Principles](../principles.md) — product, code, and testing guidelines
