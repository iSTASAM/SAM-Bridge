import { after } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { unlinkUserRichMenu } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";

/**
 * Logout under /line/* so LIFF stays on the LINE portal origin/path tree.
 * GET navigates here from the portal; clears cookie then 303 → login.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);

  const redirectTo = new URL("/line/login", new URL(request.url).origin);
  redirectTo.searchParams.set("loggedOut", "1");

  const response = NextResponse.redirect(redirectTo, 303);
  response.cookies.set(LINE_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  if (session?.lineUserId) {
    after(() => {
      void unlinkUserRichMenu(session.lineUserId).catch((error) => {
        console.warn("rich menu unlink after logout failed:", error);
      });
    });
  }

  return response;
}

export async function POST() {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LINE_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  if (session?.lineUserId) {
    after(() => {
      void unlinkUserRichMenu(session.lineUserId).catch((error) => {
        console.warn("rich menu unlink after logout failed:", error);
      });
    });
  }

  return response;
}
