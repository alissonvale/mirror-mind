[< Docs](../../../../../index.md)

# Test Guide: CV0.E2.S6 — Web route tests

**Plan:** [Plan](plan.md)

## Running

```bash
npm test                        # all tests (68)
npm run test:unit               # unit + web tests
npx vitest run tests/web.test.ts  # web tests only (13)
```

## What passes

- Login flow: render, valid/invalid/empty token, logout
- Cookie auth: redirect without cookie, accept with valid, reject with invalid
- Admin: users list, unified profile, 404 for unknown user, legacy redirects

---

**See also:** [Plan](plan.md)
