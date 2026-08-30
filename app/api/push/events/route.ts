import { NextRequest, NextResponse } from "next/server";
import { canAccessConnection, getRequestSession, sessionConnectionScope } from "@/lib/auth";
import { getConnection, listConnections } from "@/lib/ixacs-connections";
import {
  deletePushEvents,
  getIssuedKeys,
  getPushEvents,
  type PushEvent,
} from "@/lib/ixacs-store";
import { applyLiveStatus, getLiveLineStatusesByConnection } from "@/lib/push-live-status";

export const dynamic = "force-dynamic";

function lineKey(connectionId: string | null | undefined, lineUuid: string | null | undefined) {
  return `${connectionId ?? ""}:${lineUuid ?? ""}`;
}

function matchesSearch(event: PushEvent, search: string) {
  if (!search) return true;
  return [
    event.id,
    event.companyName,
    event.groupName, event.groupNameTh, event.groupNameEn, event.groupNameJa, event.groupUuid,
    event.lineName, event.lineNameTh, event.lineNameEn, event.lineNameJa, event.lineUuid,
    event.statusName, event.statusNameTh, event.statusNameEn, event.statusNameJa, event.statusUuid,
    event.productName, event.productUuid,
    event.error,
  ].some((value) => value?.toLowerCase().includes(search));
}

async function getConfiguredLineRows(input: {
  connectionId?: string | null;
  lineUuid?: string | null;
  statusUuid?: string | null;
  search?: string | null;
  offset: number;
  limit: number;
}) {
  const keys = await getIssuedKeys(input.connectionId);
  const configured = new Map<string, {
    connectionId: string;
    customerId: string | null;
    companyName: string | null;
    groupUuid: string | null;
    groupName: string | null;
    groupNameTh: string | null;
    groupNameEn: string | null;
    groupNameJa: string | null;
    lineUuid: string;
    lineName: string | null;
    lineNameTh: string | null;
    lineNameEn: string | null;
    lineNameJa: string | null;
  }>();

  await Promise.all(keys.map(async (key) => {
    const connectionId = key.company?.id ?? null;
    const lineUuid = key.line?.uuid ?? null;
    if (!connectionId || !lineUuid) return;
    const id = lineKey(connectionId, lineUuid);
    if (configured.has(id)) return;
    const connection = await getConnection(connectionId);
    configured.set(id, {
      connectionId,
      customerId: connection?.customerId || connection?.customers[0]?.id || null,
      companyName: key.company?.name ?? connection?.name ?? null,
      groupUuid: key.group?.uuid ?? null,
      groupName: key.group?.nameTh ?? key.group?.nameEn ?? null,
      groupNameTh: key.group?.nameTh ?? null,
      groupNameEn: key.group?.nameEn ?? null,
      groupNameJa: key.group?.nameJa ?? null,
      lineUuid,
      lineName: key.line?.nameTh ?? key.line?.nameEn ?? null,
      lineNameTh: key.line?.nameTh ?? null,
      lineNameEn: key.line?.nameEn ?? null,
      lineNameJa: key.line?.nameJa ?? null,
    });
  }));

  const latest = await getPushEvents({
    connectionId: input.connectionId,
    latestPerLine: true,
    limit: 2_000,
    offset: 0,
  });
  const latestByLine = new Map(
    latest.events
      .filter((event) => event.lineUuid)
      .map((event) => [lineKey(event.connectionId, event.lineUuid), event]),
  );

  const live = await getLiveLineStatusesByConnection(
    [...configured.values()].map((line) => ({ connectionId: line.connectionId, lineUuid: line.lineUuid })),
  );

  let rows = [...configured.values()].map((line) => {
    const event = latestByLine.get(lineKey(line.connectionId, line.lineUuid)) ?? null;
    const liveStatus = live.get(lineKey(line.connectionId, line.lineUuid)) ?? null;
    const base: PushEvent = {
      id: event?.id ?? `line:${line.connectionId}:${line.lineUuid}`,
      receivedAt: event?.receivedAt ?? liveStatus?.receivedAt ?? "",
      connectionId: line.connectionId,
      customerId: line.customerId,
      hasEvent: Boolean(event),
      companyName: line.companyName,
      groupUuid: line.groupUuid,
      groupName: line.groupName,
      groupNameTh: line.groupNameTh,
      groupNameEn: line.groupNameEn,
      groupNameJa: line.groupNameJa,
      lineUuid: line.lineUuid,
      lineName: line.lineName,
      lineNameTh: line.lineNameTh,
      lineNameEn: line.lineNameEn,
      lineNameJa: line.lineNameJa,
      statusUuid: null,
      statusName: null,
      productUuid: event?.productUuid ?? null,
      productName: event?.productName ?? null,
      accepted: event?.accepted ?? true,
      error: event?.error ?? null,
      payloadPreview: event?.payloadPreview ?? "",
    };
    return applyLiveStatus(base, liveStatus);
  });

  const search = input.search?.trim().toLowerCase() ?? "";
  rows = rows.filter((event) => {
    if (input.lineUuid && event.lineUuid !== input.lineUuid) return false;
    if (input.statusUuid && event.statusUuid !== input.statusUuid) return false;
    if (search && !matchesSearch(event, search)) return false;
    return true;
  });
  rows.sort((a, b) => (a.lineNameTh ?? a.lineName ?? "").localeCompare(b.lineNameTh ?? b.lineName ?? "", "th"));

  const lines = new Map<string, { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null }>();
  const statuses = new Map<string, { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null; bgColor: string | null }>();
  for (const event of rows) {
    if (event.lineUuid && !lines.has(event.lineUuid)) {
      lines.set(event.lineUuid, {
        uuid: event.lineUuid,
        name: event.lineName,
        nameTh: event.lineNameTh ?? event.lineName,
        nameEn: event.lineNameEn ?? event.lineName,
        nameJa: event.lineNameJa ?? event.lineName,
      });
    }
    if (event.statusUuid && !statuses.has(event.statusUuid)) {
      statuses.set(event.statusUuid, {
        uuid: event.statusUuid,
        name: event.statusName,
        nameTh: event.statusNameTh ?? event.statusName,
        nameEn: event.statusNameEn ?? event.statusName,
        nameJa: event.statusNameJa ?? event.statusName,
        bgColor: event.statusBgColor ?? null,
      });
    }
  }

  const offset = Math.max(0, input.offset);
  const limit = Math.min(200, Math.max(1, input.limit));
  return {
    total: rows.length,
    offset,
    limit,
    events: rows.slice(offset, offset + limit),
    lines: [...lines.values()].sort((a, b) => (a.nameTh ?? a.name ?? "").localeCompare(b.nameTh ?? b.name ?? "", "th")),
    statuses: [...statuses.values()].sort((a, b) => (a.nameTh ?? a.name ?? "").localeCompare(b.nameTh ?? b.name ?? "", "th")),
    configured: true,
  };
}

export async function GET(request: NextRequest) {
  const session = await getRequestSession();
  const scope = sessionConnectionScope(session);
  const query = request.nextUrl.searchParams;
  const requestedConnectionId = query.get("connectionId");
  if (requestedConnectionId && !canAccessConnection(session, requestedConnectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const connectionId = scope ?? requestedConnectionId;
  const latestPerLine = query.get("latestPerLine") === "1";
  const result = latestPerLine
    ? await getConfiguredLineRows({
        connectionId,
        lineUuid: query.get("lineUuid"),
        statusUuid: query.get("statusUuid"),
        search: query.get("search"),
        offset: Number(query.get("offset") ?? 0),
        limit: Number(query.get("limit") ?? 50),
      })
    : await getPushEvents({
        connectionId,
        lineUuid: query.get("lineUuid"),
        statusUuid: query.get("statusUuid"),
        status: query.get("status") === "accepted" || query.get("status") === "rejected"
          ? query.get("status") as "accepted" | "rejected"
          : null,
        search: query.get("search"),
        offset: Number(query.get("offset") ?? 0),
        limit: Number(query.get("limit") ?? 50),
        latestPerLine: false,
      });
  return NextResponse.json({
    ...result,
    companies: (await listConnections(scope)).connections.map(({ id, name }) => ({ id, name })),
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
  return NextResponse.json({ ok: true, deleted: await deletePushEvents(connectionId, lineUuid) });
}
