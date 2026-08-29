import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { connectionAsTarget, discoverIxacsLineStatuses } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import { lineLoginStatus } from "@/lib/line-logins";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session || (await lineLoginStatus(session.lineUserId)) === "out") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const lineUuid = url.searchParams.get("lineUuid")?.trim() ?? "";
  const groupUuid = url.searchParams.get("groupUuid")?.trim() ?? "";
  if (!lineUuid || !groupUuid) {
    return NextResponse.json({ ok: false, error: "LINE_REQUIRED", statuses: [] }, { status: 400 });
  }

  const statuses = await discoverIxacsLineStatuses(connectionAsTarget(connection), groupUuid, lineUuid);
  return NextResponse.json({ ok: true, lineUuid, statuses });
}
