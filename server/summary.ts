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

    const systemPrompt = layer === "persona"
      ? `You generate a descriptor for a persona — a specialized lens the mirror activates for specific domains.

Purpose: the descriptor is read by (a) a router that decides which persona handles a user message, and (b) a human viewer scanning the Cognitive Map. It must be both clear about domain and evocative about character.

Format: 1 or 2 sentences (max ~45 words).
- First clause: name the DOMAIN and ACTIVATION TRIGGERS concretely — what kinds of messages route here. Use concrete nouns from the content ("finanças, gastos, runway" / "escrita, ensaios, posts" / "bugs, código, debug").
- Second clause (optional): capture the persona's distinctive posture, voice, or method. Concrete, not abstract.

Hard rules:
- Never open with "Esta persona", "This persona", "Opera na esfera de", "Serves as", "É a persona que...". Start with the domain itself.
- Never use "Distingue-se por...", "Diferencia-se por...", "Focuses on distinguishing...". No meta-differentiation.
- Name the actual domain from the prompt, not a generic category.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example (finance persona):
Finanças pessoais: gastos, runway, saldos, orçamento. Leitura calma de números como dado, não veredicto, sem urgência nem alarme.

BAD example:
Esta persona opera na esfera financeira. Ela ajuda com decisões sobre dinheiro. Distingue-se por um olhar calmo.

GOOD example (writing persona):
Escrita de textos longos: ensaios, posts, cartas. Prosa corrida com reviravolta, recusa bullet points e listicle, busca a dobra onde o pensamento vira.

BAD example:
Esta persona auxilia na escrita. Ela aplica regras de estilo. Ativa-se em tarefas textuais.

CRITICAL: Write in the same language as the persona content. Portuguese → Portuguese. English → English. Never translate. Detect and match the language exactly.`
      : `You generate a substantive descriptor for an identity layer in a personal mirror system.

Goal: 1 or 2 sentences (max ~40 words) that capture the particular character of THIS specific layer by naming its actual content — themes, values, rules, vocabulary, posture. The reader should learn what this layer IS, not what "a layer does" in abstract.

Hard rules:
- Never open with "Esta camada", "Este layer", "This layer", "This key", "Ela opera", "Ele descreve", "Opera na esfera de", "Serves as", "Defines..." or any meta-framing. Start directly with the content.
- Never describe "when it is activated" or "how it differs from other layers". Let the substance speak.
- Never end with "Distingue-se por...", "Diferencia-se por...", "Focuses on distinguishing itself...". No meta-differentiation.
- Name specific themes, values, rules, or vocabulary from the prompt. Concrete beats abstract.
- Neutral but substantive voice. No corporate or academic register.
- Output the descriptor only. No labels, no quotes, no preamble.

GOOD example (soul layer about primacy of being, integrity, peace of mind):
Primazia do ser sobre fazer, verdade antes de conforto, controle como ilusão. Fundação de princípios e valores que sustenta qualquer expressão operacional.

BAD example (formulaic, hollow):
Esta camada opera na esfera da identidade pessoal. Ela define os princípios e valores que guiam o indivíduo. Diferencia-se por focar na verdade e na paz interior.

GOOD example (expression layer about prose rules and vocabulary):
Prosa corrida, nunca listicle. Travessão proibido, aforismo como dobra de argumento. Vocabulário de travessia contra stack, funil, KPI.

BAD example:
Este layer descreve o estilo de escrita, incluindo pontuação e vocabulário. Ativa-se sempre que a interação envolve texto.

CRITICAL: Write in the same language as the layer content. Portuguese content → Portuguese summary. English content → English summary. Never translate. Detect and match the language exactly.`;

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
