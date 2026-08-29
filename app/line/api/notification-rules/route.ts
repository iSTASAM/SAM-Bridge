import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import {
  createLineNotificationRule,
  listLineNotificationRules,
} from "@/lib/line-notification-rules";
import { lineLoginStatus } from "@/lib/line-logins";

export const dynamic = "force-dynamic";

async function authenticatedContext() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session || (await lineLoginStatus(session.lineUserId)) === "out") return null;
  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) return null;
  return { session, connection };
}

export async function GET() {
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rules = await listLineNotificationRules(context.session.lineUserId);
  return NextResponse.json({ ok: true, rules });
}

export async function POST(request: Request) {
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lineUuid = typeof body.lineUuid === "string" ? body.lineUuid.trim() : "";
  const statusUuid = typeof body.statusUuid === "string" ? body.statusUuid.trim() : "";
  if (!lineUuid || !statusUuid) {
    return NextResponse.json({ ok: false, error: "INVALID_RULE" }, { status: 400 });
  }

  const discovery = await discoverIxacsLines(connectionAsTarget(context.connection));
  const group = discovery.groups.find((item) => item.lines.some((line) => line.uuid === lineUuid));
  const line = group?.lines.find((item) => item.uuid === lineUuid);
  const status = (discovery.statusesByLine[lineUuid] ?? []).find((item) => item.uuid === statusUuid);
  if (!line || !status) {
    return NextResponse.json({ ok: false, error: "LINE_OR_STATUS_NOT_AVAILABLE" }, { status: 400 });
  }

  try {
    const rule = await createLineNotificationRule({
      lineUserId: context.session.lineUserId,
      connectionId: context.connection.id,
      lineUuid,
      lineName: line.name,
      groupName: group?.name ?? "",
      statusUuid,
      statusNameTh: status.nameTh,
      statusNameEn: status.nameEn,
      statusNameJa: status.nameJa,
      statusBackgroundColor: status.backgroundColor,
      durationMinutes: 0,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}
