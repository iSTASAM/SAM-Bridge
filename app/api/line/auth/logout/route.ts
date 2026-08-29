import { after } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  LINE_AUTH_COOKIE,
  readLineSessionToken,
} from "@/lib/line-auth";
import { unlinkUserRichMenu } from "@/lib/line-messaging";

function clearSessionCookie(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  // Expire with the same attributes used when setting the cookie.
  response.cookies.set(LINE_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.delete({
    name: LINE_AUTH_COOKIE,
    path: "/",
  });
}

async function logoutAndClear() {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);
  const lineUserId = session?.lineUserId;

  try {
    jar.delete(LINE_AUTH_COOKIE);
  } catch {
    // Some runtimes only allow clearing via the response Set-Cookie header.
  }

  // Always clear the session cookie first — do not block logout on Messaging API.
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  if (lineUserId) {
    after(() => {
      void unlinkUserRichMenu(lineUserId).catch((error) => {
        console.warn("rich menu unlink after logout failed:", error);
      });
    });
  }

  return response;
}

/** POST — used by fetch; clears cookie in Set-Cookie on the response. */
export async function POST() {
  return logoutAndClear();
}

/**
 * GET — preferred for LIFF/WebView logout: navigation applies Set-Cookie
 * before the next page loads (avoids bounce back to the dashboard).
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const session = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);
  const lineUserId = session?.lineUserId;

  try {
    jar.delete(LINE_AUTH_COOKIE);
  } catch {
    // Some runtimes only allow clearing via the response Set-Cookie header.
  }

  const url = new URL(request.url);
  const redirectTo = new URL("/line/login", url.origin);
  redirectTo.searchParams.set("loggedOut", "1");

  const response = NextResponse.redirect(redirectTo);
  clearSessionCookie(response);

  if (lineUserId) {
    after(() => {
      void unlinkUserRichMenu(lineUserId).catch((error) => {
        console.warn("rich menu unlink after logout failed:", error);
      });
    });
  }

  return response;
}
