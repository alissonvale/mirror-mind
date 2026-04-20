[< Story](index.md)

# Plan: CV1.E4.S1 — Scope identity + routing

**Roadmap:** [CV1.E4.S1](../index.md)
**Concept:** [Journey Map](../../../../../product/journey-map.md)
**Framing:** tracer bullet for the Journey Map epic. Ships both scopes with their full two-field shape (briefing + situation) wired through the full flow — surfaces, reception, composition, rail. Symmetric schema avoids a half-implemented mid-state. Every later story in the epic stacks on top of this substrate.

**Size note:** this story is larger than the typical mirror-mind story and ships as one coherent unit across multiple development phases (analogous to CV0.E2.S8 — Cognitive Map, which shipped in 9 phases as one story). See *Development phases* below for the internal breakdown. The story closes when all phases pass and the end-to-end validation works.

---

## Goal

Three simultaneous deliverables, validated together:

1. **Two surfaces** — `/organizations` and `/journeys`. Each with list + create + per-scope workshop. Both workshops edit `briefing` + `situation` + regenerable summary + archive. Journey workshop also includes an organization link selector. Empty states as invitations (S10 pattern).
2. **Reception detects scopes** — in addition to persona. The envelope becomes `{ persona, organization, journey }`; all three nullable, independent, chosen in the same LLM call.
3. **Composition injects scope content** — in the slots agreed in the concept doc: `soul → identity → persona → organization → journey → behavior → expression → adapter`. The rail reflects the detected scopes.

Validation: create *Software Zen* (briefing + situation) and *vida-economica* (briefing + situation, no organization), then *o-espelho* (briefing + situation + organization = Software Zen). Send "quanto sobrou no caixa este mês" through `/mirror`; observe the rail show `journey: vida-economica`; confirm via the composed-prompt drawer that the journey briefing + situation are present. Send "quais prioridades da Software Zen?"; observe `organization: software-zen`; confirm both fields of the org are present. Send a message about *o-espelho*; observe both org and journey activate, all four briefing/situation blocks composed in the prompt.

## Non-goals

- **Tasks, documents, session filtering, extracted-memory filtering.** Those are later stories or other epics.
- **Rich lifecycle.** Only *active* and *archived*. No draft, paused, or completed states.
- **Many-to-many scoping.** One piece of data belongs to at most one scope.
- **Automatic scope proposal.** "Looks like a new journey" is out of scope until explicit routing proves itself.
- **Cross-adapter preferences.** A scope speaks on any channel the user uses.
- **Channel or project-path fields.** Not ported in v1.
- **Admin variants of the surfaces.** Regular users manage their own scopes. No `/map/:name/journeys` or `/map/:name/organizations` in v1.
- **Organization as nested scope (sub-organizations).** One level of nesting only.

## Decisions

### D1 — Two tables, not identity layers

`organizations(id, user_id, key, name, briefing, situation, summary, status, created_at, updated_at)` and `journeys(id, user_id, organization_id nullable, key, name, briefing, situation, summary, status, created_at, updated_at)`. Both with `UNIQUE(user_id, key)` and an index on `(user_id, status)`.

Schema is symmetric between the two scopes — the only structural difference is journey's FK to organization. Symmetric schema pays off immediately: db helpers, summary pipeline, and workshop UI reuse patterns across both entities.

Neither scope belongs in the `identity` table. The identity table's schema serves prompt-as-text structural layers; scopes carry structured metadata (status, foreign keys, nested fields) that would distort it. Also: a scope is not a voice, it's a namespace (see [concept — A journey is a scope, not a layer](../../../../../product/journey-map.md#two-scopes-one-idea)).

Journey's `organization_id` is nullable — personal journeys without an organization are a real case (*vida-economica*, *vida-filosofica*).

**Supersedes CV1.E5.S1** (*Organization layer* from the Identity Lab spike §9.6). The spike's framing of organization as an identity layer is obsolete; CV1.E5.S1 is deleted. See [decisions.md](../../../decisions.md#2026-04-20--journey-map-as-a-peer-surface-a-scope-is-not-a-layer).

### D2 — Briefing vs situation

`briefing` and `situation` are two semantic slots:

- **briefing** — who/what this scope *is*. Stable. Edited rarely, only on identity shifts.
- **situation** — where this scope is *right now*. Evolving. Edited often, weeks or months.

Both scopes have both fields from S1. The original plan had journey with briefing-only in S1 and situation in S2 — that split was rejected as artificial because journey briefing-only isn't a coherent product state, just a half-built feature. Symmetric fields from day one also mean reception and composer get their final shape in a single pass (no mid-state prompt changes, which are high-risk given voice fragility demonstrated in v0.7.0).

The word `situation` was chosen over `context` (too generic — briefings are also context) and over variant metaphors like `path/caminho` (path is narrative-of-traversal, which works for journey but not for organization; unifying on `situation` keeps schema and vocabulary consistent across both scopes).

### D3 — Reception envelope becomes `{ persona, organization, journey }`

Three classifications, one LLM call. Each independent: a message can match any subset. Organization is not derived via journey FK because users talk about organizations without being in any specific journey ("what are Software Zen priorities?"). Independence costs nothing at inference — same prompt, one more output field.

**Prompt additions** (on top of the existing persona prompt):
- A second list *Available organizations* with `key: summary` entries.
- A third list *Available journeys* with `key: summary` entries, each annotated with its organization when applicable.
- Output shape: `{"persona": "<key>|null", "organization": "<key>|null", "journey": "<key>|null"}`.
- Null-case examples for each scope, analogous to persona nulls.

**Reception returns null for any scope on:**
- A returned key not present in the active set.
- JSON parse failure (fall back to all-null).
- Timeout (same path).

### D4 — Composition: broader before narrower, both inside the identity cluster

Slot order:

```
self/soul → ego/identity → persona → organization → journey → ego/behavior → ego/expression → adapter
```

Rationale: `self → ego → persona` is the mirror's structure. `organization → journey` is the situational context, broader before narrower. Form cluster stays at the end with maximum recency for absolute rules.

Each scope (org and journey) composes the same way when active — `briefing` followed by a delimited `situation` block:

```
[briefing...]

---

Current situation:
[situation...]
```

When both scopes activate, the prompt contains org's briefing+situation, then journey's briefing+situation, then the form cluster. Only active scopes compose; archived scopes cannot be selected by reception.

### D5 — Summary generation reuses the existing pipeline

`server/summary.ts` gets two new branches: `scope=organization` and `scope=journey`. Each with its own few-shot pair and routing-aware opening clause (for orgs: *"name the organization's identity and its current phase: what it is, what it does, what's in play right now"*; for journeys: *"name the context of this journey: what it is, what it's for, when it's active"*).

For both scopes, the summary is generated from the *concatenation* of `briefing` + `situation` so the classifier sees both signals in one line.

Fire-and-forget on save. Regenerate button on both workshops.

### D6 — Two separate surfaces, with cross-linking

- `/organizations` and `/organizations/:key` — list + workshop for organizations.
- `/journeys` and `/journeys/:key` — list + workshop for journeys.

Sidebar gains two links under *My Mirror*: **Organizations** and **Journeys**. They live side by side because both are authored at different cadences but both matter equally for context; forcing one under the other would bury it.

**Cross-links:**
- On `/journeys`, journeys grouped visually by organization (headers with the org name). The org header is read-only; clicking the org name navigates to `/organizations/:key`.
- On `/organizations/:key`, a list of journeys that belong to that org, with links to each `/journeys/:key`.
- On `/journeys/:key`, a dropdown to assign/change the organization link; a small breadcrumb *"in {org-name}"* above the briefing editor when set.

### D7 — Rail shows active scopes as separate lines

The rail's attention block gains up to two new lines under the persona line:
- `organization: <key>` when reception returns one.
- `journey: <key>` when reception returns one.

Lines are hidden when null. Order: persona → organization → journey, mirroring composition order. No click-through to surfaces in v1.

### D8 — Composed-prompt drawer gains two selectors

The drawer on `/map` and per-layer workshops gains **organization** and **journey** dropdowns beside the existing persona + adapter dropdowns. Each dropdown: *(none)* + each active scope. This lets the user preview composed prompts across scope combinations during briefing iteration.

### D9 — Status values limited to active / archived

v1 scopes are binary: `status IN ('active', 'archived')`. Archiving is manual via the workshop. Archived scopes:
- Excluded from the default list on both surfaces (filter affordance to show archived).
- Excluded from reception's candidate set.
- Readable via direct URL.

Draft / paused / completed states are deferred.

### D10 — Evals for scope routing

New `evals/scope-routing.ts` (analogous to existing `evals/routing.ts`). Probes include: clear journey signal only, clear organization signal only, both (message mentions org-scoped journey), neither (meta-questions), cross-scope ambiguity, archived scope excluded. Threshold 85%.

## Steps

1. **Schema + DB helpers**
   - `server/db/organizations.ts`: `createOrganization`, `updateOrganization`, `setOrganizationSummary`, `archiveOrganization`, `unarchiveOrganization`, `deleteOrganization`, `getOrganizations` (by user, filter by status), `getOrganizationByKey`.
   - `server/db/journeys.ts`: same shape + `linkOrganization(journey_id, organization_id | null)`.
   - Add `CREATE TABLE` + indexes to the schema string in `server/db.ts`. No ALTER migrations — new tables, fresh adds.
   - Re-export from `server/db.ts`.
2. **Reception** — extend prompt in `server/reception.ts` to include the two scope lists. Parse `organization` and `journey` independently; validate against active sets; fall back per-field to null on mismatch. Update `ReceptionResult` type.
3. **Composition** — `composeSystemPrompt` in `server/identity.ts` accepts `organizationKey?` and `journeyKey?`. Reads each when set; injects each scope as a `briefing + situation` block (same shape for both). Updates `server/composed-snapshot.ts` to list each as composition entries.
4. **Summary pipeline** — extend `server/summary.ts` with organization and journey branches. Wire calls from each save path.
5. **Server wiring** — `adapters/web/index.tsx` threads `{ organizationKey, journeyKey }` from reception into composition at `/mirror/stream`. Session stats / rail payload includes both.
6. **Web surfaces**
   - `adapters/web/pages/organizations.tsx` (new): list + create + workshop. Workshop has two textareas (briefing + situation), summary block, regenerate, archive action.
   - `adapters/web/pages/journeys.tsx` (new): list (grouped by organization) + create + workshop. Workshop has two textareas (briefing + situation), organization dropdown, summary block, regenerate, archive.
   - Sidebar links in `layout.tsx`.
7. **Composed-prompt drawer** — add organization + journey dropdowns. Thread selection into preview composition.
8. **Rail** — `adapters/web/pages/context-rail.tsx` adds up to two lines. Hide when null.
9. **Tests**
   - Unit (`tests/db.test.ts`): CRUD on both tables, archive lifecycle, unique `(user_id, key)`, FK from journey to organization (nullable), list filtering by status.
   - Unit (`tests/reception.test.ts` or equivalent): returns `{persona, organization, journey}`; each falls back independently; archived never returned.
   - Unit (`tests/identity.test.ts`): `composeSystemPrompt` injects org briefing+situation and journey briefing+situation in the right slots; handles all combinations (org only, journey only, both, neither).
   - Web (`tests/web.test.ts`): `/organizations` and `/journeys` list/create/workshop flows, archive toggles visibility, 404 for unknown keys, regular user access (no admin guard).
10. **Eval** (`evals/scope-routing.ts`): 20–25 probes, threshold 85%.
11. **Docs**: `test-guide.md`, `refactoring.md` (review pass), worklog entry, mark S1 ✅ in epic index and roadmap.

## Files likely touched

- `server/db.ts` — schema + re-exports
- `server/db/organizations.ts` *(new)*
- `server/db/journeys.ts` *(new)*
- `server/reception.ts` — envelope
- `server/identity.ts` — composer slots
- `server/summary.ts` — two branches
- `server/composed-snapshot.ts` — include both scopes
- `server/session-stats.ts` — rail payload
- `adapters/web/pages/organizations.tsx` *(new)*
- `adapters/web/pages/journeys.tsx` *(new)*
- `adapters/web/pages/context-rail.tsx` — scope lines
- `adapters/web/pages/layout.tsx` — sidebar links
- `adapters/web/pages/map.tsx` — drawer dropdowns
- `adapters/web/index.tsx` — routes + thread keys through `/mirror/stream`
- `tests/db.test.ts`, `tests/web.test.ts`, `tests/identity.test.ts`, `tests/reception.test.ts`
- `evals/scope-routing.ts` *(new)*

## Development phases

This story ships as one coherent unit but is built in phases, following the pattern CV0.E2.S8 (Cognitive Map) established. Each phase leaves tests passing; the story closes when the end-to-end validation works.

1. **Schema + DB helpers** — both tables, all CRUD + archive + summary setters. Unit tests green.
2. **Reception envelope** — prompt extension, three-output parsing, validation against active sets. Reception tests green. First draft of `evals/scope-routing.ts`.
3. **Composition slots** — composer accepts scope keys, injects briefing+situation blocks in the right order. Identity tests cover all four combinations.
4. **Summary pipeline** — organization and journey branches in `summary.ts`. Fire-and-forget from save paths.
5. **`/organizations` surface** — list + workshop + archive + regenerate. Web tests green.
6. **`/journeys` surface** — list (grouped by org) + workshop + FK selector + archive + regenerate. Web tests green.
7. **Rail + drawer extensions** — rail lines + drawer dropdowns for both scopes. Manual validation via `/mirror` + `/map`.
8. **End-to-end validation** — create org, create journey linked, send real messages, observe rail + composed-prompt drawer. Eval passes threshold.
9. **Review pass** — `refactoring.md`, dead code sweep, docs integrity check.

## Known incomplete

- **No tasks, no documents, no scoped episodic browse.** Later stories or other epics.
- **Sidebar placement is tentative.** Two new links under *My Mirror* adds weight. If the sidebar feels crowded in practice, the review pass may surface a different shape (grouping, submenus).
- **Rail label is plain.** `organization: <key>` / `journey: <key>`. A prettier shape with the display `name` can follow.

## Open questions to resolve during implementation

- **Exact summary prompts for each scope.** Need first drafts, then iteration via the eval. Starting shape for orgs: *"Name the organization's identity and current phase: what it is, what it does, what's in play right now. ~40 words, no meta-differentiation, match the source language."* Analogous for journeys: *"Name the context of this journey: what it is, what it's for, where it stands right now. ~40 words, same rules."*
- **Should `getOrganizations` / `getJourneys` default to exclude archived?** Yes. Explicit option to include archived for the list page's toggle.
- **Where does the "create organization" / "create journey" form live?** On the list page at the top, or a dedicated `/organizations/new` / `/journeys/new` route? Start with on-list inline form (simpler); escalate to dedicated route if it grows fields.

---

**See also:**
- [Journey Map concept](../../../../../product/journey-map.md)
- [CV1.E1.S1 — Persona routing](../../cv1-e1-personas/cv1-e1-s1-persona-routing/) — the pattern this story extends
- [Spike — Identity Lab §9.6](../../../spikes/spike-2026-04-18-identity-lab.md) — where the organization concept originated (as layer, now superseded)
