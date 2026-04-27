[< Roadmap](../index.md)

# CV2 — Accessibility

> The mirror meets the user where they are. More channels, more languages, more ways to interact.

**Status:** Activating ahead of original schedule with E1 (Localization). Channel work (web UI, WhatsApp, audio) re-positions as later epics now that the flat shape is replaced with epic shape.

---

## Epics

| Code | Epic | Status |
|------|------|--------|
| [CV2.E1](cv2-e1-localization/) | **Localization** — UI in the user's language; per-user locale preference; second-cut narrative in pt-BR | active |
| `CV2.E2` | **WhatsApp adapter** — WhatsApp Business API as a thin adapter over the server | future |
| `CV2.E3` | **Dedicated web interface** — public surface beyond the admin/operator UI | future |
| `CV2.E4` | **Voice input** — Web Speech API / Whisper, audio-first capture | future |

---

## Why Localization first

Two converging signals:

1. **Family scenario.** Onboarding a non-English-speaking family member is a near-term move. Without UI localization, the mirror is unusable for them — every other accessibility win is moot.
2. **Cheapest accessibility leverage.** Channel epics carry adapter complexity, deployment surface, and external dependencies. Localization is internal, schema-light, and unlocks one whole class of users.

The other epics keep their queue. They activate when their need surfaces.
