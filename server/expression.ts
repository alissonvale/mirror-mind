import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers } from "./db.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, buildLlmHeaders } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";
import { logLlmCall } from "./llm-logging.js";

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

/**
 * Response length axis (CV1.E10.S2). Orthogonal to ResponseMode — mode
 * is the register/structure of the reply, length is the target size.
 * `null` at the session level means "auto" — let the mode's natural
 * length stand. Explicit values modulate within (and can override) the
 * mode's natural length, so combinations like `essayistic + brief`
 * (a bounded reflection) become expressible.
 */
export type ResponseLength = "brief" | "standard" | "full";

export const RESPONSE_LENGTHS: readonly ResponseLength[] = [
  "brief",
  "standard",
  "full",
] as const;

export function isResponseLength(value: unknown): value is ResponseLength {
  return (
    typeof value === "string" &&
    (RESPONSE_LENGTHS as readonly string[]).includes(value)
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
  /**
   * Optional explicit response length target (CV1.E10.S2). When `null`,
   * the mode's natural length stands; when set, the length guide is
   * appended to the prompt as the dominant size constraint, modulating
   * (or overriding) the mode's natural sizing — `essayistic + brief`
   * yields a bounded reflection; `conversational + full` yields a long
   * plain paragraph. Length is form, not substance — same as mode.
   */
  length?: ResponseLength | null;
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
/**
 * Soft length targets per ResponseLength value (CV1.E10.S2). The
 * expression pass treats these as the dominant size constraint —
 * stronger than the mode's natural length — so that combinations like
 * `essayistic + brief` (bounded reflection) actually compress, and
 * `conversational + full` (long plain paragraph) actually expands.
 *
 * The targets are word ranges, not hard caps. The LLM follows them as
 * guidance; if the substance genuinely fits a different size, the
 * mirror's voice still wins — better an off-target reply that lands
 * than an on-target reply that says nothing.
 */
const LENGTH_GUIDES: Record<ResponseLength, string> = {
  brief:
    "Length target: brief — around 50–150 words. One short paragraph is enough. If the draft developed multiple frames or examples, prune to the single most substantive one rather than compressing all of them. The brevity must still carry mirror voice; a short reply that says nothing is worse than no length target at all.",
  standard:
    "Length target: standard — around 150–400 words. Develop the substantive thought without adding asides or parallel framings. If the draft is much longer, drop supporting examples and tangents but preserve the through-line.",
  full:
    "Length target: full — around 400–800 words. The length should serve depth, not fill space. Don't pad with meta-commentary, recaps, or restatements. If the draft is shorter and the substance doesn't warrant more, leave it shorter — the target is a ceiling, not a quota.",
};

const MODE_GUIDES: Record<ResponseMode, string> = {
  conversational:
    "Hard cap: one to three sentences. Plain prose, no headers, no bullet lists, no preamble. Match the weight of the user's message — proportional, not minimal.\n\nIf the draft is already short and plain, leave it almost untouched.\n\n**If the draft is essayistic-shaped (multiple paragraphs, headers, lists, several sections of expansion), prune from scratch — do NOT try to compress the existing structure into the cap. Pick the draft's most substantive frame, turn, reflection, or question — the part that would make the user think 'that's a real angle'. Drop illustrative examples, parallel framings, supporting paragraphs, headers, lists.**\n\n**The kept text MUST carry mirror voice — perspective, specificity, lens. If the only candidate left after pruning is bland affirmation (\"Que bom\"), generic well-wishes (\"Que essa jornada lhe seja de valor\"), or paraphrase of the user's own words, the prune was wrong — go back to the draft and pick a sharper anchor. A short reply with mirror voice beats a long preserved reply; a short reply WITHOUT mirror voice is worse than either.**",
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
    input.length ?? null,
  );

  const userPrompt = buildUserPrompt(input.userMessage, input.draft);

  const timeoutMs = config.timeout_ms ?? 10000;
  const startedAt = Date.now();

  try {
    const model = getModel(config.provider as any, config.model);
    const apiKey = await resolveApiKey(db, "expression");
    let response: Awaited<ReturnType<CompleteFn>>;
    try {
      response = await Promise.race([
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
    } catch (err) {
      // CV1.E8.S1: log the failed call so the failure is debuggable
      // even though the caller silently falls back to the draft.
      logLlmCall(db, {
        role: "expression",
        provider: config.provider,
        model: config.model,
        system_prompt: systemPrompt,
        user_message: userPrompt,
        response: null,
        latency_ms: Date.now() - startedAt,
        session_id: options.sessionId ?? null,
        user_id: userId,
        env: currentEnv(),
        error: (err as Error).message,
      });
      throw err;
    }

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
    const latencyMs = Date.now() - startedAt;

    // CV1.E8.S1: full prompt + response capture (covers both paths
    // — empty-response fallback below + applied success).
    logLlmCall(db, {
      role: "expression",
      provider: config.provider,
      model: config.model,
      system_prompt: systemPrompt,
      user_message: userPrompt,
      response: text,
      tokens_in: ((response as any).usage?.input_tokens as number | undefined) ?? null,
      tokens_out: ((response as any).usage?.output_tokens as number | undefined) ?? null,
      cost_usd: ((response as any).cost as number | undefined) ?? null,
      latency_ms: latencyMs,
      session_id: options.sessionId ?? null,
      user_id: userId,
      env: currentEnv(),
      error: final ? null : "empty response — fell back to draft",
    });

    if (!final) {
      console.log(
        `[expression] empty response. mode=${input.mode} latency=${latencyMs}ms — falling back to draft`,
      );
      return { text: input.draft, mode: input.mode, applied: false };
    }

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
  length: ResponseLength | null,
): string {
  const modeGuide = MODE_GUIDES[mode];

  // Length block (CV1.E10.S2). Only emitted when an explicit length is
  // chosen — null leaves the mode's natural length to dominate (the
  // pre-S2 behavior). When present, length is the primary size signal,
  // and we say so explicitly so the LLM resolves conflicts with the
  // mode guide in length's favor.
  const lengthBlock = length
    ? `\n\n**Length — ${length}:**\n${LENGTH_GUIDES[length]}\n\nLength is the primary size constraint here. The mode guide above describes register and structure within that target; if the mode's natural length and the length target disagree, follow the length target.`
    : "";

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

**Preserve substance — with one exception.** Every claim, fact, concrete reference, name, number, and conclusion in the draft normally must survive in the final text. Do not add information the draft does not contain. If the draft is wrong, it stays wrong — that is not your job to fix.

**The exception: when mode is conversational and the draft is essayistic-shaped, form-fit wins over preservation — but only on expansion, not on substance.** A 1-3 sentence cap cannot accommodate a multi-paragraph draft with full preservation. In that case, prune to the draft's most substantive frame, turn, reflection, or question — the part that carries mirror voice (perspective, specificity, lens). Drop illustrative examples, supporting paragraphs, parallel framings, headers, lists. The kept gesture must still be the mirror reflecting; if pruning leaves only bland affirmation, generic well-wishes, or paraphrase of the user's words, the prune was wrong — pick a sharper anchor from the draft. A short reply that lands the mirror's voice cleanly beats a long preserved reply; a short reply that lands no voice is worse than either.

**Change form only (mostly).** Length, pacing, structure, vocabulary, punctuation, paragraph shape, use of headers and lists — these are yours to adjust. Voice stays the mirror's voice (first person, the tone of the draft).

**Mode — ${mode}:**
${modeGuide}${lengthBlock}${expressionBlock}${personaBlock}

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
