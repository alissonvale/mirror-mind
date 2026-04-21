[< CV0.E3 — Admin Workspace](../index.md)

# S8 — OAuth credentials for subscription-backed providers

The mirror gains the ability to authenticate against subscription-backed LLM providers via OAuth, instead of only environment-variable API keys. Five providers are supported out-of-the-box by pi-ai — Anthropic Claude Pro/Max, OpenAI Codex (ChatGPT Plus/Pro), GitHub Copilot, Google Cloud Code Assist, and Antigravity. Each admin decides per role whether to use an env-var API key (today's default) or an OAuth credential (new).

The immediate motivation is Google Cloud Code Assist for Individuals, whose free tier covers personal and family-scale usage — letting the reception role (Gemini 2.5 Flash, validated at 9/11 accuracy on scope-routing) run at zero marginal cost. The pattern generalizes: any future role can be pointed at any of the five OAuth providers without further plumbing.

**Derived from:** [Spike 2026-04-21 — Subscription-based LLM access via OAuth](../../../spikes/spike-2026-04-21-subscription-oauth.md).

- [Plan](plan.md) — scope, decisions, steps, files touched

## Done criteria

1. An admin can paste an `auth.json` fragment on a new `/admin/oauth` page and save it as OAuth credentials for a named provider.
2. On `/admin/models`, a model role can be configured with `provider: google-gemini-cli` (or any other OAuth provider) instead of `openrouter` — the UI shows "OAuth" instead of the API-key input.
3. When reception (or any other role) calls `complete()` with an OAuth-provider model, the system resolves the API key via `getOAuthApiKey()`, refreshing the access token when expired, and persists the refreshed credentials back to the DB.
4. The `scope-routing` eval runs successfully with reception pointed at `google-gemini-cli` / `gemini-2.5-flash` — validating the full OAuth path end-to-end.
5. Documentation in the test guide explains the laptop → server credential bootstrap flow for admins picking up the mirror.
