[< CV1 — Depth](../)

# CV1.E4 — Journey Map

**Roadmap:** [CV1.E4](../../index.md)
**Status:** S1 ✅ · S4 ✅ · S5 next · S2, S3 queued
**Conceptual foundation:** [Journey Map](../../../../product/journey-map.md)

The mirror's user lives through multiple crossings at once — periods, pursuits, projects, ventures, communities. Some stand alone (personal journeys); some belong to broader contexts (organizations the user is part of). This epic turns that reality into first-class surfaces: `/journeys` and `/organizations`, both peer to the Cognitive Map and the Mirror itself.

Neither scope is an identity layer — both are **scopes over memory**, with organization as the broader scope that may contain journeys. Each story lights up one cell of the `cognitive role × scope` matrix described in the [Journey Map concept](../../../../product/journey-map.md#scope--memory-role-matrix).

## Stories

| Code | Story | Scopes | Status |
|------|-------|--------|--------|
| [S1](cv1-e4-s1-scopes-identity-routing/index.md) | **Scope identity + routing** (organizations + journeys, both with briefing + situation, reception, composition, surfaces) | Identity + Reflexive — briefing + situation for both scopes | ✅ Done |
| [S4](cv1-e4-s4-manual-scope-tagging/index.md) | **Manual session scope tagging** — hybrid model where session carries a pool of personas / orgs / journeys, reception filters within, user curates from the Context Rail, first turn auto-suggests | N:N between session and each scope type | ✅ Done |
| [S5](cv1-e4-s5-scope-atelier/index.md) | **Scope page becomes an ateliê** — `/organizations/<X>` and `/journeys/<X>` evolve from "Last conversation card" into a full workshop showing all sessions tagged to the scope, openable for continuation | Episodic — sessions surfaced via existing junction tables | next |
| S2 | **Documents attached to scope** | Semantic / Attachments — scoped by journey or organization |
| S3 | **Filter episodic and semantic memory by scope** | Episodic + Semantic extracts — `journey_id` on sessions, `journey_id` / `organization_id` on extracted memories |

**Ordering rationale:** S1 is the tracer bullet — both scopes with their full two-field shape (briefing + situation) wired through the full flow: surfaces, reception, composition, rail. S4 moved ahead of S2 after the user surfaced that reception can't be guaranteed perfect — manual tagging became the foundation everyone else depends on. **S5 jumped ahead of S2** after the conversation-import work surfaced that 27 imported sessions have nowhere to be browsed — the dor of "I can't see my sessions" is acute, the fix is small, and the surface design (ateliê per scope, no global flat list) naturally honors the structure that earlier stories built. S2 introduces the Attachments mechanism scoped to either entity. S3 closes the loop when semantic extraction exists (CV1.E3.S3).

**Tasks are not in this epic.** Tasks were considered for the agentic MVP (see [decisions.md, 2026-04-20 — Agentic turn deferred](../../../decisions.md)) and moved to a later epic coupled with tool use. CV1.E4 stays in the prompt/chat paradigm.

## Architecture

```
user message
    ↓
┌──────────────────────────┐
│  Reception               │   ← persona + organization + journey (all nullable)
│  classifies message      │
└──────────┬───────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│  System prompt composition                                    │
│  soul → identity → persona → organization → journey →         │
│  behavior → expression → adapter                              │
└──────────┬───────────────────────────────────────────────────┘
           ↓
┌──────────────────────────┐
│  Main response + rail    │   ← rail shows persona, organization, journey
└──────────────────────────┘
```

Two tables: `organizations` (briefing + situation + summary) and `journeys` (briefing + situation + summary + nullable FK to organizations). Future tables (sessions, attachments, extracted memories) gain nullable scope FKs — the ligament described in the concept doc.

---

**See also:**
- [Journey Map concept](../../../../product/journey-map.md) — the conceptual frame the epic implements
- [Memory Taxonomy](../../../../product/memory-taxonomy.md) — cognitive roles × mechanisms
- [CV1.E1 — Personas](../cv1-e1-personas/index.md) — prior epic that established reception as a routing layer
