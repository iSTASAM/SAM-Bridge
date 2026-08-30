import { deleteProviderResponse, getProviderResponse, saveProviderResponse } from "@/lib/ai-provider-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return getProviderResponse("gemini");
}

export async function POST(request: Request) {
  return saveProviderResponse(request, { id: "gemini", kind: "gemini", name: "Google Gemini" });
}

export async function DELETE() {
  return deleteProviderResponse("gemini");
}
