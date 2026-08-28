import { NextResponse } from "next/server";
import { deleteLineUser, publicLineUser, updateLineUser } from "@/lib/line-users";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json().catch(() => ({})); const user = updateLineUser(id, body);
  return user ? NextResponse.json({ user: publicLineUser(user) }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return deleteLineUser(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
