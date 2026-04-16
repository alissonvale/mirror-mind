[< Docs](../../../../../index.md)

# Test Guide: CV0.E2.S2 — Unified user profile (retroactive)

**Plan:** [Plan](plan.md)

## Manual verification

### 1. Navigate to profile

From Users page, click "Edit" on a user. Expect: `/admin/users/<name>` with two sections — Base Identity and Personas.

### 2. Base identity cards

Expect 3 cards: ego/behavior, ego/identity, self/soul. Click one — opens textarea with content. Edit and save — flash message confirms.

### 3. Persona cards

Expect all user's personas listed below Base Identity with a count badge. Click one — opens textarea. Edit and save.

### 4. Delete persona

Click "Delete" on a persona. Confirm dialog appears. After confirm — persona removed, flash message shows.

### 5. Add persona

Open "+ Add persona" card. Enter id and content. Submit. Expect: new persona appears in the list.

### 6. Legacy redirects

Navigate to `/admin/identity/<name>` — expect redirect to `/admin/users/<name>`.
Navigate to `/admin/personas/<name>` — same redirect.

---

**See also:** [Plan](plan.md)
