[< CV0.E3 — Admin Workspace](../index.md)

# S6 — Budget as simulated subscription

The mirror turns OpenRouter's pay-per-token reality into a **prepaid subscription experience**. The admin deposits credit on their dedicated OpenRouter account, the mirror logs every LLM call's actual cost, shows remaining balance prominently, calculates a burn rate, warns before zero, and gives the admin a predictable monthly spend with full visibility.

**Derived from:** conversation 2026-04-21 — after CV0.E3.S8 shipped OAuth support but the subscription-backed providers (Google Code Assist free tier, GitHub Copilot) proved unviable (Code Assist latency/quota; Copilot individual plans closed). Pay-per-token via a dedicated OpenRouter account with prepaid credit became the pragmatic substitute for flat-rate plans. This story builds the instrumentation and admin surface that gives that model a flat-rate *feel*.

- [Plan](plan.md) — scope, decisions, phases, files touched

## Done criteria

1. Every LLM call across every role (main, reception, title, summary) writes a row to `usage_log` with the actual cost returned by OpenRouter's `/api/v1/generation/{id}` endpoint.
2. `/admin/budget` shows the current credit balance (from OpenRouter's `/api/v1/auth/key`), this-month total, and breakdowns by role, by environment (dev vs prod), and by model.
3. Burn rate over the last 7 days + projected days of credit remaining at current rate.
4. A soft alert banner appears across `/admin/*` when credit remaining is under 20% of the last top-up amount.
5. Admins can set a global USD→BRL exchange rate and per-admin toggle whether to display BRL alongside USD.
6. Non-admin users no longer see cost information — Context Rail no longer shows BRL cost in the `/mirror` shell for regular users.
7. `X-Title: mirror-mind` and `HTTP-Referer` headers flow on every OpenRouter call, so the dedicated account's dashboard tags traffic by app/install distinctly.
