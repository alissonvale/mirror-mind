[< CV1.E4 — Journey Map](../index.md)

# S1 — Scope identity + routing

Minimum viable scopes with their full two-field shape: the mirror knows which organization and journey the user is in when the message signals them, and the scope briefings (plus situations) enter the composed prompt. No documents, no session filtering yet — those are later stories or other epics. This story ships the scope substrate itself (the `organizations` and `journeys` tables with symmetric `briefing` + `situation` fields, the `/organizations` and `/journeys` surfaces, reception detection for both, composition injection, rail display) as a working tracer bullet.

- [Plan](plan.md) — scope, decisions, steps, files touched

## Done criteria

1. User creates an organization (name + briefing + situation) from `/organizations`.
2. User creates a journey (name + briefing + situation + optional organization link) from `/journeys`.
3. User sends a message that semantically fits the journey and/or the organization.
4. Reception returns `{ persona, organization, journey }` — any combination of the three; each nullable.
5. Composed system prompt includes the organization briefing + situation and/or the journey briefing + situation in the right slots (broader before narrower).
6. Rail shows *organization: \<name\>* and/or *journey: \<name\>* when detected; hidden when not.
7. Archived scopes do not route.
8. A journey with an organization link surfaces the org on both its card (grouping) and its detail page.
