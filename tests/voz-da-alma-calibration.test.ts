/**
 * CV1.E9.S5 — Voz da Alma calibration probes.
 *
 * Contract test on the reception parser + axis. Each case supplies a
 * mocked LLM verdict; the test asserts the parsed `is_self_moment`
 * boolean preserves it. This catches accidental parser drift that
 * would silently break good live classifications.
 *
 * Note: this is NOT a model evaluation. Live-LLM classification
 * quality is validated by the manual smoke test guide
 * (docs/.../cv1-e9-s5-calibration/test-guide.md). The contract probe
 * here proves only that "if the LLM emits {is_self_moment: X}, the
 * pipeline routes accordingly" — the eval round proves "the LLM
 * actually emits the right X for representative inputs."
 *
 * The case set is the canonical class taxonomy shipped with S3:
 *   1. Apontamento de vida (target → true)
 *   2. Pergunta funcional (→ false)
 *   3. Reflexão analítica sem peso pessoal (→ false)
 *   4. Edge cases (greetings, meta-questions, identity-touching asks)
 */

import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb, createUser, setIdentityLayer } from "../server/db.js";
import { receive } from "../server/reception.js";

type CompleteFn = Parameters<typeof receive>[4];

function fakeComplete(text: string): CompleteFn {
  return (async () => ({
    content: [{ type: "text", text }],
  })) as unknown as CompleteFn;
}

interface CalibrationCase {
  id: string;
  message: string;
  expectedIsSelfMoment: boolean;
  expectedTouchesIdentity?: boolean;
  rationale: string;
}

const CASES: CalibrationCase[] = [
  // --- Class 1: Apontamento de vida (→ true) ---
  {
    id: "apontamento-1",
    message: "hoje atendi um caso difícil, ainda estou processando",
    expectedIsSelfMoment: true,
    rationale: "First-person past-tense registry of a moment that carries weight.",
  },
  {
    id: "apontamento-2",
    message: "fechei a porta do escritório enquanto a Veronica chegava cansada",
    expectedIsSelfMoment: true,
    rationale: "Specific event, names a person, the user is naming what they did.",
  },
  {
    id: "apontamento-3",
    message: "tive uma conversa com o Tonico que ficou pesando o resto do dia",
    expectedIsSelfMoment: true,
    rationale: "Lived event + named person + emotional residue. Classic apontamento.",
  },
  {
    id: "apontamento-4",
    message: "estou voltando do hospital, preciso parar pra respirar",
    expectedIsSelfMoment: true,
    rationale: "Confiding present-state fragment. The pause itself is the registry.",
  },
  {
    id: "apontamento-5",
    message: "minha mãe ligou mais cedo, fiquei pensando o resto do dia",
    expectedIsSelfMoment: true,
    rationale: "Specific event + sustained inner residue. No question to answer.",
  },
  {
    id: "apontamento-6-en",
    message: "I just got off a hard call with my brother",
    expectedIsSelfMoment: true,
    rationale: "English-phrased apontamento. The detection should be language-agnostic.",
  },

  // --- Class 2: Pergunta funcional (→ false) ---
  {
    id: "functional-1",
    message: "qual a melhor forma de cobrar emolumentos cartoriais via boleto?",
    expectedIsSelfMoment: false,
    rationale: "Operational ask, no personal weight. Persona path.",
  },
  {
    id: "functional-2",
    message: "compare VMware e Proxmox para uso doméstico",
    expectedIsSelfMoment: false,
    rationale: "Imperative compare, technical scope. No registry tone.",
  },
  {
    id: "functional-3",
    message: "lê esse documento e me diz o que achou",
    expectedIsSelfMoment: false,
    rationale: "Imperative read-and-report. Functional artifact request.",
  },
  {
    id: "functional-4",
    message: "o que falta pra fechar a story CV1.E7.S6?",
    expectedIsSelfMoment: false,
    rationale: "Project status check. Strategist persona territory.",
  },

  // --- Class 3: Reflexão analítica sem peso pessoal (→ false) ---
  {
    id: "analytical-1",
    message: "estou pensando sobre estratégia de divulgação para o público da Software Zen",
    expectedIsSelfMoment: false,
    rationale: "First-person verb but conceptual / strategic, not life-registry.",
  },
  {
    id: "analytical-2",
    message: "essa ideia de um seletor de destino ressoa contigo? acho que pode ser elegante",
    expectedIsSelfMoment: false,
    rationale: "Idea exploration with feedback ask. Not registry; thinking-out-loud.",
  },
  {
    id: "analytical-3",
    message:
      "vejo três caminhos pra resolver o gargalo: aumentar concorrência, reduzir latência por turno, ou paralelizar o pipeline. cada um tem trade-offs",
    expectedIsSelfMoment: false,
    rationale: "Multi-clause analytical exploration. Strategist territory.",
  },
  {
    id: "analytical-4",
    message: "qual seria o caminho de produto pra resolver o problema do onboarding?",
    expectedIsSelfMoment: false,
    rationale: "Product / design question. Persona-shaped, not Alma-shaped.",
  },

  // --- Class 4: Edge cases ---
  {
    id: "edge-greeting",
    message: "bom dia",
    expectedIsSelfMoment: false,
    rationale: "Greeting. Class 0; never Alma.",
  },
  {
    id: "edge-meta-question",
    message: "como funciona a Voz da Alma?",
    expectedIsSelfMoment: false,
    rationale: "Meta-question about the mirror itself. Functional path.",
  },
  {
    id: "edge-identity-question",
    message: "How should I think about leaving vs staying?",
    expectedIsSelfMoment: false,
    expectedTouchesIdentity: true,
    rationale:
      "Identity-touching life decision but framed as a question — canonical path with touches_identity true; not Alma (Alma serves registries, not asks).",
  },
  {
    id: "edge-apontamento-with-identity",
    message: "hoje sentei na varanda e me perguntei quem eu estou me tornando",
    expectedIsSelfMoment: true,
    expectedTouchesIdentity: true,
    rationale:
      "Apontamento de vida AND touches identity — both axes flip true. Alma path with full identity cluster.",
  },
];

describe("Voz da Alma calibration set (CV1.E9.S5)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    // At least one persona so reception doesn't short-circuit on the
    // no-candidates path. The persona itself doesn't matter for the
    // is_self_moment axis.
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
  });

  for (const c of CASES) {
    const preview =
      c.message.length > 50 ? c.message.slice(0, 50) + "…" : c.message;
    it(`${c.id} — ${preview} → is_self_moment: ${c.expectedIsSelfMoment}`, async () => {
      const verdict = JSON.stringify({
        personas: [],
        organization: null,
        journey: null,
        mode: "conversational",
        touches_identity: c.expectedTouchesIdentity ?? false,
        is_self_moment: c.expectedIsSelfMoment,
      });
      const result = await receive(db, userId, c.message, {}, fakeComplete(verdict));
      expect(result.is_self_moment).toBe(c.expectedIsSelfMoment);
      if (c.expectedTouchesIdentity !== undefined) {
        expect(result.touches_identity).toBe(c.expectedTouchesIdentity);
      }
    });
  }

  it("set covers all three classes (smoke check on the case authoring)", () => {
    const trueCount = CASES.filter((c) => c.expectedIsSelfMoment).length;
    const falseCount = CASES.filter((c) => !c.expectedIsSelfMoment).length;
    // Sanity: not all-true, not all-false. The set must exercise both
    // halves of the boolean for the contract probe to mean anything.
    expect(trueCount).toBeGreaterThan(3);
    expect(falseCount).toBeGreaterThan(3);
    // Total in the expected band (12-18 per plan).
    expect(CASES.length).toBeGreaterThanOrEqual(12);
    expect(CASES.length).toBeLessThanOrEqual(20);
  });
});
