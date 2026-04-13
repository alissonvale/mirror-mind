/**
 * Experiment 02: Streaming
 * Validates that streaming works with pi-ai + OpenRouter.
 * Run: npx tsx experiments/02-streaming.ts
 */
import "dotenv/config";
import { getModel, stream } from "@mariozechner/pi-ai";

const model = getModel("openrouter", process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001");

const events = stream(
    model,
    {
        messages: [
            { role: "user", content: "Explain in 2 sentences how photosynthesis works." },
        ],
    },
    { apiKey: process.env.OPENROUTER_API_KEY },
);

for await (const event of events) {
    if (event.type === "text_delta") {
        process.stdout.write(event.delta);
    }
}
process.stdout.write("\n");
