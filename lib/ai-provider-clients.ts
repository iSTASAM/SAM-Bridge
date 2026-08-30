import { listGeminiModels } from "@/lib/gemini-settings";
import { listOpenRouterModels } from "@/lib/openrouter-settings";
import type { AiProviderKind } from "@/lib/ai-providers";

export type AiModelOption = { id: string; name: string };

const ANTHROPIC_MODELS: AiModelOption[] = [
  { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-3-5-haiku-20241022", name: "Claude Haiku 3.5" },
];

export async function listOpenAiModels(apiKey: string): Promise<AiModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI returned HTTP ${response.status}`);
  return (data.data ?? [])
    .map((item) => item.id ?? "")
    .filter((id) => /^(gpt-|o[1-4]|chatgpt-)/i.test(id))
    .map((id) => ({ id, name: id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAnthropicModels(apiKey: string): Promise<AiModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODELS[1].id,
      max_tokens: 1,
      messages: [{ role: "user", content: "ok" }],
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok && response.status !== 400) {
    throw new Error(data.error?.message || `Anthropic returned HTTP ${response.status}`);
  }
  return ANTHROPIC_MODELS;
}

export async function listProviderModels(kind: AiProviderKind, apiKey: string): Promise<AiModelOption[]> {
  if (kind === "gemini") return listGeminiModels(apiKey);
  if (kind === "openrouter") return listOpenRouterModels(apiKey);
  if (kind === "openai") return listOpenAiModels(apiKey);
  if (kind === "anthropic") return listAnthropicModels(apiKey);
  return [];
}
