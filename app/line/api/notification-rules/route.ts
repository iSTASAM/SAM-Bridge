import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import {
  createLineNotificationRule,
  listLineNotificationRules,
} from "@/lib/line-notification-rules";
import { lineLoginStatus, markLineLoggedIn } from "@/lib/line-logins";
import { dispatchLineStatusChange } from "@/lib/line-notification-runner";
import { getLineChannelAccessToken, isLineMessagingUserId } from "@/lib/line-messaging";

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
  const token = await getLineChannelAccessToken();
  return NextResponse.json({
    ok: true,
    rules,
    messagingReady: isLineMessagingUserId(context.session.lineUserId) && Boolean(token),
    previewSession: !isLineMessagingUserId(context.session.lineUserId),
  });
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

  const currentStatusUuid =
    typeof body.currentStatusUuid === "string" ? body.currentStatusUuid.trim() : "";

  if (!isLineMessagingUserId(context.session.lineUserId)) {
    return NextResponse.json({ ok: false, error: "LINE_CLIENT_REQUIRED" }, { status: 400 });
  }
  if (!(await getLineChannelAccessToken())) {
    return NextResponse.json({ ok: false, error: "NO_CHANNEL_ACCESS_TOKEN" }, { status: 503 });
  }

  try {
    await markLineLoggedIn({
      lineUserId: context.session.lineUserId,
      connectionId: context.connection.id,
      customerId: context.session.customerId,
      loginId: context.session.loginId,
    });
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
    if (currentStatusUuid) {
      try {
        await dispatchLineStatusChange(lineUuid, currentStatusUuid, new Date().toISOString(), context.connection.id);
      } catch (error) {
        console.warn("LINE notification after saving rule failed:", error);
      }
    }
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
