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
  deleteIdentityLayer,
  getIdentityLayers,
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
  forgetSession,
  getModels,
  updateModel,
  resetModelToDefault,
  createOrganization,
  updateOrganization,
  archiveOrganization,
  unarchiveOrganization,
  deleteOrganization,
  getOrganizations,
  getOrganizationByKey,
  createJourney,
  updateJourney,
  linkJourneyOrganization,
  archiveJourney,
  unarchiveJourney,
  deleteJourney,
  getJourneys,
  getJourneyByKey,
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
} from "../../server/summary.js";
import { composeSystemPrompt } from "../../server/identity.js";
import { receive } from "../../server/reception.js";
import { resolveApiKey, headeredStreamFn } from "../../server/model-auth.js";
import { logUsage, currentEnv } from "../../server/usage.js";
import { getKeyInfo } from "../../server/openrouter-billing.js";
import { computeSessionStats } from "../../server/session-stats.js";
import { composedSnapshot } from "../../server/composed-snapshot.js";
import { extractPersonaDescriptor } from "../../server/personas.js";
import {
  type RailState,
  avatarInitials,
  avatarColor,
} from "./pages/context-rail.js";
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
import { DocsPage } from "./pages/docs.js";
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
  return {
    sessionStats,
    composed,
    personaDescriptor: descriptor,
    personaInitials: avatarInitials(persona),
    personaColor: avatarColor(persona),
    userName: user.name,
    showCost: user.role === "admin",
    showBrl: user.show_brl_conversion === 1,
    usdToBrlRate: getUsdToBrlRate(db),
  };
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
      />,
    );
  });

  // --- Cognitive Map ---

  // --- Map helpers (shared between self-modality and admin-modality) ---

  const ALLOWED_WORKSHOP_LAYERS: Record<string, Set<string>> = {
    self: new Set(["soul"]),
    ego: new Set(["identity", "expression", "behavior"]),
  };

  function isAllowedWorkshop(layer: string, key: string): boolean {
    return ALLOWED_WORKSHOP_LAYERS[layer]?.has(key) ?? false;
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
    generateLayerSummary(db, targetUser.id, "persona", key).catch(() => {});
    return c.redirect(mapRootFor(currentUser, targetUser));
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
    if (!isAllowedWorkshop(layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const layers = getIdentityLayers(db, targetUser.id);
    const current = layers.find((l) => l.layer === layer && l.key === key);
    const content = current?.content ?? "";
    const summary = current?.summary ?? null;
    const personas = layers.filter((l) => l.layer === "persona");
    const organizations = getOrganizations(db, targetUser.id);
    const journeys = getJourneys(db, targetUser.id);
    return c.html(
      <LayerWorkshopPage
        currentUser={currentUser}
        targetUser={targetUser}
        layer={layer}
        layerKey={key}
        content={content}
        summary={summary}
        personas={personas}
        organizations={organizations}
        journeys={journeys}
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
    if (!isAllowedWorkshop(layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    setIdentityLayer(db, targetUser.id, layer, key, content);
    generateLayerSummary(db, targetUser.id, layer, key).catch(() => {});
    return c.redirect(mapRootFor(currentUser, targetUser));
  }

  async function handleRegenerateSummary(
    c: any,
    currentUser: User,
    targetUser: User,
    layer: string,
    key: string,
  ) {
    if (!isAllowedWorkshop(layer, key)) {
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
    const labMode = c.req.query("lab") === "1";
    return c.html(
      <MirrorPage user={user} messages={messages} rail={rail} labMode={labMode} />,
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

  web.get("/conversation/stream", async (c) => {
    const user = c.get("user");
    const text = c.req.query("text");
    if (!text) return c.json({ error: "Missing text" }, 400);

    const bypassPersona = c.req.query("bypass_persona") === "true";

    const sessionId = getOrCreateSession(db, user.id);
    const reception = bypassPersona
      ? { persona: null, organization: null, journey: null }
      : await receive(db, user.id, text);
    const history = loadMessages(db, sessionId);
    const systemPrompt = composeSystemPrompt(
      db,
      user.id,
      reception.persona,
      "web",
      { organization: reception.organization, journey: reception.journey },
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
      let reply = "";

      await stream.writeSSE({
        data: JSON.stringify({
          type: "routing",
          persona: reception.persona,
          organization: reception.organization,
          journey: reception.journey,
        }),
      });

      agent.subscribe((event) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          const delta = event.assistantMessageEvent.delta;
          reply += delta;
          stream.writeSSE({ data: JSON.stringify({ type: "delta", text: delta }) });
        }
      });

      await agent.prompt(text);

      if (!reply) {
        const lastMsg = agent.state.messages.findLast(
          (m) => m.role === "assistant",
        );
        if (lastMsg && "content" in lastMsg) {
          for (const block of lastMsg.content) {
            if ("text" in block) reply += block.text;
          }
        }
      }

      const userMsg = agent.state.messages.findLast((m) => m.role === "user");
      const assistantMsg = agent.state.messages.findLast(
        (m) => m.role === "assistant",
      );

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
      const meta: Record<string, string> = {};
      if (reception.persona) meta._persona = reception.persona;
      if (reception.organization) meta._organization = reception.organization;
      if (reception.journey) meta._journey = reception.journey;
      const assistantWithMeta =
        Object.keys(meta).length > 0 ? { ...assistantMsg, ...meta } : assistantMsg;
      appendEntry(db, sessionId, userEntryId, "message", assistantWithMeta);

      const rail = buildRailState(
        db,
        user,
        sessionId,
        reception.persona,
        reception.organization,
        reception.journey,
      );
      await stream.writeSSE({
        data: JSON.stringify({ type: "done", reply, rail }),
      });
    });
  });

  // --- Organizations surface (CV1.E4.S1) ---

  web.get("/organizations", (c) => {
    const user = c.get("user");
    const showArchived = c.req.query("archived") === "1";
    const all = getOrganizations(db, user.id, { includeArchived: true });
    const archivedCount = all.filter((o) => o.status === "archived").length;
    const organizations = showArchived ? all : all.filter((o) => o.status === "active");
    return c.html(
      <OrganizationsListPage
        user={user}
        organizations={organizations}
        archivedCount={archivedCount}
        showArchived={showArchived}
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
    return c.html(<OrganizationWorkshopPage user={user} organization={org} />);
  });

  web.post("/organizations/:key", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
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
    // Fire-and-forget: summary regenerates in the background.
    void generateScopeSummary(db, user.id, "organization", key);
    return c.redirect(`/organizations/${key}`);
  });

  web.post("/organizations/:key/regenerate-summary", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const org = getOrganizationByKey(db, user.id, key);
    if (!org) return c.text("Organization not found", 404);
    // Awaited so the redirect lands a fresh summary.
    await generateScopeSummary(db, user.id, "organization", key);
    return c.redirect(`/organizations/${key}`);
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

  web.post("/organizations/:key/delete", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = deleteOrganization(db, user.id, key);
    if (!ok) return c.text("Organization not found", 404);
    return c.redirect("/organizations");
  });

  // --- Journeys surface (CV1.E4.S1) ---

  web.get("/journeys", (c) => {
    const user = c.get("user");
    const showArchived = c.req.query("archived") === "1";
    const allJourneys = getJourneys(db, user.id, { includeArchived: true });
    const organizations = getOrganizations(db, user.id, { includeArchived: true });
    const archivedCount = allJourneys.filter((j) => j.status === "archived").length;
    const visible = showArchived
      ? allJourneys
      : allJourneys.filter((j) => j.status === "active");

    // Group by organization. Personal (null org) first.
    const orgById = new Map(organizations.map((o) => [o.id, o]));
    const personal = visible.filter((j) => j.organization_id === null);
    const byOrg = new Map<string, typeof visible>();
    for (const j of visible) {
      if (j.organization_id !== null) {
        const list = byOrg.get(j.organization_id) ?? [];
        list.push(j);
        byOrg.set(j.organization_id, list);
      }
    }

    const groups: { organization: typeof organizations[number] | null; journeys: typeof visible }[] = [];
    if (personal.length > 0) {
      groups.push({ organization: null, journeys: personal });
    }
    // Preserve organization alphabetical order (already sorted by getOrganizations).
    for (const org of organizations) {
      const list = byOrg.get(org.id);
      if (list && list.length > 0) {
        groups.push({ organization: org, journeys: list });
      }
    }

    // Only active orgs show in the create form's selector.
    const activeOrgs = organizations.filter((o) => o.status === "active");

    return c.html(
      <JourneysListPage
        user={user}
        groups={groups}
        organizations={activeOrgs}
        archivedCount={archivedCount}
        showArchived={showArchived}
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
      const orgs = getOrganizations(db, user.id, { includeArchived: true });
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
        ? getOrganizations(db, user.id, { includeArchived: true }).find(
            (o) => o.id === journey.organization_id,
          ) ?? null
        : null;

    return c.html(
      <JourneyWorkshopPage
        user={user}
        journey={journey}
        organizations={organizations}
        parentOrganization={parentOrganization}
      />,
    );
  });

  web.post("/journeys/:key", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
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
      const orgs = getOrganizations(db, user.id, { includeArchived: true });
      const org = orgs.find((o) => o.id === orgIdRaw);
      if (org) organizationId = org.id;
    }
    linkJourneyOrganization(db, user.id, key, organizationId);

    void generateScopeSummary(db, user.id, "journey", key);
    return c.redirect(`/journeys/${key}`);
  });

  web.post("/journeys/:key/regenerate-summary", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const journey = getJourneyByKey(db, user.id, key);
    if (!journey) return c.text("Journey not found", 404);
    await generateScopeSummary(db, user.id, "journey", key);
    return c.redirect(`/journeys/${key}`);
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

  web.post("/journeys/:key/delete", (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const ok = deleteJourney(db, user.id, key);
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
    return c.html(
      <DocsPage
        currentUser={c.get("user")}
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
        currentUser={c.get("user")}
        userStats={getUserStats(db)}
        activityStats={getActivityStats(db)}
        memoryStats={getMemoryStats(db)}
        budget={{
          creditRemainingUsd: keyInfo?.limit_remaining ?? null,
          daysOfCreditLeft: burn.days_of_credit_left,
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
    return c.html(<UsersPage user={c.get("user")} users={listAllUsers()} />);
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

  admin.get("/models", (c) => {
    const rows = Object.values(getModels(db));
    return c.html(
      <ModelsPage
        user={c.get("user")}
        models={rows}
        oauthProviders={buildOAuthProviderOptions()}
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
    return c.html(
      <OAuthPage
        user={c.get("user")}
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
    const body = await c.req.parseBody();
    const raw = String(body.credentials ?? "").trim();
    if (!raw) {
      return c.html(
        <OAuthPage
          user={c.get("user")}
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
          user={c.get("user")}
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
          user={c.get("user")}
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
