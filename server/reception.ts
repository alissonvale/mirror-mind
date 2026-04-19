import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers } from "./db.js";
import { extractPersonaDescriptor } from "./personas.js";
import { getModels } from "./db/models.js";

export interface ReceptionContext {
  // Empty for now — reserved for future (recent history, topic shifts, journeys)
}

export interface ReceptionResult {
  persona: string | null;
}

type CompleteFn = typeof complete;

/**
 * Reception — a lightweight LLM call that classifies the user's message
 * before composing the system prompt. Today, picks a persona. Tomorrow,
 * will detect topic shifts, journeys, intents.
 *
 * Falls back to { persona: null } on any failure (timeout, invalid JSON,
 * no personas available). The response flow continues with base identity.
 *
 * `completeFn` parameter exists for tests — defaults to pi-ai's complete.
 */
export async function receive(
  db: Database.Database,
  userId: string,
  message: string,
  _context: ReceptionContext = {},
  completeFn: CompleteFn = complete,
): Promise<ReceptionResult> {
  const layers = getIdentityLayers(db, userId);
  const personas = layers.filter((l) => l.layer === "persona");

  if (personas.length === 0) {
    return { persona: null };
  }

  const personaList = personas
    .map((p) => `- ${p.key}: ${extractPersonaDescriptor(p) ?? ""}`)
    .join("\n");

  const systemPrompt = `You classify user messages to select the most appropriate persona lens for the mirror to respond with.

Available personas:
${personaList}

Return JSON only: {"persona": "<persona_id>"} or {"persona": null} if none fits clearly.
Do not wrap in markdown. Do not explain. JSON only.`;

  const config = getModels(db).reception;
  if (!config) return { persona: null };
  const timeoutMs = config.timeout_ms ?? 5000;

  try {
    const model = getModel(config.provider as any, config.model);
    const response = await Promise.race([
      completeFn(
        model,
        {
          systemPrompt,
          messages: [{ role: "user", content: message }],
        },
        { apiKey: process.env.OPENROUTER_API_KEY },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Reception timeout")), timeoutMs),
      ),
    ]);

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { persona: null };

    const parsed = JSON.parse(match[0]) as { persona: string | null };
    if (parsed.persona && personas.some((p) => p.key === parsed.persona)) {
      return { persona: parsed.persona };
    }
    return { persona: null };
  } catch (err) {
    console.log("[reception] falling back to base identity:", (err as Error).message);
    return { persona: null };
  }
}
