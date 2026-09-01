import { NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionToken, getRequestSession, sessionCookieOptions } from "@/lib/auth";
import { changePassword, verifyCurrentPassword } from "@/lib/user-profile-credentials";
import { getProfileForSession, updateProfileForSession } from "@/lib/user-profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getProfileForSession(session));
}

export async function PATCH(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    displayName?: unknown;
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;

  try {
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : undefined;
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const passwordChanging = Boolean(newPassword);

    if (passwordChanging && session.role !== "admin") {
      return NextResponse.json({ error: "Password cannot be changed for this account" }, { status: 403 });
    }
    if (passwordChanging && !(await verifyCurrentPassword(session, currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    let nextSession = session;

    if (displayName !== undefined) {
      await updateProfileForSession(session, { displayName });
    }

    if (passwordChanging) {
      const result = await changePassword(session, newPassword);
      nextSession = { ...session, adminAccountId: result.adminAccountId };
      await updateProfileForSession(nextSession, { adminAccountId: result.adminAccountId });
      const token = await createSessionToken({
        role: nextSession.role,
        username: nextSession.username,
        adminAccountId: nextSession.adminAccountId,
        connectionId: nextSession.connectionId,
      });
      if (!token) return NextResponse.json({ error: "Could not refresh session" }, { status: 500 });
      const response = NextResponse.json(await getProfileForSession(nextSession));
      response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
      return response;
    }

    return NextResponse.json(await getProfileForSession(nextSession));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update profile";
    const status =
      message === "PASSWORD_USER_LOCKED" ? 403
        : message === "PASSWORD_SHORT" || message === "DISPLAY_NAME_REQUIRED" ? 400
          : 500;
    return NextResponse.json({ error: friendlyError(message) }, { status });
  }
}

function friendlyError(code: string) {
  switch (code) {
    case "PASSWORD_SHORT":
      return "Password must be at least 8 characters";
    case "DISPLAY_NAME_REQUIRED":
      return "Display name is required";
    case "PASSWORD_USER_LOCKED":
      return "Password cannot be changed for this account";
    default:
      return code;
  }
}
