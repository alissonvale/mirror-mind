[< Docs](../index.md)

# Product Use Narrative

A narrative account of how Mirror Mind is used in practice, told through four fictional users — a family of four whose independent uses of the mirror span the product's surface area. It is simultaneously a story, a fixture set, and a design instrument. Three purposes at once:

1. **Development data.** Realistic, coherent user states for building and testing features that depend on multi-user scenarios, identity depth, organizations, journeys, and accumulated conversation history.

2. **Demo material.** Four characters whose situations and uses of the mirror can be walked through in presentations, onboarding, or written documentation without leaking real user data.

3. **Design pressure.** Authoring complete characters forces the product model to hold. If a persona has nowhere to live, if a journey doesn't fit the schema, if the narrative needs something the database can't express — we've found a gap.

> **How to actually use this narrative in day-to-day work** — design probes, evals, demos, and the maintenance contract that keeps it alive — is in [Uses](uses.md). Read it before extending or relying on the family in a story.

## The family

The four members are **independent, parallel tenants** on the same Mirror Mind server. They are narratively related but share no data: no shared organizations, no shared journeys, no cross-user conversations. Each has their own identity, organizations, journeys, personas, and sample conversations. Characters may reference each other by first name inside their own content (as anyone would in their own mirror), but the mirrors themselves are isolated tenants.

The server itself is the father's doing. Dan is a career IT infrastructure engineer and a homelabber; he discovered Mirror Mind, provisioned a small VPS, stood up the server, and added the other three as users. The family shares a host. They don't share a mirror.

| Role | Character | Status |
|---|---|---|
| Father (admin / host) | [Dan Reilly](users/dan-reilly/) | ✅ Complete |
| Mother | [Elena Marchetti](users/elena-marchetti/) | ✅ Complete |
| Son | [Eli Reilly](users/eli-reilly/) | ✅ Complete |
| Daughter | [Nora Reilly](users/nora-reilly/) | ✅ Complete |

## Second cut — non-American tenant

The Reilly–Marchetti family covers an American suburban frame deliberately. [Uses § What the narrative is not](uses.md#what-the-narrative-is-not) anticipated a "second cut" — different class background, different cultural register, non-American — and CV2.E1.S5 lands the first one.

| Role | Character | Status |
|---|---|---|
| Brazilian creator/educator (independent tenant, not part of the Reilly family) | [Antonio Castro](users/antonio-castro/) | ✅ Complete |

Antonio's tenant is in **Brazilian Portuguese**. The loader sets `users.locale = 'pt-BR'` for him via the `locale: pt-BR` frontmatter on his `profile.md`. He exercises a different cross-section of the product than the Reilly family: pt-BR chrome top to bottom, public-creator-with-burnout-history register, three-Antonios-across-three-generations name lineage.

## Structure

Each user lives under `users/<slug>/`. The layout mirrors the actual schema: each file under `identity/` maps one-to-one to a row in the `identity(layer, key, content)` table, and each file under `organizations/` / `journeys/` becomes one row in its table.

```
users/<slug>/
  profile.md                — narrative bio (author reference; not loaded into the DB)
  index.md                  — hub linking every other file for this user
  identity/
    self/
      soul.md               — layer=self, key=soul
    ego/
      identity.md           — layer=ego, key=identity
      behavior.md           — layer=ego, key=behavior
      expression.md         — layer=ego, key=expression
    persona/
      <key>.md              — layer=persona, one file per persona
  organizations/
    <key>.md                — name (# heading), **Status:**, ## Briefing, ## Situation, [## Summary]
  journeys/
    <key>.md                — same shape as organizations, plus optional **Organization:** <key>
  conversations/
    <NN>-<slug>.md          — canonical conversation format with frontmatter
                              ( title, persona, organizations[], journeys[] )
```

### Loader contract

**Identity files.** Walk `identity/<layer>/<key>.md`. Read the file. Upsert `(user_id, layer, key, content)`. The path encodes layer and key; the body is the content as stored. The loader consumes **from the first `# ` heading onward** — any lines above (breadcrumb links, navigation chrome) are ignored, so the same files work as both rendered docs and DB rows.

Mirror Mind today uses `self/soul`, `ego/{identity, behavior, expression}`, and one `persona/<key>` per domain. There is no `user` layer in active use; biographical context lives in `profile.md` as an author reference.

**Organization and journey files.** Walk each `<key>.md`. Filename (without extension) is the `key`. The first `# ` heading is the `name`. Metadata lines (`**Status:** <status>`, `**Organization:** <org-key>` for journeys) are parsed next. Sections `## Briefing`, `## Situation`, and optional `## Summary` become their respective columns.

**Conversation files.** Standard mirror-mind import format (see [Conversation Markdown Format](../product/conversation-markdown-format.md)). Frontmatter extended with optional `persona`, `organizations`, and `journeys` fields (singular or array), used to tag the created session.

## The loader

Implemented as `npm run admin -- narrative load` in the mirror-mind admin CLI. Reads this tree and provisions the four users into the database — idempotent by design, safe to run against a live dev database.

```bash
# Default: backup DB, upsert users/identity/orgs/journeys, import conversations
npm run admin -- narrative load

# Skip the backup (if you're iterating)
npm run admin -- narrative load --no-backup

# Clear and re-import every conversation for the narrative users
npm run admin -- narrative load --reset-conversations

# Regenerate bearer tokens for all four users
npm run admin -- narrative load --reset-tokens

# Show the current tokens recorded at first load
npm run admin -- narrative tokens
```

**Idempotency:**

- **Users:** created on first run with generated bearer tokens. On re-runs they are kept (same ID, same token). Roles are reconciled with the loader's `ADMIN_SLUGS` set on every run — `dan-reilly` is admin (he's the narrative host), the other three are regular users.
- **Identity / organizations / journeys:** upsert on `(user_id, layer, key)` or `(user_id, key)`. Re-running updates the content in place without duplicating rows.
- **Conversations:** creating a session with the same title for the same user is treated as already-imported and skipped. Pass `--reset-conversations` to wipe and re-import.
- **Alisson Vale and other real users are never touched.** The loader operates only on the `users/<slug>/` tree in this directory.
- **Backup:** every run (unless `--no-backup`) writes a timestamped copy of the SQLite file to `data/mirror.db.bak-narrative-<timestamp>`.

**Tokens** are generated once at first creation and stored in `docs/product-use-narrative/.tokens.local` (gitignored). That file is the only place the plaintext token is persisted — the DB stores only the SHA-256 hash. If the file is lost, run with `--reset-tokens` to generate new ones. View the current tokens with `npm run admin -- narrative tokens`.

## Rules for authoring

- All content in English. The narrative is fiction and does not need to match the repo's primary user.
- No real identifying data — names, companies, locations are invented.
- No shared DB rows across characters (no cross-user orgs, journeys, or conversation sessions). Characters may mention each other by first name in their own content; the DB tenants stay isolated.
- Each conversation file uses the canonical conversation format (`**User:**` / `**Assistant:**` alternation, starting with user).
- Every file starts with a breadcrumb link above the first `# ` heading so the docs stay navigable. The loader ignores everything above that heading, so this doesn't pollute what lands in the DB.
