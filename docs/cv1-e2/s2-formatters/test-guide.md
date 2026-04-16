[< Docs](../../index.md)

# Test Guide: CV1.E2.S2 — Formatter per adapter

## Automated

```bash
npm test
```

11 formatter tests: headers→bold, lists→bullets, bold/italic/code/links preserved, special chars escaped, plain text passthrough, fallback on error.

## Manual — Telegram formatting

Send messages that trigger rich formatting:

| Input | What to check |
|-------|--------------|
| "Qual a diferença entre SSE e WebSocket?" | Bold terms render as bold, not `**raw**` |
| "Me dê 3 passos para X" | Bullets appear as • not raw `-` |
| "Me mostra um exemplo de código" | Code blocks render correctly |

### Verify fallback

If MarkdownV2 parsing fails (Telegram rejects the message), the bot should retry with plain text. The user sees the reply without formatting rather than an error.

---

**See also:** [Plan](plan.md)
