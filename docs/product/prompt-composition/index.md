[< Docs](../../index.md)

# Prompt Composition Reference

How the system prompt is built for each scenario. The prompt is composed at runtime from layers, assembled in a fixed order. Each layer is optional — missing layers are skipped, not errored.

## Example prompts

Full prompts as they arrive to the LLM, built from starter templates:

- [Base](prompt-base.md) — soul + ego only, no persona, no adapter
- [Telegram with persona](prompt-telegram.md) — soul + ego/identity + persona + ego/behavior + ego/expression + Telegram instruction
- [Web without persona](prompt-web.md) — soul + ego/identity + ego/behavior + ego/expression + web instruction

---

## Composition order

```
1. self/soul          ← who the mirror IS (essence, frequency, principles)
2. ego/identity       ← operational positioning (who I am in the day-to-day)
3. persona/*          ← domain lens (only if reception selected one)
4. ego/behavior       ← how the mirror ACTS (conduct, method, posture)
5. ego/expression     ← how the mirror SPEAKS (format, vocabulary, punctuation)
6. adapter instruction← channel-specific style (from config/adapters.json)
```

The final prompt is all parts joined with `\n\n---\n\n`. Two clusters organize the order: the **identity cluster** (who I am, in whatever lens is active) comes first; the **form cluster** (how I act, how I speak) comes after. Expression sits last in the identity stack so its absolute rules (e.g., no em-dash, no disguised listicle) get maximum recency weight over any persona content above.

This is the **composition order** seen by the LLM. The **display order** in the Cognitive Map is different — cards read `identity → expression → behavior` for human scanning. See [improvement: compose order — identity then form](../../project/roadmap/improvements/compose-order-identity-then-form/) for the rationale.

---

## Scenarios

### Base response (no persona, no adapter)

Layers: `self/soul` + `ego/identity` + `ego/behavior` + `ego/expression`

When: API call without `client` field, or adapter not recognized.

### Web chat

Layers: `self/soul` + `ego/identity` + `[persona]` + `ego/behavior` + `ego/expression` + `web instruction`

The web instruction encourages depth and markdown. Reception runs first to pick a persona.

### Telegram

Layers: `self/soul` + `ego/identity` + `[persona]` + `ego/behavior` + `ego/expression` + `telegram instruction`

The telegram instruction enforces short, conversational prose. No headers, no lists, no tables.

### CLI

Layers: `self/soul` + `ego/identity` + `[persona]` + `ego/behavior` + `ego/expression` + `cli instruction`

The CLI instruction asks for scannable text without headers.

### With persona active

When reception selects a persona (e.g., `mentora`), the persona's content is inserted between `ego/identity` and `ego/behavior` — inside the identity cluster, as a specialization of identity, not as a final override. The behavior and expression rules still apply on top. The persona enriches the voice; it doesn't replace it.

The server adds the signature `◇ persona-name` before the reply text. This is not part of the prompt — it's added by code after the LLM responds.

---

## Where each piece is configured

| Layer | Source | How to edit |
|-------|--------|-------------|
| `self/soul` | `identity` table in DB | `admin.ts identity set <name> --layer self --key soul --text ...` or web Cognitive Map |
| `ego/identity` | `identity` table in DB | same |
| `ego/behavior` | `identity` table in DB | same |
| `ego/expression` | `identity` table in DB | same |
| `persona/*` | `identity` table in DB (layer=`persona`) | same, or import via `--from-poc` |
| adapter instruction | `config/adapters.json` | edit the file, restart server |

---

## Reception

Before composition, every message passes through the **reception** layer (`server/reception.ts`). Reception is a fast LLM call that returns `{ persona: string | null }`. If it fails or times out (5s), the response continues without a persona.

Reception reads the list of available personas with their generated summaries as descriptors (see [routing-aware persona summaries](../../project/roadmap/improvements/routing-aware-persona-summaries/)). Persona summaries are designed to lead with domain + activation triggers so the router gets a clear signal.

Reception uses the model defined in the `models` table under role `reception`. The main response uses the model under `main`. Models are seeded from `config/models.json` on first boot and can be edited live at `/admin/models`.

---

## Layer summaries

Each identity layer (self/ego/persona) carries an auto-generated `summary` field produced by the cheap `title` model. The summary is used for:

- **Cognitive Map cards** — surfaces a real descriptive sentence instead of the markdown header.
- **Reception descriptor** — gives the router a domain signal when picking a persona.
- **Hover tooltip** — on persona badges in the map.

Summaries regenerate on Save (fire-and-forget) or on demand via the "Regenerate summary" button in the workshop. The Personas card also has a "regenerate all summaries" bulk action.

The prompt that generates summaries branches on layer type: personas get a domain-first prompt; self/ego layers get an essence-first prompt. See [routing-aware persona summaries](../../project/roadmap/improvements/routing-aware-persona-summaries/) and [generated summary by lite model](../../project/roadmap/improvements/generated-summary-by-lite-model/) for history.

---

## Formatting

After the LLM responds, the output passes through `formatForAdapter(text, adapter)`:

| Adapter | Formatting |
|---------|-----------|
| `telegram` | MarkdownV2 conversion → HTML fallback → plain text fallback |
| `web` | Passed through (web renders markdown) |
| `cli` | Passed through |
| `api` | Passed through |

---

**See also:** [Principles](principles.md) · [Admin CLI Reference](admin-cli.md) · [Improvements](../../project/roadmap/index.md#radar)
