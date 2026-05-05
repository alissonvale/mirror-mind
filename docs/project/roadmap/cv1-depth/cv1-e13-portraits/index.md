[< CV1 Depth](../)

# CV1.E13 — Portraits

**Status:** Active. S1 + S2 shipped 2026-05-04; S3 queued.

> Design source: [`docs/design/entity-profiles.md`](../../../../design/entity-profiles.md) — design-locked 2026-05-04, three reference drafts authored against Antonio Castro's travessias.

## Premise

Today every entity link in the system drops into a CRUD form. That conflates two activities: stewardship (CRUD) and reading. The CRUD page is honest engineering but cold reading.

CV1.E12 (`/espelho`) proved a different relationship is possible — a synthesized self-portrait that the user can re-read, instead of a workspace to maintain. This epic extends that metabolism to **each territory the user operates inside**. Organizations, journeys, and scenes get a *portrait* — a read view that tells the story this entity has accumulated. Editing becomes a discreet secondary affordance.

The portrait is **not a dashboard**, **not an "About" page**, and **not third-person journalism**. It is a memoir-as-essay surface in the user's own first-person voice (locale-aware), assembled from the entity's existing fields plus the conversations and adjacencies it has accumulated.

## What ships

A new read view per entity type, replacing the current CRUD page as the default link target. The form moves to a `/<entity>/<key>/editar` URL (locale-aware). All existing internal links keep working — they now land on the read view, which is the correct default.

| Entity type | Today's URL | After this epic |
|---|---|---|
| Organization | `/organizations/<key>` (CRUD) | portrait (read) |
| Journey | `/journeys/<key>` (CRUD) | portrait (read) |
| Scene | `/cenas/<key>` (CRUD) | portrait (read) |
| All three | (same URL is the form) | `/<entity>/<key>/editar` |

The shape is **three blocks** — lede / body / close — with sub-sections that render conditionally on what data the entity carries. A travessia with no anchored cena says so explicitly; a travessia with no conversations says so explicitly. **Sections assemble from data, not from a template.** Different entities produce structurally different pages from the same engine.

The body sections observed in the design drafts:

- **"Onde ela mora"** — adjacencies (org, persona, scene) using rail glyph vocabulary, with absences declared in italic
- **Structural section** — conditional, rendered only when the source carries enumerated branches (`OS TRÊS CENÁRIOS`) or continuous fronts (`AS TRÊS FRENTES VIVAS`)
- **"A pergunta viva"** — conditional, only when the briefing/situation declares a central question
- **"Conversas que a moldaram"** — chronological list with one citable line per conversation; honest empty-state when zero conversations

LLM extraction is narrowed to **two points**, both `source_hash`-cached:

- Citable line per conversation (extractive — picks the best line from the assistant turn)
- Lede synthesis (only when briefing + situation are too short to extract a strong opening on their own)

Everything else is deterministic marshalling.

## Stories

| Code | Story | Description |
|---|---|---|
| [`CV1.E13.S1`](cv1-e13-s1-journey-portrait/) | **Journey portrait** ✅ | Shipped 2026-05-04 in five rounds. URL migration absorbed (no separate S0). Lede from briefing's last paragraph, three tiles (tempo, structural anchor, recency), "onde ela mora" adjacencies + parenthetical, structural section detector (cenários vs frentes), live-question detector with confessional layer, conversations list with LLM-extracted citable lines via `entity_profile_cache`. Three reference drafts reproduced structurally. |
| `CV1.E13.S2` | **Organization portrait** ✅ | Shipped 2026-05-04. Lede flips to situation-first (orgs use briefing as identity manifesto). "Quem passa por aqui" lists nested journeys + adjacencies. Accent flips to warm-amber. Width fix landed across all portraits (640 → 980 outer, 720 inner reading column). Pages Inteiras reference draft reproduced. |
| `CV1.E13.S3` | **Scene portrait** | Anatomy diverges from S1/S2 — cenas are declarative, not narrative; "what kind of moment is this" is the primary question. Likely needs a dedicated design pass before code. |

## Sequencing

S1 → S2 → S3, validated in order. S1 is the high-yield first surface because journeys are the most narrative-shaped and the editorial design is locked. S2 follows once S1 is live and the underlying engine is proven. S3 may reopen design before code if the cena anatomy diverges further than expected.

## Out of scope (parked for follow-up)

- Per-cena model selection (`scenes.model`) — captured in [`project_cena_model_per_scene.md`](../../../../../../.claude/projects/-Users-alissonvale-Code-mirror-poc/memory/project_cena_model_per_scene.md), unrelated to portrait design.
- Extending `## Summary` to other identity layers (ego/identity, persona/*) — same plumbing as the soul-summary work that shipped 2026-05-04, but content authoring round, not design round.
- Persona portraits — personas already have `/map/persona/<key>` workshop; whether they need a portrait equivalent is a separate question. Not in scope for this epic.

## Open questions parked for the construction round

1. **Default fecho source** — briefing-first, conversation-fallback (decided in design). Validate during S1 build whether briefing-first feels too uniform across travessias.
2. **Visibility** — admin only or all users from day one. Lean: all users from day one (the CRUD pages are user-facing today).
3. **Edit affordance placement** — discreet bottom link only, or top-right pencil also. Lean: bottom-only.
4. **Edit page in the menu** — should it disappear entirely (only reachable via "editar" link on the read view)? Lean: yes.
5. **Cache schema specifics** — `entity_profile_cache` table shape needs concrete spec before code in S1.
6. **Forgotten / archived entities** — profile 404 or redirect? Decision pending.
