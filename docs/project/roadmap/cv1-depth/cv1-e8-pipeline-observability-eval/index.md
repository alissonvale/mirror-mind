[< CV1 — Depth](../)

# CV1.E8 — Pipeline Observability & Evaluation

**Roadmap:** [CV1.E8](../../index.md)
**Status:** S1 done (`v0.19.0`), S2 draft
**Premise:** Once the pipeline of named LLM steps is in place ([CV1.E7](../cv1-e7-response-intelligence/)), the next move is making it **inspectable** and **comparable**. To improve it deliberately, we need to see what each step costs, what each step sends, and how alternative models would have behaved on the same turn. This epic builds the introspection and experimentation tooling.

The epic doesn't add new pipeline steps. It makes the existing ones visible and re-runnable.

## Stories

| Code | Story | Status |
|------|-------|--------|
| S1 | [**LLM call logging with admin toggle**](cv1-e8-s1-llm-logging/) — every invocation (reception, main, expression, title, summary, and any future role) writes a row to a log table: model, provider, role, prompt sent, response received, tokens in/out, cost (BRL + USD), latency, session_id, entry_id (when applicable), timestamp. A toggle in the admin workspace starts/stops logging globally. An admin page lists recorded calls with filters by role, session, model, and time. Export as JSON or CSV. No retention policy by default — admin clears manually. The recorded **prompts** are the canonical data for finding optimization points: token bloat, prompt drift across versions, mode mis-classification, scope leakage that survived the composer's gates. The toggle exists so the system isn't always paying the storage cost when admins aren't actively investigating | ✅ `v0.19.0` |
| S2 | **Per-turn model switching for admin re-runs** — in a conversation, admin can pick any past assistant turn and re-run it through a different model (or a different role configuration — e.g., reception switched to Haiku 4.5 instead of Gemini 2.5 Flash). The alternative response renders alongside the original (or in a panel below the bubble) for visual side-by-side comparison. Doesn't mutate the canonical conversation — alternative runs are explicit "what if" branches that admin can keep visible, discard, or save into the S1 log for cross-conversation analysis. The natural complement to S1: with logs, you see what happened; with re-runs, you ask "what if the model were different?" | Draft |

**Ordering rationale:** S1 first because the log table is the substrate. S2 builds on S1's infrastructure to record alternative-run results in the same table, enabling later cross-run analysis. Doing S2 without S1 would force a parallel persistence path; doing S1 without S2 still has standalone value (admins can investigate the existing pipeline immediately).

## Related — CV1.E7.S9 (mode visibility)

[CV1.E7.S9 — Per-turn mode visibility](../cv1-e7-response-intelligence/) (Draft) is observability-flavored and a natural sibling to S1 here. It stays in CV1.E7 because its framing was *closing the transparency loop on the response intelligence pipeline this epic just built*. The work it stamps (`_mode` on entry meta + surfacing in the snapshot) overlaps with what S1 logs comprehensively, but mode visibility is a one-field, in-line UI surface decision; S1 is a broader logging substrate with its own admin surface. Adjacent, not duplicate.

If S1 lands first, S9 may collapse into "show the relevant fields from the log entry for this turn" — possible refinement, parked.

## Why a separate epic from CV1.E7

CV1.E7 is about **building** the response intelligence pipeline — moving from prompt to pipeline, conditional layer activation, multi-persona voicing, divergent-response affordances. Each story changes what the pipeline does at runtime.

CV1.E8 is about **seeing and experimenting with** that pipeline. Stories don't change pipeline behavior at runtime (S1's toggle adds optional logging overhead; S2's re-runs are explicit out-of-band actions). Different theme — *understanding* rather than *building* — and different rhythm: stories here can ship independently as the need surfaces, without the dependency chain CV1.E7 has.

## Future stories (not yet drafted)

When/if the friction surfaces:

- **Per-step latency & cost dashboards** — aggregate views over the S1 log, e.g., reception's 95th-percentile latency over the last 24h, expression's cost per session.
- **Prompt diffing across versions** — compare two versions of a system prompt against the same recorded user message to see what the new version actually sends.
- **Eval harness integration** — formalize the existing one-off eval scripts (`evals/scope-routing.ts`) as a runner that uses S1's log as fixtures.

Drafts only when the dor justifies them.

## See also

- [CV1.E7 — Response Intelligence](../cv1-e7-response-intelligence/) — the epic this one observes
- [Briefing #5](../../../briefing.md) — *every token in the prompt must earn its place* (S1's log is how you find the tokens that don't)
- [Process / Evals](../../../../process/evals.md) — current ad-hoc eval scripts; S2 is the interactive complement
