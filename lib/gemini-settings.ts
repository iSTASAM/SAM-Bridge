import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type GeminiSettings = { apiKey: string; model: string; updatedAt: string };
const FILE = path.join(process.cwd(), "data", "gemini-settings.json");

export function getGeminiSettings(): GeminiSettings | null {
  if (!existsSync(FILE)) return null;
  try {
    const value = JSON.parse(readFileSync(FILE, "utf8")) as Partial<GeminiSettings>;
    return value.apiKey && value.model ? { apiKey: value.apiKey, model: value.model, updatedAt: value.updatedAt ?? "" } : null;
  } catch { return null; }
}

export function saveGeminiSettings(apiKey: string, model: string) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const value = { apiKey, model, updatedAt: new Date().toISOString() };
  writeFileSync(FILE, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  return value;
}

export function deleteGeminiSettings() {
  if (existsSync(FILE)) writeFileSync(FILE, "{}", { encoding: "utf8", mode: 0o600 });
}

export async function listGeminiModels(apiKey: string) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": apiKey }, cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Gemini API returned HTTP ${response.status}`);
  return (data.models ?? [])
    .filter((model) => model.name?.startsWith("models/") && model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({ id: model.name!.slice("models/".length), name: model.displayName || model.name!.slice("models/".length) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
