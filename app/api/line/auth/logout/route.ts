import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  LINE_AUTH_COOKIE,
  lineSessionCookieOptions,
  readLineSessionToken,
} from "@/lib/line-auth";
import { unlinkUserRichMenu } from "@/lib/line-messaging";

export async function POST() {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);

  if (session?.lineUserId) {
    try {
      await unlinkUserRichMenu(session.lineUserId);
    } catch (error) {
      console.warn("rich menu unlink after logout failed:", error);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LINE_AUTH_COOKIE, "", {
    ...lineSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
