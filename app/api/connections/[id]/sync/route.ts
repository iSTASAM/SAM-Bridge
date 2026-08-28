import { NextResponse } from "next/server";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  probeIxacs,
  summarizeMonitorJson,
} from "@/lib/ixacs-client";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import {
  getConnection,
  markConnectionResult,
  rememberConnectionLines,
} from "@/lib/ixacs-connections";
import { applyMonitorRows } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const connection = getConnection(id);
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { probe?: boolean };
  const target = connectionAsTarget(connection);

  if (!target.baseUrl) {
    return NextResponse.json(
      { ok: false, error: "Base URL is required" },
      { status: 400 },
    );
  }

  if (body.probe) {
    const result = await probeIxacs(target);
    markConnectionResult(id, result.ok, result.error);
    return NextResponse.json(
      {
        ok: result.ok,
        status: result.status,
        error: result.error ?? null,
      },
      { status: result.ok ? 200 : 502 },
    );
  }

  let lineUuids = connection.lineUuids;

  if (lineUuids.length === 0) {
    const discovery = await discoverIxacsLines(target);
    if (discovery.lineUuids.length > 0) {
      rememberConnectionLines(id, discovery.lineUuids);
      lineUuids = discovery.lineUuids;
    }
  }

  if (lineUuids.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "NEED_LINES",
        lineCount: 0,
        applied: 0,
        rows: [],
      },
      { status: 400 },
    );
  }
  const result = await getCtMonitorData(target, lineUuids);
  markConnectionResult(id, result.ok, result.error);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        error: result.error ?? "Could not read iXacs data",
        lineCount: 0,
        applied: 0,
        rows: [],
      },
      { status: 502 },
    );
  }

  const rows = summarizeMonitorJson(result.responseJson);
  rememberConnectionLines(
    id,
    rows.map((row) => row.uuid),
  );
  const applied = applyMonitorRows(rows);

  return NextResponse.json({
    ok: true,
    status: result.status,
    lineCount: rows.length,
    applied,
    rows,
  });
}
