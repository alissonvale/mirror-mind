import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { getIdentityLayers, getOrganizations, getJourneys } from "./db.js";
import { extractPersonaDescriptor } from "./personas.js";
import { extractScopeDescriptor } from "./scopes.js";
import { getModels } from "./db/models.js";

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

**Organization and journey — context follows mention or theme.** Activate when the message names the scope (by its key or a natural reference) or when the domain is unambiguously about its affairs. Do not activate a scope just because its domain overlaps loosely with the message's subject.

**When both a journey and its parent organization apply** (e.g., a message about a journey that belongs to an org), return both keys. The composer injects both, broader before narrower.

Matching examples (using abstract roles — map to the actual keys above):
- "Hi, how's it going?" → all null.
- "Who are you?" → all null.
- "What's the balance in my account?" → persona: whichever covers finance, if any; organization and journey: null unless named.
- "Write an essay about silence" → persona: whichever covers writing production, if any; scopes null unless the task is scoped.
- "What are the priorities for [organization name] this quarter?" → organization: that key; persona: null unless production is asked; journey: null unless narrowed.
- "How's [journey name] going?" → journey: that key; organization: the journey's parent org if any; persona: null.
- "I'm drafting an email for [journey name]'s newsletter" → persona: whichever covers writing; journey: that key; organization: if the journey has a parent org, include it.

Return JSON only: {"persona": "<key>|null", "organization": "<key>|null", "journey": "<key>|null"} using exact keys from the lists above, or null per axis. Do not wrap in markdown. Do not explain. JSON only.`;

  const config = getModels(db).reception;
  if (!config) return NULL_RESULT;
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
    if (!match) {
      console.log(
        `[reception] no JSON in LLM response. raw=${text.slice(0, 200)}`,
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
    console.log(
      `[reception] msg="${msgPreview}" candidates={p:${personas.length},o:${orgs.length},j:${journeys.length}} parsed=${JSON.stringify(parsed)} final={persona:${personaKey},organization:${organizationKey},journey:${journeyKey}}`,
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
