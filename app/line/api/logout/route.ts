import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { expireLineSessionCookie, LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { unlinkUserRichMenu } from "@/lib/line-messaging";
import { markLineLoggedOut } from "@/lib/line-logins";

export const dynamic = "force-dynamic";

async function logout(request: Request, kind: "redirect" | "json") {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);

  if (session?.lineUserId) {
    try {
      await markLineLoggedOut(session.lineUserId);
    } catch (error) {
      console.warn("line login mapping logout failed:", error);
    }
    try {
      await unlinkUserRichMenu(session.lineUserId);
    } catch (error) {
      console.warn("rich menu unlink after logout failed:", error);
    }
  }

  if (kind === "json") {
    const response = NextResponse.json({ ok: true });
    expireLineSessionCookie(response);
    return response;
  }

  const redirectTo = new URL("/line/login", new URL(request.url).origin);
  redirectTo.searchParams.set("loggedOut", "1");
  const response = NextResponse.redirect(redirectTo, 303);
  expireLineSessionCookie(response);
  return response;
}

/** Full-page GET so LIFF applies Set-Cookie, then lands on login. */
export async function GET(request: Request) {
  return logout(request, "redirect");
}

export async function POST(request: Request) {
  return logout(request, "json");
}
