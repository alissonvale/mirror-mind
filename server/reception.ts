import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers, getOrganizations, getJourneys } from "./db.js";
import { extractPersonaDescriptor } from "./personas.js";
import { extractScopeDescriptor } from "./scopes.js";
import { getModels } from "./db/models.js";
import { resolveApiKey } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";

export interface ReceptionContext {
  // Empty for now — reserved for future (recent history, topic shifts)
}

export interface ReceptionResult {
  persona: string | null;
  organization: string | null;
  journey: string | null;
}

const NULL_RESULT: ReceptionResult = {
  persona: null,
  organization: null,
  journey: null,
};

type CompleteFn = typeof complete;

/**
 * Reception — a lightweight LLM call that classifies the user's message
 * before composing the system prompt. Returns three independent signals,
 * each nullable:
 *
 *  - persona: which specialized voice to layer on the base ego
 *  - organization: which broader situational scope (venture, community)
 *  - journey: which narrower situational scope (a specific crossing)
 *
 * A message can match any subset of the three. They are evaluated in a
 * single LLM call to keep latency and cost within the current budget.
 *
 * Falls back to all-nulls on any failure (timeout, invalid JSON) or when
 * no candidates exist at all. The response flow continues with base identity.
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
  const orgs = getOrganizations(db, userId); // excludes archived by default
  const journeys = getJourneys(db, userId);  // excludes archived by default

  if (personas.length === 0 && orgs.length === 0 && journeys.length === 0) {
    return NULL_RESULT;
  }

  const personaList = personas
    .map((p) => `- ${p.key}: ${extractPersonaDescriptor(p) ?? ""}`)
    .join("\n");

  const organizationList = orgs
    .map((o) => {
      const descriptor = extractScopeDescriptor(o);
      return descriptor
        ? `- ${o.key} ("${o.name}"): ${descriptor}`
        : `- ${o.key} ("${o.name}")`;
    })
    .join("\n");

  const orgIdToKey = new Map(orgs.map((o) => [o.id, o.key]));
  const journeyList = journeys
    .map((j) => {
      const descriptor = extractScopeDescriptor(j);
      const orgTag = j.organization_id
        ? ` [in ${orgIdToKey.get(j.organization_id) ?? "?"}]`
        : "";
      const head = `- ${j.key} ("${j.name}")${orgTag}`;
      return descriptor ? `${head}: ${descriptor}` : head;
    })
    .join("\n");

  const sections: string[] = [];
  if (personas.length > 0) {
    sections.push(`Available personas (key and descriptor):
${personaList}`);
  }
  if (orgs.length > 0) {
    sections.push(`Available organizations (broader situational context):
${organizationList}`);
  }
  if (journeys.length > 0) {
    sections.push(`Available journeys (narrower situational context; parenthesized org means the journey belongs to that organization):
${journeyList}`);
  }

  const systemPrompt = `You classify user messages across three independent axes to set up the mirror's composed context. Each axis is nullable — a message can match any subset.

**Three axes:**
- **persona** — a specialized lens for a specific domain of voice. When no clear domain is called for, the base ego voice responds directly — return null.
- **organization** — a broader situational scope the user is in (a venture, a community, a role). Activate when the message is clearly about that organization's affairs.
- **journey** — a narrower situational scope (a specific pursuit, a period, a crossing). Activate when the message is clearly about that journey. Orthogonal to organization: a journey may or may not belong to one; activate both when they apply simultaneously.

The three are independent. Choose each by its own evidence. A message may hit all three, one, or none.

The user may write in any language. Match semantically, not lexically. The user may refer to a scope by its **display name** (shown in quotes beside the key) or by its key, or by natural description of its domain — any of these should count as a match. **When you return, always use the literal key** (the identifier before the quoted name), never the name. Keys are lowercase with hyphens; names are human-facing and may contain spaces, capitalization, accents.

${sections.join("\n\n")}

**Return null for an axis when:**
- The message is a greeting, farewell, or casual small talk ("hi", "how are you?", "good morning") — all three axes null.
- The message is a meta-question about the mirror itself ("who are you?", "what do you do?", "how does it work?") — all three axes null.
- The message is an open existential or reflexive question without a clear domain — persona null; scopes null unless the question is explicitly about an organization or journey.
- No candidate in the list clearly matches — that axis null.

**Persona — action verbs dominate topic.** When the user asks for production of a text artifact (imperative verbs like "write", "draft", "compose" in any language), match against the persona whose descriptor covers that kind of production — even if the topic is conceptual. The verb defines the work; the topic is the subject matter, not the routing signal for persona.

**Organization and journey — activate by mention, name, or clear domain match.**

Activate a scope when any of these is true:
- The message names the scope (by its key, by its display name in quotes, or by a natural reference to what it is).
- The message asks about the domain the scope's descriptor covers — its situation, its priorities, its numbers, its progress, its state. Read the descriptor carefully; if the message is in that territory, the scope activates.
- **Sole-scope-in-domain rule — MANDATORY.** When there is exactly one scope in the list whose descriptor covers a given domain, any question within that domain activates that scope. There is no other scope the question could be about — so null is wrong. Examples: a single finance-related journey activates on any finance question; a single organization activates on any question about that organization's work. Skip this rule only if every scope in the list would be an unrelated stretch.

Only return null for a scope when:
- The message is a greeting, a meta-question about the mirror itself, or open existential reflection.
- The topic truly belongs to no scope in the list above — not "weakly related", but genuinely outside every descriptor.

**If you find yourself about to return null for a scope, first check:** is there exactly one scope whose descriptor covers the message's domain? If yes, return that scope's key, not null.

**Scopes are independent from personas.** A question about a domain activates both: (a) the persona whose voice handles that domain, and (b) the scope that IS the context within that domain. They are complementary — persona gives the voice, scope gives the situational content. Do not skip the scope because the persona already covers the topic; they contribute different things to the composed response.

**When both a journey and its parent organization apply** (e.g., a message about a journey that belongs to an org), return both keys. The composer injects both, broader before narrower.

Matching examples (abstract roles — map to the actual keys above):
- "Hi, how's it going?" → all null.
- "Who are you?" → all null.
- "quanto sobrou no caixa este mês?" → persona: the finance persona, if any; journey: the user's journey that covers finance (its descriptor names burn, runway, budget), if any. BOTH axes activate — persona for voice, journey for context.
- "Write an essay about silence" → persona: whichever covers writing production, if any; scopes null unless the task is explicitly scoped.
- "What are the priorities for [organization name] this quarter?" → organization: that key; journey: null unless a specific journey is named.
- "How's [journey name] going?" → journey: that key; organization: the journey's parent org if any.
- "I'm drafting an email for [journey name]'s newsletter" → persona: whichever covers writing; journey: that key; organization: if the journey has a parent org, include it.

Return JSON only: {"persona": "<key>|null", "organization": "<key>|null", "journey": "<key>|null"} using exact keys from the lists above, or null per axis. Do not wrap in markdown. Do not explain. JSON only.`;

  const config = getModels(db).reception;
  if (!config) return NULL_RESULT;
  const timeoutMs = config.timeout_ms ?? 5000;

  const startedAt = Date.now();
  try {
    const model = getModel(config.provider as any, config.model);
    const apiKey = await resolveApiKey(db, "reception");
    const response = await Promise.race([
      completeFn(
        model,
        {
          systemPrompt,
          messages: [{ role: "user", content: message }],
        },
        {
          apiKey,
          // Reception is pure classification; thinking adds latency and
          // (on some models like Gemini 2.5 Pro) hides the JSON output in
          // reasoning blocks the parser doesn't read. Minimal is the right
          // effort level for this task across all providers.
          reasoning: "minimal",
        } as any,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Reception timeout")), timeoutMs),
      ),
    ]);

    // Fire-and-forget usage log — real cost reconciled via OpenRouter's
    // /generation endpoint in the background. See server/usage.ts.
    try {
      logUsage(db, {
        role: "reception",
        env: currentEnv(),
        message: response as any,
        user_id: userId,
      });
    } catch (err) {
      console.log("[reception] logUsage failed:", (err as Error).message);
    }

    // Collect text from both text blocks and thinking blocks — some providers
    // (Gemini 2.5 Pro via OpenRouter) put the JSON output inside a reasoning
    // block instead of a text block when thinking is active. `reasoning:
    // "minimal"` should prevent that, but not all providers honor the option.
    // Defensive collection keeps us resilient.
    let text = "";
    const blockTypes: string[] = [];
    for (const block of response.content as any[]) {
      blockTypes.push(block.type);
      if (block.type === "text" && typeof block.text === "string") {
        text += block.text;
      } else if (block.type === "thinking" && typeof block.thinking === "string") {
        text += block.thinking;
      }
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      const latencyMs = Date.now() - startedAt;
      console.log(
        `[reception] no JSON in LLM response. latency=${latencyMs}ms blocks=[${blockTypes.join(",")}] raw=${text.slice(0, 200)}`,
      );
      return NULL_RESULT;
    }

    const parsed = JSON.parse(match[0]) as {
      persona?: string | null;
      organization?: string | null;
      journey?: string | null;
    };

    const personaKey =
      parsed.persona && personas.some((p) => p.key === parsed.persona)
        ? parsed.persona
        : null;
    const organizationKey =
      parsed.organization && orgs.some((o) => o.key === parsed.organization)
        ? parsed.organization
        : null;
    const journeyKey =
      parsed.journey && journeys.some((j) => j.key === parsed.journey)
        ? parsed.journey
        : null;

    const msgPreview = message.length > 80 ? message.slice(0, 80) + "…" : message;
    const latencyMs = Date.now() - startedAt;
    console.log(
      `[reception] msg="${msgPreview}" candidates={p:${personas.length},o:${orgs.length},j:${journeys.length}} latency=${latencyMs}ms parsed=${JSON.stringify(parsed)} final={persona:${personaKey},organization:${organizationKey},journey:${journeyKey}}`,
    );

    return {
      persona: personaKey,
      organization: organizationKey,
      journey: journeyKey,
    };
  } catch (err) {
    console.log("[reception] falling back to base identity:", (err as Error).message);
    return NULL_RESULT;
  }
}
