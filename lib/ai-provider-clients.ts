import { listGeminiModels } from "@/lib/gemini-settings";
import { listOpenRouterModels } from "@/lib/openrouter-settings";
import type { AiProviderKind } from "@/lib/ai-providers";

export type AiModelOption = { id: string; name: string };

const MODEL_LIST_TIMEOUT_MS = 20_000;

function isOpenAiTextModel(id: string) {
  if (!/^(gpt-|o\d|chatgpt-)/i.test(id)) return false;
  return !/(audio|image|realtime|transcri|tts|embedding|moderation)/i.test(id);
}

function modelListUrl(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Base URL is required");
  let url: URL;
  try {
    url = new URL(`${base}/models`);
  } catch {
    throw new Error("Base URL is invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Base URL must use HTTP or HTTPS");
  }
  return url.toString();
}

export async function listOpenAiModels(apiKey: string): Promise<AiModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI returned HTTP ${response.status}`);
  return (data.data ?? [])
    .map((item) => item.id ?? "")
    .filter(isOpenAiTextModel)
    .map((id) => ({ id, name: id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAnthropicModels(apiKey: string): Promise<AiModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string; display_name?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `Anthropic returned HTTP ${response.status}`);
  return (data.data ?? [])
    .filter((item) => item.id)
    .map((item) => ({ id: item.id!, name: item.display_name || item.id! }));
}

export async function listOpenAiCompatibleModels(apiKey: string, baseUrl: string): Promise<AiModelOption[]> {
  const response = await fetch(modelListUrl(baseUrl), {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string; name?: string }>;
    models?: Array<{ id?: string; name?: string } | string>;
    error?: { message?: string } | string;
  };
  const message = typeof data.error === "string" ? data.error : data.error?.message;
  if (!response.ok) throw new Error(message || `Custom provider returned HTTP ${response.status}`);
  const raw = data.data ?? data.models ?? [];
  return raw
    .map((item) => typeof item === "string" ? { id: item, name: item } : { id: item.id ?? "", name: item.name || item.id || "" })
    .filter((item) => item.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listProviderModels(
  kind: AiProviderKind,
  apiKey: string,
  baseUrl = "",
): Promise<AiModelOption[]> {
  if (kind === "gemini") return listGeminiModels(apiKey);
  if (kind === "openrouter") return listOpenRouterModels(apiKey);
  if (kind === "openai") return listOpenAiModels(apiKey);
  if (kind === "anthropic") return listAnthropicModels(apiKey);
  return listOpenAiCompatibleModels(apiKey, baseUrl);
}
