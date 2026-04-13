/**
 * Experiment 01: Hello pi
 * Validates that pi-ai + OpenRouter + the configured model work.
 * Run: npx tsx experiments/01-hello.ts
 */
import "dotenv/config";
import { getModel, complete } from "@mariozechner/pi-ai";

const model = getModel("openrouter", process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001");

const response = await complete(
    model,
    {
        messages: [
            { role: "user", content: "Say hello in one short, poetic sentence." },
        ],
    },
    { apiKey: process.env.OPENROUTER_API_KEY },
);

for (const block of response.content) {
    if (block.type === "text") {
        console.log(block.text);
    }
}
