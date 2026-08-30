import { NextResponse } from "next/server";
import { getAiDefault, getAiProvider, setAiDefault } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ default: await getAiDefault() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_DEFAULT_LOAD_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { providerId?: unknown; model?: unknown };
  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!providerId || !model) {
    await setAiDefault(null);
    return NextResponse.json({ default: null });
  }
  const provider = await getAiProvider(providerId);
  if (!provider) return NextResponse.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
  try {
    return NextResponse.json({ default: await setAiDefault({ providerId, model }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_DEFAULT_SAVE_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
