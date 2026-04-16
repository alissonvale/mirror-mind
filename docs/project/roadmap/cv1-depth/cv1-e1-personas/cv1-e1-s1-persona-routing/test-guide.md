[< Docs](../../../../../index.md)

# Test Guide: CV1.E1.S1 — Reception v1

**Plan:** [Plan](plan.md)

---

## Automated

```bash
npm test
```

All 41 tests should pass (6 for reception, updated identity/db/smoke tests).

---

## Manual — persona routing

### Setup

User must have persona layers imported. On the VPS or locally:

```bash
npx tsx server/admin.ts identity import <name> --from-poc
```

Expected: `Imported 17 identity layers` (3 base + 14 personas).

### Send messages in different domains

From any channel (CLI, Web, Telegram) send messages that clearly fit different personas:

| Input | Expected persona |
|-------|------------------|
| "Me ajuda a refletir sobre uma decisão" | `mentora` or `terapeuta` |
| "Qual a diferença entre SSE e WebSocket?" | `tecnica` |
| "Como posicionar esse produto no mercado?" | `estrategista` |
| "Me ajuda a escrever um artigo sobre X" | `escritora` |
| "Quantos euros eu tenho no runway?" | `tesoureira` |
| "oi" | null (no persona) |

**Expected:**
- Response prefixed with `◇ persona` when a persona fits
- Response without signature when no persona fits
- Tone/depth changes based on persona

### Check the signature location

- **Web chat:** signature appears as small muted text above the bubble
- **CLI:** signature is part of the reply text
- **Telegram:** signature is part of the reply text

### Verify history rendering

Open `/chat` in the web. Previous assistant messages should show their signatures (when a persona was used). Messages sent before this feature won't have signatures — expected.

### Verify fallback

Edit `config/models.json` temporarily with an invalid reception model (e.g., `reception.model: "invalid/model"`), restart the server, send a message.

**Expected:**
- Server log: `[reception] falling back to base identity: ...`
- Response still arrives (takes ~5s extra because of timeout)
- No signature

Revert `config/models.json` after testing.

---

**See also:** [Plan](plan.md) · [Admin CLI Reference](../../product/admin-cli.md)
