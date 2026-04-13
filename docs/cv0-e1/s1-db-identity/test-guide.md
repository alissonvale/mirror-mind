[< Docs](../../index.md)

# Test Guide: CV0.E1.S1 — DB + Identity Transfer

**Epic:** [Plan](plan.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)

---

## Manual test script

Run from the project root (`~/Code/mirror-mind`).

### 1. Create a test user

```bash
npx tsx server/admin.ts user add testuser
```

Expect: prints name, ID, session, and token.

### 2. List starter identity layers

```bash
npx tsx server/admin.ts identity list testuser
```

Expect: 3 layers (ego/behavior, ego/identity, self/soul) with English template content.

### 3. Edit a specific layer

```bash
npx tsx server/admin.ts identity set testuser --layer ego --key behavior --text "I am direct and calm."
```

Expect: `Identity layer set: ego/behavior`

### 4. Verify the edit

```bash
npx tsx server/admin.ts identity list testuser
```

Expect: ego/behavior now shows "I am direct and calm."

### 5. Import identity from POC Mirror

```bash
npx tsx server/admin.ts identity import testuser --from-poc
```

Expect: `Imported 3 identity layers from POC Mirror.`

Note: the POC is single-user, so this imports Alisson's real identity into testuser. This is expected — we're testing the mechanism.

### 6. Verify the import

```bash
npx tsx server/admin.ts identity list testuser
```

Expect: content in Portuguese (Alma, Identidade, Comportamento) replacing the English templates.

### 7. Reject duplicate user

```bash
npx tsx server/admin.ts user add testuser
```

Expect: error `User "testuser" already exists.`

### 8. Inspect the database (optional)

```bash
sqlite3 data/mirror.db "SELECT layer, key, length(content) FROM identity WHERE user_id = (SELECT id FROM users WHERE name = 'testuser')"
```

### 9. Clean up test user (optional)

```bash
sqlite3 data/mirror.db "DELETE FROM identity WHERE user_id = (SELECT id FROM users WHERE name = 'testuser'); DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE name = 'testuser'); DELETE FROM users WHERE name = 'testuser';"
```

---

**See also:** [Plan](plan.md) · [Admin CLI Reference](../../design/admin-cli.md)
