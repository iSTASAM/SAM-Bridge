import { NextResponse } from "next/server";
import { unlinkLineUser } from "@/lib/line-users";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return unlinkLineUser(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
