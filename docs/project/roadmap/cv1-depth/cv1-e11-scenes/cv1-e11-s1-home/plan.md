[< Story](index.md)

# Plan — CV1.E11.S1 home + briefing-in-compose + cold-start

Six phases. Tests passing between each. P1 docs only. P2-P6 each lands a working slice.

## Phase 1 — Story docs

Files: this folder + sibling S2 folder + epic index update.

Commit: `docs(cv1-e11-s1+s2): open paired stories — home + avatar top bar`

## Phase 2 — Avatar top bar (S2 isolated)

Files:
- `adapters/web/pages/avatar-top-bar.tsx` — `AvatarTopBar({user})` component
- `adapters/web/public/avatar-top-bar.js` — dropdown toggle (vanilla, ~30 lines)
- i18n keys `topbar.*` in en + pt-BR
- `tests/avatar-top-bar.test.ts` — JSX renders correct items by role

Component shape: `<header class="avatar-top-bar">` with brand on left, avatar button on right, dropdown menu hidden by default. Dropdown items: name+email header (link to /me), Mapa Cognitivo (link to /map), Minha Memória (link to /memoria — placeholder until S3), Skills (em breve, no link), separator, Admin + Docs (admin only), separator, Sair (form POST to /logout).

Tests: render component as standalone JSX (no SSR setup needed), assert structure.

Commit: `feat(topbar): AvatarTopBar component + dropdown JS`

## Phase 3 — `/inicio` skeleton

Files:
- `adapters/web/pages/home-inicio.tsx` — `InicioPage` (Variant C: cards + ou + input + recents)
- `adapters/web/public/inicio.js` — minor JS (focus the input on load? card click handler if not pure anchor)
- 2 new routes: `web.get("/inicio")` and `web.post("/inicio")`
- i18n keys `home.*`

Cards: `listScenesForUser(db, user.id)` — order by recent activity (already that). Each card is an anchor `<a href="/conversation/new?scene=<key>">` (need new route or reuse) — but actually, simpler: a form POST to `/inicio?action=enter&scene=<key>` that creates the session and redirects. To keep it dead simple: each card POSTs to `/cenas/:key/start` (small new endpoint) which creates the session and redirects. Or even simpler: use the form already at /cenas/:key/editar's "Salvar e iniciar conversa" button — but that requires going through the form. Simplest: a single dedicated endpoint `POST /cenas/:key/start` that creates a fresh session linked to the cena and redirects to /conversation.

Add: `web.post("/cenas/:key/start")` — verifies cena exists for user, calls createFreshSession with sceneId, redirects to /conversation/<sessId>.

Free input: `<form method="POST" action="/inicio">` with a textarea (or input) `name="text"`. On submit:
1. Create fresh session (no scene)
2. Append the user message as the first entry
3. Redirect to /conversation/<sessId> — the conversation surface picks it up and renders the user message; the next assistant turn is generated when the user sends again

Wait — that's awkward. Let me think. The current /conversation flow works like this: user is on /conversation, types in chat-form, JS POSTs to /api/message, response streams in. Initial GET /conversation just shows the existing thread.

For free input on /inicio to feel right: the user submits, lands on /conversation/<sessId> with their message already there AND the assistant response either already streamed or about to stream.

Simplest: POST /inicio creates session, appends user message via api.message internally OR just creates session + queues the text + redirects with a query param `?pending=<text>` that chat.js consumes on load and auto-sends.

Cleanest with minimal new server logic: redirect to `/conversation/<sessId>?seed=<text>` — chat.js sees the seed param, prefills the input, auto-sends. Reuses the existing /api/message flow.

Decision: redirect to `/conversation/<sessId>?seed=<urlencoded>` — chat.js handles the seed by setting input value + dispatching form submit on load.

Recents: `listRecentSessionsForUser(db, user.id, 8)` — render with scene label (looking up scene from session.scene_id when present; "(sem cena)" otherwise). Each row is an anchor to /conversation/<sessId>.

Tests: GET /inicio returns 200 + cards + input + recents block; POST /inicio creates session and redirects with seed query.

Commit: `feat(inicio): home page (Variant C) — cards + free input + recents`

## Phase 4 — Briefing in compose

Files:
- `server/identity.ts` — `composeSystemPrompt` accepts optional `scene?: Scene`; appends `## Cena: <title>\n\n<briefing>` block when scene is non-null
- `server/voz-da-alma.ts` — `composeAlmaPrompt` same treatment
- `server/composed-snapshot.ts` — when scene is non-null, snapshot includes `{kind: 'scene', title, briefing}` block; otherwise unchanged
- `adapters/web/index.tsx` (web sync + web stream) — load scene from session.scene_id before composing
- `adapters/telegram/index.ts` — same
- `tests/compose-with-scene.test.ts` — new file with extensions to compose tests
- `tests/composed-snapshot.test.ts` — extend with scene case

The scene block sits between the identity cluster (when active) and the org/journey blocks. Order: identity (if touches_identity) → cena briefing (if scene) → orgs (if scope) → journeys → personas. Cena briefing is "this specific recurring conversation pattern" — narrower than self/identity, broader than org/journey context.

Existing tests for compose without scene must continue passing — scene is optional, default null = no behavior change.

Commit: `feat(compose): inject cena briefing block when session has scene_id`

## Phase 5 — Cold-start suggestion

Files:
- `server/cold-start.ts` (new) — small wrapper: `evaluateColdStart(db, userId, session, isFirstTurn, reception): {key, title, glyph} | null` — only matches when session.scene_id is null AND isFirstTurn AND reception isn't trivial
- `adapters/web/index.tsx` — web stream and web sync flows: after the response is generated, call evaluateColdStart, attach the suggestion to the response payload (web sync: include in JSON; web stream: emit a special SSE event before close)
- `adapters/telegram/index.ts` — append a small text snippet to the response if a suggestion exists ("Esta conversa parece a cena 'X'. Responda /aplicar para vincular." — Telegram has no card UI, so we use text)
- `adapters/web/public/chat.js` — handle the new SSE event (`event: cena-suggestion` with `data: {key, title, glyph}`) and the response payload field; render the suggestion card below the bubble; wire accept and dismiss
- `web.post("/conversation/:sessId/apply-scene")` — sets session.scene_id to the matched cena
- `tests/cold-start.test.ts` — server-side: evaluateColdStart returns suggestion when criteria met; null otherwise. Apply-scene endpoint sets the scene_id with ownership check.

Commit: `feat(cold-start): receptor suggests matching cena after turn 1`

## Phase 6 — Wrap-up

Files:
- `docs/process/worklog.md` — Done entries for S1 + S2
- `docs/project/decisions.md` — entries for compose-with-scene order, cold-start scope (turn 1 only), free input seed param flow
- Story badges flipped to ✅
- Epic index updated

Commit: `docs(cv1-e11-s1+s2): close stories — home with cards, briefing in prompt, cold-start`

## Risks across phases

- **Compose function signature change.** `composeSystemPrompt` is called from 3+ adapters; adding an optional last parameter is backward-compat but every callsite that wants the new behavior needs updating. Sweep.
- **chat.js complexity.** Already handles streaming, drafts, persona signatures, scope badges. Adding suggestion card render is another concern. Keep code modular within the file.
- **Cena cards click → POST.** Anchors don't POST. Either (a) make cards forms with hidden inputs that submit on click (fragile), (b) use JS to POST on click (simple), or (c) use a GET endpoint `/cenas/:key/start` that creates the session and redirects. Option (c) is cleanest — GET is technically not idempotent but creating a fresh session per click is the desired behavior anyway, and the user explicitly clicked "enter scene". Going with (c).
- **Apply-scene during streaming?** If the suggestion appears during a stream and the user accepts mid-stream, what happens? Solution: suggestion only appears after the stream completes (on the `done` SSE event). Accept becomes safe.

## Out of scope (reaffirmed)

- No card hover ⋯ menu in v1.
- No card color customization (uses cena's voice/persona-derived color).
- No semantic-similarity match in cold-start (CV1.E7.S6 territory).
- No Mapa Cognitivo route — link in avatar menu points to existing `/map` until that surface migrates.
- No Memória dashboard — link points to a 404 placeholder OR is "em breve" until S3.
