[< Product Use Narrative](./)

# Uses

Why this narrative exists in operational terms — how to actually use it in day-to-day work, not just admire that it exists.

The narrative serves three families of use, plus a maintenance contract that keeps it from going stale.

## 1. Design probes

When a feature is being designed, walk the proposal through the family. Make the questions specific:

- **"How does Elena experience this?"** Pick the family member whose use most resembles the target. If you can't tell which one fits, the feature lacks a clear user model — that itself is information.
- **Persona coverage.** If the feature requires a routing decision the existing personas don't have a home for, that's a signal the persona model has a gap (or the family does — see *How to extend* below).
- **The "no fit" signal.** If a feature doesn't fit any of the four characters, ask whether it's the right feature, or whether the family is too narrow to cover the case.

Examples of useful design questions:

- "If we ship this now, would Dan use it on Saturday morning in the shop, or only at his desk during the week?"
- "Would Eli's experience of this be different from Elena's because he's 18 versus 47, even though they're using the same surface?"
- "Does this need to work on Telegram for Eli and on web for Elena, and what changes between channels?"
- "Where does Nora hit this: as editor, as runner, as journalist? Each is a different mental model."

The point is not to get a definitive answer — it's to make the design conversation specific instead of generic. Specific has affordances; generic does not.

## 2. Evals — canonical conversations as regression tests

Each character has five sample conversations. They were authored in the voice the mirror should speak when assisting that user. They function as informal ground truth.

How to use them:

- **Manual eval after a prompt change.** When you change `ego/behavior`, `ego/expression`, or a persona prompt, replay one or two of the canonical user messages through the new prompt. Read the new output next to the canned reply. Did it degrade, improve, or drift?
- **Specific behavioral regression cases.** Some conversations test specific behaviors worth not breaking:
  - Nora's tempo-run conversation: the runner persona must push back against an injury-rationalizing user instead of validating the bad call.
  - Dan's "Sunday call with Mom": the son persona must name avoidance without fixing it.
  - Elena's "letter I'm not ready to send": the essayist must work at the sentence level and not literary-up the prose.
  - Eli's "should I tell Chase": the friend persona must hold the question without pushing for a decision.
- **Cross-character routing.** Reception's classifier sees four users with overlapping persona keys. You can probe consistency: does an identity-shift message route to `strategist` for Dan, `scholar` for Elena, `friend` for Eli, `editor` for Nora?

The path forward is an automated eval harness that pipes the canned user messages through the assistant on every change and surfaces deltas. For now, manual eval at change-points is a meaningful step up from no eval.

## 3. Communication — public and internal

The narrative is shippable as docs. Some applications:

- **Onboarding.** When a new collaborator joins, send them to the family before the architecture diagrams. Specific lives make abstract product concepts legible faster than abstract concepts make specific lives legible.
- **Demo material.** Pick a family member when demoing the product. "Let me log in as Elena and show you what her workshop looks like" beats clicking through generic data. The same UI feels different when there's a person it serves.
- **Public material.** Each character can be a self-contained vignette. A landing page, a blog post, a conference talk: "Meet Dan, who runs a small homelab and uses Mirror Mind to think through his career inflection." Fiction means you ship without exposing your own life or running a privacy review.
- **Stakeholder framing.** "Imagine four people in one family, each with their own mirror on the same server" makes the multi-user, identity-isolated architecture click for someone who doesn't get it from the pitch.

## Maintenance contract

The narrative goes stale fast if it isn't maintained. The rule:

> **Every roadmap story that changes a user-facing surface should extend the narrative** — a new journey, a new conversation, an updated organization or journey situation, or a small profile change.

Concretely:

- **In story step 1 (plan):** name which family member exercises the new surface. If none does cleanly, that's an early signal worth surfacing.
- **In story step 6 (status update):** before marking done, add the corresponding narrative artifact — even a single new conversation that uses the feature is enough.

Without this discipline, the family becomes a museum of an earlier version of Mirror Mind. With it, the narrative stays coherent with what the product actually does, and every shipped feature has a built-in demonstration.

## What the narrative is not

Worth keeping clear:

- **Not a substitute for real user research.** The four characters are authored fiction. They reflect what we imagine, not what users do. When real user friction is observable (the way v0.12.0 was driven by the inhabitation pass), it trumps the narrative.
- **Not a roadmap.** The tensions and journeys in the narrative are illustrative. Many of the things the family cares about will never be product features. The narrative supports design — it doesn't prescribe scope.
- **Not finished.** The current four-character family is one cut. A second cut could add more diverse users — different class background, different cultural register, non-American, less literate. The current set is good enough to start; not the only valid set.
- **Not authoritative on voice.** The four characters' voices are a reflection of who authored them. Treat them as a starting point, not as the canonical specification. If a real user produces voice the narrative didn't anticipate, the user wins.

## How to extend

The structure is in place, so adding to the family is cheap:

| Action | Rough time |
|---|---|
| Add a new conversation to an existing character | ~10 minutes |
| Add a new journey | ~5 minutes |
| Add a new persona to an existing character | ~5 minutes |
| Update an existing org or journey's situation | ~5 minutes |
| Add a whole new character (full stack) | a few hours |

For file conventions and the loader contract, see [the narrative index](./). After editing the markdown, run `npm run admin -- narrative load` to apply the changes to the dev database. Re-runs are idempotent — content upserts in place, conversations dedupe by title, no duplicates.

When extending, the small habits that keep the family coherent:

- Hold the character's voice. The new content should sound like the same person.
- Keep the narrative-only narrative facts at the index level. Inside a character's own files, they may mention family members by first name, but they share no DB rows.
- Every file gets a breadcrumb to the user hub. The breadcrumb is stripped by the loader — it costs nothing in DB cleanliness and pays for itself in docs navigation.
