import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  getCtMonitorDetailData,
  prepareCtMonitorHistory,
  summarizeMonitorJson,
  summarizeMonitorDetailJson,
} from "@/lib/ixacs-client";
import {
  activateConnectionCustomer,
  resolveRequestedCustomerIds,
} from "@/lib/ixacs-activate-customer";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import {
  getConnection,
  markConnectionResult,
  replaceConnectionLines,
  rememberConnectionLines,
  type IxacsConnection,
} from "@/lib/ixacs-connections";
import { acquireIxacsConnectionLock } from "@/lib/ixacs-request-lock";

export const dynamic = "force-dynamic";

type Discovery = Awaited<ReturnType<typeof discoverIxacsLines>>;
type DataPayload = Record<string, unknown>;
type DateQuery = {
  mode?: "day" | "range" | "month" | "year";
  date?: unknown;
  from?: unknown;
  to?: unknown;
  month?: unknown;
  year?: unknown;
  fresh?: unknown;
  customerIds?: unknown;
};
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
type DataGlobals = typeof globalThis & {
  __ixacsDataDiscoveryCache?: Map<string, { expiresAt: number; value: Discovery }>;
  __ixacsProductionDataCache?: Map<string, { expiresAt: number; payload: DataPayload }>;
};
const shared = globalThis as DataGlobals;
const discoveryCache: Map<string, { expiresAt: number; value: Discovery }> =
  shared.__ixacsDataDiscoveryCache ??= new Map<string, { expiresAt: number; value: Discovery }>();
const dataCache: Map<string, { expiresAt: number; payload: DataPayload }> =
  shared.__ixacsProductionDataCache ??= new Map<string, { expiresAt: number; payload: DataPayload }>();

async function getDiscovery(
  connectionId: string,
  customerId: string,
  target: Parameters<typeof discoverIxacsLines>[0],
) {
  const cacheKey = `${connectionId}:${customerId || "_"}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await discoverIxacsLines(target);
  if (value.groups.length > 0 || value.lineUuids.length > 0) {
    discoveryCache.set(cacheKey, {
      expiresAt: Date.now() + DISCOVERY_TTL_MS,
      value,
    });
  }
  return value;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function datesBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || start > end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end && dates.length <= 3660; cursor = new Date(cursor.valueOf() + 86_400_000)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function resolveDateKeys(query: DateQuery, today: string) {
  if (query.mode === "range") {
    return isDateKey(query.from) && isDateKey(query.to)
      ? datesBetween(query.from, query.to)
      : [];
  }
  if (query.mode === "month") {
    if (typeof query.month !== "string" || !/^\d{4}-\d{2}$/.test(query.month)) return [];
    const [year, month] = query.month.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return datesBetween(`${query.month}-01`, `${query.month}-${String(last).padStart(2, "0")}`);
  }
  if (query.mode === "year") {
    if (typeof query.year !== "string" || !/^\d{4}$/.test(query.year)) return [];
    return datesBetween(`${query.year}-01-01`, `${query.year}-12-31`);
  }
  return [isDateKey(query.date) ? query.date : today];
}

function customerLabel(connection: IxacsConnection, customerId: string) {
  return (
    connection.customers.find((item) => item.id === customerId)?.name ||
    customerId ||
    connection.name
  );
}

async function fetchRowsForActiveSession(args: {
  id: string;
  connection: IxacsConnection;
  customerId: string;
  requestedDates: string[];
  bizDates: string[];
  historical: boolean;
  today: string;
}) {
  const { id, connection, customerId, requestedDates, bizDates, historical, today } = args;
  const target = connectionAsTarget(connection);
  const discovered = await getDiscovery(id, customerId, target);
  let lineUuids =
    discovered.lineUuids.length > 0 ? discovered.lineUuids : connection.lineUuids;
  if (discovered.lineUuids.length > 0) {
    await replaceConnectionLines(id, discovered.lineUuids);
  }

  if (lineUuids.length === 0) {
    return {
      ok: false as const,
      status: 400,
      payload: { ok: false, error: "NEED_LINES", lineCount: 0, rows: [] },
    };
  }

  let historicalReferer: string | undefined;
  if (historical) {
    const prepared = await prepareCtMonitorHistory(
      target,
      discovered.groups.map((group) => group.uuid).filter(Boolean),
      bizDates[0],
    );
    if (!prepared.ok) {
      return {
        ok: false as const,
        status: 502,
        payload: {
          ok: false,
          error: `Could not open iXacs historical monitor (HTTP ${prepared.status})`,
          rows: [],
        },
      };
    }
    historicalReferer = prepared.referer;
  }

  const queryOptions = {
    bizDates,
    realTime: !historical,
    referer: historicalReferer,
  };
  const [discovery, [monitorResult, detailResult]] = await Promise.all([
    Promise.resolve(discovered),
    Promise.all([
      getCtMonitorData(target, lineUuids, queryOptions),
      getCtMonitorDetailData(target, lineUuids, queryOptions),
    ]),
  ]);
  const resultsOk = monitorResult.ok && detailResult.ok;
  const resultError = monitorResult.error ?? detailResult.error;
  await markConnectionResult(id, resultsOk, resultError);
  if (!resultsOk) {
    return {
      ok: false as const,
      status: 502,
      payload: {
        ok: false,
        status: monitorResult.ok ? detailResult.status : monitorResult.status,
        error: resultError ?? "Could not read iXacs realtime data",
        endpoints: {
          monitor: { ok: monitorResult.ok, status: monitorResult.status },
          detail: { ok: detailResult.ok, status: detailResult.status },
        },
        lineCount: 0,
        rows: [],
      },
    };
  }

  const lineMetadata = new Map(
    discovery.groups.flatMap((group) =>
      group.lines.map((line) => [
        line.uuid,
        {
          productionGroupUuid: group.uuid || null,
          productionGroupName: group.name || null,
          productionLineName: line.name || null,
        },
      ] as const),
    ),
  );
  const statusMetadata = new Map(
    discovery.statuses.map((status) => [status.uuid, status] as const),
  );
  const monitorRows = summarizeMonitorJson(monitorResult.responseJson);
  const monitorByLine = new Map(monitorRows.map((row) => [row.uuid, row] as const));
  const receivedAt = new Date().toISOString();
  const roundId = randomUUID();
  const detailRows = summarizeMonitorDetailJson(detailResult.responseJson);
  const detailByLine = new Map(detailRows.map((row) => [row.uuid, row] as const));
  const returnedLineUuids = new Set([
    ...monitorRows.map((row) => row.uuid),
    ...detailRows.map((row) => row.uuid),
  ]);
  const label = customerLabel(connection, customerId);
  const rows = [...returnedLineUuids].map((uuid) => {
    const monitor = monitorByLine.get(uuid);
    const detail = detailByLine.get(uuid);
    const statusUuid = monitor?.statusUuid ?? detail?.statusUuid ?? null;
    return {
      ...(detail ?? summarizeMonitorDetailJson({ [uuid]: {} })[0]),
      uuid,
      currentCt: monitor?.cycleTime ?? null,
      bizTime: monitor?.bizTime ?? detail?.bizTime ?? null,
      receivedAt,
      roundId,
      receivedFromMonitor: monitorByLine.has(uuid),
      receivedFromDetail: detailByLine.has(uuid),
      customerId: customerId || null,
      customerName: label,
      ...(lineMetadata.get(uuid) ?? {}),
      ...(statusUuid
        ? {
            statusUuid,
            statusName: statusMetadata.get(statusUuid)?.name ?? null,
            statusBackgroundColor: statusMetadata.get(statusUuid)?.backgroundColor ?? null,
            statusTextColor: statusMetadata.get(statusUuid)?.textColor ?? null,
          }
        : {}),
    };
  });
  await rememberConnectionLines(id, rows.map((row) => row.uuid));
  const monitorLineUuids = new Set(monitorRows.map((row) => row.uuid));
  const detailLineUuids = new Set(detailRows.map((row) => row.uuid));
  const missingMonitorLineUuids = lineUuids.filter((uuid) => !monitorLineUuids.has(uuid));
  const missingDetailLineUuids = lineUuids.filter((uuid) => !detailLineUuids.has(uuid));
  return {
    ok: true as const,
    rows,
    discovery,
    payloadExtras: {
      mode: historical ? "historical" : "realtime",
      date: requestedDates[0],
      dateFrom: requestedDates[0],
      dateTo: requestedDates.at(-1),
      dateCount: requestedDates.length,
      roundId,
      receivedAt,
      status: monitorResult.status,
      coverage: {
        requested: lineUuids.length,
        complete:
          missingMonitorLineUuids.length === 0 && missingDetailLineUuids.length === 0,
        monitor: {
          returned: monitorRows.length,
          complete: missingMonitorLineUuids.length === 0,
          missingLineUuids: missingMonitorLineUuids,
        },
        detail: {
          returned: detailRows.length,
          complete: missingDetailLineUuids.length === 0,
          missingLineUuids: missingDetailLineUuids,
        },
      },
      groups: discovery.groups,
      statuses: discovery.statuses,
      today,
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let connection = await getConnection(id);
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!connection.baseUrl) {
    return NextResponse.json({ ok: false, error: "Base URL is required" }, { status: 400 });
  }

  const requestBody = (await request.json().catch(() => ({}))) as DateQuery;
  const todayParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const todayMap = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const today = `${todayMap.year}-${todayMap.month}-${todayMap.day}`;
  const requestedDates = resolveDateKeys(requestBody, today).filter((date) => date <= today);
  if (requestedDates.length === 0 || requestedDates.length > 3660) {
    return NextResponse.json({ ok: false, error: "Invalid or excessive date range" }, { status: 400 });
  }
  const historical = requestedDates.length !== 1 || requestedDates[0] !== today;
  const bypassCache = requestBody.fresh === true || requestBody.fresh === "1" || requestBody.fresh === 1;
  const bizDates = requestedDates.map((date) => date.split("-").reverse().join("/"));
  const customerIds = resolveRequestedCustomerIds(connection, requestBody.customerIds);
  if (customerIds.length === 0 && connection.customers.length > 0) {
    return NextResponse.json({ ok: false, error: "CUSTOMER_REQUIRED", rows: [] }, { status: 400 });
  }
  const effectiveCustomerIds = customerIds.length > 0 ? customerIds : [connection.customerId || ""];
  const cacheKey = `${id}:${effectiveCustomerIds.slice().sort().join("|") || "_"}:${requestedDates.join(",")}`;
  const cached = dataCache.get(cacheKey);
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const releaseLock = await acquireIxacsConnectionLock(id);
  try {
    const cachedAfterWait = dataCache.get(cacheKey);
    if (!bypassCache && cachedAfterWait && cachedAfterWait.expiresAt > Date.now()) {
      return NextResponse.json({ ...cachedAfterWait.payload, cached: true });
    }

    const allRows: Record<string, unknown>[] = [];
    let lastExtras: Record<string, unknown> | null = null;
    let lastDiscovery: Discovery | null = null;

    for (const customerId of effectiveCustomerIds) {
      if (connection.customers.length > 0 || (customerId && connection.customerId !== customerId)) {
        const activated = await activateConnectionCustomer(id, customerId, {
          rediscover: true,
        });
        if (!activated.ok) {
          return NextResponse.json(
            { ok: false, error: activated.error, customerId, rows: allRows },
            { status: activated.status },
          );
        }
        connection = activated.connection;
      } else {
        connection = await getConnection(id) ?? connection;
      }

      const result = await fetchRowsForActiveSession({
        id,
        connection,
        customerId: connection.customerId || customerId,
        requestedDates,
        bizDates,
        historical,
        today,
      });
      if (!result.ok) {
        if (allRows.length === 0) {
          return NextResponse.json(result.payload, { status: result.status });
        }
        continue;
      }
      allRows.push(...result.rows);
      lastExtras = result.payloadExtras;
      lastDiscovery = result.discovery;
    }

    if (allRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "NEED_LINES", lineCount: 0, rows: [] },
        { status: 400 },
      );
    }

    const payload: DataPayload = {
      ok: true,
      ...(lastExtras ?? {}),
      customerIds: effectiveCustomerIds,
      lineCount: allRows.length,
      groups: lastDiscovery?.groups ?? [],
      statuses: lastDiscovery?.statuses ?? [],
      rows: allRows,
      cached: false,
    };
    dataCache.set(cacheKey, {
      expiresAt: Date.now() + (historical ? 5 * 60_000 : 5_000),
      payload,
    });
    return NextResponse.json(payload);
  } finally {
    releaseLock();
  }
}
