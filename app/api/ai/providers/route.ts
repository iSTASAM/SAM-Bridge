import { NextResponse } from "next/server";
import { listPublicAiProviders } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ providers: await listPublicAiProviders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_PROVIDERS_LOAD_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
