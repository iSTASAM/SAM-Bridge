import { NextResponse } from "next/server";
import { resetLineUserPassword } from "@/lib/line-users";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const user = resetLineUserPassword(id, typeof body.password === "string" ? body.password : "");
  return user ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
}
