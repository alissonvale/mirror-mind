[< Improvements](../)

# Scope pill hot-update + journey-icon alignment

**Type:** Refinement
**Date:** 2026-04-25

## Problem

When reception activated an organization or journey on the **first turn of a fresh session**, the server auto-seeded `session_organizations` / `session_journeys` (CV1.E4.S4 hybrid model) — but the Scope zone in the conversation header had already been server-rendered with no pills. The client-side SSE `routing` handler updated the **Cast** zone (`ensureCastAvatar`) yet had no symmetric helper for **Scope**, so the new pill only appeared after a page reload.

The asymmetry was latent for as long as the "tag = always-present in prompt" semantics held (CV1.E4.S4 → CV1.E7.S2): even without a header pill, the scope still composed into every turn, so the user never noticed. **CV1.E7.S3** removed the always-present rule — composition now follows reception's per-turn pick — and the missing pill became the only sign that the scope was tagged at all on a casual-message turn.

Surfaced during S3 manual smoke: a fresh session with `software-zen` + `o-espelho` activated by reception on turn 1 ("estratégia para divulgar..."). DB had the tags. Header showed the Cast avatars (correct) but no scope pills. After "bom dia", the bubble cleared (correct, S3 doing its job), and the Scope zone still read empty — making it look like the tags vanished.

A second, smaller asymmetry surfaced in the same review: the journey icon in the header read `≡` (three horizontal lines) while every other surface — bubble badges, Conversations list, streaming microtext — used `↝`. Aligning to `↝` was free.

## Fix

**Server — explicit seed signal.**

`adapters/web/index.tsx` (the `/conversation/stream` handler) now captures whether the auto-seed actually fired (`didAutoSeed = isFirstTurn && !hasAnyTag`) and emits a `seededScopes: { organization, journey }` field on the `routing` SSE event. Only populated when the server actually wrote to the session pool on this turn — divergent picks on later turns leave it null, so the client doesn't insert phantom pills.

**Client — `ensureScopePill` helper.**

`adapters/web/public/chat.js` gains a function that mirrors `ensureCastAvatar`:

- Idempotent (no-op if the key is already in the pool array).
- Locates the right `.header-scope-group[data-type="<type>"]`.
- Builds the same form shape as `ScopePillGroup`'s `removeForm` (POST `/conversation/untag`, hidden inputs, icon span, name span, × button).
- Inserts before the `+Add` control, removes the `.header-scope-empty` placeholder if present.
- Pushes the key onto `poolOrganizations` / `poolJourneys` so the bubble-badge suppression rule on subsequent turns reads the new state without a reload.

The routing handler now calls `ensureScopePill("organization", event.seededScopes.organization)` and `ensureScopePill("journey", event.seededScopes.journey)` **after** the bubble-badge check — so the first-turn divergence badge (the "this just came in" signal in the bubble) still fires on the seed turn, and subsequent turns see the new pill already in the pool and suppress correctly.

**Header icon alignment.**

`conversation-header.tsx` `ScopePillGroup` for journey switches `icon="≡"` to `icon="↝"`, matching the bubble badge, the Conversations list, and the streaming microtext.

## Commit

(this commit)

Asset version bumped: `chat.js?v=persona-colors-1` → `chat.js?v=scope-pill-hot-update-1`.

## Tests

639 passing, unchanged. Hot-update behavior is client-side JS without testable indirection in the current suite — validated manually:

1. Open a fresh session (no tags). Verify the Scope zone reads "no context".
2. Send a message that activates org and journey via reception (e.g., for Alisson: *"qual seria a estratégia de divulgação do espelho para o público da Software Zen?"*).
3. **Without reloading**, verify the header now shows `◈ <org>` and `↝ <journey>` pills, the bubble shows the divergence badges (first contact), and the Cast shows the persona avatars.
4. Send a casual message. Verify the bubble has no scope badges and the header pills stay (S3 + this fix together).
5. Reload the page. Verify the same state renders from the server (parity check between hot-update and full render).

## Non-goals

- **Display name in routing event.** The pill text falls back to the key on hot-update; the server's full re-render shows the human display name. Plumbing display names through the routing event is a larger schema change for a transient UX detail.
- **Persona avatar parity for divergent picks.** `ensureCastAvatar` already covers the persona case; it doesn't depend on `seededScopes` because the Cast model treats every reception-active persona as a candidate for the cast (multi-persona by design). Scope is single-pick per axis, so divergent ≠ seed and the distinction matters only here.
- **`≡` removed everywhere.** Only the Scope zone in the header used `≡`; every other surface was already `↝`. Single-site rename, no broader sweep needed.
