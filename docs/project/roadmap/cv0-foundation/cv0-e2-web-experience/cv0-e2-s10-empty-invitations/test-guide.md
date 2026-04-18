[< Story](index.md)

# Test Guide: CV0.E2.S10 — Empty states as invitations

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- **Empty structural cards render rich invitations, not grey placeholders** — after deleting all identity rows for the test user, `/map` renders the Self, Ego·Identity, Ego·Behavior, and Personas invitations alongside the unchanged Skills invitation from S8.
- **Personas invitation disappears once at least one persona exists** — creating a single persona flips the Personas card body from the invitation paragraph to the badge grid.

Smoke tests (`tests/smoke.test.ts`) also updated to match the new seed-only-ego/behavior rule: creating a user via the admin CLI produces a list with `[ego/behavior]` only; `[self/soul]` and `[ego/identity]` are not seeded.

Total: **123 passing**.

## Manual (browser)

### Empty-state display

1. Create a new user via `/admin/users` (or the admin CLI).
2. Log in as that user. Go to `/map`.
3. Each structural card with no content should carry its own paragraph:
   - **Self**: *Your soul is the deepest voice — what you are before you are anything specific…*
   - **Ego · Identity**: *Your operational identity — how you show up in the day-to-day…*
   - **Ego · Behavior**: shows the seeded baseline text (not empty, because ego/behavior is the one layer still seeded). Invitation only appears here if the layer is deleted.
   - **Personas**: *Personas are the specialized voices the mirror speaks in — a mentor…* with the `+ add persona` badge below it.
   - **Skills**: the S8 two-tier invitation, unchanged.
4. Click into any card → workshop opens with an empty textarea and the help line describing what that layer is for.
5. Write something, save → return to `/map`. That card now shows the preview + word count instead of the invitation.

### Personas invitation disappears on first add

1. Fresh user, empty personas.
2. `/map` shows the Personas invitation above the `+ add persona` button.
3. Click **+ add persona**, create one.
4. Return to `/map`. The invitation is gone; the badge grid shows the new persona + the add button.

### Seed-on-create behavior (honest default)

When an admin creates a new user (via `/admin/users` or the CLI), only `ego/behavior` is populated from the template. `self/soul` and `ego/identity` are left empty on purpose — the Cognitive Map's invitations teach the user what those layers are, and the user writes them themselves. The baseline behavior layer keeps the mirror usable on turn one.
