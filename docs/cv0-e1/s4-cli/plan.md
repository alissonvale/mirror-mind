[< Docs](../../index.md)

# Plan: CV0.E1.S4 — CLI Client

**Roadmap:** [CV0.E1.S4](../../project/roadmap.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)
**Date:** 13 April 2026

## Goal

Chat with the mirror from any machine's terminal. Config at `~/.mirror/config.json`, not tied to the repo directory.

---

## Deliverables

- `adapters/cli/index.ts` — REPL client (~40 lines): readline prompt, POST /message, print reply, /exit
- `adapters/cli/config.json.example` — template with serverUrl and token placeholder
- Updated `docs/getting-started.md` — CLI setup section

---

**See also:** [Test Guide](test-guide.md) · [CV0.E1 — Tracer Bullet](../tracer-bullet.md)
