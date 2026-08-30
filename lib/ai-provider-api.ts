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
  return NextResponse.json({
    connected: true,
    keyLast4: current.keyLast4,
    model: current.model,
    lastTestedAt: current.lastTestedAt ?? current.updatedAt,
    models: current.model ? [{ id: current.model, name: current.model }] : [],
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
    const models = input.kind === "custom" ? [] : await listProviderModels(input.kind, apiKey);
    const model = typeof body.model === "string" ? body.model.trim() : current?.model ?? "";
    if (body.testOnly) {
      if (input.kind === "custom") {
        const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : current?.baseUrl ?? "";
        if (!baseUrl) return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
        if (!model) return NextResponse.json({ error: "Model is required" }, { status: 400 });
        const now = new Date().toISOString();
        await completeAiText({
          id: input.id,
          kind: "custom",
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : input.name || "Custom",
          apiKey,
          keyLast4: apiKey.slice(-4),
          model,
          baseUrl,
          lastTestedAt: now,
          createdAt: now,
          updatedAt: now,
        }, model, "Reply with only the word OK.");
      }
      return NextResponse.json({
        connected: true,
        keyLast4: apiKey.slice(-4),
        model,
        lastTestedAt: new Date().toISOString(),
        models: models.length ? models : model ? [{ id: model, name: model }] : [],
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
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl.trim() : "",
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
    const status = message.includes("ENCRYPTION") || message.includes("SUPABASE") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function deleteProviderResponse(id: string) {
  await deleteAiProvider(id);
  return NextResponse.json({ ok: true });
}
