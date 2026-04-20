/**
 * Eval: reception persona routing.
 *
 * Measures how accurately the reception layer routes user messages to the
 * right persona (or to null for meta/greeting/reflective messages). Every
 * change to the reception prompt, persona summaries, or persona list risks
 * regressing routing behavior — this eval catches those changes.
 *
 * Scope: **Alisson-specific**. The fixtures assume the primary user's
 * persona set (tesoureira, escritora, terapeuta, etc.). Running against a
 * different DB will produce meaningless failures. When the product grows to
 * multi-user, generalize the fixtures (e.g., load from a per-user probe file).
 *
 * Usage: npm run eval:routing
 * Requires: OPENROUTER_API_KEY in .env, data/mirror.db with Alisson's personas.
 * Cost: ~22 reception calls at ~$0.00002 each → ~$0.0005 per run.
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

const PROBES: Probe<string, string | null>[] = [
  // Clear domain cases — each should map to a specific persona
  { input: "quanto está o saldo na conta PJ do Pagarme?", want: "tesoureira" },
  { input: "preciso cortar gastos, me ajuda a revisar as categorias", want: "tesoureira" },
  { input: "escreve um ensaio sobre o ruído da urgência", want: "escritora" },
  { input: "me ajuda a escrever um post pro LinkedIn sobre o Espelho", want: "divulgadora" },
  { input: "um aluno me perguntou sobre TDD legacy, como respondo?", want: "mentora" },
  { input: "tô me sentindo irritado sem motivo aparente", want: "terapeuta" },
  { input: "dor de cabeça há 3 dias, pode ser o quê?", want: "medica" },
  { input: "como estruturar a próxima aula da Software Zen Academy?", want: "professora" },
  { input: "query pra puxar todas as conversas com a tesoureira esse mês", want: "dba" },
  { input: "erro TypeError: content.trim is not a function, como debugar?", want: "tecnica" },
  { input: "qual o plano pra essa semana considerando as travessias ativas?", want: "estrategista" },
  { input: "estou pensando sobre a diferença entre construir e canalizar", want: "pensadora" },
  { input: "como ficou o design da landing do Reflexo?", want: "product-designer" },

  // Ambiguous / historical problem cases from the spike
  { input: "minha ideia é integrar Whisper ao input de áudio, faz sentido?", want: "product-designer" },
  { input: "por que acho que a travessia do deserto está mais fácil agora?", want: "pensadora" },
  { input: "lavadeira parou de funcionar, vai pagar o conserto agora ou espera?", want: "tesoureira" },

  // Meta / null cases — should NOT route to any persona
  { input: "Quem é você?", want: null },
  { input: "Oi, tudo bem?", want: null },
  { input: "Por que você existe?", want: null },
  { input: "Como você funciona?", want: null },

  // Production verb dominates conceptual topic
  {
    input: "escreva um texto de 3 parágrafos relacionando ação coerente com antifragilidade",
    want: "escritora",
    note: "Production verb ('escreva') should win over conceptual topic.",
  },
  {
    input: "O que você pensa sobre antifragilidade?",
    want: "pensadora",
    note: "Pure inquiry without production verb — conceptual persona.",
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

await runEval({
  name: "reception/routing",
  threshold: 0.85,
  probes: PROBES,
  run: async (message) => {
    const res = await receive(db, user.id, message);
    return res.persona;
  },
});

db.close();
