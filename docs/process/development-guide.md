[< Docs](../index.md)

# Development Guide

How we build Mirror Mind. This document captures the process that emerged across the first sessions of development (13–16 April 2026) and is maintained as a living reference.

---

## Principles

### Design before code

No code without a documented decision and an aligned plan. For non-trivial work, enter plan mode: explore the codebase, design the approach, present it for approval. The plan becomes a story doc.

### Small stories, immediate validation

Each story ends with a concrete "it works" moment — a curl response, a passing test, a visible result in the browser. Don't declare done without validation.

### Living documentation

Docs are the map, not bureaucracy. They're updated every cycle, not after the fact. If someone opens the repo tomorrow, they can understand what was done, why, and what's next — without asking.

### Refactoring in cycle

After implement and test, evaluate refactoring. Don't accumulate debt. Document what was refactored AND what was evaluated but left as-is (with criteria for revisiting).

### Tests passing on every commit

No exceptions. Unit tests with `:memory:` SQLite (no mocks). Smoke tests for CLI. Web route tests via `app.request()`. Every commit leaves all tests green.

---

## Roadmap hierarchy

| Level | Name | What it is | Example |
|-------|------|-----------|---------|
| **CV** | Community Value | A stage of delivery with clear user value | CV0 — Foundation |
| **E** | Epic | A cohesive block of work with done criteria | CV0.E1 — Tracer Bullet |
| **S** | Story | An atomic delivery from the user's perspective | CV0.E1.S1 — The mirror has my real voice |

Each level has a folder under `docs/project/roadmap/` with an `index.md` for navigation. Stories have their own folder; the set of docs inside depends on the weight of the change (see step 4 of the story lifecycle).

---

## Story lifecycle

### 1. Plan

For non-trivial stories, enter plan mode. Explore the codebase, design the approach, document it. The plan goes to the story's `plan.md`. Get alignment before writing code.

**Narrative impact.** When the story changes a user-facing surface, the plan should name which member(s) of the [Product Use Narrative family](../product-use-narrative/) the change affects, and what the change looks like in their use of the product (a new journey state, a new conversation kind, a new affordance on an existing org page). If no family member exercises the surface cleanly, that gap is itself worth surfacing in the plan — the family may need extending, or the feature may not have a clear user. See [Uses → Design probes](../product-use-narrative/uses.md#1-design-probes).

### 2. Implement

Write code following the plan. Commit in logical chunks. Each commit leaves tests passing.

**Commit cadence — auto-commit per round.** Every completed round of changes ships as a commit without waiting for explicit instruction: end of a phase, end of a story, a passing test suite after a focused edit pass. The commit is the natural punctuation of a round; accumulating unstaged work costs more than it saves (harder review, lost attribution, risk of mixing concerns in the next commit). Push remains explicit — see step 7. Commits happen automatically; pushes happen when the user asks.

**What counts as a "round":**
- A development phase finishing green (schema + helpers; reception wiring; a surface page).
- A coherent docs update (concept doc + its references).
- A focused refactor with tests still passing.

**When to split one round into multiple commits:** when the round mixes concerns (docs + code, or two independent code areas). Split for reviewability — each commit should read as one idea.

### 3. Test

Run automated tests (`npm test`). Do manual verification following the test guide. The user confirms "it works" before marking as done.

### 4. Document

Every story must have docs before it's marked done. Minimum is always
`index.md`. The rest is conditional on the weight of the change:

- `index.md` — **always**. Overview: problem, fix, status, and either
  links to the other docs (when they exist) or the commit SHAs
  (self-contained mode).
- `plan.md` — **when there's design worth recording**. Alternatives
  considered, schema changes, trade-offs, "why not the obvious
  approach". Skip for fixes where the "why" fits in one paragraph of
  `index.md`.
- `test-guide.md` — **when a human validator needs steps**. Manual
  browser walkthroughs, cross-device setups, specific data to seed.
  Skip when the tests added in the commit already describe the
  expected behavior (the tests are the guide).
- `refactoring.md` — produced by the review pass (step 5), when the
  review actually produces commits or parks items. No review, no file.

**Concept docs are living references.** When a story changes the territory of a
concept doc under `docs/product/`, update the doc as part of close-out — not as
a follow-up. The most volatile right now:

- [`product/prompt-composition/`](../product/prompt-composition/index.md) —
  must be updated by any story touching reception, identity composition, or
  the expression pass. Update `index.md` (rules, tables, caveats) and
  regenerate the example prompts when composition order or layer set changes.
  The worklog entry should link the section that moved.
- [`product/journey-map.md`](../product/journey-map.md),
  [`product/memory-map.md`](../product/memory-map.md),
  [`product/memory-taxonomy.md`](../product/memory-taxonomy.md) — same rule
  when a story changes their territory.

Drift in concept docs is silent and expensive: future stories build on stale
mental models. Treat the update as part of "done", not as documentation debt.

Two flavors of entry in `improvements/`:

**Deliberate** — design before code. Plan + test guide, multiple
rounds, schema or architectural change. Examples:
`sidebar-ordering-and-visibility`, `generated-summary-by-lite-model`.

**Refinement** — friction discovered while using the system, fix is
obvious, commit is small. Single `index.md` with Problem / Fix /
Commit SHA / Tests added. Examples:
`regenerate-summary-feedback`, `save-triggers-summary-regen`.

The pattern is: match the weight of the docs to the weight of the
change. An improvement is not defined by the ceremony around it — it
is defined by the fact that something got better. A two-paragraph
index is a valid improvement entry when the fix is obvious; a
three-file folder is warranted only when the reader would otherwise
lose context.

Update the epic's index (stories table) when a story belongs to an
epic, `docs/index.md` when a new concept document is introduced, and
the roadmap with links.

### 5. Review pass

Before the story is marked done, walk the produced artifacts end to end — not as a checklist, as a reading. A review pass surfaces drift (docs that no longer match the code), dead code, duplication, and naming or scope inconsistencies that got past the implementer.

Optional for tiny stories. Strongly recommended when the story produced multiple docs + code changes across several files — the review pays for itself by catching issues that the implementer is blind to after a long session.

**Review order — follow dependency, not file-system order:**

1. **Concept** — `decisions.md` entries produced by this story. Are the decisions clearly written? Do they overstate or understate scope? Is any "Why" missing?
2. **Transversal docs** — any conceptual documents the story created or touched (e.g., a taxonomy, a glossary, a principle). If downstream docs cite these, they must be accurate *before* the downstream check.
3. **Epic + roadmap integration** — does the new scope fit cleanly into the epic's index and the roadmap? Are paths, descriptions, and ordering consistent?
4. **Story docs** — `index.md`, `plan.md`, `test-guide.md`. Most important: does `plan.md` reflect what was actually built? Pre-implementation sketches and hypothetical file paths must be reconciled with reality.
5. **Server code** — helpers first, handlers second. Flag duplication with existing helpers, unused branches, unclear naming.
6. **Adapter / UI code** — component, integration (routes), client-side JS, styles. Watch for duplication between server-rendered and client-updated views.
7. **Tests** — do they cover the happy path *and* the edge cases the plan named? Do test file names match the conventions of the codebase?

**Review rhythm — one step at a time, approve before moving on:**

For each step:
1. Read the artifact (or its diff).
2. Surface *specific* observations — "X is wrong because Y" — with proposed fixes.
3. Separate **applied** changes from **parked** ones. Every parked item gets a revisit criterion ("when Z happens, come back").
4. Apply the approved fixes in one small commit per step (or one coherent batch).
5. Run tests after each batch. Never ship a review step on red.

**Output:** the review produces two visible things:
- Small commits with English messages describing *why* each change landed.
- A `refactoring.md` in the story folder, structured as two lists: **Applied** (with commit hashes and rationale) and **Evaluated but not done** (with revisit criteria). This is what prevents refactoring from being either busywork or accumulated debt.

**Three heuristics for the review:**
- **Rule of three for abstraction.** Tolerate two duplicated lines; extract on the third occurrence. Premature abstraction freezes the wrong boundary.
- **Deleted lines are a win.** If a review step only adds code, suspect that it was a review of the wrong thing.
- **Don't touch out-of-scope code.** If a review surfaces cleanup that belongs to another story, register it as a task and leave it alone for now. Mixing reviews blurs responsibility and inflates risk.

### 6. Status update

When the review pass completes and the user confirms it works:
- Mark the story ✅ in the roadmap
- Update the epic status
- Update the worklog
- **Extend the narrative if the story changed a user-facing surface** — add a new conversation, a new journey, a journey-situation update, or a profile note for whichever family member was named in the plan's narrative impact. Even one short conversation is enough; the goal is keeping the family coherent with what the product can now do. Run `npm run admin -- narrative load` after editing to refresh the dev DB. See [Uses → Maintenance contract](../product-use-narrative/uses.md#maintenance-contract).
- This happens before push, not after

### 7. Push

Once the story is truly done — review pass closed, status docs updated, tests green, user confirmed — push `main` to `origin`. One story = one push event, even when it contains several commits. Origin becomes an always-current backup of shipped work, and the push itself becomes the natural session-closing ritual.

**Why per-story, not per-commit:** review passes produce several commits that make sense together. Shipping them in one push preserves the story as the unit of narrative.

**Why per-story, not per-release:** releases can bundle three to five stories across weeks. Waiting to push leaves completed work unbacked, trading a real cost (no remote mirror of shipped work) for a symbolic gain (tidier push history). Release is a separate operation — tag, CHANGELOG, release notes — that curates commits already on origin.

**Backlog- and doc-only commits.** Updates that only shape the roadmap, decisions, or radar — no code, no tests — ride along with the next story's push. They don't earn a push on their own: a roadmap entry alone doesn't ship user value, and accumulating them costs nothing until the next story lands.

**Escape valve for long stories.** If a story stretches across multiple sessions and you want a remote backup mid-flight, push a WIP branch (e.g., `wip/s11-whatever`) to origin. Rebase or squash into `main` when the story closes. This is a valve, not the default — if the valve gets used often, the stories are probably too big.

---

## Release process

### Versioning

Semantic versioning. Each minor version maps to an epic or cohesive block of value:
- `v0.1.0` — CV0.E1 (Tracer Bullet)
- `v0.2.0` — CV1.E1 (Personas)
- `v0.3.0` — CV1.E2 (Adapter Awareness)
- `v0.4.0` — CV0.E2 (Web Experience)

Patches (`v0.3.1`, `v0.3.2`) for polish and fixes within a series.

### Artifacts

- **CHANGELOG.md** — technical, factual, per version. Includes upgrade notes.
- **Release notes** (`docs/releases/vX.Y.Z.md`) — narrative storytelling. TL;DR at top, "Where we were / What we did / What comes next" structure. Headline that captures the essence.
- **Git tag** — `vX.Y.Z` on the release commit.

### Steps

1. Mark stories as done in roadmap
2. Create CHANGELOG entry with upgrade notes
3. Write release notes (TL;DR + narrative + upgrading)
4. Bump version in `package.json`
5. Commit: "Release vX.Y.Z — Headline"
6. Tag: `git tag vX.Y.Z`
7. Push the release commit and the tag. Story commits bundled in this release are already on origin (per the per-story push rule); this push only ships the release commit and the tag.

### Upgrade notes

Each release has cumulative upgrade notes:
- "From any previous version" — base steps (pull, install, restart)
- "Additional steps if upgrading from vX" — grouped by which version you're coming from

Someone jumping from v0.1.0 to v0.4.0 sees all the steps they need.

---

## Local development environment

Dev runs as a background process, not in a manual terminal. Scripts in `scripts/` manage its lifecycle so a dev session has a single source of truth for "is the server up?" and so any task that needs a restart (DB swap, env change, dep upgrade) can request one without forcing a context switch to a terminal.

### Entrypoint: `./mirror.sh`

`mirror.sh` at the repo root is the facade. Run it with no arguments for an interactive menu, or pass a command directly:

```
./mirror.sh deploy        # push local commits and deploy to prod
./mirror.sh start         # start dev server in background
./mirror.sh stop          # stop dev server
./mirror.sh restart       # stop + start
./mirror.sh status        # PID + responding?
./mirror.sh pull-prod-db  # replace local dev DB with prod snapshot
./mirror.sh logs          # tail data/dev-server.log
```

The facade dispatches to scripts under `scripts/`. Those scripts are still callable directly when needed — they're the implementation, the facade is the interface.

### Underlying scripts

- `scripts/deploy.sh` — push local commits, then SSH into the VPS for `git pull && npm ci`, install the systemd unit, and restart `mirror-server`. Gitignored (the host/path are environment-specific).
- `scripts/dev-start.sh` — start `npm run dev` in background. Writes PID to `data/dev-server.pid`, logs to `data/dev-server.log`. Idempotent: returns OK if already running. Aborts if port is held by another process.
- `scripts/dev-stop.sh` — stop the background server, kill orphans on the port, clear PID file.
- `scripts/dev-restart.sh` — stop + start.
- `scripts/dev-status.sh` — running? PID? Responding on port?
- `scripts/pull-prod-db.sh` — snapshot prod DB over SSH and replace the local dev DB. Stops the dev server, backs up the current dev DB to `data/mirror.db.bak-pre-prod-pull-<ts>`, replaces, restarts. Honors `MIRROR_VPS` env var if VPS host changes.

The PID file and log live in `data/`, which is already gitignored.

### When the server needs a manual restart

`tsx watch` already restarts on TypeScript changes, so most code edits need nothing. A manual `./mirror.sh restart` is required when:

- `.env` changed (env vars are read at boot)
- `package.json`/dependencies changed (`npm install` doesn't notify the running server)
- The local DB was replaced (e.g. `pull-prod-db`, manual restore from backup) — `better-sqlite3` holds an open handle and stale WAL/SHM files corrupt the new DB if the server keeps writing
- A boot-time script changed (migrations, seed, identity loader)

### Convention for the builder mode

After any change in the list above, run `./mirror.sh restart` and report status. Do not leave the user to remember the restart — the moment the change lands, the facade runs.

---

## Git conventions

- **Commits in English** — descriptive, focused on "why" not just "what". Mirror Mind's internal language is English (decision D7).
- **Auto-commit per round** — every finished round of changes commits automatically, without waiting for explicit instruction. See [Story lifecycle step 2](#2-implement) for what counts as a round and when to split. Accumulating unstaged work is friction; commits are the natural punctuation.
- **Push at story completion, user-triggered** — not per-commit, not per-release, and never automatic. The user pushes. See [Story lifecycle step 7](#7-push) for cadence, the backlog-only exception, and the WIP-branch escape valve. The user still confirms "it works" before status update and push; this rule is about *when*, not *whether*.
- **No force push** — create new commits rather than rewriting history.
- **No amending published commits** — amend only before push.

---

## Documentation structure

```
docs/
├── index.md                  ← main entry point with full navigation
├── getting-started.md        ← zero-to-running guide
├── project/
│   ├── briefing.md           ← architectural decisions (D1–D8)
│   ├── decisions.md          ← incremental decisions + open discussions
│   └── roadmap/
│       ├── index.md          ← the roadmap
│       ├── cv0-foundation/
│       │   ├── index.md      ← CV nav
│       │   ├── cv0-e1-tracer-bullet/
│       │   │   ├── index.md  ← epic design + stories table
│       │   │   └── cv0-e1-s1-db-identity/
│       │   │       ├── index.md
│       │   │       ├── plan.md
│       │   │       ├── test-guide.md
│       │   │       └── refactoring.md
│       │   └── ...
│       └── cv1-depth/
│           └── ...
├── product/
│   ├── principles.md         ← product, code, testing, process guidelines
│   ├── admin-cli.md          ← admin CLI reference
│   └── prompt-composition/   ← how prompts are built + examples
├── process/
│   ├── development-guide.md  ← this document
│   ├── worklog.md            ← what was done, what's next
│   └── spikes/               ← technical investigations
└── releases/                 ← narrative release notes (v0.1.0, v0.2.0, ...)
```

Every folder with subfolders has an `index.md` for navigation. Folder and file names follow the roadmap codes: `cv0-e1-s1-db-identity`.

---

## Personas in development

When the work involves product decisions, UX, or identity, we activate personas from the mirror:

- **Product-designer** — UX analysis, layout decisions, visual identity
- **Escritora** — prompt writing, identity text, editorial voice

The persona is activated via the mirror's skill system, loaded with the relevant context, and the response follows the persona's depth while maintaining the mirror's voice.

---

## The narrative as a design instrument

The [Product Use Narrative](../product-use-narrative/) — four fictional users (Dan, Elena, Eli, Nora) authored as a family — is not just demo data. It is part of the development process: the lens we route design discussions, test scenarios, and demos through.

Three uses, one maintenance contract:

- **Design probes.** Walk every non-trivial design through the family. "How does Elena experience this? Would Dan use it on Saturday morning, in the shop? Would Eli need it on Telegram and Elena on web?" The questions force specificity. Vague feature ideas become concrete user moments — or expose that they don't have one.
- **Evals.** The 20 sample conversations across the four characters function as informal ground truth for prompt changes. After tweaking `ego/behavior`, `ego/expression`, or a persona, replay one or two of the canonical user messages through the new prompt and read the new output next to the canned reply. Did it degrade? Improve? Drift? Specific behavioral checks (Dan's son persona must name avoidance without fixing it, Nora's runner persona must push back against injury rationalization, etc.) live in the conversations themselves.
- **Demos and communication.** Pick a family member when demoing the product — "let me log in as Elena and show you her workshop" — instead of clicking through generic data. Use vignettes from the family for landing pages, blog posts, and onboarding without exposing your own life. The narrative ships as docs.

**Maintenance is the load-bearing piece.** The narrative goes stale fast if it is not extended alongside the product. The rule, integrated into the story lifecycle:

- Story step 1 (plan): name which family member exercises the new surface.
- Story step 6 (status update): add the corresponding narrative artifact before marking done.

A story that ships a new feature without extending the narrative leaves a museum behind. A story that extends the narrative ships a built-in demonstration along with the code.

The full handbook — when to use which probe, how to extend the family, what the narrative is *not* — lives in [Product Use Narrative → Uses](../product-use-narrative/uses.md).

---

## What we learned

### The process self-documents

If someone opens the repo tomorrow, they can reconstruct the entire history from the docs alone — without reading git log, without asking anyone. The roadmap shows what was planned. The stories show what was built. The decisions show why. The release notes tell the story.

### Conversation is design review

Nothing ships without being questioned. Templates inline? Move to files. Identity in one column? Split to layers. Milestone/Epic naming? Rename to Epic/Story. The first proposal is never the final one — and that's the point.

### Stories must be small enough to validate

The tracer bullet (v0.1.0) was 6 stories in one day. Each ended with a concrete proof: a curl response, a message on Telegram, a chat in the browser. "It works" is the only done criteria that matters.

### Docs are part of the deliverable

A story without docs is not done. This was a lesson learned mid-session — stories were being committed without plans and test guides. Now it's a rule: docs are created alongside the code, not after.

### Refactoring is not debt management

Refactoring happens in the same cycle as implementation. After the code works, ask: does this bother me? If yes, refactor now. If no, document why not (with criteria for revisiting). Don't accumulate, don't over-engineer.

### The review pass catches what the implementer can't see

After a long implementation session, the implementer is blind to their own drift: docs that describe an earlier plan, dead helpers left after refactors, naming collisions that looked fine when they were written. The review pass — a systematic walk through the artifacts in dependency order with the user — surfaces these cheaply. The cost is an hour; the savings are the PR comments, stale docs, and "why did we name it this?" questions that don't happen later.

The key mechanic is *separation of applied and parked*. Every observation either lands as a small commit, or it goes into `refactoring.md` with a revisit criterion. Nothing floats. Nothing gets forgotten. Nothing gets abstracted prematurely.

### The mirror assists its own construction

Product decisions (sidebar vs top nav, unified profile, chat visual identity) were made with the product-designer persona. Identity text (soul, ego, behavior prompts) was refined with the escritora. The mirror helps build itself — not as a gimmick, but because the personas carry genuine domain depth.

### Push cadence is a backup decision, not a release decision

After the early "push only when asked" rule, completed stories started piling up locally without a remote mirror. The backup gap was real — a laptop failure would have lost review-pass work — while the supposed benefit (tidy remote history) was symbolic. Making push-at-story-completion the default rule removed the ambiguity: the story's last act is a push, the same way it's a commit. Release stopped being a push event at all and became a tag event, which is what it always should have been.
