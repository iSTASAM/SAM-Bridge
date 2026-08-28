import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth";

export async function GET() {
  const session = await readSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    username: session.username,
    connectionId: session.connectionId ?? null,
  });
}
