import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  setIdentitySummary,
  createScene,
  createOrganization,
  createJourney,
  createFreshSession,
  setSessionVoice,
  addSessionJourney,
  addSessionOrganization,
} from "../server/db.js";
import { createHash } from "node:crypto";
import {
  composeSou,
  composeEstou,
  composeVivo,
  composeMirrorState,
  computeShifts,
} from "../server/mirror/synthesis.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function setup() {
  const db = openDb(":memory:");
  const hash = createHash("sha256").update("synth-test").digest("hex");
  const user = createUser(db, "synthuser", hash);
  return { db, userId: user.id };
}

describe("mirror/synthesis — composeSou", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("returns all-null state for a brand-new user", () => {
    const sou = composeSou(db, userId);
    expect(sou.soulSummary).toBeNull();
    expect(sou.identitySummary).toBeNull();
    expect(sou.expressionSummary).toBeNull();
  });

  it("uses identity.summary when present, falls back to first sentence of content", () => {
    setIdentityLayer(db, userId, "self", "soul", "I am a long-form essayist who finds clarity in writing. I prefer slow over fast.");
    setIdentityLayer(db, userId, "ego", "identity", "Operational identity goes here.");
    setIdentitySummary(db, userId, "ego", "identity", "Builder of mirrors.");

    const sou = composeSou(db, userId);
    // soul has no summary → first sentence of content
    expect(sou.soulSummary).toBe("I am a long-form essayist who finds clarity in writing.");
    // identity has summary → use it
    expect(sou.identitySummary).toBe("Builder of mirrors.");
  });
});

describe("mirror/synthesis — composeEstou", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("empty user → no journeys, no org, no scenes", () => {
    const estou = composeEstou(db, userId);
    expect(estou.activeJourneys).toEqual([]);
    expect(estou.dominantOrg).toBeNull();
    expect(estou.activeSceneCount).toBe(0);
    expect(estou.mostRecentScene).toBeNull();
  });

  it("lists active journeys (alphabetical) and counts active scenes", () => {
    createJourney(db, userId, "j-walden", "Recolhimento Walden");
    createJourney(db, userId, "j-mirror", "Mirror Mind");
    createScene(db, userId, "scene-a", { title: "Aula" });
    createScene(db, userId, "scene-b", { title: "Diário" });
    const estou = composeEstou(db, userId);
    expect(estou.activeJourneys.map((j) => j.name)).toEqual([
      "Mirror Mind",
      "Recolhimento Walden",
    ]);
    expect(estou.activeSceneCount).toBe(2);
  });

  it("dominantOrg = the org tagged on most sessions in the last 7 days", () => {
    createOrganization(db, userId, "softwarezen", "Software Zen");
    createOrganization(db, userId, "nova-acropole", "Nova Acrópole");
    const a = createFreshSession(db, userId, null);
    const b = createFreshSession(db, userId, null);
    const c = createFreshSession(db, userId, null);
    addSessionOrganization(db, a, "softwarezen");
    addSessionOrganization(db, b, "softwarezen");
    addSessionOrganization(db, c, "nova-acropole");
    const estou = composeEstou(db, userId);
    expect(estou.dominantOrg?.key).toBe("softwarezen");
    expect(estou.dominantOrg?.name).toBe("Software Zen");
  });

  it("mostRecentScene = the scene linked to the most recent session this week", () => {
    const cena = createScene(db, userId, "first", { title: "First Cena" });
    createScene(db, userId, "second", { title: "Second Cena" });
    createFreshSession(db, userId, cena.id);
    const estou = composeEstou(db, userId);
    expect(estou.mostRecentScene?.title).toBe("First Cena");
  });
});

describe("mirror/synthesis — composeVivo", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("empty user → 0 conversations, no themes, no voice, no focus journey, no last title", () => {
    const vivo = composeVivo(db, userId);
    expect(vivo.weekConversationCount).toBe(0);
    expect(vivo.weekDayCount).toBe(0);
    expect(vivo.recurringThemes).toEqual([]);
    expect(vivo.dominantVoice).toBeNull();
    expect(vivo.focusJourney).toBeNull();
    expect(vivo.lastSessionTitle).toBeNull();
  });

  it("dominantVoice is 'alma' when alma sessions outnumber persona this week", () => {
    const a = createFreshSession(db, userId, null);
    const b = createFreshSession(db, userId, null);
    createFreshSession(db, userId, null); // persona default
    setSessionVoice(db, a, userId, "alma");
    setSessionVoice(db, b, userId, "alma");
    expect(composeVivo(db, userId).dominantVoice).toBe("alma");
  });

  it("dominantVoice is 'persona' when persona sessions outnumber alma this week", () => {
    createFreshSession(db, userId, null);
    createFreshSession(db, userId, null);
    const a = createFreshSession(db, userId, null);
    setSessionVoice(db, a, userId, "alma");
    expect(composeVivo(db, userId).dominantVoice).toBe("persona");
  });

  it("focusJourney is the journey with most sessions in the last week", () => {
    createJourney(db, userId, "mirror-mind", "Mirror Mind");
    createJourney(db, userId, "walden", "Walden");
    const a = createFreshSession(db, userId, null);
    const b = createFreshSession(db, userId, null);
    const c = createFreshSession(db, userId, null);
    addSessionJourney(db, a, "mirror-mind");
    addSessionJourney(db, b, "mirror-mind");
    addSessionJourney(db, c, "walden");
    expect(composeVivo(db, userId).focusJourney?.key).toBe("mirror-mind");
  });

  it("counts conversations and distinct days in the last week", () => {
    createFreshSession(db, userId, null);
    createFreshSession(db, userId, null);
    createFreshSession(db, userId, null);
    const vivo = composeVivo(db, userId);
    expect(vivo.weekConversationCount).toBe(3);
    expect(vivo.weekDayCount).toBe(1); // all created the same instant
  });

  it("recurringThemes lifts scopes that appear in ≥2 sessions", () => {
    const cena = createScene(db, userId, "diario", { title: "Diário" });
    createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "walden", "Walden");
    // 2 sessions tagged Software Zen → org theme
    const a = createFreshSession(db, userId, null);
    const b = createFreshSession(db, userId, null);
    addSessionOrganization(db, a, "sz");
    addSessionOrganization(db, b, "sz");
    // 2 sessions linked to Diário → scene theme
    createFreshSession(db, userId, cena.id);
    createFreshSession(db, userId, cena.id);
    // 1 session tagged Walden → not enough for theme
    const c = createFreshSession(db, userId, null);
    addSessionJourney(db, c, "walden");

    const vivo = composeVivo(db, userId);
    const names = vivo.recurringThemes.map((t) => t.name).sort();
    expect(names).toEqual(["Diário", "Software Zen"]);
  });

  it("lastSessionTitle is null when sessions are untitled", () => {
    createFreshSession(db, userId, null);
    const vivo = composeVivo(db, userId);
    expect(vivo.lastSessionTitle).toBeNull();
  });
});

describe("mirror/synthesis — computeShifts", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("returns empty array when lastVisit is null (first ever visit)", () => {
    const shifts = computeShifts(db, userId, null);
    expect(shifts).toEqual([]);
  });

  it("flags soul-updated when self/soul.updated_at > lastVisit", () => {
    const lastVisit = Date.now() - 2 * DAY;
    setIdentityLayer(db, userId, "self", "soul", "fresh content");
    const shifts = computeShifts(db, userId, lastVisit);
    expect(shifts.some((s) => s.type === "soul-updated")).toBe(true);
  });

  it("does NOT flag soul-updated when soul layer was last touched before lastVisit", () => {
    setIdentityLayer(db, userId, "self", "soul", "old content");
    const shifts = computeShifts(db, userId, Date.now() + HOUR);
    expect(shifts.some((s) => s.type === "soul-updated")).toBe(false);
  });

  it("flags new-journey when a journey was created since lastVisit", () => {
    const lastVisit = Date.now() - HOUR;
    createJourney(db, userId, "fresh", "Fresh Journey");
    const shifts = computeShifts(db, userId, lastVisit);
    const m = shifts.find((s) => s.type === "new-journey");
    expect(m).toBeDefined();
    if (m && m.type === "new-journey") expect(m.name).toBe("Fresh Journey");
  });

  it("flags many-conversations with the count when sessions exist since lastVisit", () => {
    const lastVisit = Date.now() - HOUR;
    createFreshSession(db, userId, null);
    createFreshSession(db, userId, null);
    createFreshSession(db, userId, null);
    const shifts = computeShifts(db, userId, lastVisit);
    const m = shifts.find((s) => s.type === "many-conversations");
    expect(m).toBeDefined();
    if (m && m.type === "many-conversations") expect(m.count).toBe(3);
  });
});

describe("mirror/synthesis — composeMirrorState (orchestrator)", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("returns a coherent state for a brand-new user (every field has a defined-or-null value)", () => {
    const state = composeMirrorState(db, userId);
    expect(state).toBeDefined();
    expect(state.shifts).toEqual([]);
    expect(state.sou).toBeDefined();
    expect(state.estou).toBeDefined();
    expect(state.vivo).toBeDefined();
  });

  it("composes everything for a populated user without throwing", () => {
    setIdentityLayer(db, userId, "self", "soul", "Long-form thinker.");
    setIdentityLayer(db, userId, "ego", "identity", "Builder.");
    createJourney(db, userId, "mirror-mind", "Mirror Mind");
    createScene(db, userId, "diario", { title: "Diário" });
    createFreshSession(db, userId, null);
    const state = composeMirrorState(db, userId);
    expect(state.sou.soulSummary).toBe("Long-form thinker.");
    expect(state.estou.activeJourneys[0].name).toBe("Mirror Mind");
    expect(state.estou.activeSceneCount).toBe(1);
    expect(state.vivo.weekConversationCount).toBe(1);
  });
});
