[< Story](index.md)

# Plan — CV1.E7.S3 Conditional scope activation

## Diagnosis

Reception (`server/reception.ts`) was already correct: with `sessionTags` in the context, it restricts candidates to the tagged pool and applies the sole-scope-in-domain rule. When no candidate matches, it returns `organization: null` / `journey: null`.

The problem lived in the composer (`server/identity.ts:99-123`):

```ts
const orgKeys =
  tags && tags.organizationKeys.length > 0
    ? tags.organizationKeys      // ALL tagged orgs render, every turn
    : scopes?.organization
    ? [scopes.organization]
    : [];
```

If the session had 3 orgs tagged, all 3 entered the prompt on **every turn** — even when reception had decided (correctly) that none was relevant.

## Principle

**Reception is the single source of truth for scope composition.** Session tags continue to express *"this conversation can access these scopes"* (constraint on reception's pool), but the composer renders only what reception activated.

This preserves the *scope = stable pill* model from CV1.E7.S2 (the tag doesn't disappear), and makes the per-turn signal (bubble `◈`/`↝`) the same as the prompt's truth: the bubble and the prompt now agree.

## Decision: single-pick (not plural)

`organization: string | null` and `journey: string | null` stay. Not promoting to `string[]` like personas (S5). Reasons:

1. **Persona is cast (mutable); scope is context (stable).** The asymmetry from S2 holds. Multi-persona per turn is intentional design; multi-scope per turn is rare.
2. **Sole-scope rule + parent/child pair** already cover the practical cases. Reception returns org + journey together when the journey belongs to the org — this is the natural "two at the same time" form.
3. **Cost of plural is high now** (config models, parser, meta dual-stamp, UI) without evidence of need.

If real use surfaces "I need two orgs simultaneously in the same turn", we open S3b. Not before.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Composer respects reception** — remove the `tags && tags.organizationKeys.length > 0` branch in `identity.ts`. `orgKeys` and `journeyKeys` derive only from `scopes.organization` / `scopes.journey`. | `server/identity.ts` | Composer tests updated |
| 2 | **Clean `ComposeScopes.sessionTags`** — drop the field from the interface. Remove `SessionTags` import if no longer used in this file. | `server/identity.ts` interface | Type check |
| 3 | **Adapter — stop passing tags to composer** — web stream stops including `sessionTags` in the compose call. Tags are still loaded for reception's pool constraint and first-turn auto-seeding. | `adapters/web/index.tsx` | Type check + tests |
| 4 | **Tests of scenario** — delete the 5-test "session tag pool (CV1.E4.S4)" describe block (defunct semantics); add a 4-test "conditional scope activation (CV1.E7.S3)" describe block: (a) reception's pick wins over availability of others; (b) null pick → no scope block; (c) undefined scopes → same as null; (d) org + journey pair pattern. | `tests/identity.test.ts` | `npm test` |
| 5 | **Manual smoke test** — 3 messages against the dev instance with a session pinned to org + journey: (a) "bom dia" → no badge, no scope block; (b) message clearly in scope domain → badge + block; (c) message off-domain → nothing | browser | [test-guide.md](test-guide.md) |
| 6 | **Docs + close-out** — `decisions.md` (2026-04-25 entry), `worklog.md`, story folder (this), epic index marks S3 ✅, `prompt-composition/index.md` updated (Pre-S3 caveat removed; tables updated). | docs | reading |

## Manual test roteiro (Phase 5)

See [test-guide.md](test-guide.md).

## Non-goals (explicit, parked)

- **Plural shape for reception** (`organizations: string[]`). Open S3b if real use surfaces it.
- **Differentiating active vs inactive pill in the header.** Pill is session-level scope; per-turn signal lives in the bubble.
- **"Force include this scope" override.** Out of scope; open story if the dor surfaces.

## Narrative impact

S3 changes the composer's internals — not a user-facing surface in the design-doc sense. The visible effects (turn-by-turn coherence between header pill and bubble badge; smaller "Look inside" snapshot on off-domain turns) are reductions in noise, not new affordances. Narrative extension not required.

For a future read of this story by a family member, the relevant frame is Dan Reilly's experience: pinning `dan-reilly-construction` to a session and then asking small-talk questions no longer pays the cost of carrying the org's full briefing into the prompt.
