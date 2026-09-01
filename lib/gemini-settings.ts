import { deleteAiProvider, getAiProvider, saveAiProvider } from "@/lib/ai-providers";

type GeminiSettings = { apiKey: string; model: string; updatedAt: string };

export async function getGeminiSettings(): Promise<GeminiSettings | null> {
  const row = await getAiProvider("gemini");
  if (!row?.apiKey || !row.model) return null;
  return { apiKey: row.apiKey, model: row.model, updatedAt: row.updatedAt };
}

export async function saveGeminiSettings(apiKey: string, model: string) {
  const saved = await saveAiProvider({
    id: "gemini",
    kind: "gemini",
    name: "Google Gemini",
    apiKey,
    model,
  });
  return { apiKey, model, updatedAt: saved.updatedAt };
}

export async function deleteGeminiSettings() {
  await deleteAiProvider("gemini");
}

export async function listGeminiModels(apiKey: string) {
  const models: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> = [];
  let pageToken = "";
  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({})) as {
      models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(data.error?.message || `Gemini API returned HTTP ${response.status}`);
    models.push(...(data.models ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return models
    .filter((model) => model.name?.startsWith("models/") && model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({ id: model.name!.slice("models/".length), name: model.displayName || model.name!.slice("models/".length) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
