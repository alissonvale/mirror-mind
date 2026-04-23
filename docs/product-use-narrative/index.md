# Product Use Narrative

A narrative account of how Mirror Mind is used in practice, told through four fictional users — a family of four whose independent uses of the mirror span the product's surface area. It is simultaneously a story, a fixture set, and a design instrument. Three purposes at once:

1. **Development data.** Realistic, coherent user states for building and testing features that depend on multi-user scenarios, identity depth, organizations, journeys, and accumulated conversation history.

2. **Demo material.** Four characters whose situations and uses of the mirror can be walked through in presentations, onboarding, or written documentation without leaking real user data.

3. **Design pressure.** Authoring complete characters forces the product model to hold. If a persona has nowhere to live, if a journey doesn't fit the schema, if the narrative needs something the database can't express — we've found a gap.

## The family

The four members are **independent, parallel tenants** on the same Mirror Mind server. They are narratively related but share no data: no cross-user references, no shared organizations, no inter-user conversations. Each has their own identity, organizations, journeys, personas, and (eventually) sample conversations.

The server itself is the father's doing. Dan is a career IT infrastructure engineer and a homelabber; he discovered Mirror Mind, provisioned a small VPS, stood up the server, and added the other three as users. The family shares a host. They don't share a mirror.

| Role | Character | Status |
|---|---|---|
| Father (admin / host) | [Dan Reilly](users/dan-reilly/profile.md) | 🚧 Pilot — in progress |
| Mother | TBD | ⏳ Pending |
| Son | TBD | ⏳ Pending |
| Daughter | TBD | ⏳ Pending |

## Intended structure

Each user lives under `users/<slug>/`. The layout below is being calibrated on Dan and mirrors the actual schema: each file under `identity/` maps one-to-one to a row in the `identity(layer, key, content)` table.

```
users/<slug>/
  profile.md                — narrative bio (author reference only; not loaded into the DB)
  user.yaml                 — structured user record (name, role, seed metadata)
  identity/
    self/
      soul.md               — layer=self, key=soul
    ego/
      identity.md           — layer=ego, key=identity
      behavior.md           — layer=ego, key=behavior
      expression.md         — layer=ego, key=expression
    persona/
      <key>.md              — layer=persona, one file per persona
  organizations/
    <key>.md                — frontmatter + briefing/situation/summary sections
  journeys/
    <key>.md                — frontmatter + briefing/situation/summary, optional org link
  conversations/            — optional sample sessions in the mirror-mind import format
    <date>-<slug>.md
```

**Loader contract for `identity/`:** walk `identity/<layer>/<key>.md`, read the file body, and upsert `(user_id, layer, key, content)`. No other metadata lives in these files — the path encodes layer and key, and the body is the content as stored.

Mirror Mind today uses `self/soul`, `ego/{identity, behavior, expression}`, and one `persona/<key>` per domain. There is no `user` layer in active use; the biographical context lives in `profile.md` as an author reference.

## Workflow

1. **Pilot Dan end-to-end.** Build one complete character. This calibrates the format.
2. **Replicate for the other three.** Same pattern, different lives.
3. **Write the loader.** A program that reads this tree and provisions a fresh Mirror Mind database. Comes after the fixture structure is stable.

## Rules

- All content in English. The demo is fiction and doesn't need to match the repo's primary user.
- No real identifying data — names, companies, locations are invented.
- Each character must stand alone: no implicit references to other family members inside their own identity or journeys. Narrative links exist only at the README level, not in the data.
