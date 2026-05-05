import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash } from "node:crypto";
import { deleteCookie } from "hono/cookie";
import { raw } from "hono/html";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { getOAuthProviders } from "@mariozechner/pi-ai/oauth";
import { streamSSE } from "hono/streaming";
import type Database from "better-sqlite3";
import {
  createUser,
  getUserByTokenHash,
  getUserByName,
  setIdentityLayer,
  setPersonaColor,
  deleteIdentityLayer,
  getIdentityLayers,
  setPersonaShowInSidebar,
  movePersona,
  getOrCreateSession,
  loadMessages,
  loadMessagesWithMeta,
  appendEntry,
  getLastAssistantScopeMeta,
  type User,
  type UserRole,
  type IdentityLayer,
  updateUserName,
  updateUserRole,
  deleteUser,
  getUserSessionStats,
  listRecentSessionsForUser,
  createFreshSession,
  getSessionById,
  forgetSession,
  getSessionTags,
  addSessionPersona,
  removeSessionPersona,
  addSessionOrganization,
  removeSessionOrganization,
  addSessionJourney,
  removeSessionJourney,
  getSessionResponseMode,
  setSessionResponseMode,
  getSessionResponseLength,
  setSessionResponseLength,
  getSessionVoice,
  setSessionVoice,
  isSessionVoice,
  getSessionModel,
  setSessionModel,
  getSessionScene,
  setSessionScene,
  forgetTurn,
  insertDivergentRun,
  loadDivergentRunsBySession,
  type DivergentOverrideType,
  getModels,
  updateModel,
  resetModelToDefault,
  createOrganization,
  updateOrganization,
  archiveOrganization,
  unarchiveOrganization,
  concludeOrganization,
  reopenOrganization,
  deleteOrganization,
  getOrganizations,
  getOrganizationByKey,
  setOrganizationShowInSidebar,
  moveOrganization,
  createJourney,
  updateJourney,
  linkJourneyOrganization,
  archiveJourney,
  unarchiveJourney,
  concludeJourney,
  reopenJourney,
  deleteJourney,
  getJourneys,
  getJourneyByKey,
  setJourneyShowInSidebar,
  moveJourney,
  listOAuthCredentials,
  setOAuthCredentials,
  deleteOAuthCredentials,
  type OAuthCredentials,
  getUsageTotals,
  getUsageByRole,
  getUsageByEnv,
  getUsageByModel,
  getUsageByDay,
  getUsdToBrlRate,
  setUsdToBrlRate,
  updateShowBrlConversion,
  updateUserLocale,
  type LlmRole,
  listLlmCalls,
  countLlmCalls,
  getLlmCall,
  listLlmCallModels,
  deleteAllLlmCalls,
  deleteLlmCallsOlderThan,
  getLlmLoggingEnabled,
  setLlmLoggingEnabled,
  createScene,
  getSceneByKey,
  updateScene,
  archiveScene,
  unarchiveScene,
  deleteScene,
  setScenePersonas,
  getScenePersonas,
  listScenesForUser,
  getSceneById,
  type Scene,
  createDraftPersona,
  setPersonaIsDraft,
  setOrganizationIsDraft,
  setJourneyIsDraft,
  setOrganizationSummary,
  setJourneySummary,
  getLastMirrorVisit,
  setLastMirrorVisit,
  createInscription,
  listActiveInscriptions,
  listArchivedInscriptions,
  getInscriptionById,
  updateInscription,
  pinInscription,
  unpinInscription,
  archiveInscription,
  unarchiveInscription,
} from "../../server/db.js";

const ROLE_VALUES: LlmRole[] = [
  "reception",
  "main",
  "expression",
  "title",
  "summary",
];
import { generateSessionTitle } from "../../server/title.js";
import {
  generateLayerSummary,
  generateScopeSummary,
  type ScopeSummaryResult,
} from "../../server/summary.js";
import {
  composeSystemPrompt,
  composeMinimalPrompt,
} from "../../server/identity.js";
import { composeAlmaPrompt } from "../../server/voz-da-alma.js";
import { logLlmCall, linkLlmCallEntry } from "../../server/llm-logging.js";
import { receive } from "../../server/reception.js";
import { decideScopeSeeding } from "../../server/scope-seed.js";
import { decideScopeTransition } from "../../server/scope-transition.js";
import {
  express,
  isResponseMode,
  isResponseLength,
  type ResponseMode,
} from "../../server/expression.js";
import { resolveApiKey, headeredStreamFn } from "../../server/model-auth.js";
import { logUsage, currentEnv } from "../../server/usage.js";
import {
  getKeyInfo,
  getModelPricing,
} from "../../server/openrouter-billing.js";
import {
  getCatalog,
  type CatalogEntry,
} from "../../server/db/models-catalog.js";
import { resolveMainModel } from "../../server/main-model-resolver.js";
import {
  computeSessionStats,
  getPersonaTurnCountsInSession,
} from "../../server/session-stats.js";
import { composedSnapshot } from "../../server/composed-snapshot.js";
import { extractPersonaDescriptor } from "../../server/personas.js";
import {
  type RailState,
  avatarInitials,
  avatarColor,
} from "./pages/context-rail.js";
import { resolvePersonaColor } from "../../server/personas/colors.js";
import { webAuthMiddleware, setTokenCookie, adminOnlyMiddleware } from "./auth.js";
import { localeMiddleware } from "./i18n-middleware.js";
import { LoginPage } from "./pages/login.js";
// HomePage retired in CV1.E11.S5 cutover (2026-05-02). The component
// file `pages/home.tsx` and its types stay in the tree until a
// follow-up sweep removes them; no route renders them anymore.
import { MePage } from "./pages/me.js";
import { getMeStats } from "../../server/me-stats.js";
import { MirrorPage } from "./pages/mirror.js";
import { UsersPage } from "./pages/admin/users.js";
import {
  ModelsPage,
  type OAuthProviderOption,
} from "./pages/admin/models.js";
import {
  OAuthPage,
  type OAuthProviderEntry,
} from "./pages/admin/oauth.js";
import { BudgetPage } from "./pages/admin/budget.js";
import {
  LlmLogsListPage,
  LlmLogsDetailPage,
} from "./pages/admin/llm-logs.js";
import { AdminDashboardPage } from "./pages/admin-dashboard.js";
import {
  getUserStats,
  getActivityStats,
  getMemoryStats,
  getSystemStats,
  getLatestRelease,
} from "../../server/admin-stats.js";
import { MapPage } from "./pages/map.js";
import { LayerWorkshopPage } from "./pages/layer-workshop.js";
import {
  OrganizationsListPage,
  OrganizationWorkshopPage,
} from "./pages/organizations.js";
import {
  JourneysListPage,
  JourneyWorkshopPage,
} from "./pages/journeys.js";
import {
  JourneyPortraitPage,
  editPathFor,
} from "./pages/journey-portrait.js";
import {
  composeJourneyPortrait,
  warmJourneyPortraitCache,
} from "../../server/portraits/journey-synthesis.js";
import {
  composeOrganizationPortrait,
  warmOrganizationPortraitCache,
} from "../../server/portraits/organization-synthesis.js";
import { OrganizationPortraitPage } from "./pages/organization-portrait.js";
import {
  composeScenePortrait,
  warmScenePortraitCache,
} from "../../server/portraits/scene-synthesis.js";
import { ScenePortraitPage } from "./pages/scene-portrait.js";
import {
  composePersonaPortrait,
  warmPersonaPortraitCache,
} from "../../server/portraits/persona-synthesis.js";
import { PersonaPortraitPage } from "./pages/persona-portrait.js";
import { composeIdentidade } from "../../server/portraits/identidade-synthesis.js";
import { IdentidadePage } from "./pages/identidade.js";
import { PersonasListPage } from "./pages/personas.js";
import {
  CenaFormPage,
  emptyCenaFormData,
  cenaToFormData,
  type CenaFormData,
  type CenaFormInventory,
} from "./pages/cenas-form.js";
import {
  InicioPage,
  type RecentSessionWithScene,
} from "./pages/home-inicio.js";
import { MemoriaPage } from "./pages/memoria.js";
import { TerritorioPage } from "./pages/territorio.js";
import { EspelhoPage } from "./pages/espelho.js";
import { ImasPage } from "./pages/espelho-imas.js";
import { composeMirrorState } from "../../server/mirror/synthesis.js";
import {
  pickInscriptionForToday,
  pickRotatingMagnetForToday,
} from "../../server/mirror/inscription-picker.js";
import { CenasListPage } from "./pages/cenas-list.js";
import {
  parseSceneFormData,
  slugifyKey,
  uniqueSceneKey,
  loadCenaInventory,
} from "./cenas-form-handler.js";
import { evaluateColdStart } from "../../server/cold-start.js";
import { ConversationsListPage } from "./pages/conversations.js";
import { DocsPage } from "./pages/docs.js";
import {
  resolveDocPath,
  renderMarkdown,
  buildNavTree,
  urlDirForResolvedFile,
  DOCS_ROOT,
} from "../../server/docs.js";
import { formatRelativeTime } from "../../server/formatters/relative-time.js";
import { computeBurnRate } from "../../server/billing/burn-rate.js";
import {
  getLatestOrganizationSessions,
  getLatestJourneySessions,
  getOrganizationSessions,
  getJourneySessions,
} from "../../server/scope-sessions.js";
import { getConversationsList } from "../../server/conversation-list.js";

/**
 * Build the rail state from the current session. Persona is derived
 * from the last assistant entry's stored meta — the same source the
 * chat history uses to show the persona badge.
 */
function buildRailState(
  db: Database.Database,
  user: User,
  sessionId: string,
  overridePersonas?: string[] | null,
  overrideOrganization?: string | null,
  overrideJourney?: string | null,
  overrideMode?: string | null,
  overrideTouchesIdentity?: boolean | null,
  overrideIsAlma?: boolean | null,
  overrideIsTrivial?: boolean | null,
): RailState {
  const sessionStats = computeSessionStats(db, sessionId);

  let personas: string[] = overridePersonas ?? [];
  let organization: string | null = overrideOrganization ?? null;
  let journey: string | null = overrideJourney ?? null;
  let mode: string | null = overrideMode ?? null;
  // CV1.E7.S4: default identity to true for back-compat — old
  // assistant entries without _touches_identity stamping render with
  // the full layers list, matching their actual composition.
  let touchesIdentity: boolean =
    overrideTouchesIdentity === undefined || overrideTouchesIdentity === null
      ? true
      : overrideTouchesIdentity;
  // CV1.E9.S3: Alma flag for the rail. Default false; explicit
  // override wins; otherwise derive from the last assistant entry's
  // `_is_alma` meta on F5 reload.
  let isAlma: boolean =
    overrideIsAlma === undefined || overrideIsAlma === null
      ? false
      : overrideIsAlma;
  // CV1.E10.S1: trivial flag for the rail. Same pattern as isAlma —
  // explicit override wins; F5 reload derives from `_is_trivial` on
  // the last assistant entry's meta. Trivial turns render with an
  // empty Composed block (the existing fresh-session-empty CSS hides
  // it automatically).
  let isTrivial: boolean =
    overrideIsTrivial === undefined || overrideIsTrivial === null
      ? false
      : overrideIsTrivial;

  // Track whether we found an assistant entry to derive from. Fresh
  // sessions (no turns yet) shouldn't render any composed state — the
  // rail's "Composed" section should be empty until the first turn
  // actually composes something.
  let foundAssistantEntry = false;

  // Derive from the last assistant entry's meta when any axis has no override.
  // CV1.E7.S5: prefer `_personas` array, fall back to legacy `_persona`
  // singular for historical sessions. Scopes still read the singular keys.
  // CV1.E7.S9 phase 2: also derive mode from the last assistant's
  // meta — _mode is stamped on every persisted assistant entry since
  // bubble-metadata-legibility shipped.
  // CV1.E7.S4: also derive touches_identity from _touches_identity meta.
  if (
    overridePersonas === undefined ||
    overrideOrganization === undefined ||
    overrideJourney === undefined ||
    overrideMode === undefined ||
    overrideTouchesIdentity === undefined ||
    overrideIsAlma === undefined ||
    overrideIsTrivial === undefined
  ) {
    const messagesWithMeta = loadMessagesWithMeta(db, sessionId);
    for (let i = messagesWithMeta.length - 1; i >= 0; i--) {
      const m = messagesWithMeta[i];
      if (m.data.role !== "assistant") continue;
      foundAssistantEntry = true;
      if (overridePersonas === undefined) {
        if (Array.isArray(m.meta.personas)) {
          personas = (m.meta.personas as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
        } else if (typeof m.meta.persona === "string") {
          personas = [m.meta.persona as string];
        }
      }
      if (
        overrideOrganization === undefined &&
        typeof m.meta.organization === "string"
      ) {
        organization = m.meta.organization as string;
      }
      if (overrideJourney === undefined && typeof m.meta.journey === "string") {
        journey = m.meta.journey as string;
      }
      if (overrideMode === undefined && typeof m.meta.mode === "string") {
        mode = m.meta.mode as string;
      }
      if (
        overrideTouchesIdentity === undefined &&
        typeof m.meta.touches_identity === "boolean"
      ) {
        touchesIdentity = m.meta.touches_identity as boolean;
      }
      if (
        overrideIsAlma === undefined &&
        typeof m.meta.is_alma === "boolean"
      ) {
        isAlma = m.meta.is_alma as boolean;
      }
      if (
        overrideIsTrivial === undefined &&
        typeof m.meta.is_trivial === "boolean"
      ) {
        isTrivial = m.meta.is_trivial as boolean;
      }
      break;
    }
  }

  // CV1.E9.S3: Alma turns force personas to be empty in the rail
  // state — even if the meta carries _personas (legacy), the Alma
  // flag wins. Mirrors the snapshot's force-empty semantics.
  // CV1.E10.S1: trivial turns also force everything empty (snapshot
  // will receive isTrivial=true and zero out layers/personas).
  if (isAlma || isTrivial) personas = [];
  if (isTrivial) {
    organization = null;
    journey = null;
  }

  const primaryPersona = personas[0] ?? null;
  let descriptor: string | null = null;
  if (primaryPersona) {
    const personaLayer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === primaryPersona,
    );
    if (personaLayer) {
      descriptor = extractPersonaDescriptor(personaLayer, {
        ellipsis: true,
      });
    }
  }

  // CV1.E9 follow-up: when the session has no turns yet and the caller
  // didn't pass overrides (live-streaming path always does), don't
  // render any composed state — nothing has actually composed. Forces
  // empty layers, no persona, no scope, no Alma indicator. Once the
  // first turn lands, the live-render path and subsequent F5 paths
  // both see real meta and the snapshot reflects truth.
  const callerProvidedOverrides =
    overridePersonas !== undefined ||
    overrideOrganization !== undefined ||
    overrideJourney !== undefined ||
    overrideMode !== undefined ||
    overrideTouchesIdentity !== undefined ||
    overrideIsAlma !== undefined;
  const isFreshSession = !callerProvidedOverrides && !foundAssistantEntry;

  // CV1.E11.S1 follow-up: the cena anchoring this session. Read from
  // the session row (sessions.scene_id) — scene is per-session, not
  // per-turn meta. Surfaced both to the header's Scene zone and to the
  // composed snapshot so the Look-inside rail renders a "scene:" row
  // when the session is anchored to a cena.
  const sceneId = getSessionScene(db, sessionId, user.id);
  const scene = sceneId ? (getSceneById(db, sceneId, user.id) ?? null) : null;

  const composed = isFreshSession
    ? {
        layers: [],
        personas: [],
        persona: null,
        organization: null,
        journey: null,
        scene: null,
        mode: null,
        isAlma: false,
        isTrivial: false,
      }
    : composedSnapshot(
        db,
        user.id,
        personas,
        organization,
        journey,
        mode,
        touchesIdentity,
        isAlma,
        isTrivial,
        scene?.key ?? null,
      );

  // CV1.E4.S4: session tag pool + available candidates for the rail UI.
  const sessionTagRow = getSessionTags(db, sessionId);
  const allPersonaLayers = getIdentityLayers(db, user.id).filter(
    (l) => l.layer === "persona",
  );
  const allOrgs = getOrganizations(db, user.id);
  const allJourneys = getJourneys(db, user.id);

  const responseModeOverride = getSessionResponseMode(db, sessionId, user.id);
  const responseLengthOverride = getSessionResponseLength(db, sessionId, user.id);
  const voiceOverride = getSessionVoice(db, sessionId, user.id);
  const sessionModelOverride = getSessionModel(db, sessionId, user.id);

  // persona-colors improvement: map every persona the user has to its
  // resolved color (stored when set, hash-derived otherwise). Consumers
  // read from this map instead of calling avatarColor() at each render
  // site — same lookup, but honors the persisted color column.
  const personaColors: Record<string, string> = {};
  for (const p of allPersonaLayers) {
    personaColors[p.key] = resolvePersonaColor(p.color, p.key);
  }

  return {
    sessionId,
    sessionStats,
    composed,
    personaDescriptor: descriptor,
    personaInitials: avatarInitials(primaryPersona),
    personaColor: primaryPersona ? resolvePersonaColor(
      allPersonaLayers.find((p) => p.key === primaryPersona)?.color ?? null,
      primaryPersona,
    ) : avatarColor(null),
    userName: user.name,
    showCost: user.role === "admin",
    showBrl: user.show_brl_conversion === 1,
    usdToBrlRate: getUsdToBrlRate(db),
    tags: {
      personaKeys: sessionTagRow.personaKeys,
      organizationKeys: sessionTagRow.organizationKeys,
      journeyKeys: sessionTagRow.journeyKeys,
      availablePersonas: allPersonaLayers.map((p) => ({
        key: p.key,
        name: p.key,
      })),
      availableOrganizations: allOrgs.map((o) => ({
        key: o.key,
        name: o.name,
      })),
      availableJourneys: allJourneys.map((j) => ({
        key: j.key,
        name: j.name,
      })),
    },
    responseMode: {
      override: responseModeOverride,
    },
    responseLength: {
      override: responseLengthOverride,
    },
    voice: {
      override: voiceOverride,
    },
    sessionModel: {
      provider: sessionModelOverride.provider,
      id: sessionModelOverride.id,
    },
    scene: {
      key: scene?.key ?? null,
      title: scene?.title ?? null,
      voice: scene?.voice ?? null,
    },
    personaColors,
  };
}

/**
 * CV1.E9.S4: build the persona list for the "Enviar Para…" popover.
 * Cast personas first (in their session_personas insertion order),
 * then non-cast personas (alphabetical by key). Deduped — a persona
 * in the cast doesn't appear twice. Each entry carries the resolved
 * color so the popover can paint the ❖ icon correctly.
 */
function buildSendToPersonas(
  db: Database.Database,
  userId: string,
  sessionId: string,
): { key: string; color: string; inCast: boolean }[] {
  const allPersonaLayers = getIdentityLayers(db, userId).filter(
    (l) => l.layer === "persona",
  );
  const tags = getSessionTags(db, sessionId);
  const castOrdered = tags.personaKeys;
  const castSet = new Set(castOrdered);
  const personaByKey = new Map(allPersonaLayers.map((l) => [l.key, l]));
  const out: { key: string; color: string; inCast: boolean }[] = [];
  for (const key of castOrdered) {
    const layer = personaByKey.get(key);
    if (!layer) continue;
    out.push({
      key,
      color: resolvePersonaColor(layer.color, key),
      inCast: true,
    });
  }
  const nonCast = allPersonaLayers
    .filter((l) => !castSet.has(l.key))
    .sort((a, b) => a.key.localeCompare(b.key));
  for (const layer of nonCast) {
    out.push({
      key: layer.key,
      color: resolvePersonaColor(layer.color, layer.key),
      inCast: false,
    });
  }
  return out;
}

/**
 * Emits the final expressed text in small chunks so the client can
 * render it with a streaming feel. The expression LLM call itself is
 * non-streaming (it returns the whole rewritten text); the chunking is
 * a UX surface only. Chunks preserve word boundaries when possible so
 * the incremental markdown render doesn't look mid-word during reflow.
 */
function chunkForStream(text: string): string[] {
  if (!text) return [];
  // Break on runs of whitespace so chunks end on word boundaries. The
  // separator is preserved at the end of each chunk except the last.
  const tokens = text.match(/\S+\s*/g);
  if (!tokens || tokens.length === 0) return [text];
  // Coalesce tiny tokens into groups of ~3 words per chunk — balances
  // perceived typing rhythm against per-event overhead.
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 3) {
    out.push(tokens.slice(i, i + 3).join(""));
  }
  return out;
}

/**
 * Returns the assistant message shape we want to persist, with the raw
 * text content replaced by the expression pass's final text. Keeps the
 * pi-ai content-block shape (array of typed blocks) so loadMessages()
 * can rebuild history uniformly. Provider / model / usage fields on the
 * original (the draft's AssistantMessage) stay — they describe the main
 * generation's economics; the expression pass is logged separately.
 */
function buildAssistantForPersist(
  assistantMsg: any,
  finalText: string,
): any {
  if (!assistantMsg || typeof assistantMsg !== "object") {
    return {
      role: "assistant",
      content: [{ type: "text", text: finalText }],
    };
  }
  return {
    ...assistantMsg,
    content: [{ type: "text", text: finalText }],
  };
}

/**
 * Narrow the `?summary=...` query param redirected back by the scope
 * regenerate route into the typed ScopeSummaryResult accepted by the
 * workshop components. Unknown values → undefined (no banner).
 */
function parseSummaryStatus(raw: string | undefined): ScopeSummaryResult | undefined {
  if (raw === "ok" || raw === "empty" || raw === "timeout" || raw === "error") {
    return raw;
  }
  return undefined;
}

export function setupWeb(
  app: Hono<{ Variables: { user: User } }>,
  db: Database.Database,
) {
  // --- Static files ---

  app.use("/public/*", serveStatic({ root: "adapters/web/" }));

  // Locale middleware on the parent app — resolves from Accept-Language for
  // unauthenticated routes (login, logout). The `web` sub-app re-runs the
  // middleware after auth so user.locale wins for authenticated requests
  // (idempotent: ALS scopes nest, inner wins inside next()).
  app.use("*", localeMiddleware);

  // --- Login (no auth) ---

  app.get("/login", (c) => c.html(<LoginPage />));

  app.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const token = body.token as string;
    if (!token) {
      return c.html(<LoginPage error={c.get("t")("login.error.tokenRequired")} />);
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const user = getUserByTokenHash(db, hash);
    if (!user) {
      return c.html(<LoginPage error={c.get("t")("login.error.invalidToken")} />);
    }

    setTokenCookie(c, token);
    return c.redirect("/");
  });

  app.post("/logout", (c) => {
    deleteCookie(c, "mirror_token");
    return c.redirect("/login");
  });

  // --- Web routes (cookie auth) ---

  const web = new Hono<{ Variables: { user: User } }>();
  web.use("*", webAuthMiddleware(db));
  web.use("*", localeMiddleware);

  // Legacy redirects — `/chat` was the original route; `/mirror` was the
  // rename in v0.5.0. Both now redirect to `/conversation` (CV0.E4.S5),
  // the URL that matches the sidebar label.
  web.get("/chat", (c) => c.redirect("/conversation"));
  web.get("/mirror", (c) => c.redirect("/conversation"));

  // --- About You (CV0.E4.S4) — clicking the user's avatar ---

  web.get("/me", (c) => {
    const user = c.get("user");
    const editingName = c.req.query("editName") === "1";
    // `saved` carries a key-id (e.g. "name", "preference"); resolve via t().
    // Unknown ids fall back to crude key — readable rather than broken.
    const savedId = c.req.query("saved");
    const saved = savedId ? c.get("t")(`me.saved.${savedId}`) : undefined;
    return c.html(
      <MePage
        currentUser={user}
        stats={getMeStats(db, user.id)}
        editingName={editingName}
        saved={saved}
      />,
    );
  });

  web.post("/me/name", async (c) => {
    const user = c.get("user");
    const t = c.get("t");
    const body = await c.req.parseBody();
    const newName = String(body.name ?? "").trim();

    const renderWithError = (msg: string) =>
      c.html(
        <MePage
          currentUser={user}
          stats={getMeStats(db, user.id)}
          editingName
          nameError={msg}
        />,
      );

    if (!newName) return renderWithError(t("me.error.empty"));
    if (/[\/\\]/.test(newName))
      return renderWithError(t("me.error.slashes"));
    if (newName.length > 40)
      return renderWithError(t("me.error.tooLong"));
    if (newName === user.name) return c.redirect("/me");
    const collision = getUserByName(db, newName);
    if (collision && collision.id !== user.id) {
      return renderWithError(t("me.error.taken", { name: newName }));
    }
    updateUserName(db, user.id, newName);
    return c.redirect("/me?saved=name");
  });

  web.post("/me/show-brl", async (c) => {
    const user = c.get("user");
    if (user.role !== "admin") return c.text("Admin only", 403);
    const body = await c.req.parseBody();
    const show = String(body.show_brl ?? "").trim() === "1";
    updateShowBrlConversion(db, user.id, show);
    return c.redirect("/me?saved=preference");
  });

  // CV2.E1.S3 — user picks UI language. Available to every user (not
  // admin-gated). Unknown values silently rejected; default 'en' acts
  // as a defensive fallback so a malformed POST never breaks the row.
  web.post("/me/locale", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const requested = String(body.locale ?? "").trim();
    const accepted = requested === "pt-BR" ? "pt-BR" : "en";
    updateUserLocale(db, user.id, accepted);
    return c.redirect("/me?saved=locale");
  });

  // --- Home / Espelho ---
  //
  // `/` is the contemplative surface — the Espelho — that the
  // ◆ Mirror Mind logo points to. The operational home (cards +
  // free input + recents) lives at `/inicio` and is the destination
  // of the `▶ Iniciar` chrome pill.
  //
  // Previous arrangement (the cena pivot's CV1.E11.S5 cutover) had
  // `/` serving the operational home. The swap puts the brand mark
  // and the page it names at the same URL — clicking the logo lands
  // on the mirror, the way the user thinks about it.
  //
  // Backward-compat: `/espelho` 301-redirects here for anyone who
  // bookmarked the previous URL.

  web.get("/", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const lastVisit = getLastMirrorVisit(db, user.id);
    const state = composeMirrorState(db, user.id, now, lastVisit);
    const inscription = pickInscriptionForToday(db, user.id, now);
    const vivoMagnet = pickRotatingMagnetForToday(
      db,
      user.id,
      now,
      inscription?.id ?? null,
    );
    setLastMirrorVisit(db, user.id, now);
    return c.html(
      <EspelhoPage
        user={user}
        state={state}
        inscription={inscription}
        vivoMagnet={vivoMagnet}
      />,
    );
  });

  web.get("/inicio", (c) => {
    const user = c.get("user");
    const scenes = listScenesForUser(db, user.id);
    const recentRows = listRecentSessionsForUser(db, user.id, 8);
    const recents: RecentSessionWithScene[] = recentRows.map((r) => {
      const sess = getSessionById(db, r.id, user.id);
      let sceneTitle: string | null = null;
      if (sess?.scene_id) {
        const scene = getSceneById(db, sess.scene_id, user.id);
        sceneTitle = scene?.title ?? null;
      }
      return { ...r, sceneTitle };
    });
    return c.html(<InicioPage user={user} scenes={scenes} recents={recents} />);
  });

  web.post("/inicio", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData();
    const text = ((form.get("text") as string | null) ?? "").trim();
    if (!text) return c.redirect("/inicio");
    const sessId = createFreshSession(db, user.id, null);
    return c.redirect(`/conversation/${sessId}?seed=${encodeURIComponent(text)}`);
  });

  // Sentinel: requesting the old probationary route now returns
  // a 410 Gone so anyone who bookmarked it during the strangler
  // phase gets a clean signal. Will be deleted entirely after one
  // release cycle.
  web.get("/_legacy-home", (c) =>
    c.text("Gone — the legacy home was removed. Use /.", 410),
  );

  // --- Cognitive Map ---

  // --- Map helpers (shared between self-modality and admin-modality) ---

  const ALLOWED_WORKSHOP_LAYERS: Record<string, Set<string>> = {
    self: new Set(["soul"]),
    ego: new Set(["identity", "expression", "behavior"]),
  };

  function isAllowedWorkshop(
    userId: string,
    layer: string,
    key: string,
  ): boolean {
    const staticMatch = ALLOWED_WORKSHOP_LAYERS[layer]?.has(key) ?? false;
    if (staticMatch) return true;
    // Personas are allowed dynamically — any persona key the user actually
    // has in the identity table opens the same workshop page. This is how
    // /map/persona/:key resolves to a read/edit view.
    if (layer === "persona") {
      const existing = getIdentityLayers(db, userId).find(
        (l) => l.layer === "persona" && l.key === key,
      );
      return !!existing;
    }
    return false;
  }

  function mapRootFor(currentUser: User, targetUser: User): string {
    return currentUser.id === targetUser.id ? "/map" : `/map/${targetUser.name}`;
  }

  function renderMap(
    c: any,
    currentUser: User,
    targetUser: User,
    extras: {
      personaError?: string;
      editingPersona?: string;
      addingPersona?: boolean;
    } = {},
  ) {
    const layers = getIdentityLayers(db, targetUser.id);
    const baseLayers = layers.filter(
      (l) => l.layer === "self" || l.layer === "ego",
    );
    const personas = layers.filter((l) => l.layer === "persona");
    const organizations = getOrganizations(db, targetUser.id);
    const journeys = getJourneys(db, targetUser.id);
    const sessionStats = getUserSessionStats(db, targetUser.id);
    return c.html(
      <MapPage
        currentUser={currentUser}
        targetUser={targetUser}
        baseLayers={baseLayers}
        personas={personas}
        organizations={organizations}
        journeys={journeys}
        personaError={extras.personaError}
        editingPersona={extras.editingPersona}
        addingPersona={extras.addingPersona}
        sessionCount={sessionStats.total}
        lastSessionAgo={formatRelativeTime(sessionStats.lastCreatedAt)}
      />,
    );
  }

  // --- Handlers parametrized by currentUser + targetUser ---

  function handleDashboard(c: any, currentUser: User, targetUser: User) {
    const editingPersona = c.req.query("editPersona") || undefined;
    const addingPersona = c.req.query("addPersona") === "1";
    return renderMap(c, currentUser, targetUser, {
      editingPersona,
      addingPersona,
    });
  }

  async function handlePersonaAdd(
    c: any,
    currentUser: User,
    targetUser: User,
  ) {
    const body = await c.req.parseBody();
    const name = String(body.name ?? "").trim();
    const content = String(body.content ?? "");
    if (!name || !/^[a-z0-9\-]+$/.test(name)) {
      return renderMap(c, currentUser, targetUser, {
        addingPersona: true,
        personaError:
          "Name must be lowercase letters, numbers, and hyphens only.",
      });
    }
    if (!content.trim()) {
      return renderMap(c, currentUser, targetUser, {
        addingPersona: true,
        personaError: "Prompt cannot be empty.",
      });
    }
    const existing = getIdentityLayers(db, targetUser.id).find(
      (l) => l.layer === "persona" && l.key === name,
    );
    if (existing) {
      return renderMap(c, currentUser, targetUser, {
        addingPersona: true,
        personaError: `A persona named "${name}" already exists.`,
      });
    }
    setIdentityLayer(db, targetUser.id, "persona", name, content);
    generateLayerSummary(db, targetUser.id, "persona", name).catch(() => {});
    return c.redirect(mapRootFor(currentUser, targetUser));
  }

  async function handlePersonaUpdate(
    c: any,
    currentUser: User,
    targetUser: User,
    key: string,
  ) {
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    if (!content.trim()) {
      return renderMap(c, currentUser, targetUser, {
        editingPersona: key,
        personaError: "Prompt cannot be empty.",
      });
    }
    setIdentityLayer(db, targetUser.id, "persona", key, content);
    // Promote-on-edit (CV1.E11.S7): saving the persona via the workshop
    // is a deliberate review act, so a stub created via cena form is
    // promoted to a non-draft entity. No-op when not a draft.
    setPersonaIsDraft(db, targetUser.id, key, false);
    // Summary is editable on the workshop (S3 follow-up): if the user
    // typed something, keep their text and skip auto-regen. If they
    // left it blank, regenerate via the model.
    const userSummary = String(body.summary ?? "").trim();
    if (userSummary.length > 0) {
      setIdentitySummary(db, targetUser.id, "persona", key, userSummary);
    } else {
      generateLayerSummary(db, targetUser.id, "persona", key).catch(() => {});
    }
    const mapRoot = mapRootFor(currentUser, targetUser);
    return c.redirect(`${mapRoot}/persona/${key}`);
  }

  function handlePersonaDelete(
    c: any,
    currentUser: User,
    targetUser: User,
    key: string,
  ) {
    deleteIdentityLayer(db, targetUser.id, "persona", key);
    return c.redirect(mapRootFor(currentUser, targetUser));
  }

  function handleWorkshopGet(
    c: any,
    currentUser: User,
    targetUser: User,
    layer: string,
    key: string,
  ) {
    if (!isAllowedWorkshop(targetUser.id, layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const layers = getIdentityLayers(db, targetUser.id);
    const current = layers.find((l) => l.layer === layer && l.key === key);
    const content = current?.content ?? "";
    const summary = current?.summary ?? null;
    const personaColor = current?.color ?? null;
    const isDraft = current?.is_draft === 1;
    const personas = layers.filter((l) => l.layer === "persona");
    const organizations = getOrganizations(db, targetUser.id);
    const journeys = getJourneys(db, targetUser.id);
    const mode = c.req.query("edit") === "1" ? "edit" : "read";
    return c.html(
      <LayerWorkshopPage
        currentUser={currentUser}
        targetUser={targetUser}
        layer={layer}
        layerKey={key}
        content={content}
        summary={summary}
        mode={mode}
        personas={personas}
        organizations={organizations}
        journeys={journeys}
        personaColor={personaColor}
        isDraft={isDraft}
      />,
    );
  }

  async function handleWorkshopSave(
    c: any,
    currentUser: User,
    targetUser: User,
    layer: string,
    key: string,
  ) {
    if (!isAllowedWorkshop(targetUser.id, layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    setIdentityLayer(db, targetUser.id, layer, key, content);
    // Summary is editable on the workshop (S3 follow-up): if the user
    // typed something, keep their text and skip auto-regen. If they
    // left it blank, regenerate via the model.
    const userSummary = String(body.summary ?? "").trim();
    if (userSummary.length > 0) {
      setIdentitySummary(db, targetUser.id, layer, key, userSummary);
    } else {
      generateLayerSummary(db, targetUser.id, layer, key).catch(() => {});
    }
    // Save lands back on the read view of this very page. Letting the
    // user confirm the change visually before moving on beats bouncing
    // them to /map, which was the previous behavior when the workshop
    // only had an edit mode.
    const mapRoot = mapRootFor(currentUser, targetUser);
    return c.redirect(`${mapRoot}/${layer}/${key}`);
  }

  async function handleRegenerateSummary(
    c: any,
    currentUser: User,
    targetUser: User,
    layer: string,
    key: string,
  ) {
    if (!isAllowedWorkshop(targetUser.id, layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    // Awaited (not fire-and-forget) so the user sees the new summary on
    // the next page render. Worst case ~timeout_ms before redirect.
    await generateLayerSummary(db, targetUser.id, layer, key);
    const workshopHref = currentUser.id !== targetUser.id
      ? `/map/${targetUser.name}/${layer}/${key}`
      : `/map/${layer}/${key}`;
    return c.redirect(workshopHref);
  }

  async function handleRegenerateAllPersonasSummaries(
    c: any,
    currentUser: User,
    targetUser: User,
  ) {
    const layers = getIdentityLayers(db, targetUser.id);
    const personas = layers.filter((l) => l.layer === "persona");
    // Run in parallel — lite model handles 14 concurrent calls fine,
    // sequential would take ~14 × timeout in the worst case.
    await Promise.allSettled(
      personas.map((p) => generateLayerSummary(db, targetUser.id, "persona", p.key)),
    );
    const mapHref = currentUser.id !== targetUser.id ? `/map/${targetUser.name}` : "/map";
    return c.redirect(mapHref);
  }

  function handleComposedPrompt(c: any, targetUser: User) {
    const personaParam = c.req.query("persona");
    const adapterParam = c.req.query("adapter");
    const organizationParam = c.req.query("organization");
    const journeyParam = c.req.query("journey");
    const personaKey =
      !personaParam || personaParam === "none" ? null : personaParam;
    const adapter =
      !adapterParam || adapterParam === "none" ? undefined : adapterParam;
    const organization =
      !organizationParam || organizationParam === "none"
        ? null
        : organizationParam;
    const journey =
      !journeyParam || journeyParam === "none" ? null : journeyParam;
    const prompt = composeSystemPrompt(db, targetUser.id, personaKey ? [personaKey] : [], adapter, {
      organization,
      journey,
    });
    return c.json({
      prompt,
      persona: personaKey,
      adapter: adapter ?? null,
      organization,
      journey,
    });
  }

  function requireTarget(c: any): User | Response {
    const name = c.req.param("name");
    const target = getUserByName(db, name);
    if (!target) return c.text("User not found", 404);
    return target;
  }

  // --- Self-modality routes: /identidade (read view) + /map/... (workshop) ---

  // CV1.E14: /identidade is the new continuous-read self-portrait —
  // soul + role + behavior + expression + cast, woven as memoir
  // instead of the structural grid the cognitive map used to be. The
  // term "ego" is dropped from the user-facing chrome (per directive
  // 2026-05-05); the layers surface as flat peers to the soul.
  // Locale-aware via Hono regex: /identidade (pt-BR) + /identity (en).
  web.get("/:slug{identidade|identity}", (c) => {
    const user = c.get("user");
    const state = composeIdentidade(db, user.id);
    return c.html(<IdentidadePage user={user} state={state} mapUrl="/map" />);
  });

  // /map continues to render the legacy cognitive-map dashboard for
  // back-compat with admin flows (/map/<tenant-name>, /map/composed)
  // and existing internal links. The chrome's primary entry point
  // moved to /identidade (avatar dropdown, /espelho's Sou pane); /map
  // remains reachable but is no longer surfaced as the canonical
  // "self-portrait" surface.
  web.get("/map", (c) => {
    const user = c.get("user");
    return handleDashboard(c, user, user);
  });

  // Composed-prompt inspector — must be registered before `/map/:name` so
  // the literal "composed" wins over the username param.
  web.get("/map/composed", (c) => handleComposedPrompt(c, c.get("user")));

  web.get("/map/:name/composed", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handleComposedPrompt(c, target);
  });

  web.post("/map/persona", (c) =>
    handlePersonaAdd(c, c.get("user"), c.get("user")),
  );

  web.post("/map/persona/:key", (c) =>
    handlePersonaUpdate(c, c.get("user"), c.get("user"), c.req.param("key")),
  );

  web.post("/map/persona/:key/delete", (c) =>
    handlePersonaDelete(c, c.get("user"), c.get("user"), c.req.param("key")),
  );

  // Persona color picker endpoint. The workshop carries a native
  // <input type="color"> whose value is the persisted color; Save
  // submits this hex as `color`. Invalid hex silently no-ops via
  // setPersonaColor's built-in validation.
  web.post("/map/persona/:key/color", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const body = await c.req.parseBody();
    const posted = String(body.color ?? "").trim();
    if (posted.length > 0) {
      setPersonaColor(db, user.id, key, posted);
    }
    return c.redirect(`/map/persona/${key}`);
  });

  // --- Admin-modality routes with literal segments ---
  //
  // Order matters: Hono matches routes linearly. Routes with literal
  // segments must register before all-dynamic catch-all routes so that
  // e.g. POST /map/alisson/persona hits the admin persona add handler
  // rather than falling through to /map/:layer/:key's workshop save.

  web.get("/map/:name", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handleDashboard(c, c.get("user"), target);
  });

  web.post("/map/:name/persona", adminOnlyMiddleware(), async (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handlePersonaAdd(c, c.get("user"), target);
  });

  web.post("/map/:name/persona/:key", adminOnlyMiddleware(), async (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handlePersonaUpdate(c, c.get("user"), target, c.req.param("key"));
  });

  web.post("/map/:name/persona/:key/delete", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handlePersonaDelete(c, c.get("user"), target, c.req.param("key"));
  });

  // Regenerate summary endpoints. The self route (4 segments with literal
  // "regenerate-summary" at position 4) is more specific than the admin
  // catch-all and must come first.
  web.post("/map/personas/regenerate-summaries", (c) =>
    handleRegenerateAllPersonasSummaries(c, c.get("user"), c.get("user")),
  );

  web.post(
    "/map/:name/personas/regenerate-summaries",
    adminOnlyMiddleware(),
    (c) => {
      const target = requireTarget(c);
      if (target instanceof Response) return target;
      return handleRegenerateAllPersonasSummaries(c, c.get("user"), target);
    },
  );

  web.post("/map/:layer/:key/regenerate-summary", (c) =>
    handleRegenerateSummary(
      c,
      c.get("user"),
      c.get("user"),
      c.req.param("layer"),
      c.req.param("key"),
    ),
  );

  web.post("/map/:name/:layer/:key/regenerate-summary", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handleRegenerateSummary(
      c,
      c.get("user"),
      target,
      c.req.param("layer"),
      c.req.param("key"),
    );
  });

  web.get("/map/:name/:layer/:key", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handleWorkshopGet(
      c,
      c.get("user"),
      target,
      c.req.param("layer"),
      c.req.param("key"),
    );
  });

  web.post("/map/:name/:layer/:key", adminOnlyMiddleware(), (c) => {
    const target = requireTarget(c);
    if (target instanceof Response) return target;
    return handleWorkshopSave(
      c,
      c.get("user"),
      target,
      c.req.param("layer"),
      c.req.param("key"),
    );
  });

  // --- Self-modality generic routes (all-dynamic, 3-seg — register last) ---

  web.get("/map/:layer/:key", (c) =>
    handleWorkshopGet(
      c,
      c.get("user"),
      c.get("user"),
      c.req.param("layer"),
      c.req.param("key"),
    ),
  );

  web.post("/map/:layer/:key", (c) =>
    handleWorkshopSave(
      c,
      c.get("user"),
      c.get("user"),
      c.req.param("layer"),
      c.req.param("key"),
    ),
  );

  web.get("/conversation", async (c) => {
    const user = c.get("user");
    const sessionId = getOrCreateSession(db, user.id);
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    const personaTurnCounts = getPersonaTurnCountsInSession(db, sessionId);
    const divergentRuns = loadDivergentRunsBySession(db, sessionId);
    const labMode = c.req.query("lab") === "1";
    const modelCatalog =
      user.role === "admin" ? await getCatalog(db) : undefined;
    // CV1.E15.S7: pre-compute the resolver for badge logic — the
    // page re-uses the same value for every bubble's compare.
    const resolvedNow = resolveMainModel(db, sessionId, user.id);
    return c.html(
      <MirrorPage
        user={user}
        messages={messages}
        rail={rail}
        personaTurnCounts={personaTurnCounts}
        divergentRuns={divergentRuns}
        labMode={labMode}
        sendToPersonas={buildSendToPersonas(db, user.id, sessionId)}
        modelCatalog={modelCatalog}
        currentMainModel={{
          provider: resolvedNow.provider,
          id: resolvedNow.model,
        }}
      />,
    );
  });

  // Cross-scope conversations browse with filters (CV1.E6.S1).
  web.get("/conversations", (c) => {
    const user = c.get("user");

    // Read filter params; treat empty string as "no filter".
    const personaParam = c.req.query("persona") || null;
    const orgParam = c.req.query("organization") || null;
    const journeyParam = c.req.query("journey") || null;

    // Pagination — limit fixed at 50 for v1, offset from query string.
    const limit = 50;
    const rawOffset = parseInt(c.req.query("offset") || "0", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    // Resolve dropdown options.
    const personaLayers = getIdentityLayers(db, user.id).filter(
      (l) => l.layer === "persona",
    );
    const personaKeys = personaLayers.map((l) => l.key).sort();
    const personaColors: Record<string, string> = {};
    for (const p of personaLayers) {
      personaColors[p.key] = resolvePersonaColor(p.color, p.key);
    }
    const organizations = getOrganizations(db, user.id); // active only
    const journeys = getJourneys(db, user.id); // active only

    // Validate filter values silently — unknown values just don't filter.
    const validPersona = personaParam && personaKeys.includes(personaParam) ? personaParam : null;
    const validOrg =
      orgParam && organizations.some((o) => o.key === orgParam) ? orgParam : null;
    const validJourney =
      journeyParam && journeys.some((j) => j.key === journeyParam)
        ? journeyParam
        : null;

    const { rows, total } = getConversationsList(db, user.id, {
      personaKey: validPersona ?? undefined,
      organizationKey: validOrg ?? undefined,
      journeyKey: validJourney ?? undefined,
      limit,
      offset,
    });

    const activeSessionId = getOrCreateSession(db, user.id);

    return c.html(
      <ConversationsListPage
        user={user}
        rows={rows}
        total={total}
        limit={limit}
        offset={offset}
        filters={{
          persona: validPersona,
          organization: validOrg,
          journey: validJourney,
        }}
        personaKeys={personaKeys}
        organizations={organizations}
        journeys={journeys}
        activeSessionId={activeSessionId}
        personaColors={personaColors}
      />,
    );
  });

  // Open a specific session by id (CV1.E4.S5). Read-only-by-default —
  // opening doesn't change which session is "current". Sending a message
  // in the opened session updates its activity timestamp, which makes it
  // current naturally via `getOrCreateSession`.
  web.get("/conversation/:sessionId{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}", async (c) => {
    const user = c.get("user");
    const sessionId = c.req.param("sessionId");
    const session = getSessionById(db, sessionId, user.id);
    if (!session) return c.notFound();
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    const personaTurnCounts = getPersonaTurnCountsInSession(db, sessionId);
    const divergentRuns = loadDivergentRunsBySession(db, sessionId);
    const labMode = c.req.query("lab") === "1";
    const modelCatalog =
      user.role === "admin" ? await getCatalog(db) : undefined;
    // CV1.E15.S7: pre-compute the resolver for badge logic.
    const resolvedNow = resolveMainModel(db, sessionId, user.id);
    return c.html(
      <MirrorPage
        user={user}
        messages={messages}
        rail={rail}
        personaTurnCounts={personaTurnCounts}
        divergentRuns={divergentRuns}
        labMode={labMode}
        sendToPersonas={buildSendToPersonas(db, user.id, sessionId)}
        modelCatalog={modelCatalog}
        currentMainModel={{
          provider: resolvedNow.provider,
          id: resolvedNow.model,
        }}
      />,
    );
  });

  // Manual session-lifecycle actions (CV1.E3.S4).
  web.post("/conversation/begin-again", (c) => {
    const user = c.get("user");
    const endingSessionId = getOrCreateSession(db, user.id);
    createFreshSession(db, user.id);
    // Fire-and-forget: don't await — redirect lands immediately, title
    // arrives in the DB whenever the model responds (or never, on failure).
    void generateSessionTitle(db, endingSessionId);
    return c.redirect("/conversation");
  });

  web.post("/conversation/forget", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    // Respect the session the user is viewing — without this, the handler
    // always wiped the activity-current session, leaving the conversation
    // the user actually clicked "Forget" on intact (silent failure).
    const { sessionId } = resolveRailTargetSession(body.sessionId, user);
    forgetSession(db, sessionId);
    // returnTo lets the caller stay on the surface that initiated the
    // delete (Recentes on /, Histórico on /memorias, list on
    // /conversations). Defaults to /conversations. Only relative paths
    // are honored — guards against open-redirect.
    const rawReturnTo = String(body.returnTo ?? "/conversations");
    const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/conversations";
    return c.redirect(returnTo);
  });

  // Resolves the target session for a rail-side POST. The rail's forms
  // embed the id of the session the user is viewing (CV1.E7.S1 bugfix:
  // when the user opens an older session via `/conversation/<id>`, rail
  // POSTs must act on that session — not on whatever `getOrCreateSession`
  // returns as "current by last activity"). Foreign or missing ids fall
  // back to the current session so badly-formed requests stay harmless.
  //
  // Returns { sessionId, redirectTarget } — redirectTarget keeps the user
  // on the same conversation URL they came from.
  const resolveRailTargetSession = (
    rawSessionId: unknown,
    currentUser: User,
  ): { sessionId: string; redirectTarget: string } => {
    if (typeof rawSessionId === "string" && rawSessionId.length > 0) {
      const owned = getSessionById(db, rawSessionId, currentUser.id);
      if (owned) {
        return {
          sessionId: owned.id,
          redirectTarget: `/conversation/${owned.id}`,
        };
      }
    }
    return {
      sessionId: getOrCreateSession(db, currentUser.id),
      redirectTarget: "/conversation",
    };
  };

  // Session tag endpoints (CV1.E4.S4). Body: type=persona|organization|journey, key=<string>, sessionId=<id>.
  web.post("/conversation/tag", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const type = String(body.type ?? "");
    const key = String(body.key ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    if (!key) return c.redirect(redirectTarget);
    if (type === "persona") {
      // CV1.E9.S6: cast is mutually exclusive between personas and
      // Alma. Adding a persona clears any active voice override —
      // the user is choosing the persona pool path explicitly.
      setSessionVoice(db, sessionId, user.id, null);
      addSessionPersona(db, sessionId, key);
    } else if (type === "organization")
      addSessionOrganization(db, sessionId, key);
    else if (type === "journey") addSessionJourney(db, sessionId, key);
    else return c.text("Invalid tag type", 400);
    return c.redirect(redirectTarget);
  });

  web.post("/conversation/untag", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const type = String(body.type ?? "");
    const key = String(body.key ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    if (!key) return c.redirect(redirectTarget);
    if (type === "persona") removeSessionPersona(db, sessionId, key);
    else if (type === "organization")
      removeSessionOrganization(db, sessionId, key);
    else if (type === "journey") removeSessionJourney(db, sessionId, key);
    else return c.text("Invalid tag type", 400);
    return c.redirect(redirectTarget);
  });

  // Delete-turn surface — removes the user+assistant pair that
  // contains the given entry. Ownership is enforced inside forgetTurn.
  // Invalid / foreign ids → redirect to /conversation without side
  // effect (no 404 html — the UI just reloads, the user sees the list
  // unchanged). Wrong-user ids never delete anything.
  web.post("/conversation/turn/forget", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const entryId = String(body.entryId ?? "").trim();
    const viewedSessionId = String(body.sessionId ?? "").trim();
    if (!entryId) {
      return c.redirect(
        viewedSessionId ? `/conversation/${viewedSessionId}` : "/conversation",
      );
    }
    const result = forgetTurn(db, entryId, user.id);
    if (result) {
      return c.redirect(`/conversation/${result.sessionId}`);
    }
    return c.redirect(
      viewedSessionId ? `/conversation/${viewedSessionId}` : "/conversation",
    );
  });

  // Regenerate the stored title for a specific session. Lives on the
  // /conversations listing where the user can see titles that came out
  // wrong and ask for another pass. Ownership enforced via
  // getSessionById; foreign or missing ids fall back to the returnTo
  // redirect without touching anything.
  //
  // Awaits the title generation so the redirected view re-renders with
  // the fresh label. Cost is one cheap title-role call (~1-3s on
  // Gemini 2.0 Flash Lite), acceptable for an explicit user action.
  web.post("/conversation/title/regenerate", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const sessionId = String(body.sessionId ?? "").trim();
    const rawReturnTo = String(body.returnTo ?? "/conversations");
    // Only allow internal paths as returnTo targets — guards against
    // being weaponized to bounce the user off-site after a POST.
    const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/conversations";
    if (!sessionId) return c.redirect(returnTo);
    const session = getSessionById(db, sessionId, user.id);
    if (!session) return c.redirect(returnTo);
    await generateSessionTitle(db, sessionId);
    return c.redirect(returnTo);
  });

  // CV1.E7.S1 — response mode override for the session the user is
  // viewing. Empty or literal "auto" clears the override so reception's
  // pick stands.
  web.post("/conversation/response-mode", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const raw = String(body.mode ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    if (raw === "" || raw === "auto") {
      setSessionResponseMode(db, sessionId, user.id, null);
    } else if (isResponseMode(raw)) {
      setSessionResponseMode(db, sessionId, user.id, raw);
    } else {
      return c.text("Invalid mode", 400);
    }
    return c.redirect(redirectTarget);
  });

  // CV1.E10.S2 — response length override for the session. Empty or
  // literal "auto" clears the override so the mode's natural length
  // dominates. Mirror of /conversation/response-mode in shape and
  // ownership semantics.
  web.post("/conversation/response-length", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const raw = String(body.length ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    if (raw === "" || raw === "auto") {
      setSessionResponseLength(db, sessionId, user.id, null);
    } else if (isResponseLength(raw)) {
      setSessionResponseLength(db, sessionId, user.id, raw);
    } else {
      return c.text("Invalid length", 400);
    }
    return c.redirect(redirectTarget);
  });

  // CV1.E9.S6 — session voice override. Currently only "alma" is a
  // valid non-null value. Setting voice=alma clears session_personas
  // in the same transaction (cast is mutually exclusive — either
  // personas in the pool, or Alma). Empty / "none" clears the
  // override; the persona pool is NOT restored (the user re-convokes
  // personas explicitly).
  web.post("/conversation/voice", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const raw = String(body.voice ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    if (raw === "" || raw === "none") {
      setSessionVoice(db, sessionId, user.id, null);
    } else if (isSessionVoice(raw)) {
      setSessionVoice(db, sessionId, user.id, raw);
    } else {
      return c.text("Invalid voice", 400);
    }
    return c.redirect(redirectTarget);
  });

  // CV1.E15.S3 — per-session model override. Admin-only: a non-admin
  // request 403s rather than silently dropping the body, so any UI
  // surface that posts here is forced to gate by role at render time.
  // Empty fields clear the override (resolver falls through to scene
  // → global). Provider/id are stored as free strings; validation lives
  // in the resolver (S4) — typos surface as failed LLM calls, same as
  // /admin/models. Form posts both fields together.
  web.post("/conversation/model", async (c) => {
    const user = c.get("user");
    if (user.role !== "admin") {
      return c.text("Forbidden", 403);
    }
    const body = await c.req.parseBody();
    const provider = String(body.model_provider ?? "").trim();
    const id = String(body.model_id ?? "").trim();
    const { sessionId, redirectTarget } = resolveRailTargetSession(
      body.sessionId,
      user,
    );
    setSessionModel(db, sessionId, user.id, {
      provider: provider === "" ? null : provider,
      id: id === "" ? null : id,
    });
    return c.redirect(redirectTarget);
  });

  // CV1.E7.S8 — out-of-pool divergent run.
  //
  // The user clicked the suggestion card on a past assistant bubble.
  // Re-run the pipeline with the override key swapped into the
  // appropriate axis (persona / organization / journey), keeping the
  // other axes from the parent entry's meta. The result is persisted
  // to divergent_runs (separate from `entries` so the agent's
  // canonical history feed stays clean) and returned as one-shot JSON.
  web.post("/conversation/divergent-run", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null) as {
      sessionId?: string;
      parentEntryId?: string;
      type?: string;
      key?: string;
    } | null;
    if (!body || typeof body.sessionId !== "string" || typeof body.parentEntryId !== "string") {
      return c.json({ error: "Missing sessionId or parentEntryId" }, 400);
    }
    if (body.type !== "persona" && body.type !== "organization" && body.type !== "journey") {
      return c.json({ error: "Invalid override type" }, 400);
    }
    if (typeof body.key !== "string" || body.key.length === 0) {
      return c.json({ error: "Missing override key" }, 400);
    }
    const overrideType = body.type as DivergentOverrideType;
    const overrideKey = body.key;
    const sessionId = body.sessionId;
    const parentEntryId = body.parentEntryId;

    // Auth / ownership: parent entry's session must belong to the user.
    const parentRow = db
      .prepare(
        `SELECT e.id, e.session_id, e.data, s.user_id
         FROM entries e
         JOIN sessions s ON s.id = e.session_id
         WHERE e.id = ? AND e.session_id = ?`,
      )
      .get(parentEntryId, sessionId) as
      | { id: string; session_id: string; data: string; user_id: string }
      | undefined;
    if (!parentRow) return c.json({ error: "Parent entry not found" }, 404);
    if (parentRow.user_id !== user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Read parent meta to inherit the other axes.
    const parsed = JSON.parse(parentRow.data) as Record<string, unknown>;
    const parentPersonas: string[] = Array.isArray(parsed._personas)
      ? (parsed._personas as unknown[]).filter((x): x is string => typeof x === "string")
      : typeof parsed._persona === "string"
      ? [parsed._persona as string]
      : [];
    const parentOrganization =
      typeof parsed._organization === "string" ? (parsed._organization as string) : null;
    const parentJourney =
      typeof parsed._journey === "string" ? (parsed._journey as string) : null;
    const parentTouchesIdentity =
      typeof parsed._touches_identity === "boolean" ? (parsed._touches_identity as boolean) : false;
    const parentMode = typeof parsed._mode === "string" ? (parsed._mode as ResponseMode) : "conversational";
    // CV1.E10.S2: inherit the parent turn's length so the divergent
    // run stays apples-to-apples on form. Pre-S2 entries have no
    // `_length` stamped and resolve to null (auto), preserving the
    // pre-S2 behavior for older history.
    const parentLength = isResponseLength(parsed._length) ? parsed._length : null;

    // Apply override on the chosen axis. The other axes inherit from
    // the parent's meta so the divergent run has the same surrounding
    // context as the canonical, with only the swapped axis changed.
    let personasForRun: string[] = parentPersonas;
    let organizationForRun: string | null = parentOrganization;
    let journeyForRun: string | null = parentJourney;
    if (overrideType === "persona") {
      personasForRun = [overrideKey];
    } else if (overrideType === "organization") {
      organizationForRun = overrideKey;
    } else if (overrideType === "journey") {
      journeyForRun = overrideKey;
    }

    // Compose with the override; same identity gate AND mode as the parent
    // — the divergent run swaps one axis but keeps the rest of the
    // surrounding context (including target shape) identical.
    const systemPrompt = composeSystemPrompt(
      db,
      user.id,
      personasForRun,
      "web",
      {
        organization: organizationForRun,
        journey: journeyForRun,
        touchesIdentity: parentTouchesIdentity,
        mode: parentMode,
      },
    );

    // Load history up through (and including) the user message that
    // immediately precedes the parent assistant entry. The parent
    // assistant entry itself is NOT included — the divergent run is
    // an alternative answer to the same user message, not a follow-up.
    const allMessages = loadMessages(db, sessionId);
    const parentIdx = allMessages.findIndex((m) => {
      // loadMessages drops internal _* fields and returns role+content;
      // we need to identify the parent by its position in the entries
      // table, so re-walk entries with their ids.
      return false;
    });
    // Simpler approach: rebuild history from entries up to parent.
    const entriesUpThroughParent = db
      .prepare(
        `SELECT data FROM entries
         WHERE session_id = ? AND type = 'message' AND timestamp <= (
           SELECT timestamp FROM entries WHERE id = ?
         )
         ORDER BY timestamp`,
      )
      .all(sessionId, parentEntryId) as { data: string }[];
    // Drop the parent assistant entry from the tail (we want only the
    // user message that triggered it as the latest in history, plus
    // everything before).
    const historyForRun = entriesUpThroughParent
      .slice(0, -1) // drop parent assistant
      .map((r) => {
        const parsed = JSON.parse(r.data) as Record<string, unknown>;
        // Strip internal _ fields for the agent's view.
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!k.startsWith("_")) clean[k] = v;
        }
        return clean;
      });
    // The user message that triggered the parent — extract its text
    // for the agent.prompt() call.
    const userMessageEntry = entriesUpThroughParent[entriesUpThroughParent.length - 2];
    if (!userMessageEntry) {
      return c.json({ error: "Parent entry has no preceding user message" }, 400);
    }
    const userMessageData = JSON.parse(userMessageEntry.data) as {
      role: string;
      content: { type: string; text?: string }[] | string;
    };
    const userText =
      typeof userMessageData.content === "string"
        ? userMessageData.content
        : (userMessageData.content as { type: string; text?: string }[])
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text!)
            .join("");

    // CV1.E15.S4: divergent runs honor the session's resolved model
    // chain — they branch on persona/scope, not on model. The admin's
    // session-level override stays in effect across all branches.
    const resolvedMainDR = resolveMainModel(db, sessionId, user.id);
    const model = getModel(
      resolvedMainDR.provider as any,
      resolvedMainDR.model,
    );
    // History excludes the user message we'll send via prompt() — drop
    // it from history to avoid duplication.
    const historyForAgent = historyForRun.slice(0, -1);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        messages: historyForAgent as any,
      },
      streamFn: headeredStreamFn,
      getApiKey: async () => {
        try {
          return await resolveApiKey(db, "main");
        } catch (err) {
          console.log(
            "[web/divergent-run] resolveApiKey failed:",
            (err as Error).message,
          );
          return undefined;
        }
      },
    });

    let draft = "";
    agent.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        draft += event.assistantMessageEvent.delta;
      }
    });

    await agent.prompt(userText);

    if (!draft) {
      const lastMsg = agent.state.messages.findLast(
        (m) => m.role === "assistant",
      );
      if (lastMsg && "content" in lastMsg) {
        for (const block of lastMsg.content) {
          if ("text" in block) draft += block.text;
        }
      }
    }

    // Expression pass — same role as canonical.
    const expressed = await express(
      db,
      user.id,
      {
        draft,
        userMessage: userText,
        personaKeys: personasForRun,
        mode: parentMode,
        length: parentLength,
      },
      { sessionId },
    );
    const replyText = expressed.text;

    // Persist into divergent_runs. Meta carries the model + override
    // info for future S1 logging cross-ref.
    const id = insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: overrideType,
      override_key: overrideKey,
      content: replyText,
      meta: {
        model: resolvedMainDR.model,
        provider: resolvedMainDR.provider,
        mode: parentMode,
        touches_identity: parentTouchesIdentity,
      },
    });

    return c.json({
      id,
      parentEntryId,
      overrideType,
      overrideKey,
      content: replyText,
    });
  });

  // CV1.E15.S6 — destructive rerun. Admin-only.
  //
  // Replays the user message that produced an assistant entry through
  // a different model and OVERWRITES the assistant entry's content +
  // stamped model. Persona/scope/mode/length all inherited from the
  // parent entry's meta so the rerun is apples-to-apples on shape;
  // only the model changes. Differs from /conversation/divergent-run
  // (CV1.E7.S8): that one persists into a separate `divergent_runs`
  // table for side-by-side comparison; this one mutates the canonical
  // history. The user explicitly chose destructive in S6 design —
  // when a turn lands wrong, the obvious move is to replace it.
  web.post("/conversation/turn/rerun", async (c) => {
    const user = c.get("user");
    if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }
    const body = (await c.req.json().catch(() => null)) as {
      entryId?: string;
      model_provider?: string;
      model_id?: string;
    } | null;
    if (!body || typeof body.entryId !== "string") {
      return c.json({ error: "Missing entryId" }, 400);
    }
    const provider = (body.model_provider ?? "").trim();
    const modelId = (body.model_id ?? "").trim();
    if (!provider || !modelId) {
      return c.json(
        { error: "Both model_provider and model_id are required" },
        400,
      );
    }

    // Auth / ownership: target entry must belong to the user, and it
    // must be an assistant entry (rerunning a user entry doesn't make
    // sense — there's no model output to replace).
    const parentRow = db
      .prepare(
        `SELECT e.id, e.session_id, e.parent_id, e.data, s.user_id
         FROM entries e
         JOIN sessions s ON s.id = e.session_id
         WHERE e.id = ? AND e.type = 'message'`,
      )
      .get(body.entryId) as
      | {
          id: string;
          session_id: string;
          parent_id: string | null;
          data: string;
          user_id: string;
        }
      | undefined;
    if (!parentRow) return c.json({ error: "Entry not found" }, 404);
    if (parentRow.user_id !== user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const parentParsed = JSON.parse(parentRow.data) as Record<
      string,
      unknown
    >;
    if (parentParsed.role !== "assistant") {
      return c.json({ error: "Can only rerun assistant turns" }, 400);
    }

    // Inherit all axes from the parent meta. Reception is NOT re-run —
    // we keep the same routing decisions and only change the model.
    const sessionId = parentRow.session_id;
    const parentPersonas: string[] = Array.isArray(parentParsed._personas)
      ? (parentParsed._personas as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : typeof parentParsed._persona === "string"
        ? [parentParsed._persona as string]
        : [];
    const parentOrganization =
      typeof parentParsed._organization === "string"
        ? (parentParsed._organization as string)
        : null;
    const parentJourney =
      typeof parentParsed._journey === "string"
        ? (parentParsed._journey as string)
        : null;
    const parentTouchesIdentity =
      typeof parentParsed._touches_identity === "boolean"
        ? (parentParsed._touches_identity as boolean)
        : false;
    const parentMode = isResponseMode(parentParsed._mode)
      ? parentParsed._mode
      : "conversational";
    const parentLength = isResponseLength(parentParsed._length)
      ? parentParsed._length
      : null;
    const parentIsAlma = parentParsed._is_alma === true;
    const parentIsTrivial = parentParsed._is_trivial === true;

    // Find the user message that triggered this assistant turn (the
    // entry whose id is parent_id of this assistant). It's the prompt
    // we replay through the alternate model.
    const userMsgRow = parentRow.parent_id
      ? (db
          .prepare(
            "SELECT id, data FROM entries WHERE id = ? AND type = 'message'",
          )
          .get(parentRow.parent_id) as
          | { id: string; data: string }
          | undefined)
      : undefined;
    if (!userMsgRow) {
      return c.json({ error: "Could not locate prompting user message" }, 400);
    }
    const userMsgParsed = JSON.parse(userMsgRow.data) as {
      role?: string;
      content?: { type: string; text?: string }[] | string;
    };
    if (userMsgParsed.role !== "user") {
      return c.json({ error: "Parent of assistant entry is not a user msg" }, 400);
    }
    const userText =
      typeof userMsgParsed.content === "string"
        ? userMsgParsed.content
        : (userMsgParsed.content as { type: string; text?: string }[])
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text!)
            .join("");

    // Resolve the cena (the briefing that the canonical compose path
    // injects every turn). Bypassing this would give a different
    // composed prompt than the parent — apples-to-apples means
    // matching everything except the model.
    const sceneId = getSessionScene(db, sessionId, user.id);
    const sceneForRun = sceneId
      ? (getSceneById(db, sceneId, user.id) ?? null)
      : null;

    // Recompose system prompt — Alma branch when parent was Alma,
    // canonical otherwise. Trivial parents are a degenerate case
    // (composer elides) — skip rerun and surface an error so the UI
    // doesn't promise something it can't deliver.
    if (parentIsTrivial) {
      return c.json(
        { error: "Trivial turns cannot be rerun (composer elides them)" },
        400,
      );
    }
    const systemPrompt = parentIsAlma
      ? composeAlmaPrompt(
          db,
          user.id,
          {
            organization: parentOrganization,
            journey: parentJourney,
            scene: sceneForRun,
          },
          "web",
        )
      : composeSystemPrompt(db, user.id, parentPersonas, "web", {
          organization: parentOrganization,
          journey: parentJourney,
          touchesIdentity: parentTouchesIdentity,
          mode: parentMode,
          scene: sceneForRun,
        });

    // History: every entry up to but NOT including the parent
    // assistant. The user message is the last entry — agent.prompt()
    // appends it back via its argument, so drop it from history too
    // to avoid duplication.
    const allEntries = db
      .prepare(
        `SELECT data FROM entries
         WHERE session_id = ? AND type = 'message' AND timestamp < (
           SELECT timestamp FROM entries WHERE id = ?
         )
         ORDER BY timestamp`,
      )
      .all(sessionId, parentRow.id) as { data: string }[];
    const historyForAgent = allEntries.slice(0, -1).map((r) => {
      const parsed = JSON.parse(r.data) as Record<string, unknown>;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!k.startsWith("_")) clean[k] = v;
      }
      return clean;
    });

    // Build the agent with the chosen model. Auth still resolves
    // through the global "main" role — same caveat as S4.
    const model = getModel(provider as any, modelId);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        messages: historyForAgent as any,
      },
      streamFn: headeredStreamFn,
      getApiKey: async () => {
        try {
          return await resolveApiKey(db, "main");
        } catch (err) {
          console.log(
            "[web/rerun] resolveApiKey failed:",
            (err as Error).message,
          );
          return undefined;
        }
      },
    });

    let draft = "";
    agent.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        draft += event.assistantMessageEvent.delta;
      }
    });

    const startedAt = Date.now();
    await agent.prompt(userText);
    const latencyMs = Date.now() - startedAt;

    if (!draft) {
      const lastMsg = agent.state.messages.findLast(
        (m) => m.role === "assistant",
      );
      if (lastMsg && "content" in lastMsg) {
        for (const block of lastMsg.content) {
          if ("text" in block) draft += block.text;
        }
      }
    }
    if (!draft) {
      return c.json({ error: "Model returned empty response" }, 502);
    }

    // Expression pass — Alma turns skip the pass UNLESS the parent
    // entry was stamped with an explicit override (mode_source=session
    // or non-null length). Symmetric with the canonical /stream path:
    // when the user originally chose mode/length explicitly, the rerun
    // honors that choice rather than reverting to draft-only.
    const parentModeFromOverride =
      parentParsed._mode_source === "session";
    const parentSkipExpression =
      parentIsAlma && !parentModeFromOverride && parentLength === null;
    const reply = parentSkipExpression
      ? draft
      : (
          await express(
            db,
            user.id,
            {
              draft,
              userMessage: userText,
              personaKeys: parentPersonas,
              mode: parentMode,
              length: parentLength,
            },
            { sessionId },
          )
        ).text;

    // Mutate the parent entry: keep all meta, swap content + model
    // stamps. The assistant message shape from pi-ai (provider/model/
    // usage) is replaced with the rerun's own — so the canonical entry
    // tells the truth about the model that produced its current text.
    const assistantMsg = agent.state.messages.findLast(
      (m) => m.role === "assistant",
    );
    const newContent: { type: "text"; text: string }[] = [
      { type: "text", text: reply },
    ];
    const updatedEntry: Record<string, unknown> = {
      ...parentParsed,
      role: "assistant",
      content: newContent,
      // Replace pi-ai shape fields when present — keeps log honest.
      ...(assistantMsg && "provider" in assistantMsg
        ? { provider: (assistantMsg as any).provider }
        : { provider }),
      ...(assistantMsg && "model" in assistantMsg
        ? { model: (assistantMsg as any).model }
        : { model: modelId }),
      ...(assistantMsg && "usage" in assistantMsg
        ? { usage: (assistantMsg as any).usage }
        : {}),
      _model_provider: provider,
      _model_id: modelId,
      _rerun_at: Date.now(),
    };
    db.prepare("UPDATE entries SET data = ? WHERE id = ?").run(
      JSON.stringify(updatedEntry),
      parentRow.id,
    );

    // Log the rerun for observability — same shape as the canonical
    // logLlmCall but with entry_id pointing to the same row.
    try {
      const tokensIn =
        assistantMsg && "usage" in assistantMsg
          ? ((assistantMsg as any).usage?.input_tokens as
              | number
              | undefined) ?? null
          : null;
      const tokensOut =
        assistantMsg && "usage" in assistantMsg
          ? ((assistantMsg as any).usage?.output_tokens as
              | number
              | undefined) ?? null
          : null;
      const costUsd =
        assistantMsg && "cost" in assistantMsg
          ? ((assistantMsg as any).cost as number | undefined) ?? null
          : null;
      logLlmCall(db, {
        role: "main",
        provider,
        model: modelId,
        system_prompt: systemPrompt,
        user_message: userText,
        response: draft,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        session_id: sessionId,
        entry_id: parentRow.id,
        user_id: user.id,
        env: currentEnv(),
        error: null,
      });
    } catch (err) {
      console.log("[web/rerun] logLlmCall failed:", (err as Error).message);
    }

    return c.json({
      entryId: parentRow.id,
      content: reply,
      model_provider: provider,
      model_id: modelId,
    });
  });

  web.get("/conversation/stream", async (c) => {
    const user = c.get("user");
    const text = c.req.query("text");
    if (!text) return c.json({ error: "Missing text" }, 400);

    const bypassPersona = c.req.query("bypass_persona") === "true";

    // CV1.E9.S4: manual destination override. Two valid forms:
    //   forced_destination=alma           → engage Soul Voice path
    //   forced_destination=persona:<key>  → force a specific persona
    // Anything else (missing, malformed, unknown key) falls to null
    // and the canonical reception-driven routing applies.
    const forcedRaw = c.req.query("forced_destination") ?? null;
    let forcedDestination:
      | { type: "alma" }
      | { type: "persona"; key: string }
      | null = null;
    if (forcedRaw === "alma") {
      forcedDestination = { type: "alma" };
    } else if (forcedRaw && forcedRaw.startsWith("persona:")) {
      const key = forcedRaw.slice("persona:".length).trim();
      if (key) forcedDestination = { type: "persona", key };
    }

    const sessionId = getOrCreateSession(db, user.id);
    // CV1.E4.S4: load session tags; reception filters candidates within;
    // first turn of a session with no tags auto-populates from reception.
    const sessionTagsBefore = getSessionTags(db, sessionId);
    const priorEntryCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM entries WHERE session_id = ?")
        .get(sessionId) as { c: number }
    ).c;
    const isFirstTurn = priorEntryCount === 0;

    const reception = bypassPersona
      ? {
          // Lab-mode bypass — produces a stub with no persona, no scope,
          // identity off, alma off. Same shape as ReceptionResult so
          // downstream consumers can read all canonical fields without
          // narrowing the union.
          personas: [] as string[],
          persona: null,
          organization: null,
          journey: null,
          mode: "conversational" as ResponseMode,
          touches_identity: false,
          is_self_moment: false,
          is_trivial: false,
          would_have_persona: null,
          would_have_organization: null,
          would_have_journey: null,
        }
      : await receive(db, user.id, text, {
          sessionTags: sessionTagsBefore,
          sessionId,
        });

    // CV1.E7.S1: mode resolution. The session may carry an explicit
    // override written from the rail; when present, it wins over
    // reception's auto-pick. Otherwise, reception's mode stands.
    const modeOverride = getSessionResponseMode(db, sessionId, user.id);
    const resolvedMode: ResponseMode = modeOverride ?? reception.mode;

    // CV1.E10.S2: length resolution. Pure session-level — there is no
    // reception axis for length yet. `null` means "auto" — let the
    // mode's natural length stand. Explicit values are passed to the
    // expression pass as the dominant size constraint.
    const resolvedLength = getSessionResponseLength(db, sessionId, user.id);

    // Routing flags — derived once and reused below for seeding,
    // composer selection, and rail building.
    //
    // CV1.E9.S4: forced destination wins over reception's verdict.
    // - forced=alma → isAlma true regardless of reception
    // - forced=persona:K → isAlma false, persona pipeline forced to [K]
    // Reception's auto-classification is preserved on the entry meta
    // (separate field) so manual choices serve as labeled comparison
    // samples for future calibration.
    //
    // CV1.E10.S1: trivial path — when reception flags is_trivial AND
    // there's no forced destination AND it's not an Alma turn, the
    // pipeline routes to the minimal composer (adapter only). Belt-
    // and-suspenders: if reception drift somehow flipped both
    // is_trivial and is_self_moment, the alma check below (||) wins
    // (an apontamento can't elide).
    //
    // CV1.E9.S6: session-level voice override. The cast carries the
    // default voice for the conversation: voice=alma means every
    // unforced turn composes through Alma (replaces reception's
    // per-turn is_self_moment as the trigger). But the per-turn
    // override (`Enviar para…`) wins over the session default —
    // forcing a persona on an Alma-cast turn must route through
    // that persona, not Alma. Forcing Alma on a persona-cast turn
    // (the inverse) routes through Alma. Both directions of override
    // coexist with the session-level voice as the underlying default.
    const sessionVoice = getSessionVoice(db, sessionId, user.id);
    const isAlma = forcedDestination
      ? forcedDestination.type === "alma"
      : sessionVoice === "alma" || reception.is_self_moment === true;
    const forcedPersonaKey =
      forcedDestination?.type === "persona" ? forcedDestination.key : null;
    const isTrivial =
      !forcedDestination &&
      !isAlma &&
      reception.is_trivial === true;

    // Auto-seed of session pool — see decideScopeSeeding for the policy.
    // Symmetric "seed-when-empty" gate across the three axes: a scope
    // graduates from this turn's reception output into the junction only
    // when its pool was empty before the turn. The previous gate for
    // org/journey was `isFirstTurn`, strictly stronger than needed —
    // prod 28/Apr/2026 hit the case where turn 1 yielded no scope and
    // turn 2's classification stamped entry meta (badges visible) but
    // never reached the header's Scope zone.
    const seedDecision = decideScopeSeeding(
      sessionTagsBefore,
      {
        personas: reception.personas,
        organization: reception.organization,
        journey: reception.journey,
      },
      { isAlma, isTrivial, forcedPersonaKey },
    );
    for (const p of seedDecision.seedPersonas)
      addSessionPersona(db, sessionId, p);
    if (seedDecision.seedOrganization)
      addSessionOrganization(db, sessionId, seedDecision.seedOrganization);
    if (seedDecision.seedJourney)
      addSessionJourney(db, sessionId, seedDecision.seedJourney);

    // Hot-update signal for the client: keys actually seeded into the
    // pool on this turn. The Scope zone in the header was rendered
    // before these writes; the client uses these to insert the matching
    // pills without a page reload. Keys outside this object should NOT
    // trigger a client-side pill insertion (e.g., divergent picks on
    // later turns — those don't seed the DB and so must not appear in
    // the header).
    const seededScopes = {
      organization: seedDecision.seedOrganization,
      journey: seedDecision.seedJourney,
    };

    const history = loadMessages(db, sessionId);
    // CV1.E7.S3: composer reads scope from reception only. Session tags
    // already constrained reception's pool above; they no longer
    // participate in composition.
    // CV1.E7.S4: identity layers (self/soul + ego/identity) compose
    // only when reception flags the turn as identity-touching.
    // CV1.E9.S3: when reception flags is_self_moment, the canonical
    // composer is REPLACED by the Soul Voice composer — persona path
    // skipped, identity always-on, Alma preamble prepended.
    // CV1.E9.S4: a forced persona key wins over reception's persona
    // picks; a forced=alma wins over reception's is_self_moment=false.
    // CV1.E10.S1: trivial turns route to the minimal composer (adapter
    // only). Branch order: trivial → alma → forced persona → canonical.
    const personasForRun: string[] = isTrivial
      ? []
      : isAlma
        ? []
        : forcedPersonaKey
          ? [forcedPersonaKey]
          : reception.personas;
    // CV1.E11.S1: load the cena anchoring this session (if any) so the
    // composer can inject its briefing block. Trivial turns ignore the
    // cena (the minimal path skips everything).
    const sceneIdForRun = isTrivial
      ? null
      : getSessionScene(db, sessionId, user.id);
    const sceneForRun = sceneIdForRun
      ? (getSceneById(db, sceneIdForRun, user.id) ?? null)
      : null;
    const systemPrompt = isTrivial
      ? composeMinimalPrompt("web")
      : isAlma
        ? composeAlmaPrompt(
            db,
            user.id,
            {
              organization: reception.organization,
              journey: reception.journey,
              scene: sceneForRun,
            },
            "web",
          )
        : composeSystemPrompt(
            db,
            user.id,
            personasForRun,
            "web",
            {
              organization: reception.organization,
              journey: reception.journey,
              scene: sceneForRun,
              // CV1.E9.S4: when the user manually picks a persona, they're
              // explicitly opting INTO that voice — likely because the
              // turn does want identity-bearing depth. Force identity on
              // for forced-persona turns; otherwise honor reception.
              touchesIdentity: forcedPersonaKey
                ? true
                : reception.touches_identity,
              // Resolved mode honors the session override (rail mode pill)
              // when set; otherwise reception's classification. Same value
              // the expression pass uses downstream — keeps generation and
              // polish on the same target shape.
              mode: resolvedMode,
            },
          );
    // CV1.E15.S4: resolve via session → scene → global. The resolved
    // shape carries a `source` so S7's badge logic and logging can
    // distinguish "global default" from "session/scene override" without
    // re-querying.
    const resolvedMain = resolveMainModel(db, sessionId, user.id);
    const model = getModel(resolvedMain.provider as any, resolvedMain.model);

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        messages: history,
      },
      streamFn: headeredStreamFn,
      getApiKey: async () => {
        try {
          return await resolveApiKey(db, "main");
        } catch (err) {
          console.log(
            "[web/main] resolveApiKey failed:",
            (err as Error).message,
          );
          return undefined;
        }
      },
    });

    return streamSSE(c, async (stream) => {
      // CV1.E9 follow-up: wrap the entire pipeline in a top-level
      // try/catch so any pipeline error (network blip, model timeout,
      // composer throw, persistence error, etc.) emits a visible
      // error delta + done event instead of letting the stream close
      // mid-flight and leaving the client stuck at "Finding the
      // voice" forever.
      try {
      // CV1.E7.S1 pipeline:
      //   1. routing (persona, scopes, mode)
      //   2. status(composing) — main generation, hidden from UI
      //   3. status(finding-voice) — expression pass, result streams
      //   4. delta events fire during expression streaming
      //   5. done — rail + final text
      // Include each picked persona's resolved color so the client can
      // paint avatars + bubble signature live without re-running the
      // hash. Server is the single source of truth (honors the stored
      // color column). CV1.E7.S5: emit the whole map, not a scalar.
      const allPersonaLayersForColors = getIdentityLayers(db, user.id).filter(
        (l) => l.layer === "persona",
      );
      // CV1.E9.S3: on Alma turns, persona color routing is meaningless
      // (the Alma replaces the persona path; no avatars to paint). Send
      // the canonical empty shape so the client can render the Alma
      // label instead.
      // CV1.E9.S4: forced-persona turns paint with the FORCED persona's
      // color (the visible truth), not reception's auto pick.
      const personaColorsForRouting: Record<string, string> = {};
      const personasForRouting = personasForRun;
      for (const key of personasForRouting) {
        const layer = allPersonaLayersForColors.find((l) => l.key === key);
        personaColorsForRouting[key] = resolvePersonaColor(
          layer?.color ?? null,
          key,
        );
      }

      // Bubble badge transition for scope (org/journey). Symmetric with
      // newPersonasThisTurn — show the badge on the turn that introduces
      // or changes scope vs the previous assistant turn. Trivial turns
      // carry no scope on the entry meta (composer elides), so the
      // current side passes nulls and any prior scope persists for the
      // next turn's comparison.
      const previousScope = getLastAssistantScopeMeta(db, sessionId);
      const currentOrgForBadge = isTrivial ? null : reception.organization;
      const currentJourneyForBadge = isTrivial ? null : reception.journey;
      const scopeTransition = decideScopeTransition({
        previousOrg: previousScope.organization,
        previousJourney: previousScope.journey,
        currentOrg: currentOrgForBadge,
        currentJourney: currentJourneyForBadge,
      });

      await stream.writeSSE({
        data: JSON.stringify({
          type: "routing",
          // CV1.E7.S5: personas is the canonical plural. `persona` stays
          // as the primary (first element) for backward-compat clients.
          personas: personasForRouting,
          personaColors: personaColorsForRouting,
          persona: personasForRouting[0] ?? null,
          personaColor: personasForRouting[0]
            ? personaColorsForRouting[personasForRouting[0]]
            : null,
          organization: reception.organization,
          journey: reception.journey,
          // Bubble badge visibility — server-computed transition rule
          // (symmetric with newPersonasThisTurn). The client renders the
          // ⌂/↝ badge iff the corresponding field is non-null. The
          // previous client-side rule (`!poolOrganizations.includes(...)`)
          // is gone — pool membership is no longer the gate.
          newOrgThisTurn: scopeTransition.newOrgThisTurn,
          newJourneyThisTurn: scopeTransition.newJourneyThisTurn,
          // Scope pills the client should hot-insert into the header
          // (only populated when this turn auto-seeded the session pool).
          seededScopes,
          mode: resolvedMode,
          modeSource: modeOverride ? "session" : "reception",
          // CV1.E9.S3: signal to the client that this turn is the
          // Soul Voice path. Drives the bubble label, hides persona
          // signature, and lets the rail render the Alma indicator.
          isAlma,
          // CV1.E10.S1: signal to the client that this turn was elided
          // to the minimal path. The bubble has no persona signature
          // and no Alma label — just the response. Rail's Composed
          // block hides automatically (empty layers).
          isTrivial,
          // CV1.E9.S4: signal manual choice when applicable. Client can
          // mark the bubble as user-routed (small dot) so the surface
          // distinguishes auto from manual.
          forcedDestination: forcedDestination
            ? forcedDestination.type === "alma"
              ? "alma"
              : `persona:${forcedDestination.key}`
            : null,
          // CV1.E7.S8: out-of-pool would-have-picked candidates.
          // Drives the suggestion card below the assistant bubble —
          // null means no suggestion to show. Suppressed on Alma turns
          // (the suggestion semantics don't apply when the persona
          // pipeline is bypassed).
          wouldHavePersona: isAlma ? null : reception.would_have_persona,
          wouldHaveOrganization: isAlma ? null : reception.would_have_organization,
          wouldHaveJourney: isAlma ? null : reception.would_have_journey,
        }),
      });

      await stream.writeSSE({
        data: JSON.stringify({ type: "status", phase: "composing" }),
      });

      // Accumulate the draft in memory — the main-generation stream is
      // intentionally not forwarded to the client (D7 in plan.md).
      let draft = "";
      agent.subscribe((event) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          draft += event.assistantMessageEvent.delta;
        }
      });

      // CV1.E8.S1: capture latency around main generation so the
      // logged row reflects what the user actually waited for. The
      // log row itself is written after the assistant entry exists
      // (so entry_id can populate); on agent failure, the top-level
      // try/catch in the SSE handler logs the row with error set.
      const mainStartedAt = Date.now();
      await agent.prompt(text);
      const mainLatencyMs = Date.now() - mainStartedAt;

      if (!draft) {
        // CV1.E9 follow-up: enriched fallback. Reasoning-capable
        // models (Gemini 2.5, Claude with extended thinking) can
        // burn the entire output budget on thinking blocks and emit
        // zero text blocks — agent.subscribe captures only text_delta
        // events so draft stays empty. Walk the assistant content
        // and collect text first; if no text blocks exist, fall back
        // to thinking content (last resort) so the user at least
        // sees what the model produced. Diagnostic log dumps the
        // block-type distribution so we can spot reasoning runaway.
        const lastMsg = agent.state.messages.findLast(
          (m) => m.role === "assistant",
        );
        if (lastMsg && "content" in lastMsg) {
          const blockTypes: string[] = [];
          let textCollected = "";
          let thinkingCollected = "";
          for (const block of lastMsg.content as any[]) {
            blockTypes.push(block?.type ?? "unknown");
            if (block?.type === "text" && typeof block.text === "string") {
              textCollected += block.text;
            } else if (
              block?.type === "thinking" &&
              typeof block.thinking === "string"
            ) {
              thinkingCollected += block.thinking;
            }
          }
          if (textCollected) {
            draft = textCollected;
          } else if (thinkingCollected) {
            // Thinking-only response — wrap as a meta note so the
            // user sees the substance plus an explicit signal that
            // the model didn't produce a final reply. Better than
            // silence; clearer than the generic fallback message.
            draft = `_(O modelo retornou apenas raciocínio interno, sem resposta final. Conteúdo do raciocínio:)_\n\n${thinkingCollected}`;
          }
          console.log(
            `[web/main] draft fallback — blocks=[${blockTypes.join(",")}] text_chars=${textCollected.length} thinking_chars=${thinkingCollected.length}`,
          );
        }
      }

      const assistantMsg = agent.state.messages.findLast(
        (m) => m.role === "assistant",
      );
      const userMsg = agent.state.messages.findLast((m) => m.role === "user");

      if (assistantMsg && "provider" in assistantMsg) {
        try {
          logUsage(db, {
            role: "main",
            env: currentEnv(),
            message: assistantMsg as any,
            user_id: user.id,
            session_id: sessionId,
          });
        } catch (err) {
          console.log("[web/main] logUsage failed:", (err as Error).message);
        }
      }

      // Expression pass. Always on for the canonical path; falls back
      // silently on failure to the unchanged draft (result.applied
      // === false).
      //
      // CV1.E9 follow-up: SKIP expression on Alma turns. The Alma's
      // own preamble carries explicit form rules (acolher → iluminar
      // → revelar, 2–5 paragraphs of prose, no headers, no list
      // bullets). Routing the draft through the mode-aware expression
      // pass — which compresses conversational turns to "1–3
      // sentences, no preamble" — collapses the Alma's depth to a
      // line of validation. Skipping preserves the work the Alma
      // prompt already did.
      await stream.writeSSE({
        data: JSON.stringify({ type: "status", phase: "finding-voice" }),
      });

      // CV1.E15 follow-up: Alma's expression bypass is conditional on
      // "no explicit override". Without overrides we want the Alma's
      // own prosa (acolher → iluminar → revelar) to land verbatim;
      // with explicit mode or length set in the header, the admin is
      // taking control and the bypass would silently drop their choice.
      // modeOverride !== null means "session has chosen a mode";
      // resolvedLength !== null means "session has chosen a length"
      // (auto resolves to null in getSessionResponseLength).
      const skipExpression =
        isAlma && modeOverride === null && resolvedLength === null;

      let reply: string;
      if (skipExpression) {
        reply = draft;
      } else {
        const expressed = await express(
          db,
          user.id,
          {
            draft,
            userMessage: text,
            personaKeys: personasForRun,
            mode: resolvedMode,
            length: resolvedLength,
          },
          { sessionId },
        );
        reply = expressed.text;
      }

      // CV1.E9 follow-up: empty-reply guard. On Alma turns the
      // expression-pass safety net is gone; if main generation
      // returned no text AND the block-walk above couldn't extract
      // text or thinking content (model timed out, returned only
      // tool calls, hit a context limit, etc.), draft + reply are
      // empty and the chunk loop emits zero deltas — the client
      // stays stuck at "Finding the voice" forever. Known cause:
      // reasoning-mode models (DeepSeek V4 Pro, Gemini 2.5 Pro with
      // thinking, Claude with extended thinking) can burn the entire
      // output budget on thinking blocks when the system prompt is
      // large (Alma preamble + soul + doctrine + identity ~12-15k
      // tokens). The block-walk fallback catches the thinking-only
      // case; this guard catches genuine zero-output failures.
      //
      // If this fallback fires repeatedly on Alma turns, consider
      // either: (a) switching the main model in /admin/models to a
      // non-reasoning model, or (b) tightening thinkingBudgets on
      // the Agent constructor.
      if (!reply || !reply.trim()) {
        const isAlmaPreview = isAlma ? "alma" : "canonical";
        console.log(
          `[web/main] empty reply on ${isAlmaPreview} turn — draft.length=${draft.length}, assistantMsg=${assistantMsg ? "present" : "missing"}. surfacing fallback message to client.`,
        );
        reply = isAlma
          ? "_(A Alma ficou em silêncio nesta volta — provavelmente o modelo gastou o budget pensando. Tente reformular o registro, aguardar um momento, ou trocar o modelo `main` em `/admin/models` por um sem reasoning agressivo.)_"
          : "_(Resposta vazia. Tente novamente.)_";
      }

      // Stream the expressed reply in word-sized chunks. We don't stream
      // tokens from the expression LLM (the call is non-streaming) — we
      // chunk the final text for a consistent typing rhythm. Chunk size
      // is small enough to feel like streaming, large enough that short
      // conversational replies finish nearly instantly.
      for (const chunk of chunkForStream(reply)) {
        await stream.writeSSE({
          data: JSON.stringify({ type: "delta", text: chunk }),
        });
      }

      const lastEntry = db
        .prepare(
          "SELECT id FROM entries WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
        )
        .get(sessionId) as { id: string } | undefined;

      const userEntryId = appendEntry(
        db,
        sessionId,
        lastEntry?.id ?? null,
        "message",
        userMsg,
      );

      // Persist the expressed text, not the draft. The assistant message
      // the user sees is the final text; history carries what was shown.
      const assistantForPersist = buildAssistantForPersist(
        assistantMsg,
        reply,
      );
      // CV1.E7.S5: stamp both shapes. _personas is the canonical new
      // field (array); _persona stays for backward compat — consumers
      // that only read the singular get the first element.
      // CV1.E9.S3: Alma turns have no personas — skip both stamps so
      // history-based aggregations (cast counts, persona heatmaps)
      // don't see Alma turns as persona contributions.
      // CV1.E9.S4: forced-persona turns persist the FORCED key (the
      // canonical "what was actually used"), not reception's auto pick.
      const meta: Record<string, unknown> = {};
      if (!isAlma && personasForRun.length > 0) {
        meta._personas = personasForRun;
        meta._persona = personasForRun[0];
      }
      if (reception.organization) meta._organization = reception.organization;
      if (reception.journey) meta._journey = reception.journey;
      // CV1.E7.S9 phase 1: stamp the resolved mode and its source so
      // the bubble can render a per-turn mode indicator and so future
      // tools (Look inside snapshot, log dashboards) can read mode
      // from the entry without re-deriving it from reception output.
      meta._mode = resolvedMode;
      meta._mode_source = modeOverride ? "session" : "reception";
      // CV1.E10.S2: stamp the resolved length when present. Null length
      // means "auto" (mode dictates) — no value is stamped so the entry
      // stays clean. Older entries without `_length` read as null on
      // the divergent-run path below, preserving auto behavior on
      // re-runs of pre-S2 turns.
      if (resolvedLength) meta._length = resolvedLength;
      // CV1.E7.S4: stamp the identity gate so the rail snapshot can
      // re-render the correct layers list on page reload (it reads
      // _touches_identity from the last assistant entry's meta).
      // CV1.E9.S3: Alma always composes identity, so the persisted
      // gate is `true` whenever the turn was Alma.
      // CV1.E10.S1: trivial turns compose nothing — identity gate
      // false regardless of reception's verdict.
      meta._touches_identity = isTrivial
        ? false
        : isAlma
          ? true
          : reception.touches_identity;
      // CV1.E15.S4: stamp the resolved model on every assistant entry.
      // S7 reads this to badge bubbles whose model differs from the
      // session's current default; reruns (S6) overwrite it.
      meta._model_provider = resolvedMain.provider;
      meta._model_id = resolvedMain.model;
      // CV1.E9.S3: stamp the Alma flag so F5 reload reproduces the
      // routing decision (rail labeling, persona-bar suppression).
      if (isAlma) meta._is_alma = true;
      // CV1.E10.S1: stamp the trivial flag for F5 reload — rail
      // Composed block stays hidden, no persona signature.
      if (isTrivial) meta._is_trivial = true;
      // CV1.E9.S4: stamp manual choice as labeled-data ground truth.
      // Pairs with reception's auto verdict (_is_alma + _personas above
      // reflect the resolved post-override state; reception's raw
      // classification lives in usage logs / future S1 LLM logging).
      if (forcedDestination) {
        meta._forced_destination =
          forcedDestination.type === "alma"
            ? "alma"
            : `persona:${forcedDestination.key}`;
        // Cross-reference what reception thought before the override —
        // useful for future eval queries comparing forced vs auto.
        meta._reception_is_self_moment = reception.is_self_moment;
        meta._reception_personas = reception.personas;
      }
      const assistantWithMeta =
        Object.keys(meta).length > 0
          ? { ...assistantForPersist, ...meta }
          : assistantForPersist;
      const assistantEntryId = appendEntry(
        db,
        sessionId,
        userEntryId,
        "message",
        assistantWithMeta,
      );

      // CV1.E8.S1: log the main LLM call now that the entry exists so
      // entry_id can populate. The system prompt is the one that was
      // composed for this turn (Alma or canonical), the user message
      // is the raw text, response is the final draft (post fallback).
      try {
        const mainTokensIn =
          assistantMsg && "usage" in assistantMsg
            ? ((assistantMsg as any).usage?.input_tokens as number | undefined) ?? null
            : null;
        const mainTokensOut =
          assistantMsg && "usage" in assistantMsg
            ? ((assistantMsg as any).usage?.output_tokens as number | undefined) ?? null
            : null;
        const mainCostUsd =
          assistantMsg && "cost" in assistantMsg
            ? ((assistantMsg as any).cost as number | undefined) ?? null
            : null;
        logLlmCall(db, {
          role: "main",
          // CV1.E15.S4: log the resolved model, not the global default.
          provider: resolvedMain.provider,
          model: resolvedMain.model,
          system_prompt: systemPrompt,
          user_message: text,
          response: draft || null,
          tokens_in: mainTokensIn,
          tokens_out: mainTokensOut,
          cost_usd: mainCostUsd,
          latency_ms: mainLatencyMs,
          session_id: sessionId,
          entry_id: assistantEntryId,
          user_id: user.id,
          env: currentEnv(),
          error: draft ? null : "empty draft (model returned no text)",
        });
      } catch (err) {
        // Never break the pipeline on logging failure — logLlmCall is
        // already defensive, but the metadata extraction above could
        // theoretically throw on unexpected shapes.
        console.log(
          "[web/main] logLlmCall wrap failed:",
          (err as Error).message,
        );
      }

      // Title generation — on the first turn, so the conversation shows up
      // titled right away in listings instead of 'Untitled conversation'
      // until Begin again fires. The Begin-again handler still calls the
      // same generator; that run effectively refines the title with the
      // full transcript. Fire-and-forget: failure leaves the row NULL and
      // the listings fall back to the untitled label gracefully.
      if (isFirstTurn) {
        void generateSessionTitle(db, sessionId);
      }

      const rail = buildRailState(
        db,
        user,
        sessionId,
        // CV1.E9.S3: Alma turns force personas empty for rail rendering.
        // CV1.E9.S4: forced-persona turns surface the FORCED key.
        // CV1.E10.S1: trivial turns force everything empty.
        personasForRun,
        isTrivial ? null : reception.organization,
        isTrivial ? null : reception.journey,
        resolvedMode,
        // CV1.E9.S3: Alma always composes identity; pass true so the
        // snapshot reflects that and Look inside lists the layers.
        // CV1.E9.S4: forced-persona turns also force identity on.
        // CV1.E10.S1: trivial turns force identity OFF.
        isTrivial
          ? false
          : isAlma || forcedPersonaKey
            ? true
            : reception.touches_identity,
        isAlma,
        isTrivial,
      );
      // CV1.E11.S1 P5: cold-start cena suggestion. Only when the
      // session is unscoped and this is its first turn. Trivial turns
      // already short-circuit inside evaluateColdStart.
      const cenaSuggestion = evaluateColdStart(
        db,
        user.id,
        sceneIdForRun,
        isFirstTurn,
        reception,
      );
      await stream.writeSSE({
        data: JSON.stringify({
          type: "done",
          reply,
          rail,
          entries: { userEntryId, assistantEntryId },
          cenaSuggestion,
        }),
      });
      } catch (err) {
        // Pipeline failure — surface the message to the client so
        // the bubble doesn't hang at the "Finding the voice" status.
        // Two events: a delta that replaces the typing/status with
        // a visible error string, and a done event so the client's
        // post-stream cleanup (re-enable buttons, etc.) runs.
        const message = (err as Error)?.message ?? "unknown error";
        console.log("[web/conversation/stream] pipeline error:", message);
        try {
          await stream.writeSSE({
            data: JSON.stringify({
              type: "delta",
              text: `_(Erro no pipeline: ${message}. Tente novamente.)_`,
            }),
          });
          await stream.writeSSE({
            data: JSON.stringify({
              type: "done",
              reply: "",
              rail: null,
              entries: null,
              error: message,
            }),
          });
        } catch (writeErr) {
          // If we can't even write the error event, the stream is
          // already broken — log and let it close.
          console.log(
            "[web/conversation/stream] failed to surface error:",
            (writeErr as Error)?.message,
          );
        }
      }
    });
  });

  // --- Organizations surface (CV1.E4.S1) ---

  web.get("/organizations", (c) => {
    const user = c.get("user");
    const showArchived = c.req.query("archived") === "1";
    // Fetch every status so the list page can render bands for active,
    // concluded, and (on demand) archived. Filtering by status is
    // handled in-memory since the three bands share the same page.
    const all = getOrganizations(db, user.id, {
      includeArchived: true,
      includeConcluded: true,
    });
    const archivedCount = all.filter((o) => o.status === "archived").length;
    const organizations = showArchived
      ? all
      : all.filter((o) => o.status !== "archived");
    return c.html(
      <OrganizationsListPage
        user={user}
        organizations={organizations}
        archivedCount={archivedCount}
        showArchived={showArchived}
        latestSessions={getLatestOrganizationSessions(db, user.id)}
      />,
    );
  });

  web.post("/organizations", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData();
    const name = (form.get("name") as string | null)?.trim() ?? "";
    const key = (form.get("key") as string | null)?.trim() ?? "";
    if (!name || !key) return c.text("Name and key are required", 400);
    if (!/^[a-z0-9-]+$/.test(key)) {
      return c.text("Key must contain only lowercase letters, numbers, hyphens", 400);
    }
    const existing = getOrganizationByKey(db, user.id, key);
    if (existing) return c.text("An organization with that key already exists", 409);
    createOrganization(db, user.id, key, name);
    return c.redirect(`/organizations/${key}`);
  });

  // CV1.E13.S2: GET /organizations/:key is now the portrait (read view).
  // The workshop form moved to /organizations/:key/{editar,edit}.
  web.get("/organizations/:key", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const org = getOrganizationByKey(db, user.id, key);
    if (!org) return c.text("Organization not found", 404);

    const portrait = composeOrganizationPortrait(db, user.id, org);

    // Background warmup of citable-line cache for tagged sessions.
    void warmOrganizationPortraitCache(db, user.id, key);

    return c.html(
      <OrganizationPortraitPage
        user={user}
        portrait={portrait}
        editPath={editPathFor("organizations", key, user.locale)}
      />,
    );
  });

  // Workshop form — locale-aware slug, same handler for both.
  web.get("/organizations/:key/:action{editar|edit}", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const org = getOrganizationByKey(db, user.id, key);
    if (!org) return c.text("Organization not found", 404);
    const { rows: sessions, total: sessionsTotal } = getOrganizationSessions(
      db,
      user.id,
      key,
      5,
    );
    return c.html(
      <OrganizationWorkshopPage
        user={user}
        organization={org}
        sessions={sessions}
        sessionsTotal={sessionsTotal}
        summaryStatus={parseSummaryStatus(c.req.query("summary"))}
      />,
    );
  });

  web.post("/organizations/:key", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const before = getOrganizationByKey(db, user.id, key);
    if (!before) return c.text("Organization not found", 404);
    const form = await c.req.formData();
    const name = (form.get("name") as string | null)?.trim();
    const briefing = (form.get("briefing") as string | null) ?? "";
    const situation = (form.get("situation") as string | null) ?? "";
    const userSummary = ((form.get("summary") as string | null) ?? "").trim();
    const updated = updateOrganization(db, user.id, key, {
      name: name || undefined,
      briefing,
      situation,
    });
    if (!updated) return c.text("Organization not found", 404);

    // Promote-on-edit (CV1.E11.S7): saving the org via the workshop
    // promotes a stub created via cena form. No-op when not a draft.
    setOrganizationIsDraft(db, user.id, key, false);

    // Summary is now editable on the workshop. If the user typed a
    // summary, keep their text and skip auto-regen. If they cleared it
    // and the briefing/situation changed, regenerate via the model.
    // If they cleared it and content didn't change, leave it null.
    if (userSummary.length > 0) {
      setOrganizationSummary(db, user.id, key, userSummary);
      return c.redirect(`/organizations/${key}`);
    }
    const contentChanged =
      before.briefing !== updated.briefing ||
      before.situation !== updated.situation;
    if (!contentChanged) {
      return c.redirect(`/organizations/${key}`);
    }
    const result = await generateScopeSummary(db, user.id, "organization", key);
    return c.redirect(`/organizations/${key}?summary=${result}`);
  });

  web.post("/organizations/:key/regenerate-summary", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const org = getOrganizationByKey(db, user.id, key);
    if (!org) return c.text("Organization not found", 404);
    // Awaited so the redirect lands a fresh summary, and the result is
    // echoed back as a query param — otherwise silent failures (empty
    // source, timeout, API error) are indistinguishable from "nothing
    // happened" to the user clicking the button.
    const result = await generateScopeSummary(db, user.id, "organization", key);
    return c.redirect(`/organizations/${key}?summary=${result}`);
  });

  web.post("/organizations/:key/archive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = archiveOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found or already archived", 404);
    return c.redirect(`/organizations/${key}`);
  });

  web.post("/organizations/:key/unarchive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = unarchiveOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found or already active", 404);
    return c.redirect(`/organizations/${key}`);
  });

  web.post("/organizations/:key/conclude", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = concludeOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found or not active", 404);
    return c.redirect(`/organizations/${key}`);
  });

  web.post("/organizations/:key/reopen", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = reopenOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found or not concluded", 404);
    return c.redirect(`/organizations/${key}`);
  });

  web.post("/organizations/:key/delete", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = deleteOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found", 404);
    return c.redirect("/organizations");
  });

  web.post("/organizations/:key/reorder", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("direction") as string | null) ?? c.req.query("direction") ?? "";
    if (raw !== "up" && raw !== "down") {
      return c.text("direction must be 'up' or 'down'", 400);
    }
    if (!getOrganizationByKey(db, user.id, key)) {
      return c.text("Organization not found", 404);
    }
    moveOrganization(db, user.id, key, raw);
    return c.redirect("/organizations");
  });

  web.post("/organizations/:key/sidebar", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("visible") as string | null) ?? c.req.query("visible") ?? "";
    if (raw !== "0" && raw !== "1") {
      return c.text("visible must be '0' or '1'", 400);
    }
    const ok = setOrganizationShowInSidebar(db, user.id, key, raw === "1");
    if (!ok) return c.text("Organization not found", 404);
    return c.redirect("/organizations");
  });

  // --- Personas surface ---

  web.get("/personas", (c) => {
    const user = c.get("user");
    const personas = getIdentityLayers(db, user.id).filter((l) => l.layer === "persona");
    return c.html(
      <PersonasListPage
        user={user}
        personas={personas}
      />,
    );
  });

  // CV1.E13.S4: persona portrait. /personas/:key is the read view;
  // the form remains at /map/persona/:key (legacy) and is also
  // reachable via /personas/:key/{editar,edit} (locale-aware).
  web.get("/personas/:key", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const layer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === key,
    );
    if (!layer) return c.text("Persona not found", 404);

    const portrait = composePersonaPortrait(db, user.id, layer);
    void warmPersonaPortraitCache(db, user.id, key);

    return c.html(
      <PersonaPortraitPage
        user={user}
        personaKey={key}
        portrait={portrait}
        editPath={editPathFor("personas", key, user.locale)}
      />,
    );
  });

  // Workshop form alias — locale-aware. The canonical workshop URL
  // remains /map/persona/:key for backward compat with internal links;
  // these two new aliases redirect there so cross-locale link sharing
  // and post-portrait edit flows work.
  web.get("/personas/:key/:action{editar|edit}", (c) => {
    const key = c.req.param("key");
    return c.redirect(`/map/persona/${key}`);
  });

  web.post("/personas/:key/reorder", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("direction") as string | null) ?? c.req.query("direction") ?? "";
    if (raw !== "up" && raw !== "down") {
      return c.text("direction must be 'up' or 'down'", 400);
    }
    const exists = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === key,
    );
    if (!exists) return c.text("Persona not found", 404);
    movePersona(db, user.id, key, raw);
    return c.redirect("/personas");
  });

  web.post("/personas/:key/sidebar", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("visible") as string | null) ?? c.req.query("visible") ?? "";
    if (raw !== "0" && raw !== "1") {
      return c.text("visible must be '0' or '1'", 400);
    }
    const ok = setPersonaShowInSidebar(db, user.id, key, raw === "1");
    if (!ok) return c.text("Persona not found", 404);
    return c.redirect("/personas");
  });

  // --- Journeys surface (CV1.E4.S1) ---

  web.get("/journeys", (c) => {
    const user = c.get("user");
    const showArchived = c.req.query("archived") === "1";
    // Fetch every status so the list page can render active, concluded,
    // and (on demand) archived bands.
    const allJourneys = getJourneys(db, user.id, {
      includeArchived: true,
      includeConcluded: true,
    });
    // Include archived orgs so a journey linked to an archived org still
    // resolves its badge name; the create-form selector filters to active.
    const organizations = getOrganizations(db, user.id, {
      includeArchived: true,
      includeConcluded: true,
    });
    const archivedCount = allJourneys.filter((j) => j.status === "archived").length;
    const visible = showArchived
      ? allJourneys
      : allJourneys.filter((j) => j.status !== "archived");

    const activeOrgs = organizations.filter((o) => o.status === "active");

    return c.html(
      <JourneysListPage
        user={user}
        journeys={visible}
        organizations={activeOrgs}
        allOrganizations={organizations}
        archivedCount={archivedCount}
        showArchived={showArchived}
        latestSessions={getLatestJourneySessions(db, user.id)}
      />,
    );
  });

  web.post("/journeys", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData();
    const name = (form.get("name") as string | null)?.trim() ?? "";
    const key = (form.get("key") as string | null)?.trim() ?? "";
    const orgIdRaw = (form.get("organization_id") as string | null)?.trim() ?? "";
    if (!name || !key) return c.text("Name and key are required", 400);
    if (!/^[a-z0-9-]+$/.test(key)) {
      return c.text("Key must contain only lowercase letters, numbers, hyphens", 400);
    }
    const existing = getJourneyByKey(db, user.id, key);
    if (existing) return c.text("A journey with that key already exists", 409);

    let organizationId: string | null = null;
    if (orgIdRaw) {
      const orgs = getOrganizations(db, user.id, { includeArchived: true, includeConcluded: true });
      const org = orgs.find((o) => o.id === orgIdRaw);
      if (!org) return c.text("Organization not found", 400);
      organizationId = org.id;
    }

    createJourney(db, user.id, key, name, "", "", organizationId);
    return c.redirect(`/journeys/${key}`);
  });

  // CV1.E13.S1: GET /journeys/:key is now the portrait (read view).
  // The workshop form moved to /journeys/:key/editar (or /edit for `en`).
  // Internal redirects from POST handlers continue to land here, which
  // is the correct UX (save → back to reading).
  web.get("/journeys/:key", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const journey = getJourneyByKey(db, user.id, key);
    if (!journey) return c.text("Journey not found", 404);

    const portrait = composeJourneyPortrait(db, user.id, journey);

    // Background warmup of the citable-line cache. Fire-and-forget —
    // the current response renders with whatever's already cached;
    // the next visit picks up the freshly-extracted lines.
    void warmJourneyPortraitCache(db, user.id, key);

    return c.html(
      <JourneyPortraitPage
        user={user}
        portrait={portrait}
        editPath={editPathFor("journeys", key, user.locale)}
      />,
    );
  });

  // Workshop form — locale-aware slug. Both `/editar` (pt-BR canonical)
  // and `/edit` (en canonical) are accepted everywhere via Hono's regex
  // parameter, so cross-locale link sharing keeps working.
  web.get("/journeys/:key/:action{editar|edit}", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const journey = getJourneyByKey(db, user.id, key);
    if (!journey) return c.text("Journey not found", 404);

    const organizations = getOrganizations(db, user.id); // active only, for selector
    const parentOrganization =
      journey.organization_id !== null
        ? getOrganizations(db, user.id, {
            includeArchived: true,
            includeConcluded: true,
          }).find((o) => o.id === journey.organization_id) ?? null
        : null;

    const { rows: sessions, total: sessionsTotal } = getJourneySessions(
      db,
      user.id,
      key,
      5,
    );

    return c.html(
      <JourneyWorkshopPage
        user={user}
        journey={journey}
        organizations={organizations}
        parentOrganization={parentOrganization}
        sessions={sessions}
        sessionsTotal={sessionsTotal}
        summaryStatus={parseSummaryStatus(c.req.query("summary"))}
      />,
    );
  });

  web.post("/journeys/:key", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const before = getJourneyByKey(db, user.id, key);
    if (!before) return c.text("Journey not found", 404);
    const form = await c.req.formData();
    const name = (form.get("name") as string | null)?.trim();
    const briefing = (form.get("briefing") as string | null) ?? "";
    const situation = (form.get("situation") as string | null) ?? "";
    const userSummary = ((form.get("summary") as string | null) ?? "").trim();
    const orgIdRaw = (form.get("organization_id") as string | null)?.trim() ?? "";

    const updated = updateJourney(db, user.id, key, {
      name: name || undefined,
      briefing,
      situation,
    });
    if (!updated) return c.text("Journey not found", 404);

    // Promote-on-edit (CV1.E11.S7): saving via the workshop promotes
    // a stub created via cena form. No-op when not a draft.
    setJourneyIsDraft(db, user.id, key, false);

    // Organization link update is a separate call — pass null to unlink.
    let organizationId: string | null = null;
    if (orgIdRaw) {
      const orgs = getOrganizations(db, user.id, { includeArchived: true, includeConcluded: true });
      const org = orgs.find((o) => o.id === orgIdRaw);
      if (org) organizationId = org.id;
    }
    linkJourneyOrganization(db, user.id, key, organizationId);

    // Summary editable on the workshop. User text wins; blank +
    // briefing/situation change → regenerate; blank + no change → leave.
    if (userSummary.length > 0) {
      setJourneySummary(db, user.id, key, userSummary);
      return c.redirect(`/journeys/${key}`);
    }
    const contentChanged =
      before.briefing !== updated.briefing ||
      before.situation !== updated.situation;
    if (!contentChanged) {
      return c.redirect(`/journeys/${key}`);
    }
    const result = await generateScopeSummary(db, user.id, "journey", key);
    return c.redirect(`/journeys/${key}?summary=${result}`);
  });

  web.post("/journeys/:key/regenerate-summary", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const journey = getJourneyByKey(db, user.id, key);
    if (!journey) return c.text("Journey not found", 404);
    const result = await generateScopeSummary(db, user.id, "journey", key);
    return c.redirect(`/journeys/${key}?summary=${result}`);
  });

  web.post("/journeys/:key/archive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = archiveJourney(db, user.id, key);
    if (!ok) return c.text("Journey not found or already archived", 404);
    return c.redirect(`/journeys/${key}`);
  });

  web.post("/journeys/:key/unarchive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = unarchiveJourney(db, user.id, key);
    if (!ok) return c.text("Journey not found or already active", 404);
    return c.redirect(`/journeys/${key}`);
  });

  web.post("/journeys/:key/conclude", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = concludeJourney(db, user.id, key);
    if (!ok) return c.text("Journey not found or not active", 404);
    return c.redirect(`/journeys/${key}`);
  });

  web.post("/journeys/:key/reopen", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = reopenJourney(db, user.id, key);
    if (!ok) return c.text("Journey not found or not concluded", 404);
    return c.redirect(`/journeys/${key}`);
  });

  web.post("/journeys/:key/delete", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = deleteJourney(db, user.id, key);
    if (!ok) return c.text("Journey not found", 404);
    return c.redirect("/journeys");
  });

  web.post("/journeys/:key/reorder", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("direction") as string | null) ?? c.req.query("direction") ?? "";
    if (raw !== "up" && raw !== "down") {
      return c.text("direction must be 'up' or 'down'", 400);
    }
    if (!getJourneyByKey(db, user.id, key)) {
      return c.text("Journey not found", 404);
    }
    moveJourney(db, user.id, key, raw);
    return c.redirect("/journeys");
  });

  web.post("/journeys/:key/sidebar", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const form = await c.req.formData();
    const raw = (form.get("visible") as string | null) ?? c.req.query("visible") ?? "";
    if (raw !== "0" && raw !== "1") {
      return c.text("visible must be '0' or '1'", 400);
    }
    const ok = setJourneyShowInSidebar(db, user.id, key, raw === "1");
    if (!ok) return c.text("Journey not found", 404);
    return c.redirect("/journeys");
  });

  // CV1.E11.S1 follow-up: clear the cena anchor on a session. Sets
  // sessions.scene_id = NULL — subsequent turns compose without the
  // cena's briefing. Form-POSTed from the header's Scene pill.
  web.post("/conversation/:sessId/clear-scene", (c) => {
    const user = c.get("user");
    const sessId = c.req.param("sessId");
    const session = getSessionById(db, sessId, user.id);
    if (!session) return c.text("Session not found", 404);
    setSessionScene(db, sessId, user.id, null);
    return c.redirect(`/conversation/${sessId}`);
  });

  // CV1.E11.S1 P5: accept the cold-start suggestion. The client POSTs
  // here when the user clicks "Continuar nessa cena" on the suggestion
  // card. We set sessions.scene_id; subsequent turns compose with the
  // cena's briefing.
  web.post("/conversation/:sessId/apply-scene", async (c) => {
    const user = c.get("user");
    const sessId = c.req.param("sessId");
    const session = getSessionById(db, sessId, user.id);
    if (!session) return c.json({ error: "session not found" }, 404);
    const body = await c.req.json<{ key?: string }>();
    const key = (body.key ?? "").trim();
    if (!key) return c.json({ error: "key required" }, 400);
    const scene = getSceneByKey(db, user.id, key);
    if (!scene) return c.json({ error: "scene not found" }, 404);
    setSessionScene(db, sessId, user.id, scene.id);
    return c.json({ ok: true, sceneId: scene.id, title: scene.title });
  });

  web.post("/cenas/:key/start", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const scene = getSceneByKey(db, user.id, key);
    if (!scene) return c.text("Scene not found", 404);
    const sessId = createFreshSession(db, user.id, scene.id);

    // Seed the session's pools from the cena's declared cast and
    // scope so the header lands populated from turn 0 — the cena's
    // briefing already affects composition, but without the cast
    // pre-seed the user would see an empty Cast zone until reception
    // first fired. Mirrors the cena's data-layer mutex: voice='alma'
    // forces session voice, otherwise the persona cast is seeded.
    if (scene.voice === "alma") {
      setSessionVoice(db, sessId, user.id, "alma");
    } else {
      const cast = getScenePersonas(db, scene.id);
      for (const personaKey of cast) {
        addSessionPersona(db, sessId, personaKey);
      }
    }
    if (scene.organization_key) {
      addSessionOrganization(db, sessId, scene.organization_key);
    }
    if (scene.journey_key) {
      addSessionJourney(db, sessId, scene.journey_key);
    }

    // Propagate the cena's response_mode + response_length to the new
    // session so the user's chosen defaults (e.g. "conversational" /
    // "standard") land active from turn 0. Null on the cena leaves the
    // session at the global default — same as not configuring.
    if (scene.response_mode !== null) {
      setSessionResponseMode(db, sessId, user.id, scene.response_mode);
    }
    if (scene.response_length !== null) {
      setSessionResponseLength(db, sessId, user.id, scene.response_length);
    }

    return c.redirect(`/conversation/${sessId}`);
  });

  // --- Memórias dashboard (CV1.E11.S3) — second surface in the
  // cena-pivot chrome family. Aggregates Cenas, Travessias, Orgs,
  // Library + Histórico full-width.

  // Backward-compat: /memoria → /memorias (URL renamed).
  web.get("/memoria", (c) => c.redirect("/memorias", 301));

  // Backward-compat: /espelho → / (the mirror page lives at root now).
  web.get("/espelho", (c) => c.redirect("/", 301));

  // --- Ímãs management (CV1.E12.S3). The quiet edit surface for the
  // user-pinned phrases that render at the top of /espelho. The data
  // layer still calls them "inscriptions"; the user-facing name is
  // "Ímãs" / "Magnets" — fridge-magnet metaphor. All mutations are
  // POST + redirect — no JS state, no JSON.

  web.get("/espelho/imas", (c) => {
    const user = c.get("user");
    const active = listActiveInscriptions(db, user.id);
    const archived = listArchivedInscriptions(db, user.id);
    return c.html(
      <ImasPage user={user} active={active} archived={archived} />,
    );
  });

  web.post("/espelho/imas", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const text = String(body.text ?? "").trim();
    const authorRaw = String(body.author ?? "").trim();
    if (text.length === 0) {
      return c.redirect("/espelho/imas");
    }
    createInscription(db, user.id, text, authorRaw.length > 0 ? authorRaw : null);
    return c.redirect("/espelho/imas");
  });

  web.post("/espelho/imas/:id/edit", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const existing = getInscriptionById(db, user.id, id);
    if (!existing) return c.notFound();
    const body = await c.req.parseBody();
    const text = String(body.text ?? "").trim();
    const authorRaw = String(body.author ?? "").trim();
    if (text.length === 0) {
      return c.redirect("/espelho/imas");
    }
    updateInscription(
      db,
      user.id,
      id,
      text,
      authorRaw.length > 0 ? authorRaw : null,
    );
    return c.redirect("/espelho/imas");
  });

  web.post("/espelho/imas/:id/pin", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!getInscriptionById(db, user.id, id)) return c.notFound();
    pinInscription(db, user.id, id);
    return c.redirect("/espelho/imas");
  });

  web.post("/espelho/imas/:id/unpin", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!getInscriptionById(db, user.id, id)) return c.notFound();
    unpinInscription(db, user.id, id);
    return c.redirect("/espelho/imas");
  });

  web.post("/espelho/imas/:id/archive", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!getInscriptionById(db, user.id, id)) return c.notFound();
    archiveInscription(db, user.id, id);
    return c.redirect("/espelho/imas");
  });

  web.post("/espelho/imas/:id/unarchive", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!getInscriptionById(db, user.id, id)) return c.notFound();
    unarchiveInscription(db, user.id, id);
    return c.redirect("/espelho/imas");
  });

  // --- Território (CV1.E11.S3 follow-up) — present-active world:
  // cenas, travessias, organizações. Split out of /memorias because
  // those entities are configurable / alive now (the user's territory),
  // not record-of-the-past (memory).

  web.get("/territorio", (c) => {
    const user = c.get("user");
    const scenes = listScenesForUser(db, user.id);
    const journeys = getJourneys(db, user.id);
    const organizations = getOrganizations(db, user.id);
    return c.html(
      <TerritorioPage
        user={user}
        scenes={scenes}
        journeys={journeys}
        organizations={organizations}
      />,
    );
  });

  // --- Memórias — what was lived. After the Território split, this
  // page holds Library (when ships) + Histórico (the conversations).

  web.get("/memorias", (c) => {
    const user = c.get("user");
    const recentRows = listRecentSessionsForUser(db, user.id, 20);
    const recents: RecentSessionWithScene[] = recentRows.map((r) => {
      const sess = getSessionById(db, r.id, user.id);
      let sceneTitle: string | null = null;
      if (sess?.scene_id) {
        const scene = getSceneById(db, sess.scene_id, user.id);
        sceneTitle = scene?.title ?? null;
      }
      return { ...r, sceneTitle };
    });
    const totalSessions = (
      db
        .prepare("SELECT COUNT(*) as c FROM sessions WHERE user_id = ?")
        .get(user.id) as { c: number }
    ).c;
    return c.html(
      <MemoriaPage
        user={user}
        recents={recents}
        totalSessions={totalSessions}
      />,
    );
  });

  // --- /cenas (CV1.E11.S3 sub-deliverable) — simple list page,
  // destination of the Memória > Cenas card's "ver →" link.

  web.get("/cenas", (c) => {
    const user = c.get("user");
    const scenes = listScenesForUser(db, user.id);
    return c.html(<CenasListPage user={user} scenes={scenes} />);
  });

  // --- Cenas (CV1.E11.S7) — dedicated form pages for cena CRUD.
  // Sidebar chrome during the strangler period; S2 will migrate /cenas/*
  // to the avatar top bar alongside /inicio and /memoria.

  // CV1.E15.S2: only admins see/edit per-scene model overrides. Catalog
  // is loaded for admin requests so the form can render the picker; for
  // non-admins we pass `undefined` and the form hides the field block.
  async function loadCenaModelCatalog(
    user: User,
  ): Promise<CatalogEntry[] | undefined> {
    if (user.role !== "admin") return undefined;
    return getCatalog(db);
  }

  web.get("/cenas/nova", async (c) => {
    const user = c.get("user");
    const modelCatalog = await loadCenaModelCatalog(user);
    return c.html(
      <CenaFormPage
        user={user}
        mode="create"
        data={emptyCenaFormData()}
        inventory={loadCenaInventory(db, user.id)}
        modelCatalog={modelCatalog}
      />,
    );
  });

  web.post("/cenas/nova", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData();
    const t = c.get("t");
    const parsed = parseSceneFormData(form);

    if (!parsed.title) {
      const modelCatalog = await loadCenaModelCatalog(user);
      return c.html(
        <CenaFormPage
          user={user}
          mode="create"
          data={parsed}
          inventory={loadCenaInventory(db, user.id)}
          error={t("scenes.form.error.titleRequired")}
          modelCatalog={modelCatalog}
        />,
        400,
      );
    }

    const baseKey = slugifyKey(parsed.title);
    const key = uniqueSceneKey(db, user.id, baseKey);
    const scene = createScene(db, user.id, key, {
      title: parsed.title,
      temporal_pattern: parsed.temporal_pattern || null,
      briefing: parsed.briefing,
      voice: parsed.voice === "alma" ? "alma" : null,
      response_mode:
        parsed.response_mode === "auto" ? null : parsed.response_mode,
      response_length:
        parsed.response_length === "auto" ? null : parsed.response_length,
      organization_key: parsed.organization_key || null,
      journey_key: parsed.journey_key || null,
      // CV1.E15.S2: model override only persists for admin requests.
      // Non-admin posts (which shouldn't have these fields anyway) are
      // ignored — defense in depth.
      ...(user.role === "admin"
        ? {
            model_provider: parsed.model_provider || null,
            model_id: parsed.model_id || null,
          }
        : {}),
    });

    if (parsed.voice !== "alma" && parsed.personas.length > 0) {
      setScenePersonas(db, scene.id, parsed.personas);
    }

    if (form.get("action") === "save_and_start") {
      const sessId = createFreshSession(db, user.id, scene.id);
      return c.redirect(`/conversation/${sessId}`);
    }
    return c.redirect(`/cenas/${scene.key}/editar?saved=created`);
  });

  // CV1.E13.S3: GET /cenas/:key is now the portrait (read view).
  web.get("/cenas/:key", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const scene = getSceneByKey(db, user.id, key);
    if (!scene) return c.text("Scene not found", 404);

    const portrait = composeScenePortrait(db, user.id, scene);
    void warmScenePortraitCache(db, scene.id);

    return c.html(
      <ScenePortraitPage
        user={user}
        portrait={portrait}
        editPath={editPathFor("cenas", key, user.locale)}
      />,
    );
  });

  // Workshop form — locale-aware slug. /editar (pt-BR canonical) +
  // /edit (en canonical), same handler.
  web.get("/cenas/:key/:action{editar|edit}", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const scene = getSceneByKey(db, user.id, key);
    if (!scene) return c.text("Scene not found", 404);
    const personas = getScenePersonas(db, scene.id);
    const saved = c.req.query("saved");
    const modelCatalog = await loadCenaModelCatalog(user);
    return c.html(
      <CenaFormPage
        user={user}
        mode="edit"
        cenaKey={scene.key}
        cenaStatus={scene.status}
        data={cenaToFormData(scene, personas)}
        inventory={loadCenaInventory(db, user.id)}
        saved={saved === "created" || saved === "updated" ? saved : undefined}
        modelCatalog={modelCatalog}
      />,
    );
  });

  web.post("/cenas/:key/editar", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const existing = getSceneByKey(db, user.id, key);
    if (!existing) return c.text("Scene not found", 404);

    const form = await c.req.formData();
    const t = c.get("t");
    const parsed = parseSceneFormData(form);

    if (!parsed.title) {
      const modelCatalog = await loadCenaModelCatalog(user);
      return c.html(
        <CenaFormPage
          user={user}
          mode="edit"
          cenaKey={existing.key}
          cenaStatus={existing.status}
          data={parsed}
          inventory={loadCenaInventory(db, user.id)}
          error={t("scenes.form.error.titleRequired")}
          modelCatalog={modelCatalog}
        />,
        400,
      );
    }

    updateScene(db, user.id, key, {
      title: parsed.title,
      temporal_pattern: parsed.temporal_pattern || null,
      briefing: parsed.briefing,
      voice: parsed.voice === "alma" ? "alma" : null,
      response_mode:
        parsed.response_mode === "auto" ? null : parsed.response_mode,
      response_length:
        parsed.response_length === "auto" ? null : parsed.response_length,
      organization_key: parsed.organization_key || null,
      journey_key: parsed.journey_key || null,
      // CV1.E15.S2: only admins can change the per-scene model. Non-
      // admin posts skip the fields so existing values stay intact
      // (omitted UpdateSceneFields keys are no-ops).
      ...(user.role === "admin"
        ? {
            model_provider: parsed.model_provider || null,
            model_id: parsed.model_id || null,
          }
        : {}),
    });

    // Cast — only update when voice=persona; voice=alma already wiped
    // the junction inside updateScene. Setting empty list explicitly is
    // legitimate (user removed all personas).
    if (parsed.voice !== "alma") {
      setScenePersonas(db, existing.id, parsed.personas);
    }

    if (form.get("action") === "save_and_start") {
      const sessId = createFreshSession(db, user.id, existing.id);
      return c.redirect(`/conversation/${sessId}`);
    }
    return c.redirect(`/cenas/${key}/editar?saved=updated`);
  });

  web.post("/cenas/:key/archive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = archiveScene(db, user.id, key);
    if (!ok) return c.text("Scene not found", 404);
    return c.redirect(`/cenas/${key}/editar`);
  });

  web.post("/cenas/:key/unarchive", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = unarchiveScene(db, user.id, key);
    if (!ok) return c.text("Scene not found", 404);
    return c.redirect(`/cenas/${key}/editar`);
  });

  web.post("/cenas/:key/delete", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = deleteScene(db, user.id, key);
    if (!ok) return c.text("Scene not found", 404);
    return c.redirect("/inicio");
  });

  // --- Cenas: stub-first inline sub-creation (CV1.E11.S7 P4).
  // JSON endpoints called via fetch from cenas-form.js. Successful
  // creates return {key, name} which the client uses to inject a
  // chip into the form without page reload. Errors return {error}
  // with appropriate status. Stubs commit immediately — they are
  // not transactional with the cena form per the locked design
  // (creation has cognitive cost; undoing surprises).

  web.post("/cenas/sub/persona", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      name?: string;
      key?: string;
      description?: string;
    }>();
    const name = (body.name ?? "").trim();
    const key = (body.key ?? "").trim();
    const description = (body.description ?? "").trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    if (!key) return c.json({ error: "key is required" }, 400);
    if (!/^[a-z0-9-]+$/.test(key)) {
      return c.json(
        { error: "key must be lowercase letters, numbers, hyphens" },
        400,
      );
    }
    const existing = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === key,
    );
    if (existing) return c.json({ error: "key already exists" }, 409);
    createDraftPersona(db, user.id, key, name, description);
    return c.json({ key, name });
  });

  web.post("/cenas/sub/organization", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      name?: string;
      key?: string;
      description?: string;
    }>();
    const name = (body.name ?? "").trim();
    const key = (body.key ?? "").trim();
    const description = (body.description ?? "").trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    if (!key) return c.json({ error: "key is required" }, 400);
    if (!/^[a-z0-9-]+$/.test(key)) {
      return c.json(
        { error: "key must be lowercase letters, numbers, hyphens" },
        400,
      );
    }
    if (getOrganizationByKey(db, user.id, key)) {
      return c.json({ error: "key already exists" }, 409);
    }
    createOrganization(db, user.id, key, name, description, "", true);
    return c.json({ key, name });
  });

  web.post("/cenas/sub/journey", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      name?: string;
      key?: string;
      description?: string;
    }>();
    const name = (body.name ?? "").trim();
    const key = (body.key ?? "").trim();
    const description = (body.description ?? "").trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    if (!key) return c.json({ error: "key is required" }, 400);
    if (!/^[a-z0-9-]+$/.test(key)) {
      return c.json(
        { error: "key must be lowercase letters, numbers, hyphens" },
        400,
      );
    }
    if (getJourneyByKey(db, user.id, key)) {
      return c.json({ error: "key already exists" }, 409);
    }
    createJourney(db, user.id, key, name, description, "", null, true);
    return c.json({ key, name });
  });

  // --- In-app docs reader (CV0.E3.S3), admin-only ---

  // Static assets referenced by markdown (images, diagrams).
  web.use("/docs/static/*", adminOnlyMiddleware());
  web.use(
    "/docs/static/*",
    serveStatic({
      root: "./docs",
      rewriteRequestPath: (p) => p.replace(/^\/docs\/static/, ""),
    }),
  );

  function docsTitleFromHtml(html: string, fallback: string): string {
    const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (match) return match[1].replace(/<[^>]*>/g, "").trim();
    return fallback;
  }

  async function handleDocsRequest(c: any, urlPath: string) {
    const filePath = resolveDocPath(urlPath);
    if (!filePath) return c.text("Doc not found", 404);
    const { readFileSync } = await import("node:fs");
    const md = readFileSync(filePath, "utf-8");
    // Relative links resolve against the doc's own directory — computed
    // from the resolved file so /docs/project/roadmap (folder index) uses
    // /docs/project/roadmap/ as the base, not /docs/project/.
    const dir = urlDirForResolvedFile(filePath);
    const html = renderMarkdown(md, dir);
    const nav = buildNavTree();
    const title = docsTitleFromHtml(html, "Docs");
    const user = c.get("user");
    return c.html(
      <DocsPage
        currentUser={user}
        currentUrl={urlPath === "/docs" ? "/docs" : urlPath}
        html={html}
        title={title}
        nav={nav}
      />,
    );
  }

  web.get("/docs", adminOnlyMiddleware(), (c) =>
    handleDocsRequest(c, "/docs"),
  );
  web.get("/docs/*", adminOnlyMiddleware(), (c) =>
    handleDocsRequest(c, c.req.path),
  );

  // --- Admin routes ---

  const admin = new Hono<{ Variables: { user: User } }>();
  admin.use("*", adminOnlyMiddleware());

  // Admin landing dashboard (CV0.E3.S4, extended by CV0.E4.S2 with
  // shortcut cards — Budget / OAuth / Docs — when the sidebar admin
  // sub-menu was consolidated into a single Admin Workspace link).
  admin.get("/", async (c) => {
    const user = c.get("user");
    const keyInfo = await getKeyInfo();
    const burnFrom = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const burn = computeBurnRate(
      db,
      burnFrom,
      Date.now() + 1,
      keyInfo?.limit_remaining ?? null,
    );
    const oauthProviders = getOAuthProviders();
    const configuredOAuth = listOAuthCredentials(db);
    return c.html(
      <AdminDashboardPage
        currentUser={user}
        userStats={getUserStats(db)}
        activityStats={getActivityStats(db)}
        memoryStats={getMemoryStats(db)}
        budget={{
          creditRemainingUsd: keyInfo?.limit_remaining ?? null,
          daysOfCreditLeft: burn.days_of_credit_left,
          usdToBrlRate: getUsdToBrlRate(db),
          preferBrl: user.show_brl_conversion === 1,
        }}
        oauth={{
          configured: configuredOAuth.length,
          total: oauthProviders.length,
        }}
        systemStats={getSystemStats()}
        latestRelease={getLatestRelease()}
        models={Object.values(getModels(db))}
      />,
    );
  });

  const listAllUsers = () =>
    db
      .prepare("SELECT id, name, role, created_at FROM users ORDER BY name")
      .all() as {
      id: string;
      name: string;
      role: UserRole;
      created_at: number;
    }[];

  admin.get("/users", async (c) => {
    const user = c.get("user");
    return c.html(
      <UsersPage
        user={user}
        users={listAllUsers()}
      />,
    );
  });

  admin.post("/users", async (c) => {
    const { randomBytes } = await import("node:crypto");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const body = await c.req.parseBody();
    const name = body.name as string;
    const isAdmin = body.is_admin === "1";

    if (!name) {
      return c.html(
        <UsersPage
          user={c.get("user")}
          users={listAllUsers()}
          error="Name is required"
        />,
      );
    }

    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const newUser = createUser(db, name, hash, isAdmin ? "admin" : "user");

    // ego/behavior and ego/expression are seeded from templates — they
    // form the operational baseline (conduct, format, constraints) that
    // keeps the mirror usable on turn one. Self/soul and ego/identity are
    // left empty on purpose, so the Cognitive Map's invitations teach the
    // new user what each layer is and invite them to declare it themselves
    // rather than inheriting a generic voice.
    const behaviorTemplate = readFileSync(
      join(import.meta.dirname, "../../server/templates/behavior.md"),
      "utf-8",
    );
    setIdentityLayer(db, newUser.id, "ego", "behavior", behaviorTemplate);
    const expressionTemplate = readFileSync(
      join(import.meta.dirname, "../../server/templates/expression.md"),
      "utf-8",
    );
    setIdentityLayer(db, newUser.id, "ego", "expression", expressionTemplate);
    getOrCreateSession(db, newUser.id);

    return c.html(
      <UsersPage
        user={c.get("user")}
        users={listAllUsers()}
        createdUser={name}
        createdToken={token}
      />,
    );
  });

  // Legacy routes — all redirect to the Cognitive Map. The per-user editing
  // surface moved from /admin/users/:name to /map/:name when S8 landed.
  admin.get("/users/:name", (c) => {
    const name = c.req.param("name");
    if (!getUserByName(db, name)) return c.text("User not found", 404);
    return c.redirect(`/map/${name}`);
  });
  admin.get("/identity/:name", (c) => c.redirect(`/map/${c.req.param("name")}`));
  admin.get("/personas/:name", (c) => c.redirect(`/map/${c.req.param("name")}`));

  // User management actions (S5) — delete + role toggle.
  admin.post("/users/:name/delete", (c) => {
    const currentUser = c.get("user");
    const target = getUserByName(db, c.req.param("name"));
    if (!target) return c.text("User not found", 404);
    if (target.id === currentUser.id) {
      return c.text("You cannot delete yourself", 403);
    }
    deleteUser(db, target.id);
    return c.redirect("/admin/users");
  });

  admin.post("/users/:name/role", async (c) => {
    const currentUser = c.get("user");
    const target = getUserByName(db, c.req.param("name"));
    if (!target) return c.text("User not found", 404);
    if (target.id === currentUser.id) {
      return c.text("You cannot change your own role", 403);
    }
    const body = await c.req.parseBody();
    const role = body.role === "admin" ? "admin" : "user";
    updateUserRole(db, target.id, role);
    return c.redirect("/admin/users");
  });

  // Model configuration (S1) — admin tunes per-role LLM settings live.
  function parseOptionalNumber(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function buildOAuthProviderOptions(): OAuthProviderOption[] {
    const stored = new Set(
      listOAuthCredentials(db).map((r) => r.provider),
    );
    return getOAuthProviders().map((p) => ({
      id: p.id,
      name: p.name,
      configured: stored.has(p.id),
    }));
  }

  function authTypeForProvider(provider: string): "env" | "oauth" {
    return getOAuthProviders().some((p) => p.id === provider)
      ? "oauth"
      : "env";
  }

  admin.get("/models", async (c) => {
    const rows = Object.values(getModels(db));
    const user = c.get("user");
    const catalog = await getCatalog(db);
    return c.html(
      <ModelsPage
        user={user}
        models={rows}
        oauthProviders={buildOAuthProviderOptions()}
        catalog={catalog}
      />,
    );
  });

  // CV1.E15.S1: catalog endpoint for the model picker. Admin-only;
  // returns the merged OpenRouter + curated list. `?provider=` filters
  // to a single provider; `?refresh=1` bypasses the in-memory cache
  // (useful when OpenRouter ships a new model and the admin wants it
  // visible without restart).
  admin.get("/models/catalog", async (c) => {
    const provider = c.req.query("provider")?.trim() || undefined;
    const force = c.req.query("refresh") === "1";
    const catalog = await getCatalog(db, { provider, force });
    return c.json({ catalog });
  });

  admin.post("/models/:role", async (c) => {
    const role = c.req.param("role");
    const current = getModels(db)[role];
    if (!current) return c.text("Model role not found", 404);
    const body = await c.req.parseBody();
    const provider = String(body.provider ?? "").trim();
    const model = String(body.model ?? "").trim();
    if (!provider || !model) {
      return c.text("Provider and model ID are required", 400);
    }
    updateModel(db, role, {
      provider,
      model,
      timeout_ms: parseOptionalNumber(body.timeout_ms),
      price_brl_per_1m_input: parseOptionalNumber(body.price_brl_per_1m_input),
      price_brl_per_1m_output: parseOptionalNumber(body.price_brl_per_1m_output),
      purpose: String(body.purpose ?? ""),
      auth_type: authTypeForProvider(provider),
    });
    return c.redirect("/admin/models");
  });

  admin.post("/models/:role/reset", (c) => {
    const role = c.req.param("role");
    if (!getModels(db)[role]) return c.text("Model role not found", 404);
    resetModelToDefault(db, role);
    return c.redirect("/admin/models");
  });

  // Fetch pricing for a model from the OpenRouter catalog. Returns the
  // input + output prices already converted to BRL per 1M tokens (the
  // unit the admin form stores). Client-side JS calls this on the
  // "Buscar preços" button click and populates the form fields.
  admin.get("/models/openrouter-pricing", async (c) => {
    const modelId = (c.req.query("model") || "").trim();
    if (!modelId) {
      return c.json({ error: "missing_model" }, 400);
    }
    const pricing = await getModelPricing(modelId);
    if (!pricing) {
      return c.json({ error: "not_found_or_unavailable" }, 404);
    }
    const rate = getUsdToBrlRate(db);
    const input_brl_per_1m = pricing.usd_per_token_prompt * 1_000_000 * rate;
    const output_brl_per_1m = pricing.usd_per_token_completion * 1_000_000 * rate;
    return c.json({
      model: pricing.model,
      input_brl_per_1m,
      output_brl_per_1m,
      input_usd_per_1m: pricing.usd_per_token_prompt * 1_000_000,
      output_usd_per_1m: pricing.usd_per_token_completion * 1_000_000,
      usd_to_brl_rate: rate,
      fetched_at: pricing.fetched_at,
    });
  });

  // OAuth credentials (S8) — admin uploads pi-ai's auth.json per provider.
  // Credentials live in oauth_credentials; resolveApiKey reads them at call
  // time, refreshes access tokens on demand, and writes back the new state.
  function buildOAuthProviderEntries(): OAuthProviderEntry[] {
    const stored = new Map(
      listOAuthCredentials(db).map((r) => [r.provider, r]),
    );
    // getOAuthProviders() returns pi-ai's built-in OAuth-capable providers.
    // The registry order is stable across pi-ai releases.
    return getOAuthProviders().map((p) => {
      const row = stored.get(p.id);
      if (!row) {
        return { id: p.id, name: p.name, configured: false };
      }
      const creds = row.credentials as any;
      const extraFields = Object.keys(creds).filter(
        (k) => !["refresh", "access", "expires"].includes(k),
      );
      return {
        id: p.id,
        name: p.name,
        configured: true,
        expiresAt: typeof creds.expires === "number" ? creds.expires : undefined,
        updatedAt: row.updated_at,
        extraFields,
      };
    });
  }

  admin.get("/oauth", (c) => {
    const saved = c.req.query("saved");
    const deleted = c.req.query("deleted");
    const user = c.get("user");
    return c.html(
      <OAuthPage
        user={user}
        providers={buildOAuthProviderEntries()}
        saved={saved ?? undefined}
        deleted={deleted ?? undefined}
      />,
    );
  });

  admin.post("/oauth/:provider", async (c) => {
    const provider = c.req.param("provider");
    const known = getOAuthProviders().some((p) => p.id === provider);
    if (!known) return c.text("Unknown OAuth provider", 404);
    const user = c.get("user");
    const body = await c.req.parseBody();
    const raw = String(body.credentials ?? "").trim();
    if (!raw) {
      return c.html(
        <OAuthPage
          user={user}
          providers={buildOAuthProviderEntries()}
          error="Paste the full credentials JSON before saving."
        />,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return c.html(
        <OAuthPage
          user={user}
          providers={buildOAuthProviderEntries()}
          error={`Invalid JSON: ${(err as Error).message}`}
        />,
      );
    }
    // pi-ai's `login` CLI writes a full credential store keyed by provider
    // id — e.g. {"google-gemini-cli": {refresh, access, expires, ...}} — and
    // the admin typically pastes the whole file. Unwrap the matching key if
    // present; otherwise treat the object as the inner credential blob.
    const unwrapped =
      parsed &&
      typeof parsed === "object" &&
      provider in (parsed as Record<string, unknown>) &&
      typeof (parsed as any)[provider] === "object" &&
      (parsed as any)[provider] !== null
        ? (parsed as any)[provider]
        : parsed;
    if (
      !unwrapped ||
      typeof unwrapped !== "object" ||
      typeof (unwrapped as any).refresh !== "string" ||
      typeof (unwrapped as any).access !== "string" ||
      typeof (unwrapped as any).expires !== "number"
    ) {
      return c.html(
        <OAuthPage
          user={user}
          providers={buildOAuthProviderEntries()}
          error="JSON must include string 'refresh', string 'access', and numeric 'expires' fields. You can paste the full pi-ai auth.json (the envelope with the provider key) or just the inner credentials object."
        />,
      );
    }
    setOAuthCredentials(db, provider, unwrapped as OAuthCredentials);
    return c.redirect(`/admin/oauth?saved=${encodeURIComponent(provider)}`);
  });

  admin.post("/oauth/:provider/delete", (c) => {
    const provider = c.req.param("provider");
    const known = getOAuthProviders().some((p) => p.id === provider);
    if (!known) return c.text("Unknown OAuth provider", 404);
    deleteOAuthCredentials(db, provider);
    return c.redirect(`/admin/oauth?deleted=${encodeURIComponent(provider)}`);
  });

  // Budget — /admin/budget (CV0.E3.S6). Pay-per-token framed as subscription:
  // OpenRouter credit + usage_log breakdowns + per-admin BRL toggle + global
  // USD→BRL rate editor.
  function monthWindow(): { from: number; to: number } {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).getTime();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ).getTime();
    return { from, to: next };
  }


  admin.get("/budget", async (c) => {
    const user = c.get("user");
    const keyInfoRaw = await getKeyInfo();
    const { from, to } = monthWindow();
    const monthTotal = getUsageTotals(db, from, to);
    const byRole = getUsageByRole(db, from, to);
    const byEnv = getUsageByEnv(db, from, to);
    const byModel = getUsageByModel(db, from, to);
    // Burn rate uses the trailing 7 days (ignore month boundary).
    const burnFrom = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const burnRate = computeBurnRate(
      db,
      burnFrom,
      Date.now() + 1,
      keyInfoRaw?.limit_remaining ?? null,
    );
    const usdToBrlRate = getUsdToBrlRate(db);
    // `saved` carries a key-id (e.g. "rate"); resolve via t().
    const savedId = c.req.query("saved");
    const saved = savedId
      ? c.get("t")(`admin.budget.saved.${savedId}`)
      : undefined;
    return c.html(
      <BudgetPage
        user={user}
        keyInfo={keyInfoRaw ?? undefined}
        monthTotal={monthTotal}
        byRole={byRole}
        byEnv={byEnv}
        byModel={byModel}
        burnRate={burnRate}
        usdToBrlRate={usdToBrlRate}
        saved={saved}
      />,
    );
  });

  admin.post("/budget/rate", async (c) => {
    const body = await c.req.parseBody();
    const raw = String(body.rate ?? "").trim();
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      return c.text(c.get("t")("admin.budget.invalidRate"), 400);
    }
    setUsdToBrlRate(db, rate);
    return c.redirect("/admin/budget?saved=rate");
  });

  // Budget alert JSON endpoint — polled client-side by layout.js for admins
  // to decide whether to render the low-balance banner. Threshold: 20% of
  // the spending cap. Returns { alert: null } when no cap is set or balance
  // is above threshold.
  admin.get("/budget-alert.json", async (c) => {
    const info = await getKeyInfo();
    if (!info || info.limit === null || info.limit_remaining === null) {
      return c.json({ alert: null });
    }
    const pct = (info.limit_remaining / info.limit) * 100;
    if (pct >= 20) {
      return c.json({ alert: null });
    }
    const rate = getUsdToBrlRate(db);
    const user = c.get("user");
    const showBrl = user.show_brl_conversion === 1;
    return c.json({
      alert: {
        pct,
        remaining_usd: info.limit_remaining,
        remaining_brl: showBrl ? info.limit_remaining * rate : null,
        show_brl: showBrl,
      },
    });
  });

  // --- CV1.E8.S1: LLM call logs admin routes ---

  admin.get("/llm-logs", (c) => {
    const user = c.get("user");
    const roleParam = c.req.query("role") || null;
    const role: LlmRole | null = ROLE_VALUES.includes(roleParam as LlmRole)
      ? (roleParam as LlmRole)
      : null;
    const sessionId = c.req.query("session_id") || null;
    const model = c.req.query("model") || null;
    const search = c.req.query("search") || null;
    const offsetRaw = parseInt(c.req.query("offset") || "0", 10);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const limit = 50;

    const filterArgs = {
      role: role ?? undefined,
      session_id: sessionId ?? undefined,
      model: model ?? undefined,
      search: search ?? undefined,
    };
    const rows = listLlmCalls(db, { ...filterArgs, limit, offset });
    const total = countLlmCalls(db, filterArgs);
    const enabled = getLlmLoggingEnabled(db);
    const models = listLlmCallModels(db);
    return c.html(
      <LlmLogsListPage
        user={user}
        rows={rows}
        total={total}
        limit={limit}
        offset={offset}
        enabled={enabled}
        filters={{
          role,
          session_id: sessionId,
          model,
          search,
        }}
        models={models}
        saved={c.req.query("saved") || null}
        error={c.req.query("error") || null}
      />,
    );
  });

  admin.get("/llm-logs/export", (c) => {
    const roleParam = c.req.query("role") || null;
    const role: LlmRole | null = ROLE_VALUES.includes(roleParam as LlmRole)
      ? (roleParam as LlmRole)
      : null;
    const sessionId = c.req.query("session_id") || null;
    const model = c.req.query("model") || null;
    const search = c.req.query("search") || null;
    const format = c.req.query("format") === "csv" ? "csv" : "json";

    const filterArgs = {
      role: role ?? undefined,
      session_id: sessionId ?? undefined,
      model: model ?? undefined,
      search: search ?? undefined,
    };
    // Cap export at 10k rows to keep memory bounded. Heavy users
    // export in chunks via offset; UI shows the cap in copy if hit.
    const rows = listLlmCalls(db, { ...filterArgs, limit: 10000, offset: 0 });

    if (format === "json") {
      return new Response(JSON.stringify(rows, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="llm-calls-${Date.now()}.json"`,
        },
      });
    }

    // CSV with RFC 4180 escaping: every cell wrapped in double quotes,
    // double quotes inside cells doubled. Newlines preserved inside
    // quoted cells. Header row first.
    const cols = [
      "id",
      "role",
      "provider",
      "model",
      "system_prompt",
      "user_message",
      "response",
      "tokens_in",
      "tokens_out",
      "cost_usd",
      "latency_ms",
      "session_id",
      "entry_id",
      "user_id",
      "env",
      "error",
      "created_at",
    ] as const;
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '""';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines: string[] = [];
    lines.push(cols.map((c) => escape(c)).join(","));
    for (const row of rows) {
      lines.push(cols.map((col) => escape((row as any)[col])).join(","));
    }
    const csv = lines.join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="llm-calls-${Date.now()}.csv"`,
      },
    });
  });

  admin.get("/llm-logs/:id", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const row = getLlmCall(db, id);
    if (!row) return c.text("Call not found", 404);
    return c.html(
      <LlmLogsDetailPage
        user={user}
        row={row}
      />,
    );
  });

  admin.post("/llm-logs/toggle", (c) => {
    const current = getLlmLoggingEnabled(db);
    setLlmLoggingEnabled(db, !current);
    return c.redirect("/admin/llm-logs?saved=toggled");
  });

  admin.post("/llm-logs/clear", (c) => {
    const removed = deleteAllLlmCalls(db);
    return c.redirect(`/admin/llm-logs?saved=cleared-${removed}`);
  });

  admin.post("/llm-logs/clear-older", async (c) => {
    const form = await c.req.formData();
    const daysRaw = form.get("days");
    const days = parseInt((daysRaw as string | null) ?? "0", 10);
    if (!Number.isFinite(days) || days < 0) {
      return c.redirect("/admin/llm-logs?error=invalid-days");
    }
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const removed = deleteLlmCallsOlderThan(db, cutoff);
    return c.redirect(`/admin/llm-logs?saved=purged-${removed}`);
  });

  web.route("/admin", admin);

  app.route("/", web);

  console.log("Web adapter enabled");
}
