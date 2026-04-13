[< Docs](../index.md)

# Decisions

Incremental decisions made during construction. For foundational architectural decisions (D1–D8), see the [Briefing](briefing.md).

---

### 2026-04-13 — Identity as layers, not a single column

The `users` table doesn't store identity. A separate `identity` table stores layers (`user_id`, `layer`, `key`, `content`). System prompt composed at runtime by joining layers.

**Why:** preserves the structured model from the POC (self/soul, ego/identity, ego/behavior). Each layer editable independently. Migration is layer-by-layer. Future layers (personas, knowledge, journeys) follow the same pattern.

**Supersedes:** briefing D5 originally described identity as a single TEXT column in `users`.

---

### 2026-04-13 — Docs organized by roadmap hierarchy

Docs for epics and stories follow the roadmap structure: `docs/cv0-e1/` for the epic, `docs/cv0-e1/s1-db-identity/` for stories within it. Each level contains its own docs (design, plan, test guide). Transversal docs (principles, admin CLI reference) stay in `docs/design/`.

**Why:** the folder structure mirrors the roadmap codes. Finding docs for a given story is navigating a path, not searching filenames.

---

### 2026-04-13 — POC Mirror as migration source, not just reference

The admin CLI includes `identity import --from-poc` to read layers directly from `~/.espelho/memoria.db`. New users get starter templates via `user add`.

**Why:** two onboarding paths from day one — migration for existing users, templates for new ones. Reduces friction for both.

---

### 2026-04-13 — Self-construction layer isolated from core

The mirror will be able to program itself (create tools, tables, logic) to serve each user's specific needs. This generated layer is strictly sandboxed — it cannot touch the core (identity, auth, sessions, agent runtime).

**Why:** the mirror needs to be genuinely useful for diverse needs (inventory, finances, social media) without becoming a monolith. Isolation protects stability while enabling unlimited per-user growth.

---

### 2026-04-13 — Roadmap hierarchy: CV → Epic → Story

Renamed the roadmap levels: Milestone (M) → Epic (E), Epic (E) → Story (S). CV remains. An epic is a cohesive block of work with done criteria. A story is an atomic delivery from the user's perspective. Folder structure follows: `docs/cv0-e1/s1-db-identity/`.

**Why:** the old Milestone/Epic naming was inconsistent — sometimes milestones existed, sometimes not. Epic/Story aligns better with what each level actually represents.
