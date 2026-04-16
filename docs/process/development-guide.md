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

Each level has a folder under `docs/project/roadmap/` with an `index.md` for navigation. Stories have their own folder with plan, test guide, and optionally refactoring docs.

---

## Story lifecycle

### 1. Plan

For non-trivial stories, enter plan mode. Explore the codebase, design the approach, document it. The plan goes to the story's `plan.md`. Get alignment before writing code.

### 2. Implement

Write code following the plan. Commit in logical chunks. Each commit leaves tests passing.

### 3. Test

Run automated tests (`npm test`). Do manual verification following the test guide. The user confirms "it works" before marking as done.

### 4. Document

Every story must have docs before it's marked done:
- `index.md` — overview with links to plan and test guide
- `plan.md` — what was built and why
- `test-guide.md` — how to verify (automated + manual)
- `refactoring.md` — if applicable

Update the epic's index (stories table), `docs/index.md`, and the roadmap with links.

### 5. Status update

When the user confirms it works:
- Mark the story ✅ in the roadmap
- Update the epic status
- Update the worklog
- This happens before push, not after

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
7. Push commits + tags (only when asked)

### Upgrade notes

Each release has cumulative upgrade notes:
- "From any previous version" — base steps (pull, install, restart)
- "Additional steps if upgrading from vX" — grouped by which version you're coming from

Someone jumping from v0.1.0 to v0.4.0 sees all the steps they need.

---

## Git conventions

- **Commits in English** — descriptive, focused on "why" not just "what". Mirror Mind's internal language is English (decision D7).
- **Push only when asked** — never auto-push. The user controls when code goes to the remote.
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

### The mirror assists its own construction

Product decisions (sidebar vs top nav, unified profile, chat visual identity) were made with the product-designer persona. Identity text (soul, ego, behavior prompts) was refined with the escritora. The mirror helps build itself — not as a gimmick, but because the personas carry genuine domain depth.
