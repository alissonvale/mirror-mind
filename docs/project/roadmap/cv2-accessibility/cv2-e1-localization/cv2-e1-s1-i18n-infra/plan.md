[< CV2.E1 — Localization](../)

# CV2.E1.S1 — i18n infrastructure

**Status:** ✅ Done
**Last updated:** 26 April 2026

Build the rail every later story rides on: a tiny translation function, a locale-resolution middleware, two resource files (one of them empty). No user-visible change in this story — production renders bit-for-bit identical to before.

---

## What ships

1. `adapters/web/i18n.ts` — exports `t(key, locale, params?)`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `type Locale`.
2. `adapters/web/locales/en.json` — empty `{}`. Will fill in S2.
3. `adapters/web/locales/pt-BR.json` — empty `{}`. Will fill in S4.
4. `adapters/web/i18n-middleware.ts` — Hono middleware that resolves locale and stashes both `locale` and a curried `t` in `c`.
5. Registration in `adapters/web/index.tsx` on the `web` sub-app, immediately after `web.use("*", webAuthMiddleware(db))`. Login routes (`GET/POST /login`, `POST /logout`) live on the parent `app` and stay unlocalized in S1 — login chrome is handled in a later story (S2 inventory decides).
6. Tests in `tests/i18n.test.ts` and `tests/i18n-middleware.test.ts` (flat layout — `tests/` has no subdirs).

Nothing in any page changes. No JSX file is touched in this story.

---

## Contract: `t(key, locale, params?)`

```ts
export type Locale = 'en' | 'pt-BR';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'pt-BR'];
export const DEFAULT_LOCALE: Locale = 'en';

export function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>
): string;
```

- **Lookup order:** `<locale>.json[key]` → `en.json[key]` → key crude (with `console.warn`).
- **Params:** simple `{name}` interpolation. `t('greeting.hello', 'pt-BR', { name: 'Marina' })` → `Olá, Marina`.
- **Pluralization:** not in S1. Single string per key. If pluralization shows up in real use, S1b refines.
- **Keys are flat with dots as conceptual separators** (`sidebar.home`, `me.preferences.title`). The dot is part of the string key — no recursive lookup.
- **No throw.** Render must never fail because of a missing key. The crude key surfacing is the dev-mode signal.

### Loading the resource files

```ts
import enJson from './locales/en.json' with { type: 'json' };
import ptBrJson from './locales/pt-BR.json' with { type: 'json' };

const dictionaries: Record<Locale, Record<string, string>> = {
  'en': enJson,
  'pt-BR': ptBrJson,
};
```

Bundled at module load. No filesystem reads at request time. Hot-reload during dev is whatever the existing tsx dev loop already provides — nothing custom.

---

## Middleware

```ts
// adapters/web/i18n-middleware.ts
import type { MiddlewareHandler } from 'hono';
import { t, type Locale, DEFAULT_LOCALE } from './i18n.js';

export const localeMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user'); // set by auth (may be undefined for public routes)
  const fromUser = (user as { locale?: Locale } | undefined)?.locale;
  const fromHeader = parseAcceptLanguage(c.req.header('accept-language'));
  const locale: Locale = fromUser ?? fromHeader ?? DEFAULT_LOCALE;

  c.set('locale', locale);
  c.set('t', (key: string, params?: Record<string, string | number>) =>
    t(key, locale, params)
  );

  await next();
};

function parseAcceptLanguage(header: string | undefined): Locale | undefined {
  if (!header) return undefined;
  const wanted = header.split(',')[0]?.trim().toLowerCase();
  if (!wanted) return undefined;
  if (wanted.startsWith('pt')) return 'pt-BR';
  if (wanted.startsWith('en')) return 'en';
  return undefined;
}
```

**Where to register:** on the `web` sub-app (the cookie-auth surface), immediately after `web.use("*", webAuthMiddleware(db))`. Auth runs first (sets `user`), then locale runs (reads `user.locale` if present, falls back). Login pages on the parent `app` are out of scope for this story.

### Hono context typing

```ts
declare module 'hono' {
  interface ContextVariableMap {
    locale: Locale;
    t: (key: string, params?: Record<string, string | number>) => string;
  }
}
```

Co-located with the middleware to keep the augmentation discoverable.

---

## Schema dependency note

S1 reads `user.locale` if present, but doesn't require it. The column lands in S3. To keep the path forward unblocked, the middleware looks up `user.locale` defensively (the cast above). When S3 adds the column to the `User` type, the cast goes away — a one-line cleanup.

---

## Tests

### Unit (`tests/i18n.test.ts`)

- `t('foo.bar', 'en')` returns `'foo.bar'` and warns when key is missing in both files.
- `t('foo.bar', 'pt-BR')` returns the en value when only en defines it.
- `t('hello', 'en', { name: 'Marina' })` interpolates.
- Unmatched curly stays literal: `t('half {open', 'en')` → `'half {open'`.
- Multiple params interpolate independently.

### Smoke (`tests/i18n-middleware.test.ts`)

Uses Hono's `app.request()` against an in-memory SQLite (project pattern, no mocks).

- Authenticated request as user with `locale='pt-BR'` (test inline-migrates the column on the in-memory DB) → `c.get('locale') === 'pt-BR'`.
- Anonymous request with `Accept-Language: pt-BR,en;q=0.9` → `'pt-BR'`.
- Anonymous request with no header → `'en'`.
- Authenticated user with `locale='en'` overrides `Accept-Language: pt-BR` (user pref wins).
- `c.get('t')` returns a callable; called with an existing key returns its value, with a missing key returns the key crude.

The smoke test seeds the user via the existing `createUser` helper plus a direct `UPDATE users SET locale = ?` (S3 schema not in yet — the test uses an inline migration to add the column locally for the test scope).

---

## Done criteria

- [ ] `t()` exported, typed, all unit tests green.
- [ ] Two locale JSONs present (both `{}`).
- [ ] Middleware registered; `c.get('locale')` and `c.get('t')` available downstream.
- [ ] All smoke tests pass.
- [ ] Existing test suite (689 tests as of CV1.E7.S8) still passes — no regression.
- [ ] `npm run dev` opens; the site renders identical to before — no visual delta.
- [ ] Commit in English with the why (D7).

---

## Non-goals (parked, will land later)

- Calling `t()` from any page (S2).
- The user picking a locale (S3).
- Filling `pt-BR.json` (S4).
- Any narrative work (S5).
- Pluralization, gender forms, ICU MessageFormat — only if a real key needs it.
- Locale cookie for pre-auth — only if a real complaint surfaces.
- Localizing 4xx/5xx error pages — out of scope unless they're already in the chrome inventory taken in S2.

---

## Refactor pass (after green tests)

- If `parseAcceptLanguage` ends up handling more than two prefixes, extract into a `negotiate(header, supported)` helper.
- If the middleware grows beyond ~30 lines, split resolution and stashing.
- One-liner usage example added to whatever the web adapter's index doc is at that point (S2 will need it anyway).

---

## Validation moment

```bash
npm test
npm run dev
```

Open `/me` in the browser as any existing user. Nothing visually changed. In DevTools, response HTML is identical to `main` for the same authenticated user.

The win for this story is invisible — it's the rail, not the train.
