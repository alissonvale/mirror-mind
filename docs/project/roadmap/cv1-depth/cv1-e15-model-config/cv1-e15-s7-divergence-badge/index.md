[< CV1.E15](../)

# CV1.E15.S7 — Bubble badge for model divergence

**Status:** ✅ Done (2026-05-05). Closes the visibility loop on per-turn model decisions.

## Problem

Once turns can run on different models (S2 scene override, S3 session override, S6 rerun), the conversation can carry a mix. Without a visual cue, the admin has no way to tell at a glance which turns came from which model — they have to crack open `/admin/llm-logs` for every assistant bubble.

## Fix

When an assistant turn's stamped `_model_id` (S4) differs from the session's currently-resolved model (S4 resolver), the bubble gets a `⊕ <model_short>` badge in the same row as the persona / scope badges. The short label is the last `/`-segment of `model_id` so multi-vendor IDs like `anthropic/claude-sonnet-4-6` → `claude-sonnet-4-6`.

## What ships

- `MirrorPage` accepts `currentMainModel?: { provider, id } | null`
- Both `GET /conversation` and `GET /conversation/:sessionId` pre-compute via `resolveMainModel(db, sessionId, user.id)` and pass through
- Bubble badge logic compares `meta.model_id` (read from the stamped `_model_id`) against `currentMainModel.id`. Falsy / missing values short-circuit to no badge — turns stamped before S4 are silent
- New `.msg-badge-model` CSS rule: monospace, neutral grey background, distinct from persona/scope/Alma palettes
- Tooltip on the badge shows the full `model_id`

## Validation

Unit-test light because the existing render tests already snapshot the bubble HTML; adding model-aware variants would balloon the suite. Manual roteiro is the canonical check — set a per-session override, send a turn, change the override, send another, observe the divergence badge on the previous turn.

## Out of scope

- Live update — when the admin saves a session model override via S3's header row, existing bubbles don't re-paint badges until refresh. The async `refreshConversationHeader` path could be extended to repaint the messages list, but the cost-to-benefit is low; deferred.
- Cost dashboard with model breakdown — `/admin/llm-logs` already filters by model.
