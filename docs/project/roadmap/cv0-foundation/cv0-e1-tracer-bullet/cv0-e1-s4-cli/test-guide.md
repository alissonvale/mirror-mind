[< Docs](../../../../../index.md)

# Test Guide: CV0.E1.S4 — CLI Client

**Plan:** [Plan](plan.md)

---

## Setup

```bash
mkdir -p ~/.mirror
cp adapters/cli/config.json.example ~/.mirror/config.json
# Edit ~/.mirror/config.json — paste your real token
```

## 1. Connect and send a message

```bash
npx tsx adapters/cli/index.ts
```

Expect: `mirror-cli connected to https://mirror.softwarezen.com.br`

Type: `Quem é você?`

Expect: mirror replies in Portuguese, first person.

## 2. Context persists within session

Type: `O que eu acabei de perguntar?`

Expect: the mirror references your previous question.

## 3. Exit cleanly

Type: `/exit`

Expect: `Bye.` and the process exits.

## 4. Run from a different directory

```bash
cd /tmp
npx tsx ~/Code/mirror-mind/cli/index.ts
```

Expect: works the same — config is in `~/.mirror/`, not in the repo.

## 5. Bad config

Rename or delete `~/.mirror/config.json` temporarily, run the CLI.

Expect: clear error (file not found), not a cryptic crash.

---

**See also:** [Plan](plan.md)
