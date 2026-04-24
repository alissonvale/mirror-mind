import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import {
  getIdentityLayers,
  getOrganizations,
  getJourneys,
  type SessionTags,
} from "./db.js";
import { extractPersonaDescriptor } from "./personas.js";
import { extractScopeDescriptor } from "./scopes.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, buildLlmHeaders } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";
import { isResponseMode, type ResponseMode } from "./expression.js";

export interface ReceptionContext {
  /**
   * Session tag pool (CV1.E4.S4). When present, each non-empty list
   * constrains reception to only consider that subset for its
   * respective type. Empty lists are ignored — reception considers
   * all candidates of that type, as before.
   */
  sessionTags?: SessionTags;
}

export interface ReceptionResult {
  persona: string | null;
  organization: string | null;
  journey: string | null;
  /**
   * Response mode picked for this turn (CV1.E7.S1). Non-null by design —
   * defaults to "conversational" on silence or failure so the loud shape
   * (essayistic) never wins by accident. Overridden per-session via the
   * rail's mode selector; when a session has an override set, the caller
   * ignores this field.
   */
  mode: ResponseMode;
}

const DEFAULT_MODE: ResponseMode = "conversational";

const NULL_RESULT: ReceptionResult = {
  persona: null,
  organization: null,
  journey: null,
  mode: DEFAULT_MODE,
};

type CompleteFn = typeof complete;

/**
 * Reception — a lightweight LLM call that classifies the user's message
 * before composing the system prompt. Returns four signals in one call:
 *
 *  - persona: which specialized voice to layer on the base ego (nullable)
 *  - organization: which broader situational scope (nullable)
 *  - journey: which narrower situational scope (nullable)
 *  - mode: the shape of answer invited — conversational / compositional /
 *    essayistic. Non-null by design; the caller (CV1.E7.S1 expression pass)
 *    can trust mode to always be one of the three literals. Defaults to
 *    "conversational" on any fallback path so the loud shape never wins
 *    by accident.
 *
 * A message can match any subset of the three scope axes. They are
 * evaluated together with mode in a single LLM call to keep latency and
 * cost within the current budget.
 *
 * Falls back to all-nulls + conversational mode on any failure (timeout,
 * invalid JSON) or when no candidates exist at all. The response flow
 * continues with base identity and the default mode.
 *
 * `completeFn` parameter exists for tests — defaults to pi-ai's complete.
 */
export async function receive(
  db: Database.Database,
  userId: string,
  message: string,
  context: ReceptionContext = {},
  completeFn: CompleteFn = complete,
): Promise<ReceptionResult> {
  const layers = getIdentityLayers(db, userId);
  let personas = layers.filter((l) => l.layer === "persona");
  // Concluded scopes remain routable — their context is still relevant
  // for questions about past work. Archived scopes stay out.
  let orgs = getOrganizations(db, userId, { includeConcluded: true });
  let journeys = getJourneys(db, userId, { includeConcluded: true });

  // CV1.E4.S4: narrow the candidate pool when the session has tags of
  // that type. Empty lists are ignored — reception considers all.
  const tags = context.sessionTags;
  if (tags) {
    if (tags.personaKeys.length > 0) {
      const allowed = new Set(tags.personaKeys);
      personas = personas.filter((p) => allowed.has(p.key));
    }
    if (tags.organizationKeys.length > 0) {
      const allowed = new Set(tags.organizationKeys);
      orgs = orgs.filter((o) => allowed.has(o.key));
    }
    if (tags.journeyKeys.length > 0) {
      const allowed = new Set(tags.journeyKeys);
      journeys = journeys.filter((j) => allowed.has(j.key));
    }
  }

  // No routable candidates → skip the LLM call entirely and return the
  // default-mode null result. Most messages with no candidates are small
  // talk or meta ("hi", "who are you?"), all legitimately conversational;
  // saving a round-trip is better than classifying mode in isolation for
  // the rare non-trivial turn.
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

  const systemPrompt = `You classify user messages across four axes to set up the mirror's composed context. The first three (persona, organization, journey) are nullable — a message can match any subset. The fourth (mode) is always picked.

**Four axes:**
- **persona** — a specialized lens for a specific domain of voice. When no clear domain is called for, the base ego voice responds directly — return null.
- **organization** — a broader situational scope the user is in (a venture, a community, a role). Activate when the message is clearly about that organization's affairs.
- **journey** — a narrower situational scope (a specific pursuit, a period, a crossing). Activate when the message is clearly about that journey. Orthogonal to organization: a journey may or may not belong to one; activate both when they apply simultaneously.
- **mode** — the shape of answer the message invites. Always one of "conversational", "compositional", "essayistic". See the mode rules below.

The first three axes are independent. Choose each by its own evidence. A message may hit all three, one, or none. Mode is always picked.

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

**Mode — how to pick. Read carefully; this is the axis most easily over-weighted by topic.**

**Form beats topic.** The message's *register* (how it was written — length, whether it's a statement or a question, whether it explicitly asks for depth) is the primary signal. The *topic* (what it's about) is secondary. Deep topics in short form read as short; shallow topics in long form read as long. Respect the form the user used.

- **conversational** — short, lived-in, first-person writing. Statements, reactions, quick check-ins, one-line confessions, offhand observations. Greetings, small talk, casual questions with factual answers. **This is the default.** Short first-person statements are conversational *even when the topic is existential or developmental* — the short form is itself the signal that the user wants a close, proportional reply. One or two sentences back; never an essay.
- **compositional** — the message asks for structured information, comparison, enumeration, a how-to, or a decision-support analysis with parts. "Explain VMware vs Proxmox for the homelab migration." "What are the tradeoffs of X vs Y?" "Walk me through setting up Z." "List the pros and cons." The answer wants headers, lists, or clear sections.
- **essayistic** — the message is **explicitly** a long-form reflective ask: a how-should-I-think question, an open-ended developmental question that names the reflection it wants, OR the message itself is long, exploratory prose with multiple clauses that invite sustained response. "How should I think about the empty nest?" "What does it mean to X when Y?" "Help me work through why I keep avoiding this." "I've been turning this over for weeks and I still can't find the thread — [multi-sentence exploration]." The answer wants depth, connective tissue, prose over lists.

**The lighter-mode tiebreaker — now primary, not fallback.** When in doubt between two modes, always pick the lighter one (conversational < compositional < essayistic). The cost of under-shaping a reflective message is small (the user can ask for more depth); the cost of over-shaping a short statement is large (the user feels lectured).

**Key rule for short first-person statements about deep topics:**
- A one-or-two-sentence statement from the user is conversational. Full stop. Topic doesn't override this.
- "Sometimes I can't understand my kids" → conversational.
- "Had a weird dream about my father" → conversational.
- "I've been angry all week" → conversational.
- "I don't know what I want anymore" → conversational.
- Essayistic would only win if the user adds explicit framing: "How should I think about why I can't understand my kids?" or a long multi-clause exploration.

Matching examples (abstract roles — map to the actual keys above):
- "Hi, how's it going?" → persona/org/journey null; mode: conversational.
- "Who are you?" → persona/org/journey null; mode: conversational.
- "Had coffee with Mike Fraser this morning." → all scope axes null (unless Mike is a journey/org); mode: conversational.
- "Sometimes I can't understand my kids." → scopes null; mode: conversational (short first-person statement — form beats developmental topic).
- "quanto sobrou no caixa este mês?" → persona: the finance persona, if any; journey: the user's journey that covers finance. Mode: conversational (factual, short answer invited).
- "Write an essay about silence" → persona: whichever covers writing production, if any; mode: essayistic (the artifact requested IS an essay).
- "What are the priorities for [organization name] this quarter?" → organization: that key; mode: compositional (priorities want a list or sections).
- "How's [journey name] going?" → journey: that key; mode: conversational (status catch-up).
- "How should I think about leaving vs staying?" → scopes as applicable; mode: essayistic (explicit 'how should I think about' frames a reflection).

Return JSON only: {"persona": "<key>|null", "organization": "<key>|null", "journey": "<key>|null", "mode": "conversational|compositional|essayistic"} using exact keys from the lists above, or null per scope axis. Mode is always one of the three literals — never null. Do not wrap in markdown. Do not explain. JSON only.`;

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
          headers: buildLlmHeaders(),
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
      mode?: unknown;
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
    const mode: ResponseMode = isResponseMode(parsed.mode)
      ? parsed.mode
      : DEFAULT_MODE;

    const msgPreview = message.length > 80 ? message.slice(0, 80) + "…" : message;
    const latencyMs = Date.now() - startedAt;
    console.log(
      `[reception] msg="${msgPreview}" candidates={p:${personas.length},o:${orgs.length},j:${journeys.length}} latency=${latencyMs}ms parsed=${JSON.stringify(parsed)} final={persona:${personaKey},organization:${organizationKey},journey:${journeyKey},mode:${mode}}`,
    );

    return {
      persona: personaKey,
      organization: organizationKey,
      journey: journeyKey,
      mode,
    };
  } catch (err) {
    console.log("[reception] falling back to base identity:", (err as Error).message);
    return NULL_RESULT;
  }
}
