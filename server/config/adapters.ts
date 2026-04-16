import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface AdapterConfig {
  instruction: string;
}

const configPath = join(import.meta.dirname, "../../config/adapters.json");
const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
  string,
  AdapterConfig
>;

export const adapters = raw;
