[< Story](index.md)

# Refactoring log — CV1.E7.S2

What was cleaned up along the way, and what was deliberately **not** cleaned up (parked, with criteria for revisit).

---

## Applied

### `<ConversationHeader>` as its own component file

The header lives in a dedicated file (`adapters/web/pages/conversation-header.tsx`) — not nested inside `mirror.tsx`. Three reasons:

1. It has four sub-components (Cast, Scope, Mode, Menu) that each own their popovers and forms. Inline inside MirrorPage would have crossed 200 lines of JSX before any bubble rendering.
2. The header's data shape (`ConversationHeaderData = { rail, personaTurnCounts }`) travels a clean boundary and is testable in isolation.
3. When CV1.E7.S5 arrives with multi-persona, the Cast block is the only one that meaningfully changes — localizing edits helps.

### `computeBubbleSignatures(messages)` as a pure helper in `mirror.tsx`

Walks the message list once and produces `{ showSignature, showAvatarChip, persona }` per entry. Computed once, consumed by index during the JSX map. Avoids ad-hoc state (`let lastAssistantPersona`) leaking into the render.

The function is colocated with MirrorPage because it's only used there; extracting to `server/` or a shared module would be premature. If a second surface ever needs bubble signatures (e.g., a conversation detail view in listings), the function moves then.

### `attachPersonaSignature(msgNode, personaKey)` in `chat.js`

Client-side mirror of the server logic. Reads the DOM to find the last persona-bearing assistant; decides whether to insert the chip. The `lastAssistantPersonaInDOM()` helper handles the "persona-less break" case the same way the server-side `computeBubbleSignatures` does — both resolve the continuity tracker symmetrically.

Helpers `personaColor` / `personaInitials` are duplicated (small constant table + two functions). Acceptable duplication — the alternative would be inlining a TypeScript build into `public/` for consumption by vanilla JS, which is a much bigger structural change than the cost saves.

### `getPersonaTurnCountsInSession(db, sessionId)` on `server/session-stats.ts`

Not a new file — joined the existing stats helper where `computeSessionStats` already lives. One SQL query using `json_extract` on `data._persona` keyed to assistant messages. Keeps meta-read in one place so when the parallel-mechanism debt (meta vs junctions — parked in CV1.E4.S4) gets paid, we know where to touch.

### Rail code footprint cut in half

`context-rail.tsx` went from rendering seven sections to two disclosures. The `ScopeTagGroup` component survived intact and now gets invoked inside the `Edit scope ›` disclosure — same behavior, different mount point. The cut removed:

- `rail-persona` block (descriptor + avatar already mirrored in header Cast)
- `rail-response-mode` block (moved to header Mode pill)
- `rail-session-actions` (moved to header Menu)
- `rail-footer` (drive-by removal: the `Grounded in your identity →` link duplicated the sidebar's `/map` entry)
- `rail-collapsed-strip` persona avatar + cost display (superseded by the header; the strip keeps just a vertical "rail" label)

### Chat container widened from 800px → 900px

The header adds breathing room requirements. 900 is the smallest width where Cast + Scope + Mode + Menu sit cleanly on one row without crowding at common viewport widths. Bubbles still cap at `max-width: 80%` of `.msg-body`, so the wider column doesn't make bubbles feel stretched.

---

## Parked (with revisit criteria)

### Header on narrow screens

The row uses `flex-wrap` — on ≤1200px viewports, Scope wraps below Cast, then Mode and Menu tag along. Works but hasn't been validated on real mobile resolutions. The header shows a lot of information density; on small screens it may need a dedicated collapsed mode (e.g., just the Cast + a `⋯` that opens everything else).

**Revisit when:** a user reports friction on a phone or tablet, OR the planned mobile push needs visual calibration.

### Popover accessibility

The Cast avatar popovers and the various header `<details>` menus are keyboard-accessible by default (native `<summary>`). But click-outside-to-dismiss isn't implemented — if you open a popover and click elsewhere, it stays open. Only the `<details>`'s toggle closes it, or clicking another `<summary>` that forces-opens its own.

Accepted for v1. Users familiar with modern web UX expect click-outside; users with keyboard-only navigation have `Esc` as a browser-level fallback (some browsers close details on Escape).

**Revisit when:** a user explicitly reports the interaction feels sticky, OR an accessibility audit runs.

### The `/map/persona/<key>` link in the cast popover

Added as a "View persona →" link. That route doesn't exist yet — it 404s today. The link is forward-looking: the `/personas` listing is the current home, but a dedicated persona page with descriptor + usage stats + per-persona settings makes sense. Left as a dangling affordance.

**Revisit when:** the persona workshop page ships, OR a user clicks it and reports "404 here," at which point either the link goes to `/personas/<key>` (if that route is added) or the link is removed until a destination exists.

### Turn counts for imported / historical sessions

`getPersonaTurnCountsInSession` reads `_persona` meta off assistant entries. Sessions imported before reception started stamping meta (pre-CV1.E4.S1, or from external JSON imports that didn't normalize) fall back to 0 turns per persona. The popover reads "no turns yet in this session" even if the session has a dozen assistant messages.

Acceptable for v1 — the signal is "this persona hasn't spoken *in a way the system recorded*," which is honest.

**Revisit when:** a meta-backfill story lands (not planned), OR imported sessions start carrying meta by convention on the import path.

### Mode pill's hint text

The hint text for each mode (e.g., "short, close" for conversational) moved from the old rail radios to the segmented control's button `title` attribute. Tooltip on desktop; invisible on mobile. The old design had the hint inline, always visible.

**Revisit when:** observed UX confusion on mode selection (e.g., users picking the wrong mode because they don't know what "essayistic" means). Cheap fix: render hints inline inside the segmented control.

### `msg-badges` container element persistence

The `<div class="msg-badges">` wrapper still renders (empty) on persona-only bubbles after the badge retirement — it's the DOM placeholder the `chat.js` streaming handler writes into. An empty `msg-badges` block adds no visible height (the CSS already hides empty `.msg-badges`), but the div exists.

**Revisit:** when streaming logic gets a refactor anyway, inline the badge creation rather than keeping a permanently-empty holder. Low priority.

### Parallel-mechanism debt (meta vs junctions)

Unchanged from previous stories. The per-turn meta (`_persona`/`_organization`/`_journey`) and the session-level junction tables (`session_personas`/`_organizations`/`_journeys`) both carry information this story consumes — cast reads junctions, bubble signature + badges + turn counts read meta. Both right for their layer; their co-existence remains a known non-goal from CV1.E4.S4.

**Revisit:** when a specific consumer is found to disagree between the two sources (e.g., an imported session with no meta stamp renders a Cast but has zero bubble signatures). Low priority while single-persona reception keeps the two in sync by construction.

### Header zoning at extreme conditions

When the pool has 8+ personas, the Cast zone can overflow horizontally. Currently wraps (flex-wrap on `.header-cast-list`). If it wraps too aggressively, the header row gains vertical height. This is rare today (narrative users have 5-6 personas) but possible.

**Revisit when:** a real user configures 10+ personas and reports the header feels crowded. Fix candidates: a max-width on `.header-cast-list` with horizontal scroll, or a `+N more` overflow like Scope uses.
