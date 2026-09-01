import { NextResponse } from "next/server";
import { completeAiText } from "@/lib/ai-completion";
import { listProviderModels } from "@/lib/ai-provider-clients";
import {
  deleteAiProvider,
  getAiProvider,
  saveAiProvider,
  type AiProviderKind,
} from "@/lib/ai-providers";

const NAMES: Record<AiProviderKind, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  custom: "Custom",
};

export function providerPublic(item: {
  keyLast4: string;
  model: string;
  lastTestedAt: string | null;
  updatedAt: string;
}, models: Array<{ id: string; name: string }> = []) {
  return {
    connected: true,
    keyLast4: item.keyLast4,
    model: item.model,
    lastTestedAt: item.lastTestedAt ?? item.updatedAt,
    models,
  };
}

export async function getProviderResponse(id: string) {
  const current = await getAiProvider(id);
  if (!current) return NextResponse.json({ connected: false, models: [] });
  let models: Array<{ id: string; name: string }> = [];
  let modelsError = "";
  try {
    models = await listProviderModels(current.kind, current.apiKey, current.baseUrl);
  } catch (error) {
    modelsError = error instanceof Error ? error.message : "Unable to load models";
  }
  return NextResponse.json({
    connected: true,
    keyLast4: current.keyLast4,
    model: current.model,
    lastTestedAt: current.lastTestedAt ?? current.updatedAt,
    models: models.length ? models : current.model ? [{ id: current.model, name: current.model }] : [],
    ...(modelsError ? { modelsError } : {}),
  });
}

export async function saveProviderResponse(
  request: Request,
  input: { id: string; kind: AiProviderKind; name?: string },
) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: unknown;
    model?: unknown;
    testOnly?: unknown;
    name?: unknown;
    baseUrl?: unknown;
  };
  const current = await getAiProvider(input.id);
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : current?.apiKey ?? "";
  if (!apiKey) return NextResponse.json({ error: "API key is required" }, { status: 400 });

  try {
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : current?.baseUrl ?? "";
    const models = await listProviderModels(input.kind, apiKey, baseUrl);
    if (input.kind !== "custom" && models.length === 0) {
      return NextResponse.json({ error: "No compatible models are available for this API key" }, { status: 400 });
    }
    const model = typeof body.model === "string" ? body.model.trim() : current?.model ?? "";
    if (body.testOnly) {
      const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
      const testModel = requestedModel && (
        models.some((item) => item.id === requestedModel) || (input.kind === "custom" && models.length === 0)
      )
        ? requestedModel
        : "";
      if (testModel) {
        const now = new Date().toISOString();
        await completeAiText({
          id: input.id,
          kind: input.kind,
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : input.name || NAMES[input.kind],
          apiKey,
          keyLast4: apiKey.slice(-4),
          model: testModel,
          baseUrl,
          lastTestedAt: now,
          createdAt: now,
          updatedAt: now,
        }, testModel, "Reply with only the word OK.", { feature: "general", skipLog: true });
      }
      return NextResponse.json({
        connected: true,
        keyLast4: apiKey.slice(-4),
        model: testModel || model || models[0]?.id || "",
        lastTestedAt: new Date().toISOString(),
        models: models.length ? models : testModel ? [{ id: testModel, name: testModel }] : [],
      });
    }
    if (models.length && !models.some((item) => item.id === model)) {
      return NextResponse.json({ error: "Select an available model", models }, { status: 400 });
    }
    if (!model) return NextResponse.json({ error: "Select a model", models }, { status: 400 });
    const saved = await saveAiProvider({
      id: input.id,
      kind: input.kind,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : input.name || NAMES[input.kind],
      apiKey,
      model,
      baseUrl,
    });
    return NextResponse.json({
      connected: true,
      keyLast4: saved.keyLast4,
      model: saved.model,
      lastTestedAt: saved.lastTestedAt,
      models: models.length ? models : [{ id: saved.model, name: saved.model }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider failed";
    const status = message.includes("ENCRYPTION") || message.includes("SUPABASE") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function deleteProviderResponse(id: string) {
  await deleteAiProvider(id);
  return NextResponse.json({ ok: true });
}
