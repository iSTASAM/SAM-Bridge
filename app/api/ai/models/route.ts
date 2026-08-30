import { NextResponse } from "next/server";
import { getAiDefault, listPublicAiProviders } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const [providers, selected] = await Promise.all([listPublicAiProviders(), getAiDefault()]);
  const options = providers
    .filter((provider) => provider.connected)
    .map((provider) => ({
      provider: provider.id,
      name: provider.name,
      model: selected?.providerId === provider.id ? selected.model : provider.model,
      isDefault: selected?.providerId === provider.id,
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
  return NextResponse.json({ options });
}
