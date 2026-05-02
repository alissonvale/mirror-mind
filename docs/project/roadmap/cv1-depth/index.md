[< Roadmap](../index.md)

# CV1 — Depth

The mirror understands more than the current conversation text. It has memory, journey context, and personas. Every piece of context earns its place in the prompt — selective, not exhaustive.

## Epics

- [CV1.E1 — Personas](cv1-e1-personas/) ✅ `v0.2.0`
- [CV1.E2 — Adapter Awareness](cv1-e2-adapter-awareness/) ✅ `v0.3.0`
- [CV1.E3 — Memory](cv1-e3-memory/) — S4 (reset conversation) shipped; S1/S2/S3 queued
- [CV1.E4 — Journey Map](cv1-e4-journey-map/) — S1 in planning. Situational surfaces peer to the Cognitive Map — organizations and journeys, both scopes over memory. [Concept](../../product/journey-map.md)
- [CV1.E5 — Identity Architecture](../index.md#cv1e5--identity-architecture) — per-persona personal context (S2) and semantic memory (S3). S1 (organization layer) deleted, superseded by CV1.E4.
- [CV1.E6 — Memory Map](cv1-e6-memory-map/) — future epic, placeholder. Fourth peer surface that browses accumulated memory. [Concept](../../product/memory-map.md)
- [CV1.E7 — Response Intelligence](cv1-e7-response-intelligence/) — moving response generation from a single mega-prompt to a pipeline of named LLM steps. S1, S2, S3, S5 shipped; S4, S6, S7, S8, S9 drafts. [Concept](../../product/prompt-composition/)
- [CV1.E8 — Pipeline Observability & Evaluation](cv1-e8-pipeline-observability-eval/) — making the pipeline inspectable and comparable. S1 (LLM call logging) ✅ `v0.19.0`; S2 (per-turn model switching) draft.
- [CV1.E9 — Voz da Alma](cv1-e9-voz-da-alma/) ✅ `v0.18.0` — porting the o-espelho conversational wise-voice prompt as a new Self compose path that reception engages on journal-tone moments. Drives the *"Works for me, then works for Veronica"* adoption milestone. S1–S5 all shipped.
- [CV1.E10 — Token economy](cv1-e10-token-economy/) — paying the right weight per turn. S1 (trivial turn elision) ✅ `v0.20.0`; future stories drafted (per-role behavior subsets, scope summary, adapter conditional).
- [CV1.E11 — Scenes](cv1-e11-scenes/) — scene-first home and chrome inversion. The cena pivot crystallized: scene IS the model, personas/orgs/travessias emerge in service. New home at `/inicio` (Variant C: scene cards above, free input below), avatar-only top bar, Memória dashboard at `/memoria`. Strangler — old `/` untouched until cutover. S4 (backend) in progress; S1–S3, S5–S7 drafted. [Design](../../../design/scenes-home-design.md).
