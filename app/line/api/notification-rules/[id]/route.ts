import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import {
  deleteLineNotificationRule,
  updateLineNotificationRule,
} from "@/lib/line-notification-rules";
import { lineLoginStatus } from "@/lib/line-logins";

async function authenticatedLineUserId() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session || (await lineLoginStatus(session.lineUserId)) === "out") return null;
  return session.lineUserId;
}

export async function PATCH(request: Request, context: RouteContext<"/line/api/notification-rules/[id]">) {
  const lineUserId = await authenticatedLineUserId();
  if (!lineUserId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const rule = await updateLineNotificationRule(id, lineUserId, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    });
    if (!rule) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/line/api/notification-rules/[id]">) {
  const lineUserId = await authenticatedLineUserId();
  if (!lineUserId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deleteLineNotificationRule(id, lineUserId);
  return NextResponse.json({ ok: deleted }, { status: deleted ? 200 : 404 });
}
