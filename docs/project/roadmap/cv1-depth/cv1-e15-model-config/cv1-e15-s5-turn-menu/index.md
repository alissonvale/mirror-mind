[< CV1.E15](../)

# CV1.E15.S5 — Per-turn admin actions menu

**Status:** ✅ Done (2026-05-05). Replaces the bare `×` per-turn delete with a kebab `⋯` menu for admins; non-admins keep the simple delete.

## Problem

Admin needed two actions per turn (delete + rerun) but the surface only had one (delete via `×`). Adding a second affordance side-by-side would clutter the bubble's already-tight chrome.

## Fix

For admin renders, the per-turn `<form class="msg-delete-form">` becomes a `<details class="msg-actions">` with a `⋯` summary. The panel inside lists:

- **Re-executar com modelo…** — opens the rerun popover (S5 + S6)
- **Excluir** — preserves the existing forget-turn POST

The "Re-executar…" item only renders on assistant turns (rerunning a user message has no semantics) and only when `modelCatalog` is provided.

For non-admin renders, the bare `×` stays exactly as before. No behavior change for them.

## What ships

- `<details class="msg-actions">` + `<summary class="msg-actions-trigger">` per-turn (admin only)
- Single `<div id="rerun-popover">` rendered once per page (admin only) — opened by `[data-rerun-trigger]` clicks across any bubble
- Inline JS in `mirror.tsx` (admin-only render) wires the popover: open on trigger, close on cancel / outside-click, submit via `fetch POST /conversation/turn/rerun`, full reload on success
- New CSS for `.msg-actions*` + `.rerun-popover*` rules

## i18n

`conversation.turnActionsAria`, `conversation.turnActions.delete`, `conversation.rerun.{openLabel, title, hint, popoverAria, cancel, submit, running, failed, missingFields}`. Both pt-BR and en.

## Validation

The S5 markup is exercised indirectly by S6 endpoint tests (the popover form posts to `/conversation/turn/rerun`). Manual roteiro covers the live behavior — opening the menu, the popover, fetch, reload.
