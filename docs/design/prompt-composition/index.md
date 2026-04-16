[< Docs](../../index.md)

# Prompt Composition Reference

How the system prompt is built for each scenario. The prompt is composed at runtime from layers, assembled in a fixed order. Each layer is optional — missing layers are skipped, not errored.

## Example prompts

Full prompts as they arrive to the LLM, built from starter templates:

- [Base](prompt-base.md) — soul + ego only, no persona, no adapter
- [Telegram with persona](prompt-telegram.md) — soul + ego + persona + Telegram instruction
- [Web without persona](prompt-web.md) — soul + ego + web instruction

---

## Composition order

```
1. self/soul          ← who the mirror IS (essence, frequency, nature)
2. ego/identity       ← what the mirror DOES (role, activities)
3. ego/behavior       ← how the mirror COMMUNICATES (tone, constraints, vocabulary)
4. persona/*          ← domain lens (only if reception selected one)
5. adapter instruction← channel-specific style (from config/adapters.json)
```

The final prompt is all parts joined with `\n\n---\n\n`.

---

## Scenarios

### Base response (no persona, no adapter)

Layers: `self/soul` + `ego/identity` + `ego/behavior`

When: API call without `client` field, or adapter not recognized.

### Web chat

Layers: `self/soul` + `ego/identity` + `ego/behavior` + `[persona]` + `web instruction`

The web instruction encourages depth and markdown. Reception runs first to pick a persona.

### Telegram

Layers: `self/soul` + `ego/identity` + `ego/behavior` + `[persona]` + `telegram instruction`

The telegram instruction enforces short, conversational prose. No headers, no lists, no tables.

### CLI

Layers: `self/soul` + `ego/identity` + `ego/behavior` + `[persona]` + `cli instruction`

The CLI instruction asks for scannable text without headers.

### With persona active

When reception selects a persona (e.g., `mentora`), the persona's content is inserted between ego/behavior and the adapter instruction. The persona enriches the voice — it doesn't replace it.

The server adds the signature `◇ persona-name` before the reply text. This is not part of the prompt — it's added by code after the LLM responds.

---

## Where each piece is configured

| Layer | Source | How to edit |
|-------|--------|-------------|
| `self/soul` | `identity` table in DB | `admin.ts identity set <name> --layer self --key soul --text ...` or web admin |
| `ego/identity` | `identity` table in DB | same |
| `ego/behavior` | `identity` table in DB | same |
| `persona/*` | `identity` table in DB (layer=`persona`) | same, or import via `--from-poc` |
| adapter instruction | `config/adapters.json` | edit the file, restart server |

---

## Reception

Before composition, every message passes through the **reception** layer (`server/reception.ts`). Reception is a fast LLM call that returns `{ persona: string | null }`. If it fails or times out (5s), the response continues without a persona.

Reception uses the model defined in `config/models.json` under `reception`. The main response uses the model under `main`.

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

**See also:** [Principles](principles.md) · [Admin CLI Reference](admin-cli.md) · [config/models.json](../../config/models.json) · [config/adapters.json](../../config/adapters.json)
