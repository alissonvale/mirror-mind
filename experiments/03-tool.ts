/**
 * Experiment 03: First tool
 * Validates that pi-agent-core's Agent + tool-calling loop works.
 * Run: npx tsx experiments/03-tool.ts
 */
import "dotenv/config";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const getTimeTool: AgentTool = {
    name: "get_time",
    label: "Get Time",
    description: "Returns the current date and time in ISO 8601 format.",
    parameters: Type.Object({}),
    execute: async () => {
        const now = new Date().toISOString();
        return {
            content: [{ type: "text", text: now }],
            details: { now },
        };
    },
};

const agent = new Agent({
    initialState: {
        systemPrompt: "You are a concise assistant.",
        model: getModel("openrouter", process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001"),
        tools: [getTimeTool],
    },
    getApiKey: () => process.env.OPENROUTER_API_KEY,
});

agent.subscribe((event) => {
    if (event.type === "tool_execution_start") {
        console.log(`\n→ calling ${event.toolName}(${JSON.stringify(event.args)})`);
    }
    if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
    ) {
        process.stdout.write(event.assistantMessageEvent.delta);
    }
});

await agent.prompt("What time is it right now? Answer in one short sentence.");
process.stdout.write("\n");
