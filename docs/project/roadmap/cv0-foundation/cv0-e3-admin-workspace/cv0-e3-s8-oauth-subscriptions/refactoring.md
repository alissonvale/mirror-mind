[< Story](index.md)

# Refactoring — CV0.E3.S8

Captured during and after the five-phase implementation. Two buckets: **applied** (commits that landed) and **parked** (observations left alone, with a criterion for revisiting).

---

## Applied

### Single source of truth for API-key resolution

Five call sites (reception, title, summary × 2, main in web / telegram / server/index) all read `process.env.OPENROUTER_API_KEY` directly before this story. The new `server/model-auth.ts :: resolveApiKey(db, role)` is the single seam every call site now uses. The change is mechanically a search-and-replace, but the result is that any future auth variant (per-user keys, vault integration, etc.) has exactly one place to land.

**Why:** when the eventual Antigravity or OpenAI Codex integration wants a different credential shape, extending the resolver is a one-file edit instead of a six-file grep-and-patch.

### `getOAuthApiKey` as an injectable parameter, not a module-level mock

Initial test drafts tried `vi.spyOn(pi, "getOAuthApiKey")`. Because pi-ai is an ESM package, vitest can't patch the module's frozen exports, and the spy call itself throws. Swapped to the same pattern the codebase already uses for `completeFn` in `reception.ts` — the function is an optional third argument with a real production default. Tests pass a stub; production passes nothing.

**Why:** keeps the test surface honest (no surprise mutation of pi-ai's public exports), consistent with the project's existing testing style.

### OAuth imports from `@mariozechner/pi-ai/oauth`

The pi-ai package exposes OAuth types at the root and the OAuth *functions* at the `/oauth` subpath (per its `exports` map in `package.json`). Initial drafts imported `getOAuthProviders` and `getOAuthApiKey` from the root and hit `TypeError: not a function` at runtime. Corrected in both `server/model-auth.ts` and the admin web adapter.

**Why:** match the package's actual shape; no shims.

---

## Evaluated but not done

### No in-browser OAuth flow in v1

The plan's non-goals section calls this out explicitly. `npx @mariozechner/pi-ai login <provider>` generates the `auth.json` on the operator's laptop; the admin pastes it. Revisit if and when the mirror is offered as a multi-tenant product where individual users each bring their own subscription — the paste pattern doesn't scale past a single-tenant install, but the substrate does.

**Revisit when:** the mirror gains a "bring your own subscription" user flow.

### Antigravity provider not validated

The UI lists `google-antigravity` because the pi-ai registry does, but the story's acceptance path only exercises `google-gemini-cli`. Same plumbing covers both — when someone wants free Gemini 3 / Claude / GPT-OSS via Antigravity, the flow is: `npx @mariozechner/pi-ai login google-antigravity` → paste at `/admin/oauth` → swap `models.provider` → done.

**Revisit when:** demand surfaces, or Antigravity's quota / model catalog becomes noticeably attractive relative to Code Assist.

### `oauth_credentials.credentials` as JSON TEXT, not a structured column set

The blob shape varies by provider — `refresh`, `access`, `expires` are universal; `project_id` is Google-only; GitHub Copilot adds a few more. Rather than a sparse column-per-field schema, the whole object is JSON-serialized into `credentials`. The plan's D1 called this out; the implementation followed through.

**Revisit when:** a query surface needs to filter or index on a specific credential field (unlikely — these are write-rarely, read-often per provider).

### No retry-on-refresh-failure UX beyond the log line

When `getOAuthApiKey` throws, `resolveApiKey` wraps the error as `OAuthResolutionError` and the Agent callback catches it and returns `undefined`. The downstream LLM call then fails in the normal way the Agent handles provider failures. For reception, the existing outer catch swallows it and the mirror falls back to all-nulls — a silent fallback that matches the plan's D5. For main, the user sees a stream error.

An intermediate UX — a flash in the admin dashboard saying *"reception fell back because OAuth refresh failed for google-gemini-cli at 14:22:06"* — is a radar item for CV0.E3.S6 (operational alerts + usage tracking) and doesn't belong in S8. A standalone `/admin/oauth/:provider/test` button that exercises the full resolve path without an LLM call would also be useful; parked as a small follow-up.

**Revisit when:** S6 (usage tracking) lands, or the first real OAuth incident produces a confusing failure and we want self-diagnosis affordances.

### `seedModelsIfEmpty` still reads only from `config/models.json`

The JSON seed doesn't include an `auth_type` field; every seeded row defaults to `env`. This is correct today because the shipped seed points at openrouter. If Google Code Assist ever becomes the shipped default for reception, the seed needs to carry `auth_type: 'oauth'` — the model config helper already accepts it on the `SeedEntry` interface, so the change is just a one-line JSON edit.

**Revisit when:** we want to ship a default OAuth config, or when a new role with a mandatory OAuth provider gets added.
