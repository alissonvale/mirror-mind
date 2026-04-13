import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const configPath = join(homedir(), ".mirror", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
  serverUrl: string;
  token: string;
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function send(text: string): Promise<string> {
  const res = await fetch(`${config.serverUrl}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ text }),
  });

  const data = (await res.json()) as { reply?: string; error?: string };

  if (data.error) return `[error: ${data.error}]`;
  return data.reply ?? "[empty reply]";
}

function prompt() {
  rl.question("you: ", async (text) => {
    if (!text.trim()) return prompt();
    if (text === "/exit") {
      console.log("Bye.");
      rl.close();
      return;
    }

    const reply = await send(text);
    console.log(`\nmirror: ${reply}`);
    prompt();
  });
}

console.log(`mirror-cli connected to ${config.serverUrl}`);
console.log("Type /exit to quit.\n");
prompt();
