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
  /**
   * Personas picked for this turn (CV1.E7.S5). Zero-or-more: reception
   * may activate no persona, one, or a set of lenses that cover the
   * message's substance together. Order is meaningful — the first entry
   * is the "leading lens" used by the UI for the bubble color bar.
   *
   * Empty array replaces the previous `persona: null`. Single-element
   * is the common case (and identical to the previous singular
   * behavior). Multi-element is the integrated-voicing case: composer
   * renders all blocks under a shared "one voice, multiple lenses"
   * instruction.
   */
  personas: string[];
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
  /**
   * Whether the turn touches identity / purpose / values — the signal
   * that gates `self/soul` and `ego/identity` composition (CV1.E7.S4).
   * `true` activates both deep identity layers; `false` skips both.
   * Boolean (not split soul/identity) — the two layers compose together
   * by design; if real use surfaces "I want one but not the other", S4b
   * splits the axis. Conservative default: `false` on missing field or
   * on reception failure (silence = skip; identity-touching turns are
   * the minority case, so the default reflects that).
   */
  touches_identity: boolean;
  /**
   * Whether the turn is a Voz da Alma moment — a journal-tone fragment
   * of personal weight that wants the wise-voice composition path
   * instead of the canonical persona pipeline (CV1.E9.S3). When `true`,
   * the pipeline routes to `composeAlmaPrompt`, skips persona pool
   * seeding, and stamps the assistant entry with `_is_alma: true`.
   * Conservative default: `false` on missing field, drift, or any
   * reception failure. False positives are corrosive (patronizing
   * wisdom on small talk); false negatives are recoverable via S4's
   * manual override ("Enviar Para… Voz da Alma").
   */
  is_self_moment: boolean;
  /**
   * Out-of-pool "would have picked" signals (CV1.E7.S8). Populated only
   * when reception sees a strictly better candidate **outside** the
   * session pool than what the constraint allows it to pick canonically.
   * Drives the rail's suggestion card — *"`maker` may have something
   * to say"* / *"Add `vida-economica` context"* — that triggers an
   * opt-in divergent run. Null when the canonical pick is already the
   * best, when there are no out-of-pool candidates, or on any drift
   * / failure path. The user's click on the suggestion is the signal
   * that flips the divergent run on; reception is not re-classified.
   */
  would_have_persona: string | null;
  would_have_organization: string | null;
  would_have_journey: string | null;
}

const DEFAULT_MODE: ResponseMode = "conversational";

const NULL_RESULT: ReceptionResult = {
  personas: [],
  organization: null,
  journey: null,
  mode: DEFAULT_MODE,
  touches_identity: false,
  is_self_moment: false,
  would_have_persona: null,
  would_have_organization: null,
  would_have_journey: null,
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
  const allPersonas = layers.filter((l) => l.layer === "persona");
  // Concluded scopes remain routable — their context is still relevant
  // for questions about past work. Archived scopes stay out.
  const allOrgs = getOrganizations(db, userId, { includeConcluded: true });
  const allJourneys = getJourneys(db, userId, { includeConcluded: true });

  let personas = allPersonas;
  let orgs = allOrgs;
  let journeys = allJourneys;

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

  // CV1.E7.S8: out-of-pool sets — what the constraint hides from
  // reception's canonical pick but is still in the user's data. Used to
  // ask reception for a `would_have_X` flag when an out-of-pool candidate
  // would be a strictly better fit than the in-pool options. Empty when
  // no constraint applies to the corresponding axis (full pool == filtered
  // pool); reception sees one list and there's nothing to suggest from
  // outside it.
  const outOfPoolPersonas = allPersonas.filter(
    (p) => !personas.some((fp) => fp.key === p.key),
  );
  const outOfPoolOrgs = allOrgs.filter(
    (o) => !orgs.some((fo) => fo.key === o.key),
  );
  const outOfPoolJourneys = allJourneys.filter(
    (j) => !journeys.some((fj) => fj.key === j.key),
  );

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

  // CV1.E7.S8: out-of-pool listings rendered separately so reception can
  // flag a `would_have_X` candidate without picking it canonically.
  const outOfPoolPersonaList = outOfPoolPersonas
    .map((p) => `- ${p.key}: ${extractPersonaDescriptor(p) ?? ""}`)
    .join("\n");
  const outOfPoolOrgList = outOfPoolOrgs
    .map((o) => {
      const descriptor = extractScopeDescriptor(o);
      return descriptor
        ? `- ${o.key} ("${o.name}"): ${descriptor}`
        : `- ${o.key} ("${o.name}")`;
    })
    .join("\n");
  const allOrgsIdToKey = new Map(allOrgs.map((o) => [o.id, o.key]));
  const outOfPoolJourneyList = outOfPoolJourneys
    .map((j) => {
      const descriptor = extractScopeDescriptor(j);
      const orgTag = j.organization_id
        ? ` [in ${allOrgsIdToKey.get(j.organization_id) ?? "?"}]`
        : "";
      const head = `- ${j.key} ("${j.name}")${orgTag}`;
      return descriptor ? `${head}: ${descriptor}` : head;
    })
    .join("\n");

  const sections: string[] = [];
  if (personas.length > 0) {
    sections.push(`Available personas — SESSION POOL (pick canonical from these):
${personaList}`);
  }
  if (outOfPoolPersonas.length > 0) {
    sections.push(`Available personas — OUT-OF-POOL (do NOT pick canonically; only flag as would_have_persona if a clear out-of-pool match where every in-pool option is a stretch):
${outOfPoolPersonaList}`);
  }
  if (orgs.length > 0) {
    sections.push(`Available organizations — SESSION POOL (broader situational context; pick canonical from these):
${organizationList}`);
  }
  if (outOfPoolOrgs.length > 0) {
    sections.push(`Available organizations — OUT-OF-POOL (do NOT pick canonically; only flag as would_have_organization for a clear out-of-pool match):
${outOfPoolOrgList}`);
  }
  if (journeys.length > 0) {
    sections.push(`Available journeys — SESSION POOL (narrower situational context; parenthesized org means the journey belongs to that organization; pick canonical from these):
${journeyList}`);
  }
  if (outOfPoolJourneys.length > 0) {
    sections.push(`Available journeys — OUT-OF-POOL (do NOT pick canonically; only flag as would_have_journey for a clear out-of-pool match):
${outOfPoolJourneyList}`);
  }

  const systemPrompt = `You classify user messages across six canonical axes plus three "would have picked" auxiliary axes to set up the mirror's composed context.

**Six canonical axes** (drive the actual response):
- **personas** — an array of specialized lenses. Zero, one, or more. Return an empty array when no clear domain is called for (the base ego voice answers). Return a single persona when one lens clearly covers the message's substance. Return multiple personas ONLY when the message genuinely spans two or more domains that need to be woven together in a single reply.
- **organization** — a broader situational scope the user is in (a venture, a community, a role). Activate when the message is clearly about that organization's affairs.
- **journey** — a narrower situational scope (a specific pursuit, a period, a crossing). Activate when the message is clearly about that journey. Orthogonal to organization.
- **mode** — the shape of answer the message invites. Always one of "conversational", "compositional", "essayistic".
- **touches_identity** — boolean. \`true\` only when the turn invites depth on identity, purpose, or values. \`false\` is the default and the conservative pick.
- **is_self_moment** — boolean. \`true\` only when the message is a journal-tone fragment of personal weight that wants the wise-voice composition (the Voz da Alma path) rather than the canonical persona pipeline. \`false\` is the default and the conservative pick.

**Three auxiliary "would have picked" axes** (CV1.E7.S8 — drive the rail's out-of-pool suggestion card):
- **would_have_persona** — string or null. Set to a key from the OUT-OF-POOL personas list ONLY when that out-of-pool candidate is a strictly better fit than every in-pool option (the in-pool options would all be a stretch, but the out-of-pool one cleanly covers the message's domain).
- **would_have_organization** — same rule as would_have_persona, for organizations.
- **would_have_journey** — same rule, for journeys.

The persona and scope canonical axes pick from the SESSION POOL only. The would_have_X auxiliary axes pick from the OUT-OF-POOL list only. Never use a session-pool key as a would_have_X. Never use an out-of-pool key as canonical.

**Personas — prefer the minimum sufficient set.** Return the smallest number of personas that can carry the reply's substance. One persona is the common case. Two is warranted when the message obviously invites two distinct lenses to cooperate (e.g., "how should I position and launch X?" → strategist + communicator; "should I stay or leave, and help me write the message either way" → therapist + writer). Three or more is rare and only for genuinely multi-domain asks. Do not stack personas for cosmetic coverage.

**Order matters.** When returning multiple personas, put the **leading lens first** — the persona whose frame opens the answer. The composer treats the first element as primary and the UI uses its color for the bubble color bar.

The user may write in any language. Match semantically, not lexically. The user may refer to a scope by its **display name** (shown in quotes beside the key) or by its key, or by natural description of its domain — any of these should count as a match. **When you return, always use the literal key** (the identifier before the quoted name), never the name. Keys are lowercase with hyphens; names are human-facing and may contain spaces, capitalization, accents.

${sections.join("\n\n")}

**Return empty/null for an axis when:**
- The message is a greeting, farewell, or casual small talk ("hi", "how are you?", "good morning") — personas empty, scopes null.
- The message is a meta-question about the mirror itself ("who are you?", "what do you do?", "how does it work?") — personas empty, scopes null.
- The message is an open existential or reflexive question without a clear domain — personas empty; scopes null unless the question is explicitly about an organization or journey.
- No candidate in the list clearly matches — that axis empty/null.

**Persona — action verbs dominate topic.** When the user asks for production of a text artifact (imperative verbs like "write", "draft", "compose" in any language), include the persona whose descriptor covers that kind of production — even if the topic is conceptual. The verb defines the work; the topic is the subject matter.

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

**Identity — touches_identity (boolean). When to set true vs false.**

\`true\` activates two heavy "who I am" layers in the composed prompt: \`self/soul\` (essence, purpose, frequency) and \`ego/identity\` (operational positioning, stances). They are expensive in tokens and frame the response as identity-bearing. They earn their place only when the turn genuinely invites that depth.

**Set \`true\` when the turn explicitly touches identity, purpose, or values:**
- "Quem sou eu nesse momento da vida?" / "Who am I right now?"
- "Estou perdendo o sentido do que faço." / "I'm losing the sense of what I do."
- "Devo deixar meu trabalho?" (decision-of-life question, even if framed practically)
- "O que eu valorizo de verdade?"
- "Como devo viver?" / "How should I live?"
- "Help me think about who I am as an X."

**Set \`false\` when the turn is operational, factual, transactional, or casual:**
- "Bom dia." / "Good morning." (greeting)
- "Quanto sobrou no caixa?" (operational/factual)
- "Compare VMware vs Proxmox" (technical analysis)
- "Walk me through migrating Plex." (how-to)
- "What's the difference between a Stanley No. 4 and No. 5?" (curiosity)
- "I'm tired today." (short first-person statement — the form-beats-topic rule applies here too: short = conversational, identity-conservative)

**The identity-conservative tiebreaker.** When in doubt, prefer \`false\`. Identity-touching turns are the minority case — most turns are operational. A miss in the false direction (skipping identity on a turn that wanted it) is recoverable: the user can ask for more depth and reception will reclassify on the next turn. A miss in the true direction (loading identity on a turn that didn't want it) is silent token waste and frames every casual exchange as existential — corrosive over time. Bias toward false; require positive evidence to flip true.

**Form beats topic on identity too.** A short first-person statement on a deep topic is conversational AND \`touches_identity: false\`. Both the mode and the identity axes respect the user's chosen form. Essayistic register OR explicit framing about identity/purpose/values is what unlocks \`true\`.

**Voz da Alma — is_self_moment (boolean). When to set true vs false.**

\`true\` activates the **Voz da Alma** compose path: the canonical persona pipeline is REPLACED by a wise-voice composition that speaks from the user's center, citing the user's own declared principles (doctrine layer) when they ressoam. The Alma is identity-bearing by design — heavy in tokens, distinctive in tone — and only earns its place on a narrow class of turns.

**Three classes the model must distinguish:**

1. **Apontamento de vida** (target → \`true\`). A lived-in fragment about something that happened, a registry of a moment that carries weight. First-person, often short, often retrospective. The user is not asking a question; they are sharing a moment.
   Examples that flip true:
   - "hoje atendi um caso difícil"
   - "fechei a porta enquanto a Veronica chegava destruída"
   - "tive uma conversa com o Tonico que ficou pesando"
   - "estou voltando do hospital, preciso parar pra respirar"
   - "acabei de saber que o orçamento foi cortado"
   - "minha mãe ligou mais cedo, fiquei pensando o resto do dia"
   - "I just got off a hard call with my brother"
   - "today I sat with a patient who reminded me why I started"

2. **Pergunta funcional** (→ \`false\`). Operational, factual, transactional, how-to. The user wants information or an artifact, not a return.
   Examples that stay false:
   - "qual a melhor forma de cobrar X?"
   - "como configuro Y?"
   - "compare A e B"
   - "o que falta para fechar a story?"
   - "lê esse documento e me diz o que achou"
   - "write a draft of the email"

3. **Reflexão analítica sem peso pessoal** (→ \`false\`). Thinking-out-loud about strategy, design, marketing, ideas — the user is sharing thought-work, not a moment of life.
   Examples that stay false:
   - "estou pensando sobre estratégia de marketing"
   - "acho que a divulgação devia focar em X"
   - "qual seria o caminho de produto pra resolver Y?"
   - "essa ideia ressoa contigo?"

**Conservative-by-default.** The cost of a false positive (Alma fires on a casual question) is patronizing wisdom — corrosive to trust over time. The cost of a false negative (Alma silent when wanted) is recoverable — the user has a manual override ("Enviar Para… Voz da Alma"). Bias toward \`false\`; require positive evidence to flip \`true\`.

**Form signals FOR \`true\`** (use as evidence the message is an apontamento de vida):
- First-person past tense or first-person present-state ("hoje X", "estou X", "acabei de X")
- Names a specific event, person, or moment
- Carries weight — the user is sharing something that affects them
- No question to be answered, no artifact to be produced
- Tone of confiding or registering, not of asking or analyzing

**Form signals AGAINST \`true\`** (use as evidence to keep \`false\`):
- Question marks at the end (most apontamentos are statements, not questions)
- Imperative verbs ("escreve", "compara", "explica", "lê", "compose")
- Topic-only message ("estratégia de X", "como funciona Y")
- Long multi-clause exploration of a topic (essayistic but conceptual, not life-registry)
- Greetings, meta-questions about the mirror, casual small talk

**Independence from touches_identity.** The two booleans overlap (most self-moments touch identity) but they are distinct. \`is_self_moment\` asks "does this turn want the persona-skipping Alma voice?". \`touches_identity\` asks "does this turn want the soul/doctrine/identity layers loaded into a *persona* response?". \`is_self_moment: true\` always implies the Alma path (which composes identity); \`touches_identity\` only matters when \`is_self_moment\` is false.

is_self_moment classification examples:
- "bom dia" → false (greeting; class 0, treated as functional/casual)
- "compare VMware vs Proxmox" → false (functional)
- "estou pensando sobre estratégia de divulgação" → false (analytical reflection, no personal weight)
- "hoje atendi um caso que me marcou" → true (apontamento de vida)
- "fechei a porta enquanto a Veronica chegava cansada" → true (apontamento de vida)
- "How should I think about leaving vs staying?" → false (reflective question, but the user is asking for help thinking — canonical path with touches_identity true)
- "I just left the meeting feeling small" → true (apontamento de vida — first-person registry of a moment with weight)

Matching examples (abstract roles — map to the actual keys above):
- "Hi, how's it going?" → personas: []; organization/journey null; mode: conversational; touches_identity: false.
- "Who are you?" → personas: []; organization/journey null; mode: conversational; touches_identity: false. (Meta-question about the mirror, not about the user's identity.)
- "Had coffee with Mike Fraser this morning." → personas: []; scopes null; mode: conversational; touches_identity: false.
- "Sometimes I can't understand my kids." → personas: []; scopes null; mode: conversational; touches_identity: false (short first-person, form beats topic).
- "I don't know what I want anymore." → personas: []; scopes null; mode: conversational; touches_identity: false (short — needs explicit framing to flip identity true).
- "How should I think about who I'm becoming?" → personas as applicable; mode: essayistic; touches_identity: true (explicit identity framing + reflective ask).
- "quanto sobrou no caixa este mês?" → personas: [finance persona, if any]; journey: finance journey; mode: conversational; touches_identity: false.
- "Write an essay about silence" → personas: [writing-production persona, if any]; mode: essayistic; touches_identity: false (production task, not identity reflection).
- "What are the priorities for [organization name] this quarter?" → personas: [strategy persona]; organization: that key; mode: compositional; touches_identity: false.
- "How should I think about leaving vs staying?" → personas as applicable; mode: essayistic; touches_identity: true (life-decision question framed as reflection).
- "qual seria a estratégia de divulgação do espelho para o público da Software Zen?" → personas: ["estrategista", "divulgadora"]; organization: software-zen; mode: compositional or essayistic; touches_identity: false (strategic/operational, not identity).

**Out-of-pool suggestions — the would_have_X axes (conservative).**

When the SESSION POOL list for an axis is empty (no constraint shown), no would_have_X applies — there's nothing outside. When a SESSION POOL list is present and an OUT-OF-POOL list also appears, you may flag a would_have_X — but only when the out-of-pool candidate is a clear, domain-cleanly-covering match AND the canonical pick from the session pool would all be a stretch. The default is null. Examples:

- Session pool persona: \`engineer\`. Out-of-pool: \`maker\` (woodwork). Message: "Stanley No. 4 vs No. 5 plane?". The engineer canonical pick is a stretch (engineer compares technical things); maker cleanly covers woodwork. Flag would_have_persona: "maker".
- Session pool persona: \`engineer\`. Out-of-pool: \`maker\`, \`tecnica\`. Message: "Walk me through Proxmox cutover order." Engineer covers it cleanly; no stretch. would_have_persona: null.
- Session pool journey: \`o-espelho\`. Out-of-pool: \`vida-economica\`. Message: "How does my financial situation affect strategy?". o-espelho is a stretch for finance; vida-economica covers it. Flag would_have_journey: "vida-economica".

Do NOT flag would_have_X just because the message lightly mentions an out-of-pool topic. The flag is for when the user's chosen frame (the session pool) genuinely doesn't fit and a different lens would.

Return JSON only: {"personas": ["<key>", ...], "organization": "<key>|null", "journey": "<key>|null", "mode": "conversational|compositional|essayistic", "touches_identity": true|false, "is_self_moment": true|false, "would_have_persona": "<key>|null", "would_have_organization": "<key>|null", "would_have_journey": "<key>|null"}. The personas field is always an array (possibly empty). Scopes and would_have_X fields use exact keys from the lists above or null. Mode is always one of the three literals — never null. touches_identity and is_self_moment are always booleans — never null. Do not wrap in markdown. Do not explain. JSON only.`;

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
      personas?: unknown;
      organization?: string | null;
      journey?: string | null;
      mode?: unknown;
      touches_identity?: unknown;
      is_self_moment?: unknown;
      would_have_persona?: string | null;
      would_have_organization?: string | null;
      would_have_journey?: string | null;
    };

    // Accept the canonical new shape (personas: string[]) and silently
    // wrap the legacy singular (persona: "<key>") into a one-element
    // array. This keeps reception resilient when the model drifts or
    // when config/models.json swaps to a model that hasn't fully
    // adopted the new prompt yet.
    const rawPersonaList: string[] = Array.isArray(parsed.personas)
      ? (parsed.personas as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : typeof parsed.persona === "string"
      ? [parsed.persona]
      : [];

    // Validate each key against the available persona pool, preserving
    // order and dropping unknowns silently. Dedupe while we're here.
    const seen = new Set<string>();
    const personaKeys: string[] = [];
    for (const key of rawPersonaList) {
      if (seen.has(key)) continue;
      if (!personas.some((p) => p.key === key)) continue;
      seen.add(key);
      personaKeys.push(key);
    }

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
    // CV1.E7.S4: identity-conservative default. The boolean activates
    // self/soul + ego/identity composition, which is expensive in
    // tokens and thematically heavy. Only a confirmed `true` flips
    // it on; missing field, non-boolean, or any drift defaults to
    // `false` (skip identity layers — matches the modal turn).
    const touchesIdentity: boolean =
      parsed.touches_identity === true ? true : false;
    // CV1.E9.S3: same conservative-default semantics as touches_identity.
    // Only literal `true` flips the Alma path on; anything else (missing
    // field, string "true", null, drift) lands on `false`. False
    // positives are corrosive (patronizing); false negatives are
    // recoverable via S4's manual override.
    const isSelfMoment: boolean =
      parsed.is_self_moment === true ? true : false;

    // CV1.E7.S8: would-have-picked from out-of-pool. Validate that
    // each non-null key actually belongs to the out-of-pool set —
    // a model could drift and emit a session-pool key here, which
    // would defeat the suggestion semantics. Null on any drift,
    // null on missing fields, null on unknown keys.
    const wouldHavePersona =
      typeof parsed.would_have_persona === "string" &&
      outOfPoolPersonas.some((p) => p.key === parsed.would_have_persona)
        ? parsed.would_have_persona
        : null;
    const wouldHaveOrganization =
      typeof parsed.would_have_organization === "string" &&
      outOfPoolOrgs.some((o) => o.key === parsed.would_have_organization)
        ? parsed.would_have_organization
        : null;
    const wouldHaveJourney =
      typeof parsed.would_have_journey === "string" &&
      outOfPoolJourneys.some((j) => j.key === parsed.would_have_journey)
        ? parsed.would_have_journey
        : null;

    const msgPreview = message.length > 80 ? message.slice(0, 80) + "…" : message;
    const latencyMs = Date.now() - startedAt;
    console.log(
      `[reception] msg="${msgPreview}" candidates={p:${personas.length},o:${orgs.length},j:${journeys.length}} latency=${latencyMs}ms parsed=${JSON.stringify(parsed)} final={personas:[${personaKeys.join(",")}],organization:${organizationKey},journey:${journeyKey},mode:${mode},touches_identity:${touchesIdentity},is_self_moment:${isSelfMoment}}`,
    );

    return {
      personas: personaKeys,
      organization: organizationKey,
      journey: journeyKey,
      mode,
      touches_identity: touchesIdentity,
      is_self_moment: isSelfMoment,
      would_have_persona: wouldHavePersona,
      would_have_organization: wouldHaveOrganization,
      would_have_journey: wouldHaveJourney,
    };
  } catch (err) {
    console.log("[reception] falling back to base identity:", (err as Error).message);
    return NULL_RESULT;
  }
}
