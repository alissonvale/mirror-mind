[< Story](index.md)

# Plan: CV0.E3.S9 — Import conversation history from markdown

**Roadmap:** [CV0.E3.S9](index.md)
**Framing:** the mirror replaces other AI tools (Gemini, ChatGPT, Claude) for users who already accumulated months of conversation context elsewhere. Without an import path, every new user starts cold and trades depth for migration cost. A small admin CLI command + a documented markdown format closes that gap without polluting the mirror with per-source adapters.

---

## Goal

A new admin command that reads a directory of markdown files, creates one session per file, populates entries from alternating `**User:**` / `**Assistant:**` blocks, and tags each session with the supplied persona (and optional organization / journey).

```bash
npx tsx server/admin.ts conversation import <user> \
  --dir <path> \
  --persona <key> \
  [--organization <key>] \
  [--journey <key>] \
  [--dry-run]
```

**Validation criterion:** the 27 markdown files in `~/Code/szen_mind/conversas/zenith-estrategia-gpt-4o/` (after a one-line `sed` to normalize `**Zenith:**` → `**Assistant:**` and `topico:` → `title:`) import cleanly into the production mirror as 27 new sessions tagged `estrategista` + `software-zen`, visible at `/organizations/software-zen` with verbatim content.

## Non-goals (v1)

- **Web UI for import.** CLI only. Promotion to `/admin/imports` is a future story if friction proves itself.
- **Per-file persona / org / journey overrides.** One persona per invocation; batch with multiple invocations or a shell loop. A YAML-based mapping file is over-design for the first user (you).
- **Source provenance metadata on the session.** A `source: gemini-zenith` badge on imported sessions is desirable but adds an additive migration; deferred until the absence is felt. Frontmatter `source:` is parsed and ignored in v1.
- **Tolerance for non-canonical labels.** No `--assistant-label` or `--title-key` flags. The format is strict; non-conforming sources normalize before import.
- **Compaction at import time.** Sessions are imported verbatim. If a long imported session causes context overflow at first use, that's the dor that earns CV1.E3.S2 (compaction) its concrete first user.
- **Updating or merging existing sessions.** The importer only creates. Re-running on the same directory creates duplicate sessions.

## Decisions

### D1 — Strict canonical markdown format

One format, documented at `docs/product/conversation-markdown-format.md`. Frontmatter `title:` (optional, falls back to filename), body alternating `**User:**` / `**Assistant:**` blocks. No flexibility flags in the importer.

Rationale: flexibility flags pollute a generic tool with one user's choices and inflate the doc with caveats. Normalizing source-specific output (e.g., szen_mind's `**Zenith:**` → `**Assistant:**`) is a one-line `sed` in the user's shell, lives in the user's domain, doesn't burden the mirror.

### D2 — One markdown file = one session

Each `.md` in the target directory becomes a separate session. Filename is used as session title if frontmatter `title:` is missing. Files are processed in alphabetical order (deterministic; matches typical `01-`, `02-`, ... numbering).

### D3 — Tags via flags, all must pre-exist

`--persona` is required. `--organization` and `--journey` are optional. Each must resolve to an existing key for the user; missing → fail with clear error before any write.

This avoids "side-effect creation" of personas/orgs/journeys during import — the admin creates those deliberately first, then imports.

### D4 — Session timestamps from import time, entries with monotonic increments

The original Gemini JSON carries no timestamps. Solution:

- `session.created_at = importStartedAt` (the moment `import` was invoked)
- Entry timestamps: `importStartedAt + index` milliseconds (so order survives `ORDER BY timestamp`, and same-second collisions can't reorder a session)

Across files in a single import run, sessions get distinct `created_at` values via `Math.max(now, lastCreatedAt + 1)` — same pattern `createFreshSession` already uses.

### D5 — `--dry-run` is first-class

Without `--dry-run`, the importer writes. With `--dry-run`, it parses, validates (persona/org/journey resolve, format is canonical, entry counts add up), prints a report (filename → would-create-N-entries → tagged-with-X), and exits without writing.

`--dry-run` is the safety pattern — admin always runs it first in production, reviews, then runs for real.

### D6 — All-or-nothing per file

Each file's import wraps in a `db.transaction`. If any entry parse or write fails inside a file, that whole session rolls back and the importer continues with the next file (logging the failure). One bad file doesn't poison the rest.

### D7 — Fail-stop on missing user / persona / org / journey

Invalid invocations fail before any write. Clear error to stderr, exit 1. The `--dry-run` catches all of this in test mode.

## Markdown format (summary, full spec at `docs/product/conversation-markdown-format.md`)

```markdown
---
title: "string — optional, becomes session title (falls back to filename)"
source: "string — optional, ignored in v1"
---

**User:**
[plain markdown]

**Assistant:**
[plain markdown]

**User:**
...
```

Rules:
- Frontmatter is optional. If absent, the file body starts at line 1.
- Body must alternate `**User:**` and `**Assistant:**` headings, starting with `**User:**`. Each heading on its own line.
- Content between headings is preserved verbatim (multi-paragraph, lists, code, anything).
- Trailing whitespace around blocks is trimmed.
- A file with zero blocks is skipped with a warning, not an error.

## Steps

### Phase 1 — DB helpers

`server/db/entries.ts`:
- Extend `appendEntry` to accept an optional `timestamp` parameter (defaults to `Date.now()` for backward compatibility). Single change, no migration.

`server/db/sessions.ts`:
- New `createSessionAt(db, userId, title, createdAt)` — explicit timestamp variant of session creation, used only by the importer. Title supported because the importer wants to set it at create time.

Tests in `tests/db.test.ts` for the new behavior (in-memory SQLite).

### Phase 2 — Markdown parser

`server/import/markdown-conversation.ts` (new):
- `parseConversationMarkdown(text: string): { title?: string; source?: string; messages: Array<{role: 'user' | 'assistant'; content: string}> }`
- Uses `gray-matter` (already in deps) for frontmatter.
- Body parsing: regex split on `^\*\*(User|Assistant):\*\*$` lines; alternation enforced; throws on misordered headings.
- No DB dependency. Pure parser, easy to unit-test.

Unit tests with three fixtures: canonical example, missing frontmatter, alternation violation.

### Phase 3 — Importer

`server/import/conversation-importer.ts` (new):
- `importConversationDir(db, opts)` orchestrates:
  - Resolve user / persona / organization / journey by key (fail-stop if any missing)
  - List `*.md` files in `opts.dir`, sort
  - For each: parse → in transaction → `createSessionAt` → loop `appendEntry` with monotonic timestamps → tag via existing `addSessionPersona` / `addSessionOrganization` / `addSessionJourney`
- Returns a structured result: `{ sessionsCreated, entriesCreated, files: [{path, title, entryCount, status}] }`
- Dry-run mode: same code path, but `db.transaction` wraps a no-op writer so all validation runs without persisting.

Unit tests with a small fixture directory and `:memory:` SQLite.

### Phase 4 — Admin CLI command

`server/admin.ts`:
- New group `conversation`, action `import`. Dispatcher in `main()`. Update `usage()` text.
- Handler: parse flags via existing `parseFlag`, resolve `--dry-run` boolean presence, call `importConversationDir`, print human-readable report.

Smoke test in `tests/smoke.test.ts` invoking the CLI as subprocess against a tmp DB and a tmp markdown directory.

### Phase 5 — Format spec doc

`docs/product/conversation-markdown-format.md` (new): full canonical format specification. Linked from the story index, the plan, and the docs index. Public artifact for anyone writing a converter.

### Phase 6 — Close-out

- `docs/process/worklog.md` entry
- Mark S9 ✅ in epic `index.md` and roadmap `index.md`
- Run the full test suite, confirm passing
- Production rollout (see below)

## Production rollout

Per the dev process — ship to prod after local validation:

```bash
# 0. Backup
ssh vps 'cp /opt/mirror/data/mirror.db \
  /opt/mirror/data/mirror.db.bak-$(date +%Y%m%d-%H%M%S)'

# 1. Deploy
ssh vps 'cd /opt/mirror && git pull && npm install && systemctl restart mirror-server'

# 2. Sync the (normalized) markdowns
sed 's/\*\*Zenith:\*\*/**Assistant:**/g; s/^topico:/title:/' \
  ~/Code/szen_mind/conversas/zenith-estrategia-gpt-4o/*.md \
  | rsync ... # (or run sed in-place on a copy first)
rsync -av /tmp/normalized/ vps:/tmp/import-zenith/

# 3. Dry-run
ssh vps 'cd /opt/mirror && npm run admin -- conversation import alisson \
  --dir /tmp/import-zenith \
  --persona estrategista \
  --organization software-zen \
  --dry-run'

# 4. Review report. If ok:
ssh vps 'cd /opt/mirror && npm run admin -- conversation import alisson \
  --dir /tmp/import-zenith \
  --persona estrategista \
  --organization software-zen'

# 5. Validate at /organizations/software-zen in browser

# 6. Cleanup
ssh vps 'rm -rf /tmp/import-zenith'
```

Rollback if needed: `cp data/mirror.db.bak-XXXX data/mirror.db && systemctl restart mirror-server`. The imported sessions disappear with the DB restore.

## Files likely touched

- `server/db/entries.ts` — extend `appendEntry` with optional timestamp
- `server/db/sessions.ts` — new `createSessionAt`
- `server/db.ts` — re-export new helpers
- `server/import/markdown-conversation.ts` — new (parser)
- `server/import/conversation-importer.ts` — new (orchestrator)
- `server/admin.ts` — new command
- `docs/product/conversation-markdown-format.md` — new (canonical format spec)
- `docs/project/roadmap/cv0-foundation/cv0-e3-admin-workspace/index.md` — add S9 row, update radar
- `docs/project/roadmap/index.md` — surface S9 in CV0.E3 listing
- `docs/process/worklog.md` — close-out entry
- `tests/db.test.ts` — coverage for `appendEntry` timestamp + `createSessionAt`
- `tests/import.test.ts` (new) — coverage for parser + importer with `:memory:` SQLite
- `tests/smoke.test.ts` — CLI subprocess smoke test
