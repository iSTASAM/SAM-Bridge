import type { AiProvider } from "@/lib/ai-providers";

const DEFAULT_TIMEOUT_MS = 55_000;
const MAX_OUTPUT_TOKENS = 8192;

export type AiCompletion = {
  answer: string;
  finishReason: string;
};

function apiUrl(baseUrl: string, path: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("AI provider base URL is required");
  let url: URL;
  try {
    url = new URL(`${base}${path}`);
  } catch {
    throw new Error("AI provider base URL is invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("AI provider base URL must use HTTP or HTTPS");
  }
  return url.toString();
}

function completionError(provider: string, status: number, message?: string) {
  const detail = message?.trim().slice(0, 500);
  return new Error(detail || `${provider} returned HTTP ${status}`);
}

function ensureComplete(answer: string, finishReason: string, provider: string) {
  const text = answer.trim();
  if (!text) throw new Error(`${provider} returned an empty response`);
  if (["length", "max_tokens", "MAX_TOKENS"].includes(finishReason)) {
    throw new Error(`${provider} response exceeded the output limit. Please ask for a narrower or more concise analysis.`);
  }
  return { answer: text, finishReason };
}

async function completeOpenAiCompatible(provider: AiProvider, model: string, prompt: string) {
  const defaultBase = provider.kind === "openrouter"
    ? "https://openrouter.ai/api/v1"
    : "https://api.openai.com/v1";
  const response = await fetch(apiUrl(provider.baseUrl || defaultBase, "/chat/completions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json",
      ...(provider.kind === "openrouter"
        ? {
            "http-referer": process.env.OPENROUTER_REFERER ?? "http://localhost:4525",
            "x-title": "SAM Bridge",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> }; finish_reason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw completionError(provider.name, response.status, result.error?.message);
  const content = result.choices?.[0]?.message?.content;
  const answer = typeof content === "string"
    ? content
    : (content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
  return ensureComplete(answer, result.choices?.[0]?.finish_reason ?? "stop", provider.name);
}

async function completeAnthropic(provider: AiProvider, model: string, prompt: string) {
  const response = await fetch(apiUrl(provider.baseUrl || "https://api.anthropic.com", "/v1/messages"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const result = (await response.json().catch(() => ({}))) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
    error?: { message?: string };
  };
  if (!response.ok) throw completionError(provider.name, response.status, result.error?.message);
  const answer = (result.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  return ensureComplete(answer, result.stop_reason ?? "end_turn", provider.name);
}

async function completeGemini(provider: AiProvider, model: string, prompt: string) {
  const base = provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(apiUrl(base, `/models/${encodeURIComponent(model)}:generateContent`), {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": provider.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const result = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw completionError(provider.name, response.status, result.error?.message);
  const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return ensureComplete(answer, result.candidates?.[0]?.finishReason ?? "UNKNOWN", provider.name);
}

export async function completeAiText(provider: AiProvider, model: string, prompt: string): Promise<AiCompletion> {
  const selectedModel = model.trim() || provider.model.trim();
  if (!provider.apiKey || !selectedModel) throw new Error("AI provider and model are not configured");
  if (provider.kind === "gemini") return completeGemini(provider, selectedModel, prompt);
  if (provider.kind === "anthropic") return completeAnthropic(provider, selectedModel, prompt);
  return completeOpenAiCompatible(provider, selectedModel, prompt);
}
