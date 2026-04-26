[< Improvements](../)

# Auto-seed of session pool — per-axis instead of all-or-nothing

**Type:** Refinement
**Date:** 2026-04-26

## Problem

The first-turn auto-seed in `/conversation/stream` was gated by a single `hasAnyTag` check that read all three axes (personas, orgs, journeys) at once. If the session had any tag in any axis when the first message arrived, **no axis** would seed — even if some axes were genuinely empty.

The concrete failure surfaced during S3 manual smoke as Dan Reilly:

1. User pinned `reilly-homelab` (org) + `vmware-to-proxmox` (journey) in the conversation header before sending any message. Persona axis was untouched.
2. First message ("Plex / Proxmox migration") activated reception, which picked `engineer` as the persona.
3. `hasAnyTag` was true (because of the org and journey pins) → `didAutoSeed` was false → **no persona was written** to `session_personas`.
4. The bubble badge for `engineer` rendered (it reads from the entry's `_personas` meta, which was stamped). The Cast in the header showed the avatar in-memory (from `ensureCastAvatar`'s client-side hot-update). The composed snapshot showed the persona block (`engineer` was still active for that turn's prompt composition).
5. **On reload**, the server re-rendered the page from `session_personas` (empty) → Cast read empty even though the bubble and snapshot of the same turn still announced `engineer`.

Three surfaces disagreed: bubble said the persona was active, snapshot agreed, header said no cast at all.

## Fix — asymmetric gate per axis

The fix landed in two passes. The first pass split the all-or-nothing gate into per-axis gates while keeping the first-turn-only window. Manual smoke after that pass surfaced a second gap: the canonical Dan walkthrough sends a casual greeting as turn 1 (no persona activation), then an in-domain message as turn 2. Reception activated the persona on turn 2, but `isFirstTurn === false` blocked the seed. The Cast still rendered empty after F5.

The second pass relaxes the gate **only for the persona axis** to match the cast-vs-scope philosophy:

- **Personas (cast) — seed whenever the persona pool was empty before this turn**, regardless of whether it's the first turn. Cast is mutable by design — it forms across the conversation. Once any persona is seeded, the pool is constrained and the auto-grow stops.
- **Orgs and journeys (scope) — seed only on the first turn with an empty pool.** Scope is the conversation's stable context, declared at session start. Auto-growing scopes across turns would let casual mentions silently broaden the conversation's framing — exactly the kind of leakage S3 just removed at the composition layer.

```ts
const personasEmptyBefore = sessionTagsBefore.personaKeys.length === 0;
const orgsEmptyBefore = sessionTagsBefore.organizationKeys.length === 0;
const journeysEmptyBefore = sessionTagsBefore.journeyKeys.length === 0;

// Personas: any turn while pool is empty.
if (personasEmptyBefore) {
  for (const p of reception.personas) addSessionPersona(db, sessionId, p);
}

// Orgs and journeys: first turn only, while pool is empty.
if (isFirstTurn) {
  if (orgsEmptyBefore && reception.organization) {
    addSessionOrganization(db, sessionId, reception.organization);
  }
  if (journeysEmptyBefore && reception.journey) {
    addSessionJourney(db, sessionId, reception.journey);
  }
}

const seededScopes = {
  organization: isFirstTurn && orgsEmptyBefore ? reception.organization : null,
  journey: isFirstTurn && journeysEmptyBefore ? reception.journey : null,
};
```

The asymmetry is the point: the code now reflects the philosophical asymmetry CV1.E7.S2 installed at the visual layer. Cast can grow during a conversation; scope cannot.

## Why per-axis is correct

The original all-or-nothing gate read as: *"if the user pinned anything, they're in control mode for the whole session — don't auto-seed any axis."* That's reasonable as a coarse heuristic, but it conflates two different intentions:

- **Pinning a scope** (org or journey) is a deliberate framing of the conversation's context: "this conversation is about X." It's a contract on the scope axis.
- **Not pinning a persona** does not signal control mode for the cast. The cast is mutable by design (cast-vs-scope asymmetry from CV1.E7.S2). Letting reception populate the cast is the natural mode unless the user explicitly convoked someone.

Per-axis gating respects the asymmetry: each axis decides independently whether to defer to the user's prior action. If the user touched it, defer. If they didn't, auto-seed.

## What did NOT change

- **First-turn-only.** Auto-seed still runs only on the first turn of a session. It does not become a per-turn auto-grow. That's a different design (parked under [CV1.E7.S8 — out-of-pool suggestion via the rail](../../cv1-depth/cv1-e7-response-intelligence/)) and would need a different mechanism — extending the auto-seed window to "any turn while pool empty" would couple cast growth to first-time activations only, missing the divergence-detection semantics S8 is meant to surface.
- **`seededScopes` shape.** The hot-update signal to the client still emits `{ organization, journey }` per-axis. The change is just that the booleans are now independent. Personas still don't need a seed signal — `ensureCastAvatar` is idempotent over the DOM and the underlying `session_personas` is now populated on the same turn, so the Cast renders correctly on reload.

## Commit

(this commit)

## Tests

647 passing, unchanged. The auto-seed lives inside the streaming handler whose tests would need full Agent mocking — out of scope for a refinement. Validated manually by repeating the Dan walkthrough Test 2 and confirming the Cast persists across F5.

## Related

- [scope-pill-hot-update](../scope-pill-hot-update/) — the sibling client-side fix that surfaced the same family of problem (UI showing one thing, server-rendered state showing another) for scope pills. This refinement closes the persona side of that gap.
- [Session scope lifecycle](../../../../product/prompt-composition/index.md#session-scope-lifecycle) — updated to document the per-axis nature of the auto-seed.
