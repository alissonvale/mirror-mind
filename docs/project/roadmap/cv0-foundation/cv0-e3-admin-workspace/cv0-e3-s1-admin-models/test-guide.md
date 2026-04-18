[< Story](index.md)

# Test Guide: CV0.E3.S1 — Admin customizes models

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- Regular user → **403** on `/admin/models` and its POST routes.
- Admin GET `/admin/models` renders each seeded role (`main`, `reception`, `title`) with its form.
- POST `/admin/models/:role` persists provider, model ID, prices, timeout, purpose; redirect to the listing.
- POST `/admin/models/:role` with empty provider or model → **400**.
- Unknown role → **404** on both POST routes.
- POST `/admin/models/:role/reset` restores seed values from `config/models.json`.
- `seedModelsIfEmpty` populates `main`, `reception`, `title` on first boot.

Total: **151 passing**.

## Manual (browser)

### Edit a model live

1. Log in as admin. Sidebar → This Mirror → **Models**.
2. Three cards: Primary response (main), Reception, Titles. Each with provider, model ID, prices, optional timeout, purpose.
3. On the **main** card, change model ID to another OpenRouter model (e.g., `anthropic/claude-sonnet-4`) and click **Save**.
4. Redirect back to the list — the new value shows. Send a message in `/mirror`; the response comes from the new model. No restart.

### Revert to shipped default

1. After the edit above, click **Revert to default** on the same card. Native confirm: "Revert main to the shipped default?" — confirm.
2. Values return to what `config/models.json` ships (`openrouter` / `deepseek/deepseek-chat-v3-0324` / ...). Next message uses the original model.

### Dashboard reflection

1. Open `/admin`. The **Models** card lists the three roles with their model IDs and BRL prices.
2. Change a price via `/admin/models` (e.g., set main input to `R$ 0,10`). Reload `/admin` — the card reflects the new price.
3. Send messages; the **Cost · last 30 days** card updates accordingly on the next reload (approximation still applies).

### Auth

- Non-admin hitting `/admin/models` → 403. POST routes same behavior.
- Tampered form posting to unknown role (e.g., `/admin/models/shadow`) → 404.

### What's not here

- **Add new roles via the UI.** Roles arrive through code (seed JSON + consumer). The admin edits what's already there.
- **Provider / model autocomplete.** Free-form input; pi-ai errors at request time if the model ID is invalid.
- **Change history.** Each save overwrites the row. Audit log is a radar story.
- **Per-user overrides.** Models are mirror-wide.
