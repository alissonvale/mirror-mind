[< Docs](../../../../../index.md)

# Plan: CV0.E2.S3 — Move web client to adapters/web/

**Roadmap:** [CV0.E2.S3](../../../index.md)

## Goal

All web client code under `adapters/web/`, server/index.tsx core-only. Same URL structure, no user-facing changes.

## Before → After

```
BEFORE                              AFTER
server/                             server/
├── index.tsx (360 lines)           ├── index.tsx (~120 lines)
├── web/                            adapters/
│   ├── auth.ts                     └── web/
│   ├── layout.tsx                      ├── index.tsx (setupWeb)
│   ├── login.tsx                       ├── auth.ts
│   ├── chat.tsx                        ├── pages/
│   └── admin/                          │   ├── layout.tsx
│       ├── users.tsx                   │   ├── login.tsx
│       ├── identity.tsx                │   ├── chat.tsx
│       ├── personas.tsx                │   └── admin/
│       └── user-profile.tsx            │       ├── users.tsx
├── public/                             │       ├── identity.tsx
│   ├── style.css                       │       ├── personas.tsx
│   └── chat.js                         │       └── user-profile.tsx
                                        └── public/
                                            ├── style.css
                                            └── chat.js
```

## Key decisions

- `setupWeb(app, db)` follows the Telegram adapter pattern exactly
- Templates stay in `server/templates/` (single source of truth) — web adapter reads them via relative path
- Static files served from `adapters/web/public/`
- All imports updated to one-directional: adapters → server (no circular deps)

---

**See also:** [Refactoring](refactoring.md)
