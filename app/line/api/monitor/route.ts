import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { getConnection } from "@/lib/ixacs-connections";
import {
  connectionAsTarget,
  getCtMonitorData,
  summarizeMonitorJson,
} from "@/lib/ixacs-client";
import { dispatchLineStatusSnapshots } from "@/lib/line-notification-runner";

export const dynamic = "force-dynamic";

/**
 * Lightweight realtime snapshot for the LINE portal board.
 * Only hits iXacs ctMonitor — no catalog rediscovery or per-line board reads.
 */
export async function GET() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const lineUuids = connection.lineUuids;
  if (lineUuids.length === 0) {
    return NextResponse.json({ ok: true, lines: [], receivedAt: new Date().toISOString() });
  }

  const monitor = await getCtMonitorData(connectionAsTarget(connection), lineUuids, { realTime: true });
  if (!monitor.ok) {
    return NextResponse.json(
      { ok: false, error: monitor.error ?? "MONITOR_FAILED", lines: [] },
      { status: 502 },
    );
  }

  const receivedAt = new Date().toISOString();
  const lines = summarizeMonitorJson(monitor.responseJson).map((row) => ({
    uuid: row.uuid,
    statusUuid: row.statusUuid,
  }));

  after(() => {
    void dispatchLineStatusSnapshots(
      lines.map((line) => ({ lineUuid: line.uuid, statusUuid: line.statusUuid })),
      receivedAt,
      connection.id,
    ).catch((error) => {
      console.warn("LINE notification from portal monitor failed:", error);
    });
  });

  return NextResponse.json({
    ok: true,
    lines,
    receivedAt,
  });
}
