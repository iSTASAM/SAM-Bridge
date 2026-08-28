import { NextResponse } from "next/server";
import { createSourceConfig, listSourceConfigs } from "@/lib/source-configs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configs: listSourceConfigs() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(createSourceConfig(body), { status: 201 });
}
