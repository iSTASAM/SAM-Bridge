import { NextResponse } from "next/server";
import { verifyAdminAccount } from "@/lib/admin-accounts";
import { AUTH_COOKIE, createSessionToken, credentialsMatch, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  if (!process.env.AUTH_PASSWORD) {
    return NextResponse.json({ ok: false, error: "AUTH_PASSWORD is not set" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const envOk = await credentialsMatch(username, password);
  const stored = envOk ? null : await verifyAdminAccount(username, password);
  if (!envOk && !stored) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }
  const token = await createSessionToken({ role: "admin", username: stored?.username || username });
  if (!token) return NextResponse.json({ ok: false, error: "Could not create session" }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return response;
}
