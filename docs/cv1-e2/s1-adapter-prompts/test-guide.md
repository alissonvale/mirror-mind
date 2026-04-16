[< Docs](../../index.md)

# Test Guide: CV1.E2.S1 — Adapter-aware prompts

## Automated

```bash
npm test
```

Identity tests verify adapter instruction appended after soul + ego + persona, unknown adapters ignored.

## Manual

Send the same question on different channels and compare the style:

**Question:** any topic your mirror has depth on (e.g., a concept from your identity, a strategic question, a personal reflection).

| Channel | Expected style |
|---------|---------------|
| Telegram | 2-4 short paragraphs, conversational, no headers or lists |
| Web | Structured, markdown, can go deep |
| CLI | Scannable paragraphs, no headers |

### Verify config is respected

Edit `config/adapters.json` — change Telegram instruction to something visible (e.g., add "Always start with 'Hey!'"). Restart server, send Telegram message. Verify the change takes effect.

---

**See also:** [Plan](plan.md)
