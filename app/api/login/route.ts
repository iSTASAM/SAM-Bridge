import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  createSessionToken,
  safeCredentialsMatch,
  sessionCookieOptions,
} from "@/lib/auth";
import { findConnectionCredentials } from "@/lib/ixacs-connections";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    customerId?: unknown;
    loginId?: unknown;
    password?: unknown;
  } | null;

  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  const loginId = typeof body?.loginId === "string" ? body.loginId.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const candidates = findConnectionCredentials(customerId, loginId);
  const connection = (await Promise.all(candidates.map(async (candidate) =>
    (await safeCredentialsMatch(
      `${customerId}\u0000${loginId}`,
      password,
      `${candidate.customerId}\u0000${candidate.loginId}`,
      candidate.password,
    )) ? candidate : null,
  ))).find((candidate) => candidate !== null);

  if (!connection) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({ role: "user", username: loginId, connectionId: connection.id });
  if (!token) {
    return NextResponse.json({ ok: false, error: "Could not create session" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return response;
}
