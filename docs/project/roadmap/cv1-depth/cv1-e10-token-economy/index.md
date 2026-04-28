[< CV1 Depth](../)

# CV1.E10 — Token economy

**Status:** S1 done (`v0.20.0`); future stories drafted

## Premise

Briefing #5 is the canonical rule: *every token in the prompt must earn its place.* CV1.E7 made the heavy layers conditional (S3 scope, S4 identity); CV1.E9 added a third compose path for the Voz da Alma. What remains uncovered is the bottom of the weight ladder — turns where the user is just opening or closing the conversational thread, where even the canonical "always-on" baseline (`ego/behavior` + adapter) is still overkill.

This epic is about **paying the right weight per turn**. Not about adding capabilities; about ensuring the prompt's bytes are proportional to what the turn actually invites.

## Three weights, three classes

After this epic ships, the pipeline composes one of three weights per turn:

| Weight | Trigger | What composes |
|---|---|---|
| **Heavy (Alma)** | `is_self_moment: true` (CV1.E9.S3) | Alma preamble + soul + doctrine + identity + scope + behavior + adapter |
| **Medium (canonical)** | default path | persona + scope (when reception flagged) + identity (when `touches_identity`) + behavior + adapter |
| **Light (trivial)** | `is_trivial: true` (CV1.E10.S1) | adapter only (or empty when no adapter) |

Mutually exclusive at the trigger level: a turn is at most one of `is_self_moment` or `is_trivial`. When both would apparently apply, the prompt rules force `is_self_moment` to win (an apontamento is never trivial; reception bias). When neither flips, the canonical path runs with its own conditional gates.

## Stories

| # | Story | Status |
|---|---|---|
| S1 | [Trivial turn elision](cv1-e10-s1-trivial-elision/) | ✅ `v0.20.0` |

## Why a separate epic from CV1.E7

CV1.E7 was about response **intelligence** — moving from a single mega-prompt to a pipeline of named LLM steps with conditional layer activation. CV1.E10 is about response **economy** — gating the elision direction symmetrically to how CV1.E9 gated the elaboration direction.

If future stories show up that elide more (e.g., per-role behavior subsets, per-turn scope summaries instead of full briefings), they live here. Each one extends the "right weight per turn" axis without changing what the pipeline DOES at runtime — only how heavy it is when it does it.

## Future stories (not yet drafted)

- **Per-role behavior subsets.** Today `ego/behavior` is one monolithic block. Some sections (Pensamento, Estrutura argumentativa) only matter when there's substance to argue around; Postura and Condutas operacionais cover all turns. A future story could split behavior into composable sub-blocks gated by reception axes.
- **Scope summary vs full briefing.** Org/journey briefings can run several KB. For turns where the scope is context but not the focus, a 2-line summary (already exists for routing — `extractScopeDescriptor`) could replace the full block. Only fully load when reception flags scope-as-focus.
- **Adapter instruction conditional.** Same logic — most adapter instructions are formatting-only ("use markdown", "wrap at N chars"); for trivial turns even that overhead can elide.

Drafts only when real use justifies them.
