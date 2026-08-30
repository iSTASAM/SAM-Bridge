import { NextResponse } from "next/server";
import { createAdminAccount, listPublicAdmins } from "@/lib/admin-accounts";
import { getRequestSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function statusFor(error: string) {
  if (error === "ADMIN_USERNAME_TAKEN") return 409;
  if (error === "ADMIN_USERNAME_REQUIRED" || error === "ADMIN_PASSWORD_SHORT") return 400;
  if (error === "ADMIN_ENV_LOCKED") return 403;
  return 503;
}

export async function GET() {
  const session = await getRequestSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ accounts: await listPublicAdmins() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_ACCOUNTS_LOAD_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  try {
    return NextResponse.json({ account: await createAdminAccount(username, password) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADMIN_ACCOUNTS_SAVE_FAILED";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
