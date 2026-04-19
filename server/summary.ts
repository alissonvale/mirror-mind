import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers, setIdentitySummary } from "./db/identity.js";
import { getModels } from "./db/models.js";

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

    const systemPrompt = `You generate concise summaries for identity layers in a personal mirror system.

Rules:
- 2 to 3 sentences describing (1) the angle or domain in which it operates, (2) what it does and when it is activated, (3) what distinguishes it from other layers.
- Use neutral descriptive voice.
- Do not copy the prompt literally; synthesize.
- Match the language of the original layer content.
- Just the summary text, nothing else.`;

    const config = getModels(db).title;
    if (!config) return;
    const timeoutMs = config.timeout_ms ?? 8000;

    const model = getModel(config.provider as any, config.model);
    const response = await Promise.race([
      completeFn(
        model,
        {
          systemPrompt,
          messages: [{ role: "user", content: target.content }],
        },
        { apiKey: process.env.OPENROUTER_API_KEY },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Summary generation timeout")), timeoutMs),
      ),
    ]);

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

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
