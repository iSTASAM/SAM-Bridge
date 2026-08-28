import { NextResponse } from "next/server";
import { createLineSessionToken, LINE_AUTH_COOKIE, lineSessionCookieOptions } from "@/lib/line-auth";
import { authenticateSavedConnection } from "@/lib/ixacs-connections";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { idToken?: unknown; customerCompanyId?: unknown; loginId?: unknown; password?: unknown; inClient?: unknown };
  const settings = await getLineWebhookSettings();
  if (!settings?.lineLoginChannelId || !settings.liffId) return NextResponse.json({ error: "LINE_LOGIN_NOT_CONFIGURED" }, { status: 503 });
  if (body.inClient !== true) return NextResponse.json({ error: "LINE_CLIENT_REQUIRED" }, { status: 403 });
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  const params = new URLSearchParams({ id_token: idToken, client_id: settings.lineLoginChannelId });
  let verify: Response;
  try { verify = await fetch("https://api.line.me/oauth2/v2.1/verify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store", signal: AbortSignal.timeout(10_000) }); }
  catch { return NextResponse.json({ error: "LINE_VERIFY_UNAVAILABLE" }, { status: 502 }); }
  const identity = (await verify.json().catch(() => ({}))) as { sub?: string; name?: string; error_description?: string };
  if (!verify.ok || !identity.sub) return NextResponse.json({ error: "INVALID_LINE_ID_TOKEN" }, { status: 401 });
  try {
    const connection = await authenticateSavedConnection(String(body.customerCompanyId ?? ""), String(body.loginId ?? ""), String(body.password ?? ""));
    if (!connection) throw new Error("INVALID_CREDENTIALS");
    const requestedCustomer = String(body.customerCompanyId ?? "").trim();
    const token = await createLineSessionToken({ connectionId: connection.id, customerId: requestedCustomer || connection.customerId, loginId: connection.loginId, lineUserId: identity.sub });
    if (!token) throw new Error("SESSION_NOT_CONFIGURED");
    const response = NextResponse.json({ ok: true, destination: "/line/dashboard" }); response.cookies.set(LINE_AUTH_COOKIE, token, lineSessionCookieOptions()); return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "LOGIN_FAILED";
    return NextResponse.json({ error: code }, { status: code === "INVALID_CREDENTIALS" ? 401 : 403 });
  }
}
