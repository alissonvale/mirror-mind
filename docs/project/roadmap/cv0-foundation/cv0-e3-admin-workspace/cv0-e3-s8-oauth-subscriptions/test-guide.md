[< Story](index.md)

# Test guide — CV0.E3.S8

This story replaces the `process.env.OPENROUTER_API_KEY` monoculture with a per-role auth path. Every LLM call goes through `resolveApiKey(db, role)`, which either returns the env var (default, same as before) or resolves an OAuth credential from the DB, refreshing its access token when expired. An admin uploads pi-ai credentials at `/admin/oauth` and switches a role to an OAuth provider at `/admin/models`.

---

## Automated checks

```sh
npm test
```

Look for:

- `oauth_credentials` describe block — CRUD, upsert, JSON round-trip with arbitrary extra fields (e.g. `project_id`), `getAllOAuthCredentials` returns the map shape pi-ai expects.
- `models.auth_type` describe block — default is `env`, `updateModel` persists `oauth`, migration is idempotent across reopens.
- `resolveApiKey — env auth_type` / `resolveApiKey — oauth auth_type` — the two branches of the wrapper, with `getOAuthApiKey` injected as a fake to exercise refresh-persistence, unchanged-credential fast path, and error wrapping as `OAuthResolutionError`.
- `web routes — admin oauth (CV0.E3.S8)` — GET lists the five pi-ai providers, POST validates JSON shape, delete removes, 403 for non-admin, 404 for unknown provider.
- `web routes — admin models` additions — env/OAuth badges render, datalist lists OAuth ids, auth_type is derived from the chosen provider on save, warning appears when OAuth provider has no stored credentials.

Expected total: **269 tests passing** (was 237 before this story).

---

## Manual flow — the primary acceptance path

### 1. Bootstrap credentials on the laptop

pi-ai ships a CLI that runs the browser OAuth flow and writes the resulting credentials to a local file. For Google Cloud Code Assist (the main target of this story), the command is:

```sh
npx @mariozechner/pi-ai login google-gemini-cli
```

- A browser opens. Sign in with the Google account you want the server to use.
- **Recommended:** use a dedicated Google account (e.g. `mirror.alisson@gmail.com`), not your personal Gmail. Keeps quotas separated and makes revocation trivial.
- On success, pi-ai writes an `auth.json` (or similar) file in the current directory. Open it — the contents will look like:

```json
{
  "refresh": "1//0g...",
  "access": "ya29...",
  "expires": 1729876543210,
  "project_id": "mirror-alisson-dev"
}
```

This blob is what you will paste into the mirror.

### 2. Upload credentials at `/admin/oauth`

- Boot the dev server: `npm run dev`.
- Log in as an admin user.
- In the sidebar, under **This Mirror**, click **OAuth**.
- You should see five provider cards: Anthropic, GitHub Copilot, Google Cloud Code Assist (Gemini CLI), Antigravity, ChatGPT Plus/Pro (Codex).
- On the `google-gemini-cli` card, paste the full JSON into the textarea and click **Save credentials**.
- The page reloads with a success flash. The card now shows **Configured** with a relative expiry (e.g. *expires in 47h*) and the extra field `project_id`.

**Failure modes to test:**

- Empty paste → error flash "Paste the full credentials JSON before saving."
- Malformed JSON → error flash with the parser message.
- Valid JSON missing `refresh`/`access`/`expires` → error flash naming the required fields.

### 3. Switch the reception role to OAuth

- Sidebar → **This Mirror** → **Models**.
- On the **reception** card, change **Provider** from `openrouter` to `google-gemini-cli` (the datalist under the field suggests known values; you can also type it directly).
- Change **Model ID** to `gemini-2.5-flash`.
- Clear the Input/Output BRL fields (the free tier is zero-cost for now) or leave them — they only affect the Context Rail cost estimate.
- Click **Save**.
- The card reloads with the **OAuth** badge and the provider line reads `google-gemini-cli · gemini-2.5-flash`. No warning (because credentials exist).

**Warning path:** temporarily delete the stored credential at `/admin/oauth`, return to `/admin/models`, and confirm the reception card shows the inline warning *No credentials stored for google-gemini-cli* with a **Configure OAuth →** link. Re-upload the credentials before proceeding.

### 4. End-to-end probe via the scope-routing eval

Ensure the eval's DB (`data/mirror.db`) has reception pointed at the OAuth config you just saved. Run:

```sh
npm run eval:scope-routing
```

What to watch for:

- Each probe runs. Latency per call is logged by the reception path.
- **Target: same 9/11 accuracy observed on the OpenRouter path.** Any regression indicates the OAuth resolver is returning a stale token or the provider's pi-ai adapter is parsing the response differently than the OpenRouter adapter.
- Check `oauth_credentials` after the run — if the stored `access` changed and `expires` advanced, pi-ai refreshed and the resolver wrote the new blob back. This is the happy path.

### 5. Bonus — Gemini 2.5 Pro retry

The 2026-04-21 spike was blocked on pi-ai's OpenRouter adapter mis-parsing Gemini 2.5 Pro's reasoning-aware response. The native `google-gemini-cli` provider goes through a different pi-ai path. Try:

- Change reception's **Model ID** to `gemini-2.5-pro`, Save.
- Run the eval again.

Two outcomes are both useful:

- **Pro works** → register a decision in `decisions.md` noting Pro is viable for reception via OAuth, and consider making it the new default when the cost budget (free-tier quota) accommodates Pro's per-call latency.
- **Pro still fails** → log the error shape. Likely a different parsing issue in the native adapter; file as a followable item parked to the next pi-ai upgrade.

---

## Laptop → server credential bootstrap

For deployments on a VPS where the admin can't run the browser-based OAuth flow locally:

1. Run `npx @mariozechner/pi-ai login google-gemini-cli` on your **laptop** (or any machine with a browser).
2. The CLI writes `auth.json` (name may vary by provider) to the current directory.
3. Open the file and **copy the entire JSON**.
4. In the mirror at `https://your-mirror.example.com/admin/oauth`, paste it into the `google-gemini-cli` card and save.
5. The server will refresh access tokens automatically on each reception call; the refresh token inside the blob remains valid under regular use.

**When to re-paste:** if you revoke the OAuth authorization (e.g. via Google's account security page), or the refresh token itself expires (rare — typically only happens after months of inactivity). The mirror surfaces `OAuthResolutionError` in logs when refresh fails; reception falls back silently to all-nulls until you upload fresh credentials.

**Separate accounts for laptop + server.** The spike recommends using one Google account for local dev work (personal Gmail, shared with Gemini CLI, Gemini app, etc.) and a dedicated account for the VPS. This way a rate-limit in one does not affect the other, and revoking one does not interrupt the other.

---

## What "done" feels like

- Credentials stored in `oauth_credentials`, visible at `/admin/oauth` with accurate expiry hints.
- `/admin/models` shows an OAuth badge for the reception role and no credential warnings.
- The scope-routing eval runs green end-to-end through the Google Code Assist free tier, with reception's recorded latency roughly comparable to the OpenRouter path.
- Session-stat cost for reception drops to zero in the Rail (free-tier use); if you kept prices in the model config, they simply report estimates — real billing is zero.
- Nothing else about the mirror changed — `main` and `title` continue on OpenRouter; reception messages route the same way; the Cognitive Map, scopes, and memory surfaces are unaffected.
