import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { getConnection } from "@/lib/ixacs-connections";
import {
  deleteLineNotificationRule,
  getLineNotificationRule,
  updateLineNotificationRule,
} from "@/lib/line-notification-rules";
import { resolveLineNotificationTarget } from "@/lib/line-notification-target";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const session = await getRequestSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, ruleId } = await params;
  const current = await getLineNotificationRule(ruleId);
  if (!current || current.connectionId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lineUuid = typeof body.lineUuid === "string" ? body.lineUuid.trim() : "";
  const statusUuid = typeof body.statusUuid === "string" ? body.statusUuid.trim() : "";
  const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : undefined;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  try {
    let target: Awaited<ReturnType<typeof resolveLineNotificationTarget>> | undefined;
    if (lineUuid && statusUuid) {
      const connection = await getConnection(id);
      if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });
      target = await resolveLineNotificationTarget(connection, lineUuid, statusUuid);
      if (!target) return NextResponse.json({ error: "LINE_OR_STATUS_NOT_AVAILABLE" }, { status: 400 });
    }
    const rule = await updateLineNotificationRule(ruleId, current.lineUserId, {
      enabled,
      durationMinutes,
      ...target,
    });
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const session = await getRequestSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, ruleId } = await params;
  const current = await getLineNotificationRule(ruleId);
  if (!current || current.connectionId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const deleted = await deleteLineNotificationRule(ruleId, current.lineUserId);
  return NextResponse.json({ ok: deleted }, { status: deleted ? 200 : 404 });
}
