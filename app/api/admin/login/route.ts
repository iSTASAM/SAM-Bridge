import { NextResponse } from "next/server";
import { AUTH_COOKIE, authConfigured, createSessionToken, credentialsMatch, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ ok: false, error: "AUTH_USER and AUTH_PASSWORD are not set" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await credentialsMatch(username, password))) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }
  const token = await createSessionToken({ role: "admin", username });
  if (!token) return NextResponse.json({ ok: false, error: "Could not create session" }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return response;
}
