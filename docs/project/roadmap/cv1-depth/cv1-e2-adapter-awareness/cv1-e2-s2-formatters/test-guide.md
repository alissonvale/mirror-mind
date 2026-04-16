[< Docs](../../../../../index.md)

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
| A technical question that triggers comparisons | Bold terms render as bold, not `**raw**` |
| A question that triggers step-by-step advice | Bullets appear as • not raw `-` |
| A question that triggers code examples | Code blocks render correctly |

### Verify fallback

If MarkdownV2 parsing fails (Telegram rejects the message), the bot should retry with plain text. The user sees the reply without formatting rather than an error.

---

**See also:** [Plan](plan.md)
