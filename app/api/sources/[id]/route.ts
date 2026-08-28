import { NextResponse } from "next/server";
import {
  deleteSourceConfig,
  getSourceConfig,
  updateSourceConfig,
} from "@/lib/source-configs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = getSourceConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(config);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const config = updateSourceConfig(id, body);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(config);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!deleteSourceConfig(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
