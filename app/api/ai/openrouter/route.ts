import { deleteProviderResponse, getProviderResponse, saveProviderResponse } from "@/lib/ai-provider-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return getProviderResponse("openrouter");
}

export async function POST(request: Request) {
  return saveProviderResponse(request, { id: "openrouter", kind: "openrouter", name: "OpenRouter" });
}

export async function DELETE() {
  return deleteProviderResponse("openrouter");
}
