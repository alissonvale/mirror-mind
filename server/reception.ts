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

  const systemPrompt = `You classify user messages to select the most appropriate persona lens for the mirror to respond with. Personas are specialized lenses for specific domains. When no clear domain is called for, the base ego voice responds directly — return null in that case, not a best-guess persona.

The user may write in any language. Match the pattern semantically, not lexically. The persona keys are literal identifiers — return one of the keys exactly as listed below, or null.

Available personas (key and descriptor):
${personaList}

Return null when:
- The message is a greeting, farewell, or casual small talk ("hi", "how are you?", "good morning")
- The message is a meta-question about the mirror itself — identity, capabilities, functioning ("who are you?", "what do you do?", "how does it work?", "do you have a name?", "why do you exist?")
- The message is an open existential or reflexive question without a clear domain attached
- No persona descriptor among those listed clearly matches the domain of the message

Return a persona only when the message clearly matches one of the domains described in the list above, OR the user explicitly names a persona by its key.

**Action verbs dominate topic.** When the user asks for the production of a text artifact (imperative verbs like "write", "draft", "compose", "produce a text/post/essay/email", and their equivalents in any language), match against the persona whose descriptor covers that kind of production — even if the topic is conceptual, philosophical, or from another domain. The verb defines the work; the topic is just the subject matter, not the routing signal.

Matching examples (using abstract persona roles — map to the actual keys in the list):
- "Who are you?" → null (meta question about the mirror)
- "Hi, how's it going?" → null (casual greeting)
- "What's the balance in my account?" → the persona whose descriptor covers finance, if any; else null
- "Write an essay about silence" → the persona whose descriptor covers writing production, if any; else null
- "Write a text relating antifragility and coherence" → same writing-production persona (conceptual topic, but the task is to produce text)
- "What do you think about antifragility?" → the persona whose descriptor covers conceptual/reflective inquiry, if any; else null (pure inquiry, no production)
- "I feel lost" → the persona whose descriptor covers emotional or psychological support, if any; else null

Return JSON only: {"persona": "<persona_key>"} using one of the exact keys from the list above, or {"persona": null}. Do not wrap in markdown. Do not explain. JSON only.`;

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
