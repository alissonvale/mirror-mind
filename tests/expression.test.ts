import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
} from "../server/db.js";
import {
  express,
  isResponseMode,
  RESPONSE_MODES,
  type ExpressionInput,
} from "../server/expression.js";

type CompleteFn = NonNullable<
  Parameters<typeof express>[3]
>["completeFn"];

function fakeComplete(text: string): CompleteFn {
  return (async () => ({
    content: [{ type: "text", text }],
    provider: "test",
    model: "test-model",
    usage: { input: 10, output: 20 },
  })) as unknown as CompleteFn;
}

function capturingComplete(reply: string = "SHAPED"): {
  fn: CompleteFn;
  getSystemPrompt: () => string | undefined;
  getUserContent: () => string | undefined;
} {
  let systemPrompt: string | undefined;
  let userContent: string | undefined;
  const fn = (async (
    _model: unknown,
    req: {
      systemPrompt: string;
      messages: Array<{ role: string; content: string }>;
    },
  ) => {
    systemPrompt = req.systemPrompt;
    userContent = req.messages[0]?.content;
    return {
      content: [{ type: "text", text: reply }],
      provider: "test",
      model: "test-model",
      usage: { input: 10, output: 20 },
    };
  }) as unknown as CompleteFn;
  return {
    fn,
    getSystemPrompt: () => systemPrompt,
    getUserContent: () => userContent,
  };
}

function failingComplete(): CompleteFn {
  return (async () => {
    throw new Error("boom");
  }) as unknown as CompleteFn;
}

const BASE_INPUT: ExpressionInput = {
  draft: "This is the draft produced by the main model.",
  userMessage: "Tell me something.",
  personaKey: null,
  mode: "conversational",
};

describe("expression — mode guards", () => {
  it("RESPONSE_MODES is the canonical set", () => {
    expect(RESPONSE_MODES).toEqual([
      "conversational",
      "compositional",
      "essayistic",
    ]);
  });

  it("isResponseMode narrows correctly", () => {
    expect(isResponseMode("conversational")).toBe(true);
    expect(isResponseMode("compositional")).toBe(true);
    expect(isResponseMode("essayistic")).toBe(true);
    expect(isResponseMode("chatty")).toBe(false);
    expect(isResponseMode(null)).toBe(false);
    expect(isResponseMode(undefined)).toBe(false);
    expect(isResponseMode(42)).toBe(false);
  });
});

describe("express — happy path", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("returns the LLM's rewritten text and marks applied=true", async () => {
    const result = await express(db, userId, BASE_INPUT, {
      completeFn: fakeComplete("Reshaped reply."),
    });

    expect(result.text).toBe("Reshaped reply.");
    expect(result.mode).toBe("conversational");
    expect(result.applied).toBe(true);
  });

  it("includes the user's message and the draft in the user prompt", async () => {
    const cap = capturingComplete();
    await express(
      db,
      userId,
      {
        ...BASE_INPUT,
        userMessage: "Had coffee with Mike Fraser.",
        draft: "Mike Fraser, eh?",
      },
      { completeFn: cap.fn },
    );

    const userContent = cap.getUserContent() ?? "";
    expect(userContent).toContain("Had coffee with Mike Fraser.");
    expect(userContent).toContain("Mike Fraser, eh?");
  });
});

describe("express — mode wiring", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("names each mode in the system prompt", async () => {
    for (const mode of RESPONSE_MODES) {
      const cap = capturingComplete();
      await express(
        db,
        userId,
        { ...BASE_INPUT, mode },
        { completeFn: cap.fn },
      );
      expect(cap.getSystemPrompt()).toContain(`Mode — ${mode}`);
    }
  });

  it("embeds mode-specific guidance so the three prompts differ", async () => {
    const prompts: Record<string, string> = {};
    for (const mode of RESPONSE_MODES) {
      const cap = capturingComplete();
      await express(
        db,
        userId,
        { ...BASE_INPUT, mode },
        { completeFn: cap.fn },
      );
      prompts[mode] = cap.getSystemPrompt() ?? "";
    }
    expect(prompts.conversational).not.toEqual(prompts.compositional);
    expect(prompts.compositional).not.toEqual(prompts.essayistic);
    expect(prompts.conversational).not.toEqual(prompts.essayistic);
  });
});

describe("express — expression layer input", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("includes ego/expression content when present", async () => {
    setIdentityLayer(
      db,
      userId,
      "ego",
      "expression",
      "Plain prose by default. Words I avoid: leverage, optimize.",
    );

    const cap = capturingComplete();
    await express(db, userId, BASE_INPUT, { completeFn: cap.fn });

    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).toContain("Plain prose by default");
    expect(prompt).toContain("leverage, optimize");
  });

  it("omits the expression block when ego/expression is missing", async () => {
    const cap = capturingComplete();
    await express(db, userId, BASE_INPUT, { completeFn: cap.fn });

    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).not.toContain("The user's expression rules");
  });

  it("omits the expression block when ego/expression is only whitespace", async () => {
    setIdentityLayer(db, userId, "ego", "expression", "   \n\n   ");

    const cap = capturingComplete();
    await express(db, userId, BASE_INPUT, { completeFn: cap.fn });

    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).not.toContain("The user's expression rules");
  });
});

describe("express — persona input", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("names the persona when provided", async () => {
    const cap = capturingComplete();
    await express(
      db,
      userId,
      { ...BASE_INPUT, personaKey: "mentora" },
      { completeFn: cap.fn },
    );

    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).toContain('active persona for this turn is "mentora"');
  });

  it("omits the persona block when personaKey is null", async () => {
    const cap = capturingComplete();
    await express(db, userId, BASE_INPUT, { completeFn: cap.fn });

    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).not.toContain("active persona for this turn");
  });
});

describe("express — fallback paths", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("falls back to the draft on LLM error, applied=false", async () => {
    const result = await express(db, userId, BASE_INPUT, {
      completeFn: failingComplete(),
    });

    expect(result.text).toBe(BASE_INPUT.draft);
    expect(result.applied).toBe(false);
    expect(result.mode).toBe("conversational");
  });

  it("falls back to the draft on empty LLM output", async () => {
    const result = await express(db, userId, BASE_INPUT, {
      completeFn: fakeComplete("   "),
    });

    expect(result.text).toBe(BASE_INPUT.draft);
    expect(result.applied).toBe(false);
  });

  it("falls back to the draft when the expression role is absent", async () => {
    db.prepare("DELETE FROM models WHERE role = 'expression'").run();
    let called = false;
    const neverCalled = (async () => {
      called = true;
      return { content: [{ type: "text", text: "never" }] };
    }) as unknown as CompleteFn;

    const result = await express(db, userId, BASE_INPUT, {
      completeFn: neverCalled,
    });

    expect(result.text).toBe(BASE_INPUT.draft);
    expect(result.applied).toBe(false);
    expect(called).toBe(false);
  });
});

describe("express — usage logging", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("logs the call under role='expression' with the session_id", async () => {
    await express(db, userId, BASE_INPUT, {
      completeFn: fakeComplete("done"),
      sessionId: "sess-abc",
    });

    const row = db
      .prepare(
        "SELECT role, session_id, user_id FROM usage_log WHERE role = 'expression' LIMIT 1",
      )
      .get() as { role: string; session_id: string | null; user_id: string };
    expect(row.role).toBe("expression");
    expect(row.session_id).toBe("sess-abc");
    expect(row.user_id).toBe(userId);
  });

  it("does not log on fallback", async () => {
    await express(db, userId, BASE_INPUT, {
      completeFn: failingComplete(),
    });

    const { c } = db
      .prepare("SELECT COUNT(*) as c FROM usage_log WHERE role = 'expression'")
      .get() as { c: number };
    expect(c).toBe(0);
  });
});
