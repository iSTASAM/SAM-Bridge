import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { getConnection, rememberConnectionLines } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const connection = await getConnection(id);
  if (!connection) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const discovery = await discoverIxacsLines(connectionAsTarget(connection));
  if (!discovery.ok && discovery.groups.length === 0) {
    return NextResponse.json(
      { error: discovery.error ?? "Could not load groups and lines" },
      { status: 502 },
    );
  }
  if (discovery.lineUuids.length > 0) await rememberConnectionLines(id, discovery.lineUuids);
  return NextResponse.json({ groups: discovery.groups });
}
