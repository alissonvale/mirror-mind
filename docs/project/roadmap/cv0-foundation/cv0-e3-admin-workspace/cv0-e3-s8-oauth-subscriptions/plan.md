[< Story](index.md)

# Plan: CV0.E3.S8 — OAuth credentials for subscription-backed providers

**Roadmap:** [CV0.E3.S8](../index.md)
**Derived from:** [Spike 2026-04-21 — Subscription-based LLM access via OAuth](../../../spikes/spike-2026-04-21-subscription-oauth.md)
**Framing:** The spike confirmed pi-ai supports OAuth flows for five subscription-backed providers. This story wires that support into mirror-mind. Concretely: credential storage, admin UI for upload/management, models table gains an `auth_type` axis, and the model-invocation paths resolve keys through OAuth when appropriate. End-to-end validation via the scope-routing eval against Google Code Assist.

---

## Goal

An admin can configure any model role to use an OAuth-backed subscription instead of an env-var API key, with credentials persisted to the DB and auto-refreshing transparently on each call. The primary target is Google Cloud Code Assist (free tier for personal use); the pattern generalizes to all five pi-ai-supported providers.

Three deliverables, validated together:

1. **Credential storage** — `oauth_credentials` table, admin UI to paste/save/delete credentials per provider.
2. **Model config switch** — `models.auth_type` column; `/admin/models` lets the admin choose between `env` (today's behavior) and `oauth` (new); provider dropdown shows OAuth-only providers alongside existing env providers.
3. **Runtime resolution** — a small wrapper in the model-invocation path that reads `auth_type` from the model config, calls `getOAuthApiKey()` for OAuth providers, writes refreshed credentials back, and returns the API key to `complete()`.

Validation: point the reception role at `google-gemini-cli` / `gemini-2.5-flash` via OAuth. Run `npm run eval:scope-routing`. Expect the same 9/11 accuracy observed with the OpenRouter path. Observe zero cost in the session stats.

## Non-goals

- **OAuth login flow in the browser.** Admin pastes credentials generated on their laptop via `npx @mariozechner/pi-ai login <provider>`. A full in-app OAuth flow (redirect handling, device code, etc.) is a later story; the paste-from-file pattern handles personal/family deployments cleanly.
- **Multiple credentials per provider.** One active credential per provider key. Rotating credentials = replace.
- **Per-user credentials.** All users share the server-side OAuth credentials for each provider — the mirror is a single-tenant-per-install system. Multi-tenant subscription per end-user is out of scope (and would violate most subscription TOS anyway).
- **Automatic provider selection fallback.** When OAuth refresh fails permanently, the role's call fails the same way any other call failure does today (reception falls back silently, main surfaces the error). No auto-downgrade to an env-var API key.
- **Antigravity integration.** Listed in the spike as a followable direction but not investigated. Wiring it on is trivial (same pattern as the other four); skip for v1 unless demand surfaces.

## Decisions

### D1 — Credential storage in a dedicated table

`oauth_credentials(provider TEXT PRIMARY KEY, credentials TEXT NOT NULL, updated_at INTEGER NOT NULL)`. One row per provider. Credentials field stores the JSON blob pi-ai expects (refresh, access, expires, and provider-specific fields like `project_id` for Google).

Not mixed into `models` table because: (a) credentials are per-provider, models are per-role, and multiple roles may share a provider; (b) credential rotation is a different lifecycle from model config; (c) the blob shape differs per provider and doesn't fit a flat schema.

### D2 — Admin UI — paste pattern, not in-browser OAuth

`/admin/oauth` page lists each provider pi-ai supports, shows whether a credential is stored (with expiry date), provides paste-JSON + save, and a delete action. No redirect-URL OAuth dance in v1.

Rationale: headless server can't open a browser; laptop-initiated OAuth via the pi-ai CLI produces `auth.json` already. The paste pattern respects this workflow, is explicit, and avoids the complexity of device-code UX. When SaaS/multi-tenant becomes real, in-browser OAuth can be added on top — this story is the substrate.

### D3 — `models.auth_type` column — default `env`

```sql
ALTER TABLE models ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'env';
-- values: 'env' | 'oauth'
```

Every existing row keeps working (all default to `env`; current code reads from `process.env.OPENROUTER_API_KEY`). New rows configured with an OAuth-only provider save as `auth_type='oauth'`. The admin UI sets this implicitly based on the chosen provider.

### D4 — Single wrapper for API-key resolution

Create `server/model-auth.ts` with one function:

```typescript
resolveApiKey(db, role): Promise<string>
```

- Reads model config for the role.
- If `auth_type === 'env'`, returns the appropriate env var (same as today).
- If `auth_type === 'oauth'`, loads credentials from `oauth_credentials`, calls pi-ai's `getOAuthApiKey()`, persists refreshed credentials, returns the access token.

Every current call site doing `apiKey: process.env.OPENROUTER_API_KEY` migrates to `apiKey: await resolveApiKey(db, roleName)`. Four call sites: `reception.ts`, `summary.ts`, `title.ts`, plus the main response paths in `adapters/web/index.tsx` and `adapters/telegram/index.ts`.

### D5 — Credential refresh is best-effort

`getOAuthApiKey()` may throw if refresh fails (network, revoked credential, expired refresh token). Policy: the wrapper catches, logs, and throws a typed `OAuthResolutionError`. The caller (reception, main, etc.) handles it the same way it handles any other provider failure — reception returns all-nulls (silent fallback already exists), main surfaces the error to the user.

No automatic fallback to another provider. An admin who notices the failure swaps provider at `/admin/models` or re-uploads credentials.

### D6 — Supported providers surfaced in the UI

`/admin/oauth` lists all five pi-ai-supported OAuth providers with their human names:

- Anthropic (Claude Pro/Max)
- OpenAI Codex (ChatGPT Plus/Pro)
- GitHub Copilot
- Google Cloud Code Assist
- Antigravity

Listing even providers we don't plan to use in v1 signals intent and removes friction when the admin wants to try one.

### D7 — Model dropdown in `/admin/models` shows provider-type

When the admin picks a provider in `/admin/models`, the UI surfaces whether that provider uses env-var auth (shows an API-key field) or OAuth (shows a "configure OAuth →" link to `/admin/oauth` filtered to that provider). No surprises.

### D8 — End-to-end validation through the eval

The `scope-routing` eval is the canonical validation. Target: same 9/11 score when reception is running through OAuth as through OpenRouter (both using `gemini-2.5-flash`). Latency may differ slightly (Code Assist vs OpenRouter) — record in the decisions log; no specific threshold.

Bonus validation if time allows: retry Gemini 2.5 Pro via `google-gemini-cli` provider. The spike identified that pi-ai's OpenAI-compatible adapter fails to parse Pro's reasoning response through OpenRouter, but the native `google-gemini-cli` provider may not hit the same parsing path. If Pro works via OAuth, it unlocks a stronger reception option at zero cost in the free tier (within quota).

## Steps

1. **Schema**
   - Add `oauth_credentials` table to `server/db.ts` CREATE TABLE block.
   - Add `auth_type` column migration via `ALTER TABLE` in `migrate()`.
   - Re-export helpers from `server/db.ts`.
2. **DB helpers** (`server/db/oauth-credentials.ts`)
   - `setOAuthCredentials(db, provider, credentials)` — upsert.
   - `getOAuthCredentials(db, provider)` — read.
   - `deleteOAuthCredentials(db, provider)` — delete.
3. **`server/model-auth.ts`** — `resolveApiKey(db, role)` with the two branches.
4. **Migrate call sites** to use `resolveApiKey` in place of `process.env.OPENROUTER_API_KEY`. Reception, summary, title, main response paths.
5. **Admin UI — `/admin/oauth`** (`adapters/web/pages/admin/oauth.tsx`, new)
   - List of providers.
   - Per-provider card: configured/not, expiry, paste-JSON form, save, delete.
6. **Admin UI — `/admin/models` updates** — include OAuth providers in the dropdown; conditional API key field vs "configure OAuth →" link; `auth_type` set implicitly from the provider chosen.
7. **Tests** (`tests/web.test.ts`, `tests/db.test.ts`)
   - CRUD on `oauth_credentials`.
   - `resolveApiKey` returns env var for `env` auth, calls OAuth path for `oauth` auth (mocked `getOAuthApiKey`).
   - `/admin/oauth` list/save/delete flows.
   - `auth_type` column migration is idempotent.
8. **Eval validation** — point reception at `google-gemini-cli` via UI, run `npm run eval:scope-routing`, record results.
9. **Docs**: `test-guide.md` including laptop→server credential bootstrap. `refactoring.md` produced during review pass.

## Files likely touched

- `server/db.ts` — schema + migration + re-exports
- `server/db/oauth-credentials.ts` *(new)* — CRUD helpers
- `server/model-auth.ts` *(new)* — key resolution wrapper
- `server/reception.ts` — use resolveApiKey
- `server/summary.ts` — use resolveApiKey
- `server/title.ts` — use resolveApiKey
- `adapters/web/index.tsx` — use resolveApiKey in main path, new routes for /admin/oauth
- `adapters/telegram/index.ts` — use resolveApiKey
- `adapters/web/pages/admin/oauth.tsx` *(new)*
- `adapters/web/pages/admin/models.tsx` — auth-type aware UI
- `tests/db.test.ts` — oauth_credentials + migration tests
- `tests/web.test.ts` — /admin/oauth + resolveApiKey integration

## Known incomplete

- **No in-browser OAuth flow.** The paste pattern is intentional; adding redirect-based OAuth can come later without breaking this surface.
- **No Antigravity tested.** Same plumbing would cover it; validation deferred.
- **Gemini 2.5 Pro retry is optional.** If time allows in the S8 cycle, rerun the eval with Pro via `google-gemini-cli`; otherwise, registered as a followable task.

## Open questions to resolve during implementation

- **Where to host the credential paste JSON shape documentation.** Inline help text on the /admin/oauth page? Link to pi-ai's README? A small doc page under `/docs`?
- **Credential expiry display format.** Relative time ("expires in 47 days") vs absolute? Lean relative for the common case + tooltip with absolute.
- **What happens on revoked credential.** pi-ai's `getOAuthApiKey` throws. How verbose the error surface should be in the admin UI (and how clearly to guide "go relogin on your laptop and re-paste").

---

**See also:**
- [Spike — Subscription OAuth](../../../spikes/spike-2026-04-21-subscription-oauth.md) — the investigation that produced this story
- [CV0.E3.S1 — Admin customizes models via the browser](../cv0-e3-s1-admin-models/) — the precedent for config-in-DB, live admin surface
- [pi-ai OAuth module documentation](https://github.com/mariozechner/pi-mono/blob/main/packages/pi-ai/README.md#oauth-providers) (external)
