import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getShutOffHoursGraphData,
  summarizeShutOffHoursGraph,
  type StatusGunttTopic,
} from "@/lib/ixacs-client";
import {
  activateConnectionCustomer,
  resolveRequestedCustomerIds,
} from "@/lib/ixacs-activate-customer";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { getConnection, type IxacsConnection } from "@/lib/ixacs-connections";
import { acquireIxacsConnectionLock } from "@/lib/ixacs-request-lock";

export const dynamic = "force-dynamic";
type Query = {
  mode?: string;
  date?: string;
  from?: string;
  to?: string;
  month?: string;
  year?: string;
  customerIds?: unknown;
};
type LostTimePayload = Record<string, unknown>;

export type CachedLineResult = {
  expiresAt: number;
  topics: StatusGunttTopic[];
  minutesByTopic: Record<string, number>;
  countByTopic: Record<string, number>;
};

type LostTimeGlobals = typeof globalThis & {
  __ixacsLostTimeCache?: Map<string, { expiresAt: number; payload: LostTimePayload }>;
  __ixacsLostTimeLineCache?: Map<string, CachedLineResult>;
  __ixacsLostTimeLineCacheHydrated?: boolean;
};

const shared = globalThis as LostTimeGlobals;
const resultCache = shared.__ixacsLostTimeCache ??= new Map();
const lineResultCache = shared.__ixacsLostTimeLineCache ??= new Map();
const LINE_CACHE_FILE = path.join(process.cwd(), "data", "ixacs-lost-time-cache.json");
const LIVE_CACHE_MS = 15 * 60_000;
const HISTORICAL_CACHE_MS = 365 * 24 * 60 * 60_000;

function hydrateLineCache() {
  if (shared.__ixacsLostTimeLineCacheHydrated) return;
  shared.__ixacsLostTimeLineCacheHydrated = true;
  if (!existsSync(LINE_CACHE_FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(LINE_CACHE_FILE, "utf8")) as {
      entries?: Record<string, CachedLineResult>;
    };
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed.entries ?? {})) {
      if (
        entry
        && entry.expiresAt > now
        && Array.isArray(entry.topics)
        && entry.minutesByTopic
        && entry.countByTopic
      ) {
        lineResultCache.set(key, entry);
      }
    }
  } catch {
    // A damaged optional cache must never prevent live iXacs reads.
  }
}

export function getCachedLostTimeLine(connectionId: string, lineUuid: string, date: string): CachedLineResult | null {
  hydrateLineCache();
  const connection = getConnection(connectionId);
  if (!connection) return null;
  const prefix = `${connectionId}:${connection.baseUrl}:`;
  const suffix = `:${lineUuid}:${date}`;
  const now = Date.now();
  for (const [key, entry] of lineResultCache) {
    if (key.startsWith(prefix) && key.endsWith(suffix) && entry.expiresAt > now) return entry;
  }
  return null;
}

export function getCachedLostTimeTopics(connectionId: string): StatusGunttTopic[] {
  hydrateLineCache();
  const connection = getConnection(connectionId);
  if (!connection) return [];
  const prefix = `${connectionId}:${connection.baseUrl}:`;
  const topics = new Map<string, StatusGunttTopic>();
  const now = Date.now();
  for (const [key, entry] of lineResultCache) {
    if (!key.startsWith(prefix) || entry.expiresAt <= now) continue;
    for (const topic of entry.topics) if (!topics.has(topic.key)) topics.set(topic.key, topic);
  }
  return [...topics.values()];
}

function persistLineCache() {
  try {
    const now = Date.now();
    for (const [key, entry] of lineResultCache) {
      if (entry.expiresAt <= now) lineResultCache.delete(key);
    }
    mkdirSync(path.dirname(LINE_CACHE_FILE), { recursive: true });
    writeFileSync(
      LINE_CACHE_FILE,
      JSON.stringify({ entries: Object.fromEntries(lineResultCache) }),
      "utf8",
    );
  } catch {
    // Keep serving the live result when the optional disk cache is unavailable.
  }
}

function today() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function range(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || start > end) return [];
  const values: string[] = [];
  for (let cursor = start; cursor <= end && values.length <= 366; cursor = new Date(cursor.valueOf() + 86_400_000)) {
    values.push(cursor.toISOString().slice(0, 10));
  }
  return values;
}

function dates(query: Query) {
  if (query.mode === "range" && query.from && query.to) return range(query.from, query.to);
  if (query.mode === "month" && /^\d{4}-\d{2}$/.test(query.month ?? "")) {
    const [year, month] = query.month!.split("-").map(Number);
    const lastDay = String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0");
    return range(`${query.month}-01`, `${query.month}-${lastDay}`);
  }
  if (query.mode === "year" && /^\d{4}$/.test(query.year ?? "")) return range(`${query.year}-01-01`, `${query.year}-12-31`);
  return [/^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : today()];
}

async function loadLostTimeForConnection(
  id: string,
  connection: IxacsConnection,
  dateKeys: string[],
  bizDates: string[],
  companyLabel: string,
) {
  const targetConfig = connectionAsTarget(connection);
  const discovery = await discoverIxacsLines(targetConfig);
  if (!discovery.groups.length) {
    return {
      ok: false as const,
      error: discovery.error || "Could not load iXacs groups",
      topics: [] as StatusGunttTopic[],
      rows: [] as Array<Record<string, unknown>>,
      errors: [] as Array<{ productionLineUuid: string; date: string; status: number }>,
      cachedLineCount: 0,
      fetchedLineCount: 0,
      lineCount: 0,
      cacheChanged: false,
    };
  }

  const allowed = new Set(connection.lineUuids.length ? connection.lineUuids : discovery.lineUuids);
  const targets = discovery.groups.flatMap((group) => group.lines
    .filter((line) => allowed.has(line.uuid))
    .map((line) => ({ groupUuid: group.uuid, groupName: group.name, lineUuid: line.uuid, lineName: line.name })));
  const topics = new Map<string, StatusGunttTopic>();
  const rows: Array<Record<string, unknown>> = [];
  const errors: Array<{ productionLineUuid: string; date: string; status: number }> = [];
  let cachedLineCount = 0;
  let fetchedLineCount = 0;
  let cacheChanged = false;

  const realTime = dateKeys.length === 1 && dateKeys[0] === today();
  const cacheTtl = dateKeys.at(-1)! < today() ? HISTORICAL_CACHE_MS : LIVE_CACHE_MS;
  hydrateLineCache();

  for (const target of targets) {
    const minutesByTopic: Record<string, number> = {};
    const countByTopic: Record<string, number> = {};
    const lineCacheKey = `${id}:${connection.baseUrl}:${connection.customerId}:${target.groupUuid}:${target.lineUuid}:${dateKeys.join(",")}`;
    const cachedLine = lineResultCache.get(lineCacheKey);
    if (cachedLine && cachedLine.expiresAt > Date.now()) {
      cachedLineCount += 1;
      for (const topic of cachedLine.topics) if (!topics.has(topic.key)) topics.set(topic.key, topic);
      Object.assign(minutesByTopic, cachedLine.minutesByTopic);
      Object.assign(countByTopic, cachedLine.countByTopic);
    } else {
      fetchedLineCount += 1;
      const result = await getShutOffHoursGraphData(targetConfig, target.groupUuid, target.lineUuid, {
        bizDates,
        realTime,
      });
      if (!result.ok || !("responseJson" in result)) {
        errors.push({ productionLineUuid: target.lineUuid, date: `${dateKeys[0]}..${dateKeys.at(-1)}`, status: result.status });
      } else {
        const summary = summarizeShutOffHoursGraph(result.responseJson);
        for (const topic of summary.topics) if (!topics.has(topic.key)) topics.set(topic.key, topic);
        Object.assign(minutesByTopic, summary.minutesByTopic);
        Object.assign(countByTopic, summary.countByTopic);
        lineResultCache.set(lineCacheKey, {
          expiresAt: Date.now() + cacheTtl,
          topics: summary.topics,
          minutesByTopic: summary.minutesByTopic,
          countByTopic: summary.countByTopic,
        });
        cacheChanged = true;
      }
    }
    rows.push({
      companyId: connection.id,
      companyName: companyLabel,
      customerId: connection.customerId || null,
      productionGroupUuid: target.groupUuid,
      productionGroupName: target.groupName,
      productionLineUuid: target.lineUuid,
      productionLineName: target.lineName,
      minutesByTopic,
      countByTopic,
    });
  }

  return {
    ok: errors.length === 0,
    error: undefined as string | undefined,
    topics: [...topics.values()],
    rows,
    errors,
    cachedLineCount,
    fetchedLineCount,
    lineCount: targets.length,
    cacheChanged,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = performance.now();
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let connection = getConnection(id);
  if (!connection) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  let activeConnection: IxacsConnection = connection;

  const query = await request.json().catch(() => ({})) as Query;
  const dateKeys = dates(query).filter((date) => date <= today());
  if (!dateKeys.length || dateKeys.length > 366) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const bizDates = dateKeys.map((date) => date.split("-").reverse().join("/"));
  const customerIds = resolveRequestedCustomerIds(activeConnection, query.customerIds);
  const effectiveCustomerIds = customerIds.length > 0 ? customerIds : [activeConnection.customerId || ""];
  const connectionScope = `${activeConnection.baseUrl}:${effectiveCustomerIds.slice().sort().join("|")}`;
  const cacheKey = `${id}:${connectionScope}:${dateKeys.join(",")}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cached: true, elapsedMs: Math.round(performance.now() - startedAt) });
  }

  const releaseLock = await acquireIxacsConnectionLock(id);
  try {
  const cachedAfterWait = resultCache.get(cacheKey);
  if (cachedAfterWait && cachedAfterWait.expiresAt > Date.now()) {
    return NextResponse.json({ ...cachedAfterWait.payload, cached: true, elapsedMs: Math.round(performance.now() - startedAt) });
  }

  const topics = new Map<string, StatusGunttTopic>();
  const rows: Array<Record<string, unknown>> = [];
  const errors: Array<{ productionLineUuid: string; date: string; status: number }> = [];
  let cachedLineCount = 0;
  let fetchedLineCount = 0;
  let lineCount = 0;
  let cacheChanged = false;

  for (const customerId of effectiveCustomerIds) {
    if (activeConnection.customers.length > 0 || (customerId && activeConnection.customerId !== customerId)) {
      const activated = await activateConnectionCustomer(id, customerId, { rediscover: true });
      if (!activated.ok) {
        return NextResponse.json(
          { ok: false, error: activated.error, customerId, rows },
          { status: activated.status },
        );
      }
      activeConnection = activated.connection;
    } else {
      activeConnection = getConnection(id) ?? activeConnection;
    }

    const label =
      activeConnection.customers.find((item) => item.id === activeConnection.customerId)?.name ||
      activeConnection.customerId ||
      activeConnection.name;
    const result = await loadLostTimeForConnection(id, activeConnection, dateKeys, bizDates, label);
    if (!result.ok && result.error && rows.length === 0 && result.rows.length === 0) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    for (const topic of result.topics) if (!topics.has(topic.key)) topics.set(topic.key, topic);
    rows.push(...result.rows);
    errors.push(...result.errors);
    cachedLineCount += result.cachedLineCount;
    fetchedLineCount += result.fetchedLineCount;
    lineCount += result.lineCount;
    cacheChanged = cacheChanged || result.cacheChanged;
  }

  if (cacheChanged) persistLineCache();
  rows.sort((a, b) =>
    String(a.companyName).localeCompare(String(b.companyName)) ||
    String(a.productionLineName).localeCompare(String(b.productionLineName)),
  );

  const realTime = dateKeys.length === 1 && dateKeys[0] === today();
  const payload: LostTimePayload = {
    ok: errors.length === 0,
    source: "getShutOffHoursGraphData",
    companyId: activeConnection.id,
    customerIds: effectiveCustomerIds,
    dateFrom: dateKeys[0],
    dateTo: dateKeys.at(-1),
    dateCount: dateKeys.length,
    lineCount,
    failedRequestCount: errors.length,
    errors: errors.slice(0, 20),
    topics: [...topics.values()],
    rows,
    workerCount: 1,
    cachedLineCount,
    fetchedLineCount,
    elapsedMs: Math.round(performance.now() - startedAt),
    cached: false,
  };
  if (errors.length > 0) {
    const sessionRejected = errors.every((item) => item.status === 401 || item.status === 403);
    payload.error = sessionRejected
      ? "iXacs session expired or was rejected. Reconnect this company, then load Lost Time again."
      : `Could not load complete Lost Time data (${errors.length}/${lineCount || errors.length} lines failed)`;
    return NextResponse.json(payload, { status: 502 });
  }
  resultCache.set(cacheKey, {
    expiresAt: Date.now() + (realTime ? 15_000 : LIVE_CACHE_MS),
    payload,
  });
  return NextResponse.json(payload);
  } finally {
    releaseLock();
  }
}
