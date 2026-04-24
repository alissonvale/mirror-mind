import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash } from "node:crypto";
import { deleteCookie } from "hono/cookie";
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
  forgetTurn,
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
} from "../../server/db.js";
import { generateSessionTitle } from "../../server/title.js";
import {
  generateLayerSummary,
  generateScopeSummary,
  type ScopeSummaryResult,
} from "../../server/summary.js";
import { composeSystemPrompt } from "../../server/identity.js";
import { receive } from "../../server/reception.js";
import {
  express,
  isResponseMode,
  type ResponseMode,
} from "../../server/expression.js";
import { resolveApiKey, headeredStreamFn } from "../../server/model-auth.js";
import { logUsage, currentEnv } from "../../server/usage.js";
import { getKeyInfo } from "../../server/openrouter-billing.js";
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
import { LoginPage } from "./pages/login.js";
import { HomePage, type AdminState } from "./pages/home.js";
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
import { PersonasListPage } from "./pages/personas.js";
import { ConversationsListPage } from "./pages/conversations.js";
import { DocsPage } from "./pages/docs.js";
import { loadSidebarScopes } from "./pages/layout.js";
import {
  resolveDocPath,
  renderMarkdown,
  buildNavTree,
  urlDirForResolvedFile,
  DOCS_ROOT,
} from "../../server/docs.js";
import { greetingFor } from "../../server/formatters/greeting.js";
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
  overridePersona?: string | null,
  overrideOrganization?: string | null,
  overrideJourney?: string | null,
): RailState {
  const sessionStats = computeSessionStats(db, sessionId);

  let persona: string | null = overridePersona ?? null;
  let organization: string | null = overrideOrganization ?? null;
  let journey: string | null = overrideJourney ?? null;

  // Derive from the last assistant entry's meta when any axis has no override.
  // Same pattern already used for persona — scopes inherit it so GET /mirror
  // reflects the last turn's composition without needing a new stream event.
  if (
    overridePersona === undefined ||
    overrideOrganization === undefined ||
    overrideJourney === undefined
  ) {
    const messagesWithMeta = loadMessagesWithMeta(db, sessionId);
    for (let i = messagesWithMeta.length - 1; i >= 0; i--) {
      const m = messagesWithMeta[i];
      if (m.data.role !== "assistant") continue;
      if (overridePersona === undefined && typeof m.meta.persona === "string") {
        persona = m.meta.persona as string;
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
      break;
    }
  }

  let descriptor: string | null = null;
  if (persona) {
    const personaLayer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === persona,
    );
    if (personaLayer) {
      descriptor = extractPersonaDescriptor(personaLayer, {
        ellipsis: true,
      });
    }
  }

  const composed = composedSnapshot(db, user.id, persona, organization, journey);

  // CV1.E4.S4: session tag pool + available candidates for the rail UI.
  const sessionTagRow = getSessionTags(db, sessionId);
  const allPersonaLayers = getIdentityLayers(db, user.id).filter(
    (l) => l.layer === "persona",
  );
  const allOrgs = getOrganizations(db, user.id);
  const allJourneys = getJourneys(db, user.id);

  const responseModeOverride = getSessionResponseMode(db, sessionId, user.id);

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
    personaInitials: avatarInitials(persona),
    personaColor: persona ? resolvePersonaColor(
      allPersonaLayers.find((p) => p.key === persona)?.color ?? null,
      persona,
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
    personaColors,
  };
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

  // --- Login (no auth) ---

  app.get("/login", (c) => c.html(<LoginPage />));

  app.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const token = body.token as string;
    if (!token) {
      return c.html(<LoginPage error="Token is required" />);
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const user = getUserByTokenHash(db, hash);
    if (!user) {
      return c.html(<LoginPage error="Invalid token" />);
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

  // Legacy redirects — `/chat` was the original route; `/mirror` was the
  // rename in v0.5.0. Both now redirect to `/conversation` (CV0.E4.S5),
  // the URL that matches the sidebar label.
  web.get("/chat", (c) => c.redirect("/conversation"));
  web.get("/mirror", (c) => c.redirect("/conversation"));

  // --- About You (CV0.E4.S4) — clicking the user's avatar ---

  web.get("/me", (c) => {
    const user = c.get("user");
    const editingName = c.req.query("editName") === "1";
    const saved = c.req.query("saved") ?? undefined;
    return c.html(
      <MePage
        currentUser={user}
        stats={getMeStats(db, user.id)}
        editingName={editingName}
        saved={saved}
        sidebarScopes={loadSidebarScopes(db, user.id)}
      />,
    );
  });

  web.post("/me/name", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const newName = String(body.name ?? "").trim();

    const renderWithError = (msg: string) =>
      c.html(
        <MePage
          currentUser={user}
          stats={getMeStats(db, user.id)}
          sidebarScopes={loadSidebarScopes(db, user.id)}
          editingName
          nameError={msg}
        />,
      );

    if (!newName) return renderWithError("Name cannot be empty.");
    if (/[\/\\]/.test(newName))
      return renderWithError("Name cannot contain slashes.");
    if (newName.length > 40)
      return renderWithError("Name must be 40 characters or fewer.");
    if (newName === user.name) return c.redirect("/me");
    const collision = getUserByName(db, newName);
    if (collision && collision.id !== user.id) {
      return renderWithError(`The name "${newName}" is already taken.`);
    }
    updateUserName(db, user.id, newName);
    return c.redirect("/me?saved=Name+updated");
  });

  web.post("/me/show-brl", async (c) => {
    const user = c.get("user");
    if (user.role !== "admin") return c.text("Admin only", 403);
    const body = await c.req.parseBody();
    const show = String(body.show_brl ?? "").trim() === "1";
    updateShowBrlConversion(db, user.id, show);
    return c.redirect("/me?saved=Preference+updated");
  });

  // --- Home (CV0.E4.S1) ---

  web.get("/", async (c) => {
    const user = c.get("user");
    const latestRelease = getLatestRelease();
    const recentSessions = listRecentSessionsForUser(db, user.id, 4);

    let adminState: AdminState | null = null;
    if (user.role === "admin") {
      const userStats = getUserStats(db);
      const keyInfo = await getKeyInfo();
      const burnFrom = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const burn = computeBurnRate(
        db,
        burnFrom,
        Date.now() + 1,
        keyInfo?.limit_remaining ?? null,
      );
      adminState = {
        usersTotal: userStats.total,
        usersActive7d: userStats.activeLast7d,
        creditRemainingUsd: keyInfo?.limit_remaining ?? null,
        daysOfCreditLeft: burn.days_of_credit_left,
        usdToBrlRate: getUsdToBrlRate(db),
        preferBrl: user.show_brl_conversion === 1,
      };
    }

    return c.html(
      <HomePage
        currentUser={user}
        greeting={greetingFor(user.name)}
        latestRelease={latestRelease}
        recentSessions={recentSessions}
        adminState={adminState}
        sidebarScopes={loadSidebarScopes(db, user.id)}
      />,
    );
  });

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
        sidebarScopes={loadSidebarScopes(db, currentUser.id)}
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
    generateLayerSummary(db, targetUser.id, "persona", key).catch(() => {});
    // Land on the persona workshop read view — consistent with the
    // self/ego workshop save and lets the user verify the change in
    // rendered markdown before moving on.
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
        sidebarScopes={loadSidebarScopes(db, currentUser.id)}
        personaColor={personaColor}
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
    generateLayerSummary(db, targetUser.id, layer, key).catch(() => {});
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
    const prompt = composeSystemPrompt(db, targetUser.id, personaKey, adapter, {
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

  // --- Self-modality routes: /map/... ---

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

  // Persona color picker endpoint — swatch clicks and custom-hex Apply
  // both funnel here. Body carries `color` (the value to write) and
  // optionally `custom` (the text input; preferred when present).
  // Empty string clears the stored color → consumers fall back to the
  // deterministic hash.
  web.post("/map/persona/:key/color", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const body = await c.req.parseBody();
    // Custom hex takes precedence when present (user typed + clicked
    // Apply). Otherwise the posted `color` is the swatch button's
    // value or the empty-string reset.
    const customRaw = String(body.custom ?? "").trim();
    const posted = customRaw.length > 0
      ? customRaw
      : String(body.color ?? "").trim();
    const target = posted.length === 0 ? null : posted;
    setPersonaColor(db, user.id, key, target);
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

  web.get("/conversation", (c) => {
    const user = c.get("user");
    const sessionId = getOrCreateSession(db, user.id);
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    const personaTurnCounts = getPersonaTurnCountsInSession(db, sessionId);
    const labMode = c.req.query("lab") === "1";
    return c.html(
      <MirrorPage
        user={user}
        messages={messages}
        rail={rail}
        personaTurnCounts={personaTurnCounts}
        labMode={labMode}
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
        personaColors={personaColors}
      />,
    );
  });

  // Open a specific session by id (CV1.E4.S5). Read-only-by-default —
  // opening doesn't change which session is "current". Sending a message
  // in the opened session updates its activity timestamp, which makes it
  // current naturally via `getOrCreateSession`.
  web.get("/conversation/:sessionId{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}", (c) => {
    const user = c.get("user");
    const sessionId = c.req.param("sessionId");
    const session = getSessionById(db, sessionId, user.id);
    if (!session) return c.notFound();
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    const personaTurnCounts = getPersonaTurnCountsInSession(db, sessionId);
    const labMode = c.req.query("lab") === "1";
    return c.html(
      <MirrorPage
        user={user}
        messages={messages}
        rail={rail}
        personaTurnCounts={personaTurnCounts}
        labMode={labMode}
        sidebarScopes={loadSidebarScopes(db, user.id)}
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

  web.post("/conversation/forget", (c) => {
    const user = c.get("user");
    const sessionId = getOrCreateSession(db, user.id);
    forgetSession(db, sessionId);
    createFreshSession(db, user.id);
    return c.redirect("/conversation");
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
    if (type === "persona") addSessionPersona(db, sessionId, key);
    else if (type === "organization")
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

  web.get("/conversation/stream", async (c) => {
    const user = c.get("user");
    const text = c.req.query("text");
    if (!text) return c.json({ error: "Missing text" }, 400);

    const bypassPersona = c.req.query("bypass_persona") === "true";

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
          persona: null,
          organization: null,
          journey: null,
          mode: "conversational" as ResponseMode,
        }
      : await receive(db, user.id, text, { sessionTags: sessionTagsBefore });

    // CV1.E7.S1: mode resolution. The session may carry an explicit
    // override written from the rail; when present, it wins over
    // reception's auto-pick. Otherwise, reception's mode stands.
    const modeOverride = getSessionResponseMode(db, sessionId, user.id);
    const resolvedMode: ResponseMode = modeOverride ?? reception.mode;

    // First-turn suggestion: if the session has no tags yet, seed them
    // with whatever reception picked so the next turn already has the
    // constrained pool. User can remove/adjust from the rail.
    const hasAnyTag =
      sessionTagsBefore.personaKeys.length +
        sessionTagsBefore.organizationKeys.length +
        sessionTagsBefore.journeyKeys.length >
      0;
    if (isFirstTurn && !hasAnyTag) {
      if (reception.persona) addSessionPersona(db, sessionId, reception.persona);
      if (reception.organization)
        addSessionOrganization(db, sessionId, reception.organization);
      if (reception.journey)
        addSessionJourney(db, sessionId, reception.journey);
    }

    const history = loadMessages(db, sessionId);
    const sessionTags = getSessionTags(db, sessionId);
    const systemPrompt = composeSystemPrompt(
      db,
      user.id,
      reception.persona,
      "web",
      {
        organization: reception.organization,
        journey: reception.journey,
        sessionTags,
      },
    );
    const main = getModels(db).main;
    const model = getModel(main.provider as any, main.model);

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
      // CV1.E7.S1 pipeline:
      //   1. routing (persona, scopes, mode)
      //   2. status(composing) — main generation, hidden from UI
      //   3. status(finding-voice) — expression pass, result streams
      //   4. delta events fire during expression streaming
      //   5. done — rail + final text
      // Include the persona's resolved color so the client can apply
      // it directly to the streaming bubble + the cast avatar without
      // re-running the hash. Server is the single source of truth
      // (honors the stored color column).
      const personaColorForRouting = reception.persona
        ? resolvePersonaColor(
            getIdentityLayers(db, user.id).find(
              (l) => l.layer === "persona" && l.key === reception.persona,
            )?.color ?? null,
            reception.persona,
          )
        : null;

      await stream.writeSSE({
        data: JSON.stringify({
          type: "routing",
          persona: reception.persona,
          personaColor: personaColorForRouting,
          organization: reception.organization,
          journey: reception.journey,
          mode: resolvedMode,
          modeSource: modeOverride ? "session" : "reception",
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

      await agent.prompt(text);

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

      // Expression pass. Always on; falls back silently on failure to
      // the unchanged draft (result.applied === false).
      await stream.writeSSE({
        data: JSON.stringify({ type: "status", phase: "finding-voice" }),
      });

      const expressed = await express(
        db,
        user.id,
        {
          draft,
          userMessage: text,
          personaKey: reception.persona,
          mode: resolvedMode,
        },
        { sessionId },
      );

      const reply = expressed.text;

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
      const meta: Record<string, string> = {};
      if (reception.persona) meta._persona = reception.persona;
      if (reception.organization) meta._organization = reception.organization;
      if (reception.journey) meta._journey = reception.journey;
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
        reception.persona,
        reception.organization,
        reception.journey,
      );
      await stream.writeSSE({
        data: JSON.stringify({
          type: "done",
          reply,
          rail,
          entries: { userEntryId, assistantEntryId },
        }),
      });
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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

  web.get("/organizations/:key", (c) => {
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
    const updated = updateOrganization(db, user.id, key, {
      name: name || undefined,
      briefing,
      situation,
    });
    if (!updated) return c.text("Organization not found", 404);

    // Regenerate the summary only when the content that feeds it
    // (briefing / situation) changed. Name-only edits skip the LLM call
    // entirely and redirect instantly. Awaited for visible feedback —
    // fire-and-forget was silent-failure hell when the LLM timed out.
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
      />,
    );
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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

  web.get("/journeys/:key", (c) => {
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
    const orgIdRaw = (form.get("organization_id") as string | null)?.trim() ?? "";

    const updated = updateJourney(db, user.id, key, {
      name: name || undefined,
      briefing,
      situation,
    });
    if (!updated) return c.text("Journey not found", 404);

    // Organization link update is a separate call — pass null to unlink.
    let organizationId: string | null = null;
    if (orgIdRaw) {
      const orgs = getOrganizations(db, user.id, { includeArchived: true, includeConcluded: true });
      const org = orgs.find((o) => o.id === orgIdRaw);
      if (org) organizationId = org.id;
    }
    linkJourneyOrganization(db, user.id, key, organizationId);

    // Same rule as organizations: regenerate only when briefing/situation
    // changed. Org-link changes don't affect the summary content.
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
          sidebarScopes={loadSidebarScopes(db, c.get("user").id)}
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
        sidebarScopes={loadSidebarScopes(db, c.get("user").id)}
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

  admin.get("/models", (c) => {
    const rows = Object.values(getModels(db));
    const user = c.get("user");
    return c.html(
      <ModelsPage
        user={user}
        models={rows}
        oauthProviders={buildOAuthProviderOptions()}
        sidebarScopes={loadSidebarScopes(db, user.id)}
      />,
    );
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
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
          sidebarScopes={loadSidebarScopes(db, user.id)}
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
          sidebarScopes={loadSidebarScopes(db, user.id)}
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
          sidebarScopes={loadSidebarScopes(db, user.id)}
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
    const saved = c.req.query("saved") ?? undefined;
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
        sidebarScopes={loadSidebarScopes(db, user.id)}
      />,
    );
  });

  admin.post("/budget/rate", async (c) => {
    const body = await c.req.parseBody();
    const raw = String(body.rate ?? "").trim();
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      return c.text("Invalid rate", 400);
    }
    setUsdToBrlRate(db, rate);
    return c.redirect("/admin/budget?saved=Exchange+rate+updated");
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

  web.route("/admin", admin);

  app.route("/", web);

  console.log("Web adapter enabled");
}
