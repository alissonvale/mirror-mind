[< CV1 Depth](../)

# CV1.E14 — Identity Narrative

**Status:** ✅ Done (2026-05-05). One story shipped.

> Design source: design conversation 2026-05-05 (this session) — three reference drafts authored against Antonio Castro's identity layers.

## Premise

The cognitive map (`/map`) presented the user's psyche as a structural grid: cards for self/soul, ego/identity, ego/behavior, ego/expression, plus the persona collection. Each card was a clickable surface. The metaphor was *spatial* — layers laid out in a plane.

The user named the discomfort: the map metaphor doesn't match how identity reads. Identity isn't a grid; it's a story you can tell about yourself. CV1.E14 changes the metaphor — `/narrativa` (pt-BR canonical) + `/narrative` (en alias) becomes the new continuous-read self-portrait surface.

The other shift is terminological: **"ego" leaves the user-facing chrome**. The DB schema and internal code still use `identity.layer = 'ego'` (architectural nomenclature, not user-visible), but the GUI labels become flat: ALMA / IDENTIDADE / COMPORTAMENTO / EXPRESSÃO / ELENCO. No agrupador "Ego" / "Conduta" — five h2 peers.

## What ships

- `GET /narrativa` and `GET /narrative` render the new continuous-read self-portrait page.
- The avatar dropdown's "Mapa Interior" / "Inner Map" link flips to "Narrativa" / "Narrative", pointing at `/narrativa`.
- `/espelho`'s Sou pane heading link flips from `/map` to `/narrativa` — the contemplative entry now drills into the narrative.
- The `/map` route continues to render the legacy cognitive-map dashboard for back-compat with admin flows (`/map/<tenant-name>`, `/map/composed`) and existing internal links. The chrome no longer surfaces it as the canonical self-portrait surface, but the page exists.

## Page shape

```
                       BOOKPLATE (user.name)

 ALMA              [self/soul content rendered as continuous prose]
 IDENTIDADE        [ego/identity content]
 COMPORTAMENTO     [ego/behavior content]
 EXPRESSÃO         [ego/expression content]
 ELENCO            [persona list — names link to /personas/<key>]

                                   [ir ao mapa para editar]
```

Visual notes:

- **Bookplate** at the top — same shape as `/espelho` (small caps name + thin rule).
- **Section labels** — small caps (0.78rem, letter-spacing 0.28em, muted color).
- **Sub-headings** within each layer (the `## ` markers in the markdown) render as `☞ heading` in italic serif. Reads as a typographic finger pointing into the next chapter, not as an `<h3>` that breaks the page into cards.
- **Body paragraphs** — sans-serif, 0.96rem, line-height 1.7. Comfortable scroll read.
- **Personas** — `◇ key` (with persona color on the glyph) + italic descriptor. Each name links to its portrait.
- **Single edit affordance** in the footer — "ir ao mapa para editar" / "go to the map to edit". Cycles back to `/map` (workshop home) where layer-by-layer editing happens.

## Synthesis

**Light.** No LLM. Layer markdown content is parsed (preamble + H2-delimited subsections) and rendered verbatim with friendly chrome. Personas are listed via DB queries. The whole thing is deterministic; the page renders fast on every visit.

The choice to skip LLM synthesis was deliberate (decision recorded during the design conversation): layer content is already authored prose; the work is presentation, not generation. LLM-woven transitions would add cost without earning the editorial weight back.

## Server module

`server/portraits/narrativa-synthesis.ts`:

- `composeNarrativa(db, userId)` — orchestrator returning a typed `NarrativaState`.
- `parseLayer(content, editPath)` — pure helper that:
  - Strips the leading `# H1` (layer title — already redundant with the section label rendered by the page).
  - Captures preamble paragraphs before the first `## ` heading.
  - Splits the rest into named subsections by `## ` markers.
  - Returns `isEmpty: true` when the content has no body at all.

Each layer carries the path to its workshop (e.g., `/map/self/soul`, `/map/ego/behavior`) — used by the stub block CTA when the layer is unwritten.

## Empty-state behavior

When a layer is `isEmpty`, the section renders an italic stub line with an inline edit link: *"Esta camada ainda não foi escrita — escrever"* / *"This layer hasn't been written yet — write"*. Mirrors the cena stub-block pattern from S3.

When the persona list is empty, the ELENCO section renders *"Nenhuma persona declarada ainda."* with no CTA (personas are created via `/personas` or the cena form, not directly from the narrativa).

## Tests

`tests/narrativa.test.ts` (11 tests):

- `parseLayer`: strips H1, captures preamble, splits subsections; isEmpty true for empty/H1-only content; handles content with no H2 (preamble-only).
- `composeNarrativa`: builds full state across layers + personas; each layer carries the correct edit path; layers are isEmpty when unwritten; personas sorted by sort_order then key.
- Routes: `GET /narrativa` returns 200 with section labels + bookplate + soul lede + footer edit link; `GET /narrative` (en alias) returns the same page; stub blocks render with workshop URLs when layers are unwritten.

Existing tests updated:
- `tests/avatar-top-bar.test.tsx` — chrome assertion flipped from `/map` to `/narrativa`.
- `tests/web.test.ts` — three tests updated for the new chrome label + URL.
- `tests/espelho-routes.test.ts` — Sou pane drill-down link flipped from `/map` to `/narrativa`.

Suite: 1193/1193 (was 1182; +11 narrativa, 0 net regressions).

## What "Ego" looks like in the system now

| Surface | Term used |
|---|---|
| `/narrativa` page | "IDENTIDADE / COMPORTAMENTO / EXPRESSÃO" (no "Ego") |
| Avatar dropdown | "Narrativa" |
| `/espelho` Sou pane | drills into `/narrativa` |
| `/map` workshop home (legacy) | still uses old chrome — back-compat surface |
| DB schema | `identity.layer = 'ego'` (unchanged — architectural) |
| System prompts (composeSystemPrompt) | still references "ego/identity" etc. (internal nomenclature) |

The audit of remaining "ego" usages in the chrome (`/map` legacy page, layer breadcrumbs, etc.) is a follow-up sweep — not in this story's scope. The metaphor change happens at the canonical surface; the legacy surfaces gradually drop "ego" as they're touched.
