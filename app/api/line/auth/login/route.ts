import { NextResponse } from "next/server";
import { createLineSessionToken, LINE_AUTH_COOKIE, lineSessionCookieOptions } from "@/lib/line-auth";
import { authenticateSavedConnection } from "@/lib/ixacs-connections";
import { isLineMessagingUserId, linkLoggedInRichMenu } from "@/lib/line-messaging";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";
import { markLineLoggedIn } from "@/lib/line-logins";
import { lineWebPreviewEnabled } from "@/lib/line-web-preview";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    idToken?: unknown;
    lineUserId?: unknown;
    customerCompanyId?: unknown;
    loginId?: unknown;
    password?: unknown;
    inClient?: unknown;
    webPreview?: unknown;
  };

  const settings = await getLineWebhookSettings();
  const webPreview = body.webPreview === true && lineWebPreviewEnabled();

  if (!webPreview && (!settings?.lineLoginChannelId || !settings.liffId)) {
    return NextResponse.json({ error: "LINE_LOGIN_NOT_CONFIGURED" }, { status: 503 });
  }

  let lineUserId = "";

  if (webPreview) {
    // Browser UX preview: authenticate with iXacs connection credentials only.
    lineUserId = `web-preview:${String(body.loginId ?? "").trim().toLowerCase() || "anonymous"}`;
  } else {
    if (body.inClient !== true) {
      return NextResponse.json({ error: "LINE_CLIENT_REQUIRED" }, { status: 403 });
    }
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    const params = new URLSearchParams({
      id_token: idToken,
      client_id: settings!.lineLoginChannelId,
    });
    let verify: Response;
    try {
      verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return NextResponse.json({ error: "LINE_VERIFY_UNAVAILABLE" }, { status: 502 });
    }
    const identity = (await verify.json().catch(() => ({}))) as {
      sub?: string;
      name?: string;
    };
    if (!verify.ok || !identity.sub) {
      return NextResponse.json({ error: "INVALID_LINE_ID_TOKEN" }, { status: 401 });
    }
    lineUserId = identity.sub;
    const fromLiff = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
    // LIFF profile userId is the Messaging API / OA id used for rich menus.
    if (isLineMessagingUserId(fromLiff)) lineUserId = fromLiff;
  }

  try {
    const connection = await authenticateSavedConnection(
      String(body.customerCompanyId ?? ""),
      String(body.loginId ?? ""),
      String(body.password ?? ""),
    );
    if (!connection) throw new Error("INVALID_CREDENTIALS");
    const requestedCustomer = String(body.customerCompanyId ?? "").trim();
    const token = await createLineSessionToken({
      connectionId: connection.id,
      customerId: requestedCustomer || connection.customerId,
      loginId: connection.loginId,
      lineUserId,
    });
    if (!token) throw new Error("SESSION_NOT_CONFIGURED");

    try {
      await markLineLoggedIn({
        lineUserId,
        connectionId: connection.id,
        customerId: requestedCustomer || connection.customerId,
        loginId: connection.loginId,
      });
    } catch (error) {
      console.warn("line login mapping save failed:", error);
    }

    // Link Rich Menu 2 before returning so LINE shows it as soon as the user leaves LIFF.
    let richMenu: { ok: boolean; error?: string };
    try {
      richMenu = await linkLoggedInRichMenu(lineUserId);
      if (!richMenu.ok) {
        console.warn("rich menu link after login did not succeed:", richMenu);
      }
    } catch (error) {
      console.warn("rich menu link after login failed:", error);
      richMenu = { ok: false, error: "LINK_FAILED" };
    }

    const response = NextResponse.json({
      ok: true,
      destination: "/line/dashboard",
      richMenu: {
        ok: richMenu.ok,
        error: richMenu.ok ? null : richMenu.error,
      },
    });
    response.cookies.set(LINE_AUTH_COOKIE, token, lineSessionCookieOptions());
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "LOGIN_FAILED";
    return NextResponse.json({ error: code }, { status: code === "INVALID_CREDENTIALS" ? 401 : 403 });
  }
}
