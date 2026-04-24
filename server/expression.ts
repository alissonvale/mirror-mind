import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers } from "./db.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, buildLlmHeaders } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";

export type ResponseMode = "conversational" | "compositional" | "essayistic";

export const RESPONSE_MODES: readonly ResponseMode[] = [
  "conversational",
  "compositional",
  "essayistic",
] as const;

export function isResponseMode(value: unknown): value is ResponseMode {
  return (
    typeof value === "string" &&
    (RESPONSE_MODES as readonly string[]).includes(value)
  );
}

export interface ExpressionInput {
  /** The raw text produced by the main generation pass. */
  draft: string;
  /** The user's message that elicited the draft. */
  userMessage: string;
  /**
   * Active persona keys for this turn (CV1.E7.S5). Zero-or-more. The
   * first entry is the leading lens. Empty array = no persona (base
   * ego voice authored the draft). Expression pass preserves each
   * lens's contribution without labeling segments in the output.
   */
  personaKeys: string[];
  /** Chosen response mode for this turn. */
  mode: ResponseMode;
}

export interface ExpressionResult {
  /** The final, expressed text. On fallback, equals input.draft. */
  text: string;
  /** Which mode was applied. */
  mode: ResponseMode;
  /** True when the pass ran; false when we fell back (role missing, LLM failure). */
  applied: boolean;
}

type CompleteFn = typeof complete;

interface ExpressOptions {
  completeFn?: CompleteFn;
  sessionId?: string | null;
}

/**
 * Describes each mode to the expression LLM. Short, declarative — the
 * model does not benefit from prose beyond these markers. Descriptions
 * are the sole source of truth for how modes differ.
 */
const MODE_GUIDES: Record<ResponseMode, string> = {
  conversational:
    "Short and close. One to three sentences. No headers, no bullet lists, no preamble. Meet the message on its own register — the kind of answer you'd give in a real exchange. If the draft is already short and plain, leave it almost untouched.",
  compositional:
    "Structured but tight. Use headers and lists only when the content is genuinely list-shaped (steps, comparisons, enumerations). Prefer short paragraphs to long ones. Think 'clean answer', not 'essay'.",
  essayistic:
    "Reflective and fuller. Develop the thought across paragraphs with connective tissue between ideas. Prose over lists. The reader is after depth, not a summary.",
};

/**
 * Post-generation expression pass (CV1.E7.S1). The draft produced by the
 * main Agent is rewritten by a small dedicated model to match the chosen
 * response mode and the user's ego/expression rules. The substance is
 * preserved; only form is touched.
 *
 * Always on in v1 (D2 in plan.md). Falls back silently to the unchanged
 * draft on any failure — missing role row, missing API key, LLM error,
 * invalid response shape. The caller never needs a fallback branch.
 *
 * `options.completeFn` exists for tests — defaults to pi-ai's complete.
 * `options.sessionId` is threaded into usage logging so expression calls
 * can be attributed per-session alongside main/reception.
 */
export async function express(
  db: Database.Database,
  userId: string,
  input: ExpressionInput,
  options: ExpressOptions = {},
): Promise<ExpressionResult> {
  const completeFn = options.completeFn ?? complete;

  const config = getModels(db).expression;
  if (!config) {
    return { text: input.draft, mode: input.mode, applied: false };
  }

  const layers = getIdentityLayers(db, userId);
  const expressionLayer =
    layers.find((l) => l.layer === "ego" && l.key === "expression")?.content ??
    null;

  const systemPrompt = buildSystemPrompt(
    input.mode,
    expressionLayer,
    input.personaKeys,
  );

  const userPrompt = buildUserPrompt(input.userMessage, input.draft);

  const timeoutMs = config.timeout_ms ?? 10000;
  const startedAt = Date.now();

  try {
    const model = getModel(config.provider as any, config.model);
    const apiKey = await resolveApiKey(db, "expression");
    const response = await Promise.race([
      completeFn(
        model,
        {
          systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        },
        {
          apiKey,
          // Expression is text transformation, not reasoning. Same policy as
          // reception — minimal effort keeps latency down and avoids the
          // reasoning-block swallow trap on some providers.
          reasoning: "minimal",
          headers: buildLlmHeaders(),
        } as any,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Expression timeout")), timeoutMs),
      ),
    ]);

    try {
      logUsage(db, {
        role: "expression",
        env: currentEnv(),
        message: response as any,
        user_id: userId,
        session_id: options.sessionId ?? null,
      });
    } catch (err) {
      console.log("[expression] logUsage failed:", (err as Error).message);
    }

    let text = "";
    for (const block of response.content as any[]) {
      if (block.type === "text" && typeof block.text === "string") {
        text += block.text;
      }
    }

    const final = text.trim();
    if (!final) {
      const latencyMs = Date.now() - startedAt;
      console.log(
        `[expression] empty response. mode=${input.mode} latency=${latencyMs}ms — falling back to draft`,
      );
      return { text: input.draft, mode: input.mode, applied: false };
    }

    const latencyMs = Date.now() - startedAt;
    console.log(
      `[expression] mode=${input.mode} latency=${latencyMs}ms draft_chars=${input.draft.length} final_chars=${final.length}`,
    );

    return { text: final, mode: input.mode, applied: true };
  } catch (err) {
    console.log(
      "[expression] falling back to draft:",
      (err as Error).message,
    );
    return { text: input.draft, mode: input.mode, applied: false };
  }
}

function buildSystemPrompt(
  mode: ResponseMode,
  expressionLayer: string | null,
  personaKeys: string[],
): string {
  const modeGuide = MODE_GUIDES[mode];

  const expressionBlock = expressionLayer?.trim()
    ? `\n\nThe user's expression rules (apply on top of the mode):\n\n${expressionLayer.trim()}`
    : "";

  let personaBlock = "";
  if (personaKeys.length === 1) {
    personaBlock = `\n\nThe active persona for this turn is "${personaKeys[0]}". The draft was produced by that persona; preserve its voice — you are only adjusting form, not lens.`;
  } else if (personaKeys.length > 1) {
    const list = personaKeys.map((k) => `"${k}"`).join(", ");
    personaBlock = `\n\nMultiple persona lenses produced this turn together: ${list}. The draft integrates all of their contributions into one unified voice. Preserve each lens's distinctive contribution to the draft; do not label segments or mark transitions between lenses inside the text. Your job is form only — the integration is already done.`;
  }

  return `You are a form editor for a response the mirror has just generated. Your job is to rewrite the draft so it matches the chosen response mode and the user's expression rules. You are not answering the user — the answer already exists as the draft. You are shaping how that answer reads.

**Preserve substance.** Every claim, fact, concrete reference, name, number, and conclusion in the draft must survive in the final text. Do not add information the draft does not contain. Do not remove information the draft contains. If the draft is wrong, it stays wrong — that is not your job to fix.

**Change form only.** Length, pacing, structure, vocabulary, punctuation, paragraph shape, use of headers and lists — these are yours to adjust. Voice stays the mirror's voice (first person, the tone of the draft).

**Mode — ${mode}:**
${modeGuide}${expressionBlock}${personaBlock}

Return only the rewritten text. No preamble ("Here is the rewritten version:"), no commentary, no code fence. Plain text only.`;
}

function buildUserPrompt(userMessage: string, draft: string): string {
  return `The user wrote:
<<<
${userMessage}
>>>

Draft to reshape:
<<<
${draft}
>>>

Rewrite the draft now.`;
}
