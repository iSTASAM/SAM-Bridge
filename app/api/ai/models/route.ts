import { NextResponse } from "next/server";
import { getGeminiSettings } from "@/lib/gemini-settings";
import { getOpenRouterSettings } from "@/lib/openrouter-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const openrouter = getOpenRouterSettings();
  const gemini = getGeminiSettings();
  const options = [];
  if (openrouter) options.push({ provider: "openrouter", name: "OpenRouter", model: openrouter.model });
  if (gemini) options.push({ provider: "gemini", name: "Google Gemini", model: gemini.model });
  return NextResponse.json({ options });
}
