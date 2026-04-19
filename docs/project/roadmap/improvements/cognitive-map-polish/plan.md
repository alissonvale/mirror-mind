[< Story](index.md)

# Plan: Cognitive Map polish

## Problem

Three small UX frictions on the Cognitive Map:

1. The card preview text (the layer summary) was rendered at 0.9rem in dark grey (`#4a4a4a`). Visually heavy; competed with the card headers for attention. The user's framing: *"quero trazer um pouco de leveza para a fonte da descrição da camada."*
2. No limit on preview length. A summary running five lines looked unwieldy.
3. The sidebar was always fixed at 200px. For a wide map, there was no way to reclaim the horizontal space.
4. Browser was requesting `/favicon.ico` and getting 404 on every page load.

## Solution

**Typography and truncation:**

- Font size down from `0.9rem` to `0.76rem`.
- Color from `#4a4a4a` to `#857d72` (soft terracotta).
- Weight 300 (light).
- Line-height from `1.5` to `1.35`.
- `-webkit-line-clamp: 3` with `display: -webkit-box` + `-webkit-box-orient: vertical` + `overflow: hidden` clips the preview to three lines.
- A `<span class="map-card-readmore">read more →</span>` sits below the preview. CSS hides it by default; a small script adds `.is-truncated` to any `.map-card-preview` where `scrollHeight > clientHeight + 1` (i.e., actually truncated), and `.map-card-preview.is-truncated + .map-card-readmore { display: block; }` reveals the link.

**Sidebar toggle:**

- Button `☰` at fixed position top-left, visible always on desktop (previously mobile-only).
- On desktop: toggles `body.sidebar-collapsed`. CSS slides the sidebar off with `transform: translateX(-100%)` and expands the content area (`margin-left: 0; max-width: 1100px`).
- On mobile: keeps the existing `body.sidebar-open` behavior (sidebar hidden by default, revealed on tap).
- Button position transitions with the sidebar (`left: 210px` when expanded, `left: 0.75rem` when collapsed).

**Favicon:**

- `<link rel="icon" href="data:," />` in the layout head suppresses the browser's automatic `/favicon.ico` request.

## Files affected

- `adapters/web/public/style.css`:
  - `.map-card-preview` — new font size, color, weight, line-height, line-clamp.
  - `.map-card-readmore` — new, hidden by default, revealed by sibling `.is-truncated`.
  - `.sidebar-toggle` — changed from `display: none` to `display: block`, transparent background, repositioned to `left: 210px`.
  - `.sidebar-collapsed .sidebar` — slides the sidebar off.
  - `.sidebar-collapsed .content` — expands the content area.
  - Mobile media query updated so the collapsed/open states coexist cleanly.
- `adapters/web/public/layout.js` (new):
  - `window.toggleSidebar()` — chooses `sidebar-open` on mobile, `sidebar-collapsed` on desktop, via `matchMedia`.
  - `DOMContentLoaded` handler — walks `.map-card-preview` and marks truncated ones with `.is-truncated`.
- `adapters/web/pages/layout.tsx`:
  - `<link rel="icon" href="data:," />` added to head.
  - `<button class="sidebar-toggle" onclick="window.toggleSidebar()">` — replaces the inline `classList.toggle('sidebar-open')`.
  - `<script src="/public/layout.js">` at end of body.
  - Stylesheet cache-busted to `?v=map-lightweight-4`.
- `adapters/web/pages/map.tsx`:
  - `<span class="map-card-readmore">read more →</span>` added after the preview paragraph.

## Decisions

**Why external `layout.js` instead of inline script.** An initial attempt used `dangerouslySetInnerHTML` on an inline `<script>` tag. Hono JSX does not support `dangerouslySetInnerHTML` (it's a React-ism); the prop is silently rendered as a literal HTML attribute, and the script body never executes. Moving the logic to a static file served via the existing `serveStatic("/public/*")` mount avoids the compatibility gap.

**Why `window.toggleSidebar` and not two handlers.** Two buttons (one for mobile `sidebar-open`, one for desktop `sidebar-collapsed`) would duplicate markup. A single button that dispatches based on `matchMedia('(max-width: 768px)').matches` keeps the layout simple.

**Why `read more →` even though clicking the whole card already opens the workshop.** The card is fully clickable. The `read more` is a visual affordance for when the summary is long enough to warrant truncation — it tells the reader there's more to see, without adding a separate action target.

**Why detect truncation with JS instead of always showing `read more`.** For short summaries that fit in three lines, `read more` would be misleading — nothing more to see. The `scrollHeight > clientHeight` check runs once on `DOMContentLoaded` and adds the class only where needed.

## Validation

- Manual visual review on the Cognitive Map — font is visibly lighter, `read more →` appears only on truncated previews, sidebar slides cleanly, favicon request gone from the network tab.
- No test coverage added — pure CSS/JS UX changes.

## Risk

Low. All changes are client-side and progressive enhancements. If the JS fails to load, preview simply stays clamped at three lines without the `read more` indicator; sidebar toggle stops working but the sidebar remains in its default visible state. Favicon change is cosmetic.

## Out of scope

- Persisting sidebar state across page loads (collapsed/expanded).
- Keyboard shortcut for the toggle.
- Animating the `read more → full content` inline expansion (clicking the card goes to workshop for full view).
