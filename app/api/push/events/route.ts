import { NextRequest, NextResponse } from "next/server";
import { canAccessConnection, getRequestSession, sessionConnectionScope } from "@/lib/auth";
import { deletePushEvents, getPushEvents } from "@/lib/ixacs-store";
import { listConnections } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getRequestSession();
  const scope = sessionConnectionScope(session);
  const query = request.nextUrl.searchParams;
  const requestedConnectionId = query.get("connectionId");
  if (requestedConnectionId && !canAccessConnection(session, requestedConnectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const connectionId = scope ?? requestedConnectionId;
  const status = query.get("status");
  const result = getPushEvents({
    connectionId,
    lineUuid: query.get("lineUuid"),
    statusUuid: query.get("statusUuid"),
    status: status === "accepted" || status === "rejected" ? status : null,
    search: query.get("search"),
    offset: Number(query.get("offset") ?? 0),
    limit: Number(query.get("limit") ?? 50),
    latestPerLine: query.get("latestPerLine") === "1",
  });
  return NextResponse.json({
    ...result,
    companies: listConnections(scope).connections.map(({ id, name }) => ({ id, name })),
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestSession();
  const query = request.nextUrl.searchParams;
  const connectionId = query.get("connectionId") ?? "";
  const lineUuid = query.get("lineUuid") ?? "";
  if (!connectionId || !lineUuid) {
    return NextResponse.json({ error: "connectionId and lineUuid are required" }, { status: 400 });
  }
  if (!canAccessConnection(session, connectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, deleted: deletePushEvents(connectionId, lineUuid) });
}
