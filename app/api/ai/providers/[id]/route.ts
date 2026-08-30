import { NextResponse } from "next/server";
import { deleteProviderResponse, getProviderResponse, saveProviderResponse } from "@/lib/ai-provider-api";
import { AI_PROVIDER_KINDS, type AiProviderKind } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

function kindOf(id: string, bodyKind?: unknown): AiProviderKind {
  if (AI_PROVIDER_KINDS.includes(id as AiProviderKind)) return id as AiProviderKind;
  if (AI_PROVIDER_KINDS.includes(bodyKind as AiProviderKind)) return bodyKind as AiProviderKind;
  return "custom";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return await getProviderResponse(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_PROVIDERS_LOAD_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clone = request.clone();
  const body = (await clone.json().catch(() => ({}))) as { kind?: unknown };
  return saveProviderResponse(request, { id, kind: kindOf(id, body.kind) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return await deleteProviderResponse(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_PROVIDERS_DELETE_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
