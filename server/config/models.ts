import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ModelConfig {
  provider: string;
  model: string;
  timeout_ms?: number;
  purpose: string;
}

const configPath = join(import.meta.dirname, "../../config/models.json");
const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
  string,
  ModelConfig
>;

export const models = raw;
