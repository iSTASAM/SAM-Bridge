import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type OpenRouterSettings = { apiKey: string; model: string; updatedAt: string };
export type OpenRouterModel = { id: string; name: string };

const FILE = path.join(process.cwd(), "data", "openrouter-settings.json");
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function openRouterHeaders(apiKey: string) {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "http-referer": process.env.OPENROUTER_REFERER ?? "http://localhost:4525",
    "x-title": "SAM Bridge",
  };
}

export function getOpenRouterSettings(): OpenRouterSettings | null {
  if (!existsSync(FILE)) return null;
  try {
    const value = JSON.parse(readFileSync(FILE, "utf8")) as Partial<OpenRouterSettings>;
    return value.apiKey && value.model
      ? { apiKey: value.apiKey, model: value.model, updatedAt: value.updatedAt ?? "" }
      : null;
  } catch {
    return null;
  }
}

export function saveOpenRouterSettings(apiKey: string, model: string) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const value = { apiKey, model, updatedAt: new Date().toISOString() };
  writeFileSync(FILE, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  return value;
}

export function deleteOpenRouterSettings() {
  if (existsSync(FILE)) writeFileSync(FILE, "{}", { encoding: "utf8", mode: 0o600 });
}

export async function listOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: openRouterHeaders(apiKey),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string; name?: string; architecture?: { output_modalities?: string[] } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `OpenRouter returned HTTP ${response.status}`);
  return (data.data ?? [])
    .filter((model) => model.id && (model.architecture?.output_modalities?.includes("text") ?? true))
    .map((model) => ({ id: model.id!, name: model.name || model.id! }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function completeOpenRouter(apiKey: string, model: string, prompt: string) {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
  });
  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message || `OpenRouter returned HTTP ${response.status}`);
  const answer = result.choices?.[0]?.message?.content?.trim() ?? "";
  if (!answer) throw new Error("OpenRouter returned an empty response");
  const finishReason = result.choices?.[0]?.finish_reason ?? "stop";
  if (finishReason === "length") {
    throw new Error("OpenRouter response exceeded the output limit. Please ask for a narrower or more concise analysis.");
  }
  return { answer, finishReason };
}
