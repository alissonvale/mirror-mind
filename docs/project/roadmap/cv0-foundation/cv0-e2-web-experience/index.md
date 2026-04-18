[< CV0 — Foundation](../)

# CV0.E2 — Web Experience `v0.4.0` → `v0.5.0`

**Roadmap:** [CV0.E2](../../index.md)
**Status:** S1–S6 done (v0.4.0). S7 pending. S8–S10 queued for v0.5.0.

The web client is the surface where the mirror's memory becomes **legible**. It is not a chat + admin page — it's a workspace where the user sees, edits, and senses what the mirror is holding about them, in real time and across time.

Two surfaces, two purposes:

- **Chat + Context Rail** — the live side. What the mirror is paying attention to *right now*: active persona, session stats, composed context. A window into [Attention Memory](../../../product/memory-taxonomy.md#axis-a--cognitive-roles).
- **Memory Workspace** — the durable side. What the mirror holds *over time*: identity layers, personas, journeys, extensions. Each concept gets a card, the workspace grows as the mirror grows.

Both surfaces are organized by the same [memory taxonomy](../../../product/memory-taxonomy.md): roles on one axis, storage on the other.

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](cv0-e2-s1-basic-web/index.md) | **Login + Chat + Admin** | ✅ Done (from CV0.E1.S5) |
| [S2](cv0-e2-s2-unified-profile/index.md) | **Unified user profile** | ✅ Done (v0.3.2) |
| [S3](cv0-e2-s3-web-refactor/index.md) | **Move web to adapters/web/** | ✅ Done |
| [S4](cv0-e2-s4-sidebar/index.md) | **Sidebar navigation** | ✅ Done |
| [S5](cv0-e2-s5-chat-visual/index.md) | **Chat with visual identity** | ✅ Done |
| [S6](cv0-e2-s6-web-tests/index.md) | **Web route tests** | ✅ Done |
| S7 | **I know who's logged in** | — |
| [S9](cv0-e2-s9-context-rail/index.md) | **Context Rail — attention memory visible** | — **next** |
| S8 | **Memory Workspace — `/memory` with cards per layer** | — |
| S10 | **Empty states as invitations** | — |

**Ordering note:** S9 is scheduled before S8. The rail is smaller, visible on every chat screen, and teaches us what signals matter before we design the full workspace. Learning flows from S9 into S8.

## Radar

Directions the rail and workspace open up, but that are not stories yet:

- **Reception as router** — today reception returns `{ persona }`. It will evolve into a multi-signal envelope (`{ persona, journey, topicShifted, attachmentsNeeded, semanticQueries, extensionsActivated }`). The rail and workspace must not lock into the current shape. See [memory-taxonomy.md](../../../product/memory-taxonomy.md#how-the-reception-layer-routes-across-this-map).
- **Avatar customization** — persona avatars today are first-letter + color token. User-uploaded avatars enter when demand appears.
- **Workspace side-sheet** — a collapsible overlay that opens the Memory Workspace next to the chat without leaving the page (target for S8 or a later iteration).

---

**See also:** [Memory Taxonomy](../../../product/memory-taxonomy.md) · [Principles](../../../product/principles.md) · [Prompt Composition](../../../product/prompt-composition/)
