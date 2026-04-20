/**
 * Eval: reception scope routing (organizations + journeys).
 *
 * Measures how accurately the reception layer routes messages to the right
 * organization and journey scopes (both nullable). Persona routing lives in
 * `evals/routing.ts`; this eval covers the two scope axes added in CV1.E4.S1.
 *
 * Scope: **Alisson-specific**. The fixtures assume the primary user's
 * organizations and journeys (Software Zen; o-espelho, vida-economica, etc.).
 * Running against a different DB will produce meaningless failures.
 *
 * Usage: npm run eval:scope-routing
 * Requires: OPENROUTER_API_KEY in .env, data/mirror.db seeded with
 *           organizations and journeys for the primary user.
 *
 * Note: probes are initial — calibrate after first real run, especially
 * edge cases at the org/journey boundary.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import path from "node:path";
import { receive } from "../server/reception.js";
import { runEval } from "./_lib/runner.js";
import type { Probe } from "./_lib/types.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DB_PATH = path.join(ROOT, "data/mirror.db");
const ADMIN_USERNAME = "Alisson Vale";

interface ScopePair {
  organization: string | null;
  journey: string | null;
}

const PROBES: Probe<string, ScopePair>[] = [
  // Clear organization-only signals
  {
    input: "quais as prioridades estratégicas da Software Zen este trimestre?",
    want: { organization: "software-zen", journey: null },
    note: "Named organization, no specific journey.",
  },
  {
    input: "como está a saúde financeira da Software Zen?",
    want: { organization: "software-zen", journey: null },
  },

  // Clear journey-only signals (personal journeys without org)
  {
    input: "quanto sobrou no caixa este mês?",
    want: { organization: null, journey: "vida-economica" },
    note: "Personal finance journey, no organization.",
  },
  {
    input: "estou perdendo motivação pra estudar filosofia essa semana",
    want: { organization: null, journey: "vida-filosofica" },
  },

  // Journey that belongs to an organization — both should activate
  {
    input: "o que falta pra fechar o S1 do mirror-mind?",
    want: { organization: "software-zen", journey: "mirror-mind" },
    note: "Journey inside an organization — both axes active.",
  },
  {
    input: "como está a travessia do Espelho?",
    want: { organization: "software-zen", journey: "o-espelho" },
  },

  // Meta / null cases — neither scope should activate
  {
    input: "Quem é você?",
    want: { organization: null, journey: null },
    note: "Meta-question about the mirror.",
  },
  {
    input: "Oi, tudo bem?",
    want: { organization: null, journey: null },
  },
  {
    input: "O que você pensa sobre antifragilidade?",
    want: { organization: null, journey: null },
    note: "Pure conceptual inquiry, no scope attached.",
  },

  // Ambiguous — message touches a domain but names no scope explicitly
  {
    input: "estou escrevendo um ensaio sobre silêncio",
    want: { organization: null, journey: null },
    note: "Writing production, but no specific scope named.",
  },

  // Writing task scoped to a specific journey
  {
    input: "me ajuda a redigir o email da próxima semana do Espelho",
    want: { organization: "software-zen", journey: "o-espelho" },
    note: "Production verb + named journey — both scope axes activate, plus persona (escritora) — persona not evaluated here.",
  },
];

const db = new Database(DB_PATH, { readonly: true });
const user = db.prepare("SELECT id FROM users WHERE name = ?").get(ADMIN_USERNAME) as
  | { id: string }
  | undefined;
if (!user) {
  console.error(`User "${ADMIN_USERNAME}" not found in ${DB_PATH}`);
  process.exit(1);
}

await runEval<string, ScopePair>({
  name: "reception/scope-routing",
  threshold: 0.8, // Slightly lower than persona threshold — first iteration; tune after seeing real results.
  probes: PROBES,
  equals: (got, want) =>
    got.organization === want.organization && got.journey === want.journey,
  format: (v) => `org=${v.organization ?? "null"} journey=${v.journey ?? "null"}`,
  run: async (message) => {
    const res = await receive(db, user.id, message);
    return { organization: res.organization, journey: res.journey };
  },
});

db.close();
