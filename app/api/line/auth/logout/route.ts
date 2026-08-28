import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, lineSessionCookieOptions } from "@/lib/line-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LINE_AUTH_COOKIE, "", {
    ...lineSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
