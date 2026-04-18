[< CV0 — Foundation](../)

# CV0.E2 — Web Experience `v0.4.0` → `v0.5.0`

**Roadmap:** [CV0.E2](../../index.md)
**Status:** S1–S6 done (v0.4.0). S7 and S9 done (pending release). S8, S10 queued.

The web client is the surface where the mirror becomes **legible** — both its structure (who it is) and its memory (what it carries). Not a chat + admin page, but a workspace where the user sees, edits, and senses both the psyche that shapes responses and the traces that accumulate through use.

Two surfaces, two purposes:

- **Mirror + Context Rail** — the live side. What the mirror is paying attention to *right now*: active persona, session stats, composed context. A window into [Attention Memory](../../../product/memory-taxonomy.md#axis-a--cognitive-roles).
- **Cognitive Map** — the durable side. The psyche's architecture: self (soul), ego, personas, skills. Each layer gets a card, the map grows as new layers emerge (shadow, meta-self). This is the **structure** — the mirror's identity, not its memory.

The two concepts are distinct and both visible. **Structure** is who the mirror is — relatively stable, edited deliberately. **Memory** is what the mirror carries — accumulating in real-time (rail), across conversations (future), and inside each structural layer. Calling them by their true names keeps the map from being confused with what's mapped onto it. See the [memory taxonomy](../../../product/memory-taxonomy.md) for the full decomposition.

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](cv0-e2-s1-basic-web/index.md) | **Login + Chat + Admin** | ✅ Done (from CV0.E1.S5) |
| [S2](cv0-e2-s2-unified-profile/index.md) | **Unified user profile** | ✅ Done (v0.3.2) |
| [S3](cv0-e2-s3-web-refactor/index.md) | **Move web to adapters/web/** | ✅ Done |
| [S4](cv0-e2-s4-sidebar/index.md) | **Sidebar navigation** | ✅ Done |
| [S5](cv0-e2-s5-chat-visual/index.md) | **Chat with visual identity** | ✅ Done |
| [S6](cv0-e2-s6-web-tests/index.md) | **Web route tests** | ✅ Done |
| [S7](cv0-e2-s7-auth-roles/index.md) | **I know who's logged in** | ✅ Done |
| [S9](cv0-e2-s9-context-rail/index.md) | **Context Rail — attention memory visible** | ✅ Done |
| S8 | **Cognitive Map — `/map` with a card per psyche layer** (self, ego, personas, skills; self-service name edit included) | — |
| S10 | **Empty states as invitations** | — |

**Ordering note:** S9 is scheduled before S8. The rail is smaller, visible on every chat screen, and teaches us what signals matter before we design the full map. Learning flows from S9 into S8.

## Radar

Directions the rail and map open up, but that are not stories yet:

- **Episodic memory surface** — past conversations browsable inside the app (today they live in the DB, unreadable through the UI). Different from the map: the map is structure, this is accumulation. Likely a separate route (`/history` or similar) that appears when [CV1.E3](../../index.md#cv1e3--memory) long-term memory lands.
- **Reception as router** — today reception returns `{ persona }`. It will evolve into a multi-signal envelope (`{ persona, journey, topicShifted, attachmentsNeeded, semanticQueries, skillsActivated }`). The rail and map must not lock into the current shape. See [memory-taxonomy.md](../../../product/memory-taxonomy.md#how-the-reception-layer-routes-across-this-map).
- **Avatar customization** — persona avatars today are first-letter + color token. User-uploaded avatars enter when demand appears.
- **Map side-sheet** — a collapsible overlay that opens the Cognitive Map next to the chat without leaving the page (target for S8 or a later iteration).
- **Shadow and Meta-Self layers** — future psyche layers, each adding a new card type to the map as they're implemented (not rendered until they exist in the DB).

---

**See also:** [Memory Taxonomy](../../../product/memory-taxonomy.md) · [Principles](../../../product/principles.md) · [Prompt Composition](../../../product/prompt-composition/)
