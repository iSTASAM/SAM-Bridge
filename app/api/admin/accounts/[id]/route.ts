import { NextResponse } from "next/server";
import { deleteAdminAccount, getPublicAdmin, updateAdminAccount } from "@/lib/admin-accounts";
import { getRequestSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function statusFor(error: string) {
  if (error === "ADMIN_USERNAME_TAKEN") return 409;
  if (error === "ADMIN_USERNAME_REQUIRED" || error === "ADMIN_PASSWORD_SHORT") return 400;
  if (error === "ADMIN_ENV_LOCKED") return 403;
  return 503;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  try {
    const account = await updateAdminAccount(id, {
      username: typeof body.username === "string" ? body.username : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
    });
    if (!account) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_ACCOUNTS_SAVE_FAILED";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === "env") return NextResponse.json({ error: "ADMIN_ENV_LOCKED" }, { status: 403 });
  const target = await getPublicAdmin(id);
  if (target && session.username.toLowerCase() === target.username.toLowerCase()) {
    return NextResponse.json({ error: "ADMIN_SELF_DELETE" }, { status: 403 });
  }
  try {
    const ok = await deleteAdminAccount(id);
    if (!ok) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_ACCOUNTS_DELETE_FAILED";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
