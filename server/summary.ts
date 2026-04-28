import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers, setIdentitySummary } from "./db/identity.js";
import {
  getOrganizationByKey,
  setOrganizationSummary,
} from "./db/organizations.js";
import { getJourneyByKey, setJourneySummary } from "./db/journeys.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, buildLlmHeaders } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";
import { logLlmCall } from "./llm-logging.js";

type CompleteFn = typeof complete;

/**
 * Background summary generator for identity layers. Reads the layer's content,
 * asks the cheap "title" model for a 2-3 sentence descriptive summary, and
 * writes it to `identity.summary`.
 *
 * Used by:
 * - Cognitive Map cards (instead of `firstLine`, which surfaces markdown
 *   headers like "# Alma").
 * - Reception descriptor (instead of `extractPersonaDescriptor`'s first
 *   non-header line, which can be ambiguous between Template B personas).
 *
 * Fire-and-forget by contract for the Save trigger — callers should not await.
 * The Regenerate button in the workshop awaits so the user sees the new
 * summary on the next page render.
 *
 * On any failure (no content, timeout, parse error, API error), the layer
 * keeps its existing summary (or NULL) and consumers fall back to first
 * line of content. Logged, not thrown.
 */
export async function generateLayerSummary(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
  completeFn: CompleteFn = complete,
): Promise<void> {
  try {
    const layers = getIdentityLayers(db, userId);
    const target = layers.find((l) => l.layer === layer && l.key === key);
    if (!target || !target.content.trim()) return;

    const systemPrompt = layer === "persona"
      ? `You generate a descriptor for a persona — a specialized lens the mirror activates for specific domains.

Purpose: the descriptor is read by (a) a router that decides which persona handles a user message, and (b) a human viewer scanning the Cognitive Map. It must be both clear about domain and evocative about character.

Format: 1 or 2 sentences (max ~45 words).
- First clause: name the DOMAIN and ACTIVATION TRIGGERS concretely — what kinds of messages route here. Use concrete nouns from the content (e.g. "finance, spending, runway" / "writing, essays, posts" / "bugs, code, debug").
- Second clause (optional): capture the persona's distinctive posture, voice, or method. Concrete, not abstract.

Hard rules:
- Never open with meta-framing like "This persona", "It operates in the domain of", "Serves as", "Is the persona that...". Start with the domain itself.
- Never use "Distinguishes itself by...", "Differs from others by...", "Focuses on distinguishing...". No meta-differentiation.
- Name the actual domain from the prompt, not a generic category.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example (finance persona):
Personal finance: spending, runway, balances, budget. Calm reading of numbers as data, not verdict, without urgency or alarm.

BAD example:
This persona operates in the financial domain. It helps with decisions about money. It distinguishes itself by a calm gaze.

GOOD example (writing persona):
Long-form writing: essays, posts, letters. Flowing prose with a pivot, rejects bullet points and listicle, seeks the fold where thought turns.

BAD example:
This persona assists with writing. It applies style rules. It activates in textual tasks.

CRITICAL: Write the descriptor in the same language as the persona content. If the content is Portuguese, write in Portuguese; if English, write in English; and so on. Never translate. Detect the language of the content you receive and match it exactly.`
      : `You generate a substantive descriptor for an identity layer in a personal mirror system.

Goal: 1 or 2 sentences (max ~40 words) that capture the particular character of THIS specific layer by naming its actual content — themes, values, rules, vocabulary, posture. The reader should learn what this layer IS, not what "a layer does" in abstract.

Hard rules:
- Never open with meta-framing like "This layer", "This key", "It operates", "It describes", "Operates in the domain of", "Serves as", "Defines...". Start directly with the content.
- Never describe "when it is activated" or "how it differs from other layers". Let the substance speak.
- Never end with "Distinguishes itself by...", "Differs from others by...", "Focuses on distinguishing itself...". No meta-differentiation.
- Name specific themes, values, rules, or vocabulary from the prompt. Concrete beats abstract.
- Neutral but substantive voice. No corporate or academic register.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example (soul layer about primacy of being, integrity, peace of mind):
Primacy of being over doing, truth before comfort, control as illusion. Foundation of principles and values that sustains any operational expression.

BAD example (formulaic, hollow):
This layer operates in the domain of personal identity. It defines the principles and values that guide the individual. It distinguishes itself by focusing on truth and inner peace.

GOOD example (expression layer about prose rules and vocabulary):
Flowing prose, never listicle. Em-dash forbidden, aphorism as the pivot of argument. Own vocabulary of crossing against stack, funnel, KPI.

BAD example:
This layer describes the writing style, including punctuation and vocabulary. It activates whenever the interaction involves text.

CRITICAL: Write the summary in the same language as the layer content. If the content is Portuguese, write in Portuguese; if English, write in English; and so on. Never translate. Detect the language of the content you receive and match it exactly.`;

    const config = getModels(db).title;
    if (!config) return;
    const timeoutMs = config.timeout_ms ?? 8000;

    const model = getModel(config.provider as any, config.model);
    const apiKey = await resolveApiKey(db, "title");
    const startedAt = Date.now();
    let response: Awaited<ReturnType<CompleteFn>>;
    try {
      response = await Promise.race([
        completeFn(
          model,
          {
            systemPrompt,
            messages: [{ role: "user", content: target.content }],
          },
          { apiKey, headers: buildLlmHeaders() } as any,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Summary generation timeout")), timeoutMs),
        ),
      ]);
    } catch (err) {
      logLlmCall(db, {
        role: "summary",
        provider: config.provider,
        model: config.model,
        system_prompt: systemPrompt,
        user_message: target.content,
        response: null,
        latency_ms: Date.now() - startedAt,
        user_id: userId,
        env: currentEnv(),
        error: (err as Error).message,
      });
      throw err;
    }

    try {
      logUsage(db, {
        role: "summary",
        env: currentEnv(),
        message: response as any,
        user_id: userId,
      });
    } catch (err) {
      console.log("[summary] logUsage failed:", (err as Error).message);
    }

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    // CV1.E8.S1: full prompt + response capture.
    logLlmCall(db, {
      role: "summary",
      provider: config.provider,
      model: config.model,
      system_prompt: systemPrompt,
      user_message: target.content,
      response: text,
      tokens_in: ((response as any).usage?.input_tokens as number | undefined) ?? null,
      tokens_out: ((response as any).usage?.output_tokens as number | undefined) ?? null,
      cost_usd: ((response as any).cost as number | undefined) ?? null,
      latency_ms: Date.now() - startedAt,
      user_id: userId,
      env: currentEnv(),
    });

    const cleaned = text.trim().slice(0, 500);
    if (!cleaned) return;
    setIdentitySummary(db, userId, layer, key, cleaned);
  } catch (err) {
    console.log(
      "[summary] generation failed, layer keeps existing summary:",
      (err as Error).message,
    );
  }
}

/**
 * Result of a scope summary generation attempt. Used by the Regenerate
 * Summary button to show the user explicit feedback on the workshop
 * page — otherwise silent failures (empty source, LLM timeout, API
 * error) look identical to "nothing happened", since the form-POST
 * redirect hides the underlying status.
 *
 * Fire-and-forget callers (the Save trigger) ignore this value.
 */
export type ScopeSummaryResult = "ok" | "empty" | "timeout" | "error";

/**
 * Background summary generator for scopes — organizations and journeys.
 * Symmetric with generateLayerSummary: reads the scope's briefing +
 * situation, asks the cheap title model for a short routing-aware
 * descriptor, writes it to the scope's `summary` field.
 *
 * Used by:
 * - The scope workshop's Summary block (display + reception tooltip).
 * - Reception classifier's candidate list (extractScopeDescriptor prefers
 *   `summary` when present).
 *
 * Fire-and-forget by contract on Save — callers should not await.
 * Regenerate buttons await so the UI reflects the new value on next render.
 *
 * On failure (no source, timeout, parse error, API error), the scope
 * keeps its existing summary (or NULL) and consumers fall back to the
 * briefing+situation fallback in extractScopeDescriptor. The categorized
 * result is returned to the caller; failures are also logged.
 */
export async function generateScopeSummary(
  db: Database.Database,
  userId: string,
  scopeType: "organization" | "journey",
  key: string,
  completeFn: CompleteFn = complete,
): Promise<ScopeSummaryResult> {
  try {
    const scope =
      scopeType === "organization"
        ? getOrganizationByKey(db, userId, key)
        : getJourneyByKey(db, userId, key);
    if (!scope) return "error";

    const source = [scope.briefing, scope.situation]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n---\n\n");
    if (!source) return "empty";

    const systemPrompt =
      scopeType === "organization"
        ? `You generate a short descriptor for an organization — a broader situational scope the mirror's user is part of (a venture, a community, a role).

Purpose: the descriptor is read by (a) a reception classifier that decides when to activate this organization for a message, and (b) a human scanning the list of their own scopes. It must clearly name what the organization is AND signal what's currently in play.

Format: 1 or 2 sentences (max ~45 words).
- First clause: name the organization's IDENTITY concretely — what it is, what it does, who it's for. Use concrete nouns from the content.
- Second clause (optional): capture what's in play RIGHT NOW — the current phase, the active transition, what the user should know about its state today.

Hard rules:
- Never open with "This organization", "It operates in", "Serves as", "Is the organization that...". Start directly with the content.
- Never use "Distinguishes itself by...", "Differs from...". No meta-differentiation.
- Name the actual organization, not a generic category.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example:
Software Zen: training a new generation of software professionals guided by consciousness, sovereignty, mastery. Currently in transition — no recurring revenue, consolidating the Espelho environment and mirror-mind foundation.

BAD example:
This organization operates in the education technology domain. It focuses on developing software professionals. It distinguishes itself by its philosophical approach.

CRITICAL: Write the summary in the same language as the organization's content. If the content is Portuguese, write in Portuguese; if English, write in English. Never translate. Detect the language of the content you receive and match it exactly.`
        : `You generate a short descriptor for a journey — a narrower situational scope (a specific pursuit, a period, a crossing the user is going through).

Purpose: the descriptor is read by (a) a reception classifier that decides when to activate this journey for a message, and (b) a human scanning the list of their own journeys. It must clearly name what the journey is AND where it stands right now.

Format: 1 or 2 sentences (max ~45 words).
- First clause: name the journey's CONTEXT concretely — what it's for, what the user is pursuing or crossing. Use concrete nouns from the content.
- Second clause (optional): capture where the journey stands RIGHT NOW — current phase, progress, what's the active focus.

Hard rules:
- Never open with "This journey", "It is a period", "Serves as", "Is the journey that...". Start directly with the content.
- Never use "Distinguishes itself by...", "Differs from...". No meta-differentiation.
- Name the actual journey, not a generic category.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example:
Personal finance survival period without programmed revenue. Living on reserves, ~17 month runway, tracking burn and the categorization of recurring expenses to extend margin.

BAD example:
This journey is a period focused on finances. It operates during a specific phase of the user's life. It distinguishes itself by focusing on survival.

CRITICAL: Write the summary in the same language as the journey's content. If the content is Portuguese, write in Portuguese; if English, write in English. Never translate. Detect the language of the content you receive and match it exactly.`;

    const config = getModels(db).title;
    if (!config) return "error";
    // Scope summaries send briefing+situation as input — larger than the
    // compact context that title generation uses. The title role's default
    // 8s timeout is too tight for this payload, so we floor at 30s here.
    const timeoutMs = Math.max(config.timeout_ms ?? 0, 30000);

    const model = getModel(config.provider as any, config.model);
    const apiKey = await resolveApiKey(db, "title");
    const startedAt = Date.now();
    let response: Awaited<ReturnType<CompleteFn>>;
    try {
      response = await Promise.race([
        completeFn(
          model,
          {
            systemPrompt,
            messages: [{ role: "user", content: source }],
          },
          { apiKey, headers: buildLlmHeaders() } as any,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Summary generation timeout")), timeoutMs),
        ),
      ]);
    } catch (err) {
      logLlmCall(db, {
        role: "summary",
        provider: config.provider,
        model: config.model,
        system_prompt: systemPrompt,
        user_message: source,
        response: null,
        latency_ms: Date.now() - startedAt,
        user_id: userId,
        env: currentEnv(),
        error: (err as Error).message,
      });
      throw err;
    }

    try {
      logUsage(db, {
        role: "summary",
        env: currentEnv(),
        message: response as any,
        user_id: userId,
      });
    } catch (err) {
      console.log("[summary] logUsage failed:", (err as Error).message);
    }

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    // CV1.E8.S1: full prompt + response capture.
    logLlmCall(db, {
      role: "summary",
      provider: config.provider,
      model: config.model,
      system_prompt: systemPrompt,
      user_message: source,
      response: text,
      tokens_in: ((response as any).usage?.input_tokens as number | undefined) ?? null,
      tokens_out: ((response as any).usage?.output_tokens as number | undefined) ?? null,
      cost_usd: ((response as any).cost as number | undefined) ?? null,
      latency_ms: Date.now() - startedAt,
      user_id: userId,
      env: currentEnv(),
    });

    const cleaned = text.trim().slice(0, 500);
    if (!cleaned) return "error";

    if (scopeType === "organization") {
      setOrganizationSummary(db, userId, key, cleaned);
    } else {
      setJourneySummary(db, userId, key, cleaned);
    }
    return "ok";
  } catch (err) {
    const message = (err as Error).message;
    console.log(
      `[summary] ${scopeType} generation failed, scope keeps existing summary:`,
      message,
    );
    return message.toLowerCase().includes("timeout") ? "timeout" : "error";
  }
}
