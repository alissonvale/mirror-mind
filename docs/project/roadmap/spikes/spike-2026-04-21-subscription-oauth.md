[< Spikes](index.md)

# Spike: Subscription-based LLM access via OAuth

**Date:** 21 April 2026
**Status:** Closed 21 April 2026
**Participants:** Alisson + Claude
**Nature:** Investigation into alternative billing models for mirror-mind's LLM calls, combined with an empirical three-model comparison for the reception role. Produced immediate decisions about the default reception model and a follow-up story (CV0.E3.S8) for OAuth integration.

---

## 1. Motivation

After v0.8.0 shipped, two concerns converged:

1. **Cost curve.** Per-token billing via OpenRouter worked at single-user scale (~R$120–150/month) but would scale linearly with family usage and eventually with any external sharing. The question surfaced: are there flat-rate or subscription-based paths that would decouple cost from volume?

2. **Reception as strategic seam.** Reception is the cognitive router — today it picks persona + organization + journey; tomorrow it may detect topic shifts, decide response depth, choose between retrieval strategies, activate skills. The capacity of the model here determines how much intelligence the mirror can layer on top. Understanding which model to use — and whether a stronger one is reachable through non-per-token billing — matters for the product's trajectory.

The spike set out to answer three questions:

1. Do consumer AI subscriptions (Claude Pro/Max, ChatGPT Plus/Pro, Gemini Advanced, GitHub Copilot, Cursor, Kiro, etc.) provide API access to third-party apps like mirror-mind?
2. Does the mirror's foundation library — pi-ai — support any of these subscription paths via OAuth?
3. Empirically, which model is the best fit for reception: the current Claude Haiku 4.5, Google's Gemini 2.5 Flash, or Gemini 2.5 Pro?

---

## 2. Consumer subscriptions and third-party API access

The initial hypothesis — that a Claude Max subscription (or equivalent) would cover mirror-mind's API traffic — was wrong. The pattern is consistent across the major providers:

| Provider | Consumer subscription | API access from third-party apps |
|----------|----------------------|-----------------------------------|
| Anthropic | Claude Pro / Max / Teams | No — covers claude.ai and Claude Code only |
| OpenAI | ChatGPT Plus / Team / Enterprise | No — covers ChatGPT and OpenAI apps only |
| Google | Gemini Advanced | No — covers the Gemini app only |
| xAI | X Premium (Grok) | No — Grok inside X only |
| Amazon | Kiro subscription | No — Kiro IDE only |
| Others (Cursor, Copilot, Cody, Windsurf) | IDE-bound | No — the IDE only |

API usage across all these providers is pay-per-token. Enterprise committed-use contracts exist but require significant volume and aren't subscription in the consumer sense.

**Why the pattern is universal:** unlimited API from subscription would collapse the pricing model — a single heavy-use app could consume 100× a normal subscriber's token volume. Providers cap consumer subscriptions through UX (daily message limits, silent rate-limiting) rather than pricing those limits in. For API, where volume is unbounded and programmatic, only consumption billing works.

**One significant exception:** OAuth flows that grant *their own* app's access to third-party tools. This is what Claude Code does (OAuth against Claude Pro/Max), what Codex CLI does (OAuth against ChatGPT Plus/Pro), what GitHub Copilot extensions do (OAuth against the Copilot subscription), and what Google Gemini CLI does (OAuth against Google Cloud Code Assist).

The third-party boundary matters: if a library wraps the same OAuth flow and makes the authenticated token callable from any app, the app can ride the subscription without per-token billing. This is the mechanism pi-ai exploits.

---

## 3. pi-ai's OAuth support

Inspection of `node_modules/@mariozechner/pi-ai/dist/utils/oauth/` revealed first-class OAuth support for five providers:

```
anthropic.ts          — Claude Pro/Max subscription
github-copilot.ts     — Copilot subscription
google-antigravity.ts — Antigravity (free Gemini 3, Claude, GPT-OSS via Google Cloud)
google-gemini-cli.ts  — Google Cloud Code Assist (free tier or paid)
openai-codex.ts       — ChatGPT Plus/Pro (access to GPT-5.x Codex models)
```

Public surface from pi-ai's oauth module:

- `loginProvider()` per provider — runs the OAuth flow, returns credentials.
- `refreshOAuthToken(providerId, credentials)` — auto-refresh.
- `getOAuthApiKey(providerId, credentialsMap)` — returns an API key usable in `complete()`/`stream()` calls, refreshing the token if expired.

Credential storage is the caller's responsibility. pi-ai offers a CLI helper (`npx @mariozechner/pi-ai login <provider>`) that saves to `auth.json` in the current directory — useful for local dev and for laptop→server credential bootstrapping.

**This significantly changes the cost calculus.** Any of the five OAuth providers could power mirror-mind's reception (or any other role) at whatever cost structure that subscription carries. For Google Gemini CLI specifically, the "Code Assist for Individuals" free tier covers personal and family-scale usage at zero marginal cost.

---

## 4. Google Cloud Code Assist — the practical path

Code Assist for Individuals was the most attractive of the five OAuth providers for mirror-mind's use case:

- **Free tier** for individual developer use. Quotas ~60 RPM and ~1000 req/day on Gemini 2.5 Pro; higher on Flash.
- **Models:** `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` — the Google flagships.
- **Paid tier** available for heavier use via `GOOGLE_CLOUD_PROJECT` with billing, at standard Gemini API rates.

**Operational question: how does the OAuth flow work on a headless server?** The standard flow opens a browser and redirects to `localhost:callback_port`, which a VPS can't do. pi-ai's `loginGeminiCli` supports an `onManualCodeInput` callback — the server shows a URL, the user consents on any device (phone, laptop), copies the redirect URL, pastes it back. But simpler still for personal use: login on the laptop once, transport the resulting `auth.json` to the server (upload via admin UI or scp), let the server refresh tokens from then on. Refresh tokens don't expire under regular use.

**Google account structure.** Three options discussed:

1. Personal Gmail — simplest, but mixes personal identity with service infrastructure.
2. **Dedicated Google account** (e.g. `mirror.alisson@gmail.com`) — clean isolation, independent quota from personal Code Assist usage, trivial to revoke. Chosen as the recommended pattern.
3. Software Zen Workspace account — possible but carries admin policy considerations.

For a family-scale deployment, a single dedicated account is sufficient: the server uses one credential, each family member has their own mirror-mind user + identity, they share the Google account's quota. This stays within Code Assist for Individuals terms (personal developer use) and is trivial to scale to a second account if quota tightens.

**Laptop + server as distinct identities.** The cleanest setup is to use the user's personal Google account on the laptop (for local dev, Gemini CLI use, etc.) and a dedicated account for the server. Each has its own free tier quota; a rate-limit on one does not affect the other.

---

## 5. Three-model eval for reception

The second thread of the spike compared candidate models empirically. Reception's current default (as of v0.8.0) was Claude Haiku 4.5. The question: would Gemini 2.5 Flash or Gemini 2.5 Pro, available at a different price point and eventually through OAuth, do the job as well?

**Method:** the existing `evals/scope-routing.ts` (11 probes, 4 scope quadrants, 3 meta/null cases) ran against the production DB (14 personas, 1 org, 2 journeys). Each model was configured on the reception role via direct SQL update to the `models` table; the eval was then invoked with `npm run eval:scope-routing`. Latency logging was added to the reception diagnostic log for this spike.

**Reception code changes driven by the spike:**

1. Added `reasoning: "minimal"` to reception's `complete()` options. pi-ai's simplified reasoning option maps to provider-specific equivalents (Anthropic thinkingEnabled=false, OpenAI reasoningEffort=minimal, Google thinking.budgetTokens=0). Reception is classification, not reasoning — minimizing thinking reduces latency and, on Gemini, keeps the JSON output in text blocks instead of reasoning blocks.
2. Added thinking-block fallback in the response parser. Defensive: if a provider still returns content in a reasoning block, the parser now reads it. Does not kick in under normal operation.
3. Added latency logging in both success and no-JSON paths. Enables ongoing comparison of models over real traffic.

**Results:**

| Model | Score | Latency (min–max) | BRL/1M (in/out) |
|-------|-------|-------------------|------------------|
| Claude Haiku 4.5 | 9/11 (82%) ✅ | 1.3s – 2.6s | 5 / 25 |
| Gemini 2.5 Flash (w/ reasoning=minimal) | **9/11 (82%)** ✅ | 1.1s – 3.0s | 1.5 / 12.5 |
| Gemini 2.5 Flash (without reasoning=minimal) | 8/11 (73%) ❌ | — | — |
| Gemini 2.5 Pro | — (blocked) | — | 6.25 / 50 |

**Three findings stood out:**

1. **Gemini 2.5 Flash matches Haiku on accuracy** once `reasoning: "minimal"` is applied. Without it, Flash scored 8/11 — the model was over-activating scopes by inferring cross-axis connections the prompt didn't ask for (e.g., activating `vida-economica` when the message explicitly named Software Zen's financial health). Disabling reasoning made the model more decisive and more literal in following the prompt's scope-activation rules.

2. **Cost difference is meaningful.** Flash at R$1.5/R$12.5 per 1M tokens vs Haiku at R$5/R$25 — roughly 3× reduction at comparable accuracy and latency. For single-user usage (~200 msg/day), this is R$5–10/month saved; at larger scale, linear growth.

3. **Gemini 2.5 Pro was blocked by a pi-ai parsing issue, not the model itself.** Direct curl to OpenRouter returned well-formed responses — `message.content` with the expected JSON and `message.reasoning` with the reasoning trace. pi-ai's OpenAI-compatible adapter returned `content: [], stopReason: "error"` for the same request. The issue is in how pi-ai parses OpenRouter's reasoning-aware response shape for this particular model path; not a general bug in pi-ai's reasoning handling (Flash works fine through the same path).

**Supersedes the 2026-04-20 decision** (Haiku as default). Registered at decisions.md (2026-04-21).

---

## 6. Decisions made

1. **Reception default changes to `google/gemini-2.5-flash` via OpenRouter** with `reasoning: "minimal"`. Same accuracy as Haiku, 3× lower cost, similar latency. Applied to `config/models.json` seed and to the primary user's running install.

2. **`reasoning: "minimal"` becomes the universal reception option.** Applies across all providers. No-op on models that don't use reasoning; reduces latency and improves JSON discipline on models that do.

3. **Gemini 2.5 Pro parked as blocked.** Revisit when pi-ai patches the OpenRouter reasoning-response parsing, OR when the Code Assist OAuth provider (`google-gemini-cli`) is wired — its path through pi-ai is different and may not hit the same parsing issue.

4. **OAuth integration prioritized as CV0.E3.S8** — next story on the roadmap, before CV1.E4.S2 (attachments). Rationale: the cost path to zero for reception runs through Google Cloud Code Assist free tier, and the window to validate it is better taken while the model eval finding is fresh.

5. **Account architecture for the user:** dedicated Google account for the VPS, personal Google account for the laptop. Different free tier quotas, clean isolation, easy revocation.

---

## 7. Follow-up items

Items captured for the roadmap, to be planned as needed:

- **[CV0.E3.S8 — OAuth credentials for subscription-backed providers](../cv0-foundation/cv0-e3-admin-workspace/)** — priority next story. Full scope: oauth_credentials table, admin UI for credential upload/paste, models table extended with `auth_type`, wrapper for `getOAuthApiKey` in the model-invocation paths, end-to-end validation against Google Code Assist free tier.

- **Gemini 2.5 Pro via OAuth revalidation.** Once CV0.E3.S8 lands, rerun `evals/scope-routing.ts` against `google/gemini-2.5-pro` through the `google-gemini-cli` provider (rather than OpenRouter). If the pi-ai parsing path is clean via the native provider, Pro becomes viable for reception — and the stronger model would matter when reception grows more axes (topic shift detection, response-depth modulation, adaptive identity composition).

- **Latency observability.** The diagnostic log now records per-call latency. Over time, a simple aggregation — p50/p95 latency per role per model per day — would make model-swap decisions data-driven rather than spot-checked.

- **Document the laptop+server credential bootstrap flow** as part of the CV0.E3.S8 test guide. The workflow (laptop login → credential file → server upload via admin UI) is not obvious to an administrator picking up the mirror.

- **Antigravity provider** mentioned in pi-ai's OAuth list but not investigated in this spike. Offers "free Gemini 3, Claude, GPT-OSS via Google Cloud" — may be another path worth evaluating once basic OAuth infrastructure exists.

- **Terms-of-service clarity for dedicated-account pattern.** Code Assist for Individuals is for "individual developer use". A family-scale deployment using a dedicated account is a defensible interpretation but has not been formally confirmed. Revisit if/when the mirror is offered outside the immediate family.

---

## 8. What did not happen

- No code landed for OAuth flow itself. The spike explored feasibility and found pi-ai already supports it; implementation is CV0.E3.S8.
- No attempt was made to bypass pi-ai's Gemini 2.5 Pro parsing issue (via custom `fetch` or alternative provider). Filed as known constraint; revisit when the native provider path exists.
- The `laptop account vs server account` mental model was agreed conceptually but no credentials were created or stored. CV0.E3.S8 will walk through this as part of its acceptance.

---

**See also:**
- [CV0.E3.S8 — OAuth credentials for subscription-backed providers](../cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/) — implementation story derived from this spike
- [Decisions — 2026-04-21 Reception default changes to Gemini 2.5 Flash](../../decisions.md)
- [pi-ai README — OAuth Providers](https://github.com/mariozechner/pi-mono/blob/main/packages/pi-ai/README.md#oauth-providers) (external)
