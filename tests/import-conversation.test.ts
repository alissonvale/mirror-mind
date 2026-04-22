import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createOrganization,
  createJourney,
  loadMessages,
  getSessionTags,
} from "../server/db.js";
import {
  importConversationDir,
  ImportError,
} from "../server/import/conversation-importer.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

function setupBasicUser(db: Database.Database) {
  const user = createUser(db, "alisson", "h");
  setIdentityLayer(db, user.id, "persona", "estrategista", "# estrategista prompt");
  return user;
}

function makeFixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mirror-import-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content, "utf-8");
  }
  return dir;
}

describe("importConversationDir", () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("imports two canonical files into two sessions", () => {
    const db = freshDb();
    const user = setupBasicUser(db);

    dir = makeFixtureDir({
      "01-first.md": `---
title: "First conversation"
---

**User:**
hi

**Assistant:**
hello
`,
      "02-second.md": `---
title: "Second conversation"
---

**User:**
again

**Assistant:**
back
`,
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    expect(report.dryRun).toBe(false);
    expect(report.sessionsCreated).toBe(2);
    expect(report.entriesCreated).toBe(4);
    expect(report.files.map((f) => f.status)).toEqual(["imported", "imported"]);

    const sessions = db
      .prepare("SELECT id, title FROM sessions WHERE user_id = ? ORDER BY created_at")
      .all(user.id) as Array<{ id: string; title: string }>;
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.title).toBe("First conversation");
    expect(sessions[1]!.title).toBe("Second conversation");

    const msgs = loadMessages(db, sessions[0]!.id);
    expect(msgs).toHaveLength(2);
    expect((msgs[0] as any).role).toBe("user");
    expect((msgs[0] as any).content[0].text).toBe("hi");
    expect((msgs[1] as any).role).toBe("assistant");
    expect((msgs[1] as any).content[0].text).toBe("hello");

    const tags = getSessionTags(db, sessions[0]!.id);
    expect(tags.personaKeys).toEqual(["estrategista"]);
    expect(tags.organizationKeys).toEqual([]);
    expect(tags.journeyKeys).toEqual([]);
  });

  it("falls back to filename when title is missing", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({
      "untitled-conv.md": `**User:**
hi

**Assistant:**
hello
`,
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    expect(report.sessionsCreated).toBe(1);
    expect(report.files[0]!.title).toBe("untitled-conv");
    const row = db.prepare("SELECT title FROM sessions").get() as { title: string };
    expect(row.title).toBe("untitled-conv");
  });

  it("tags with organization and journey when supplied", () => {
    const db = freshDb();
    const user = setupBasicUser(db);
    createOrganization(db, user.id, "software-zen", "Software Zen");
    createJourney(db, user.id, "o-espelho", "O Espelho");

    dir = makeFixtureDir({
      "a.md": `**User:**
x

**Assistant:**
y
`,
    });

    importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
      organizationKey: "software-zen",
      journeyKey: "o-espelho",
    });

    const sessionId = (db.prepare("SELECT id FROM sessions").get() as { id: string }).id;
    const tags = getSessionTags(db, sessionId);
    expect(tags.personaKeys).toEqual(["estrategista"]);
    expect(tags.organizationKeys).toEqual(["software-zen"]);
    expect(tags.journeyKeys).toEqual(["o-espelho"]);
  });

  it("dry-run reports without writing", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({
      "a.md": `---
title: "A"
---

**User:**
x

**Assistant:**
y
`,
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.sessionsCreated).toBe(0);
    expect(report.entriesCreated).toBe(0);
    expect(report.files[0]!.status).toBe("would-import");
    expect(report.files[0]!.entryCount).toBe(2);

    const count = db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number };
    expect(count.c).toBe(0);
  });

  it("records parse errors per-file without aborting the run", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({
      "01-good.md": `**User:**
ok

**Assistant:**
ok
`,
      "02-bad.md": `**User:**
x

**User:**
two users in a row
`,
      "03-good.md": `**User:**
ok

**Assistant:**
ok
`,
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    expect(report.sessionsCreated).toBe(2);
    expect(report.files.map((f) => f.status)).toEqual([
      "imported",
      "error",
      "imported",
    ]);
    expect(report.files[1]!.reason).toMatch(/Alternation violation/);
  });

  it("skips files with no role headings (warning, not error)", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({
      "empty.md": `---
title: "ghost"
---

just some text without headings
`,
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    expect(report.sessionsCreated).toBe(0);
    expect(report.files[0]!.status).toBe("skipped");
    expect(report.files[0]!.reason).toBe("no role headings found");
  });

  it("ignores non-.md files in the directory", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({
      "a.md": `**User:**
hi

**Assistant:**
hi
`,
      "README.txt": "not a conversation",
      "junk.json": "{}",
    });

    const report = importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    expect(report.filesProcessed).toBe(1);
    expect(report.sessionsCreated).toBe(1);
  });

  it("entries within a session are returned in insertion order", () => {
    const db = freshDb();
    const user = setupBasicUser(db);

    dir = makeFixtureDir({
      "long.md": `**User:**
one

**Assistant:**
two

**User:**
three

**Assistant:**
four

**User:**
five
`,
    });

    importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    const sessionId = (db.prepare("SELECT id FROM sessions WHERE user_id = ?").get(user.id) as { id: string }).id;
    const msgs = loadMessages(db, sessionId);
    expect(msgs.map((m) => (m as any).content[0].text)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
    ]);
  });

  it("fails fast on missing user", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({ "a.md": "**User:**\nhi\n" });

    expect(() =>
      importConversationDir(db, {
        userName: "ghost",
        dir,
        personaKey: "estrategista",
      }),
    ).toThrow(ImportError);
    expect(() =>
      importConversationDir(db, {
        userName: "ghost",
        dir,
        personaKey: "estrategista",
      }),
    ).toThrow(/User "ghost" not found/);
  });

  it("fails fast on missing persona", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({ "a.md": "**User:**\nhi\n" });

    expect(() =>
      importConversationDir(db, {
        userName: "alisson",
        dir,
        personaKey: "ghost-persona",
      }),
    ).toThrow(/Persona "ghost-persona" not found/);
  });

  it("fails fast on missing organization", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({ "a.md": "**User:**\nhi\n" });

    expect(() =>
      importConversationDir(db, {
        userName: "alisson",
        dir,
        personaKey: "estrategista",
        organizationKey: "ghost-org",
      }),
    ).toThrow(/Organization "ghost-org" not found/);
  });

  it("fails fast on missing journey", () => {
    const db = freshDb();
    setupBasicUser(db);

    dir = makeFixtureDir({ "a.md": "**User:**\nhi\n" });

    expect(() =>
      importConversationDir(db, {
        userName: "alisson",
        dir,
        personaKey: "estrategista",
        journeyKey: "ghost-journey",
      }),
    ).toThrow(/Journey "ghost-journey" not found/);
  });

  it("imported sessions get distinct created_at values", () => {
    const db = freshDb();
    const user = setupBasicUser(db);

    dir = makeFixtureDir({
      "01.md": "**User:**\na\n\n**Assistant:**\nb\n",
      "02.md": "**User:**\nc\n\n**Assistant:**\nd\n",
      "03.md": "**User:**\ne\n\n**Assistant:**\nf\n",
    });

    importConversationDir(db, {
      userName: "alisson",
      dir,
      personaKey: "estrategista",
    });

    const created = db
      .prepare("SELECT created_at FROM sessions WHERE user_id = ? ORDER BY created_at")
      .all(user.id) as Array<{ created_at: number }>;
    expect(new Set(created.map((r) => r.created_at)).size).toBe(3);
  });
});
