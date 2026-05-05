[< CV1.E15](../)

# CV1.E15.S6 — Destructive rerun endpoint

**Status:** ✅ Done (2026-05-05). Admin replaces an assistant turn with a rerun through a different model.

## Problem

When a turn lands wrong, the user keeps two unattractive options today: edit `/admin/models` (leaks into every other session) or live with it. The destructive rerun closes that loop — replay the same prompt, replace the answer, move on.

## Fix

`POST /conversation/turn/rerun` — admin-only:

```jsonc
// body
{ "entryId": "<assistant-entry-uuid>",
  "model_provider": "openrouter",
  "model_id": "anthropic/claude-sonnet-4-6" }

// response
{ "entryId": "...",
  "content": "<final reply text>",
  "model_provider": "openrouter",
  "model_id": "anthropic/claude-sonnet-4-6" }
```

Inheritance from the parent entry's stamped meta:
- `_personas`, `_persona`, `_organization`, `_journey` — composer keeps the same persona / scope context
- `_mode`, `_length` — expression pass keeps the same target shape
- `_touches_identity`, `_is_alma` — composer picks Alma branch when parent was Alma
- Scene anchored to the session (the cena's briefing still injects)

Reception is **not** re-run. Routing decisions stay frozen; only the model swaps.

The assistant entry is **mutated in place** (`UPDATE entries SET data = ? WHERE id = ?`). Same id, new content, new `_model_provider/_model_id`, plus `_rerun_at` timestamp for trace. The pi-ai shape fields (`provider`, `model`, `usage`) are also replaced so the entry tells the truth about its current text.

`logLlmCall` writes a row pointing at the rerun's `entry_id` — `/admin/llm-logs` shows both the original turn and the rerun against the same entry, ordered by `created_at`.

## Guards

- Non-admin → 403
- Missing `entryId`, `model_provider`, or `model_id` → 400
- `entryId` not found → 404
- Foreign user's entry → 403
- Non-assistant entry → 400 ("Can only rerun assistant turns")
- Trivial-stamped assistant → 400 ("Trivial turns cannot be rerun (composer elides them)")
- Assistant with no `parent_id` → 400 (no prompting user message to replay)

## Auth handling

Same caveat as S4: `resolveApiKey(db, "main")` resolves through the global main role. Cross-provider override (e.g. main=openrouter, rerun against anthropic-direct OAuth) would break — documented in S4's index.

## Validation

7 unit tests in `tests/turn-rerun.test.ts` covering the validation surface (auth, body, ownership, entry-type guards). The happy path requires a live LLM call — covered in the manual roteiro.

## Out of scope

- Streaming the rerun (current impl is synchronous JSON + reload) — deferred; the page reload is fast enough for the surface.
- Restoring the original content on undo — destructive by design. Re-rerun through the original model is the workaround if the user changes their mind.

## Follow-ups

- **SSE rerun + in-bubble status**. Today the popover stays open during the call and shows `"Composing…"` (same hardcoded microcopy the main chat uses in `chat.js:1267-1268` — itself an i18n debt). To eliminate that duplication, the rerun endpoint would need to emit `routing/status/delta/done` events the way `/conversation/stream` does, and the popover would close on submit while the targeted bubble repaints in place reusing the chat's own render pipeline. Cost ~2-3h for the streaming refactor + chat.js shared render path; benefit is marginal until the rerun surface is used heavily. Recorded so the next session knows the direction.
- **i18n the chat status microcopy**. `chat.js:1267-1268` ("Composing", "Finding the voice") and the rerun popover's `"Composing…"` should live behind a single i18n key surface. Trivial once the rerun follow-up above forces both sites through one render path.
