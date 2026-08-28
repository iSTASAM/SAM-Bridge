import { NextResponse } from "next/server";
import { deleteGeminiSettings, getGeminiSettings, listGeminiModels, saveGeminiSettings } from "@/lib/gemini-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getGeminiSettings();
  if (!settings) return NextResponse.json({ connected: false, models: [] });
  try {
    const models = await listGeminiModels(settings.apiKey);
    return NextResponse.json({ connected: true, keyLast4: settings.apiKey.slice(-4), model: settings.model, lastTestedAt: settings.updatedAt, models });
  } catch (error) {
    return NextResponse.json({ connected: false, keyLast4: settings.apiKey.slice(-4), model: settings.model, models: [], error: error instanceof Error ? error.message : "Gemini connection failed" });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { apiKey?: unknown; model?: unknown; testOnly?: unknown };
  const existing = getGeminiSettings();
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : existing?.apiKey ?? "";
  if (!apiKey) return NextResponse.json({ error: "Gemini API key is required" }, { status: 400 });
  try {
    const models = await listGeminiModels(apiKey);
    const model = typeof body.model === "string" ? body.model.trim() : existing?.model ?? "";
    if (!body.testOnly) {
      if (!models.some((item) => item.id === model)) return NextResponse.json({ error: "Select an available Gemini model", models }, { status: 400 });
      const saved = saveGeminiSettings(apiKey, model);
      return NextResponse.json({ connected: true, keyLast4: apiKey.slice(-4), model, lastTestedAt: saved.updatedAt, models });
    }
    return NextResponse.json({ connected: true, keyLast4: apiKey.slice(-4), model, lastTestedAt: new Date().toISOString(), models });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gemini connection failed" }, { status: 502 });
  }
}

export async function DELETE() {
  deleteGeminiSettings();
  return NextResponse.json({ ok: true });
}
