import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { getConnection } from "@/lib/ixacs-connections";
import {
  deleteLineNotificationRule,
  updateLineNotificationRule,
} from "@/lib/line-notification-rules";
import { lineLoginStatus } from "@/lib/line-logins";
import { dispatchLineStatusChange } from "@/lib/line-notification-runner";
import { resolveLineNotificationTarget } from "@/lib/line-notification-target";

async function authenticatedContext() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session || (await lineLoginStatus(session.lineUserId)) === "out") return null;
  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) return null;
  return { session, connection };
}

export async function PATCH(request: Request, context: RouteContext<"/line/api/notification-rules/[id]">) {
  const auth = await authenticatedContext();
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lineUuid = typeof body.lineUuid === "string" ? body.lineUuid.trim() : "";
  const statusUuid = typeof body.statusUuid === "string" ? body.statusUuid.trim() : "";
  const currentStatusUuid =
    typeof body.currentStatusUuid === "string" ? body.currentStatusUuid.trim() : "";

  try {
    let target:
      | Awaited<ReturnType<typeof resolveLineNotificationTarget>>
      | undefined;

    if (lineUuid && statusUuid) {
      target = await resolveLineNotificationTarget(auth.connection, lineUuid, statusUuid);
      if (!target) {
        return NextResponse.json({ ok: false, error: "LINE_OR_STATUS_NOT_AVAILABLE" }, { status: 400 });
      }
    }

    const rule = await updateLineNotificationRule(id, auth.session.lineUserId, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      ...target,
    });
    if (!rule) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (target && currentStatusUuid) {
      try {
        await dispatchLineStatusChange(target.lineUuid, currentStatusUuid, new Date().toISOString(), auth.connection.id);
      } catch (error) {
        console.warn("LINE notification after updating rule failed:", error);
      }
    }
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/line/api/notification-rules/[id]">) {
  const auth = await authenticatedContext();
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deleteLineNotificationRule(id, auth.session.lineUserId);
  return NextResponse.json({ ok: deleted }, { status: deleted ? 200 : 404 });
}
