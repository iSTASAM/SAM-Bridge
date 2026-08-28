import { NextResponse } from "next/server";
import {
  deleteOpenRouterSettings,
  getOpenRouterSettings,
  listOpenRouterModels,
  saveOpenRouterSettings,
} from "@/lib/openrouter-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getOpenRouterSettings();
  if (!settings) return NextResponse.json({ connected: false, models: [] });
  try {
    const models = await listOpenRouterModels(settings.apiKey);
    return NextResponse.json({
      connected: true,
      keyLast4: settings.apiKey.slice(-4),
      model: settings.model,
      lastTestedAt: settings.updatedAt,
      models,
    });
  } catch (error) {
    return NextResponse.json({
      connected: true,
      keyLast4: settings.apiKey.slice(-4),
      model: settings.model,
      lastTestedAt: settings.updatedAt,
      models: [{ id: settings.model, name: settings.model }],
      error: error instanceof Error ? error.message : "OpenRouter connection failed",
    });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown; model?: unknown; testOnly?: unknown };
  const existing = getOpenRouterSettings();
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : existing?.apiKey ?? "";
  if (!apiKey) return NextResponse.json({ error: "OpenRouter API key is required" }, { status: 400 });
  try {
    const models = await listOpenRouterModels(apiKey);
    const model = typeof body.model === "string" ? body.model.trim() : existing?.model ?? "";
    if (!body.testOnly) {
      if (!models.some((item) => item.id === model)) {
        return NextResponse.json({ error: "Select an available OpenRouter model", models }, { status: 400 });
      }
      const saved = saveOpenRouterSettings(apiKey, model);
      return NextResponse.json({
        connected: true,
        keyLast4: apiKey.slice(-4),
        model,
        lastTestedAt: saved.updatedAt,
        models,
      });
    }
    return NextResponse.json({
      connected: true,
      keyLast4: apiKey.slice(-4),
      model,
      lastTestedAt: new Date().toISOString(),
      models,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OpenRouter connection failed" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  deleteOpenRouterSettings();
  return NextResponse.json({ ok: true });
}
