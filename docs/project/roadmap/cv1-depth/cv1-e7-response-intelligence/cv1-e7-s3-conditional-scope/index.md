[< CV1.E7](../)

# CV1.E7.S3 — Conditional scope activation

**Status:** ✅ Done (2026-04-25)

## Problem

Until S3, the composer carried two parallel paths for scope content. When the session had no scope tags, it rendered reception's single pick. When the session had tags of a type, it rendered **all** of them on every turn — a "tag = always present in prompt" semantics inherited from CV1.E4.S4 (manual session scope tagging), pre-dating reception's multi-axis routing.

The asymmetry surfaced once v0.13.0 populated sessions with multiple stable scopes pinned per conversation. A small-talk turn on a session tagged with org `software-zen` and journey `vida-economica` carried both full briefing+situation blocks into every system prompt — regardless of whether the message had anything to do with either. The composer was loud where reception had been deliberately quiet.

The user-facing inconsistency: the conversation header pill (session-level) said *"this conversation is in this scope"* and the bubble badge (per-turn) said *"reception didn't activate the scope here"* — and yet the prompt still carried the scope. Two surfaces disagreed about a third surface (the prompt itself).

## Fix

Reception is the **single source of truth** for which scope content composes. Session tags continue to express *"this conversation operates within this context"* and constrain reception's candidate pool — but they do not force composition. A pinned scope absent from this turn's pick produces no prompt block.

```
session tags → reception's candidate pool (constraint)
                      │
                      ▼
            reception picks at most one org
            and at most one journey per turn
                      │
                      ▼
            composer renders only what was picked
```

The two-axis pattern (org + journey when journey belongs to org) and the sole-scope-in-domain rule continue to hold — they were always reception's job, not the composer's.

## What shipped

- **`server/identity.ts`** — `ComposeScopes.sessionTags` removed from the interface. The `tags && tags.organizationKeys.length > 0` branch in scope rendering deleted; `orgKeys` and `journeyKeys` derive only from `scopes.organization` / `scopes.journey`. `SessionTags` import dropped. Docblock updated to document conditional scope activation.
- **`adapters/web/index.tsx`** — the web stream call site stopped passing `sessionTags` to `composeSystemPrompt`. Tags are still loaded and used for reception's pool constraint and for first-turn auto-seeding; only the composer call no longer reads them.
- **`tests/identity.test.ts`** — the 5-test "session tag pool (CV1.E4.S4)" describe block deleted (defunct semantics). A 4-test "conditional scope activation (CV1.E7.S3)" describe block added pinning the new contract: reception's pick wins, null-pick = no block, undefined-scopes = no block, the org+journey pair pattern.

## Tests

639 passing (was 640 at S5 close; net -1: 5 pre-S3 tests deleted, 4 new S3 tests added).

## Non-goals (parked)

- **Plural shape for reception** (`organizations: string[]`, `journeys: string[]`). The sole-scope-in-domain rule and the journey-plus-parent-org pair cover today's practical cases. Open S3b only when real use surfaces a turn that genuinely needs two orgs simultaneously.
- **"Force include this scope" override.** Out of scope; open a story if the dor surfaces.
- **Differentiating active vs inactive pill in the header.** The pill stays as the session-level indicator; per-turn signal lives in the bubble.

## Docs

- [Plan](plan.md) — design before code, the alternatives considered
- [Test guide](test-guide.md) — manual roteiro
- [decisions.md — Conditional scope activation](../../../decisions.md#2026-04-25--conditional-scope-activation-reception-is-the-source-of-truth-cv1e7s3)
- [prompt-composition](../../../../product/prompt-composition/) — updated; the pre-S3 caveat is gone
