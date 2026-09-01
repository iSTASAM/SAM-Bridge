import { timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getExportConfig } from "@/lib/export-configs";
import { POST as readProduction } from "@/app/api/connections/[id]/data/route";
import { getCachedLostTimeLine, getCachedLostTimeTopics, POST as readLostTime } from "@/app/api/connections/[id]/lost-time/route";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  getCtMonitorDetailData,
  prepareCtMonitorHistory,
  summarizeMonitorDetailJson,
  summarizeMonitorJson,
} from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import { acquireIxacsConnectionLock } from "@/lib/ixacs-request-lock";
import {
  readExcelExportSnapshot,
  writeExcelExportSnapshot,
  type ExcelExportSnapshotPayload,
} from "@/lib/excel-export-snapshot";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type ProductionBody = Awaited<ReturnType<typeof payload>>;
type DailyCacheEntry = { expiresAt: number; body: ProductionBody };
type ExportGlobals = typeof globalThis & {
  __ixacsExcelDailyCache?: Map<string, DailyCacheEntry>;
  __ixacsLostTimeWarmPending?: Map<string, Set<string>>;
  __ixacsLostTimeWarmRunning?: Set<string>;
  __ixacsLostTimeWarmTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __ixacsExcelDailyCacheHydrated?: boolean;
  __ixacsLiveLostTimePriority?: Set<string>;
  __ixacsLostTimeWarmVersion?: number;
};
const exportShared = globalThis as ExportGlobals;
const excelDailyCache = exportShared.__ixacsExcelDailyCache ??= new Map<string, DailyCacheEntry>();
const lostTimeWarmPending = exportShared.__ixacsLostTimeWarmPending ??= new Map<string, Set<string>>();
const lostTimeWarmRunning = exportShared.__ixacsLostTimeWarmRunning ??= new Set<string>();
const lostTimeWarmTimers = exportShared.__ixacsLostTimeWarmTimers ??= new Map<string, ReturnType<typeof setTimeout>>();
const liveLostTimePriority = exportShared.__ixacsLiveLostTimePriority ??= new Set<string>();
if (exportShared.__ixacsLostTimeWarmVersion !== 2) {
  for (const timer of lostTimeWarmTimers.values()) clearTimeout(timer);
  for (const pending of lostTimeWarmPending.values()) pending.clear();
  lostTimeWarmTimers.clear();
  lostTimeWarmPending.clear();
  lostTimeWarmRunning.clear();
  exportShared.__ixacsLostTimeWarmVersion = 2;
}
const EXCEL_HISTORY_CONCURRENCY = 12;
const EXCEL_LOST_TIME_CONCURRENCY = 4;
const EXCEL_PRODUCTION_FIELD_COUNT = 13;
const EXCEL_DAILY_CACHE_FILE = path.join(process.cwd(), "data", "ixacs-excel-production-cache.json");

function hydrateExcelDailyCache() {
  if (exportShared.__ixacsExcelDailyCacheHydrated) return;
  exportShared.__ixacsExcelDailyCacheHydrated = true;
  if (!existsSync(EXCEL_DAILY_CACHE_FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(EXCEL_DAILY_CACHE_FILE, "utf8")) as { entries?: Record<string, DailyCacheEntry> };
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed.entries ?? {})) {
      if (entry?.expiresAt > now && entry.body && typeof entry.body === "object") excelDailyCache.set(key, entry);
    }
  } catch {
    // The disk cache is optional; a damaged file falls back to a live read.
  }
}

function persistExcelDailyCache() {
  try {
    const now = Date.now();
    for (const [key, entry] of excelDailyCache) if (entry.expiresAt <= now) excelDailyCache.delete(key);
    mkdirSync(path.dirname(EXCEL_DAILY_CACHE_FILE), { recursive: true });
    writeFileSync(EXCEL_DAILY_CACHE_FILE, JSON.stringify({ entries: Object.fromEntries(excelDailyCache) }), "utf8");
  } catch {
    // Keep returning the live result if the optional disk cache cannot persist.
  }
}

function authorized(request: Request, expected: string) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function bangkokToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateRange(historyDays: number, requestedFrom: string | null, requestedTo: string | null, defaultDays = historyDays) {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date(`${bangkokToday()}T00:00:00Z`);
  const to = requestedTo && valid.test(requestedTo) ? new Date(`${requestedTo}T00:00:00Z`) : today;
  const from = requestedFrom && valid.test(requestedFrom)
    ? new Date(`${requestedFrom}T00:00:00Z`)
    : new Date(to.valueOf() - (defaultDays - 1) * 86_400_000);
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || from > to) return null;
  const days = Math.floor((to.valueOf() - from.valueOf()) / 86_400_000) + 1;
  if (days > 366) return null;
  return { from: isoDate(from), to: isoDate(to), days };
}

function flat(row: Row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    value !== null && typeof value === "object" ? JSON.stringify(value) : value,
  ]));
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(typeof value === "string" ? value.replaceAll(",", "").trim() : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inScope(config: Awaited<ReturnType<typeof getExportConfig>>, row: Row) {
  if (!config) return false;
  const lineId = String(row.productionLineUuid ?? row.uuid ?? "");
  const groupId = String(row.productionGroupUuid ?? "");
  if (config.lineUuids.length > 0) return config.lineUuids.includes(lineId);
  if (config.groupUuids.length > 0) return config.groupUuids.includes(groupId);
  return config.allGroups || config.allLines;
}

async function payload(response: Response) {
  const body = await response.json() as { rows?: Row[]; groups?: Array<{ uuid?: string; name?: string; lines?: Array<{ uuid?: string; name?: string }> }>; topics?: Row[]; [key: string]: unknown };
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "IXACS_READ_FAILED");
  return body;
}

async function productionWindows(requestUrl: string, connectionId: string, from: string, to: string, fresh = false): Promise<{
  bodies: Awaited<ReturnType<typeof payload>>[];
  warnings: Array<{ from: string; to: string; error: string }>;
}> {
  try {
    const response = await readProduction(new Request(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "range", from, to, fresh }),
    }), { params: Promise.resolve({ id: connectionId }) });
    return { bodies: [await payload(response)], warnings: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IXACS_READ_FAILED";
    if (from === to) return { bodies: [], warnings: [{ from, to, error: message }] };

    // Historical iXacs calls have variable response time. When a window times
    // out, split it and retry smaller windows instead of failing the complete
    // Power BI refresh.
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const midpoint = new Date(start.valueOf() + Math.floor((end.valueOf() - start.valueOf()) / 2));
    const next = new Date(midpoint.valueOf() + 86_400_000);
    const [left, right] = await Promise.all([
      productionWindows(requestUrl, connectionId, from, isoDate(midpoint), fresh),
      productionWindows(requestUrl, connectionId, isoDate(next), to, fresh),
    ]);
    return { bodies: [...left.bodies, ...right.bodies], warnings: [...left.warnings, ...right.warnings] };
  }
}

function dailyCacheKey(connectionId: string, date: string) {
  return `${connectionId}:${date}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

async function productionDailyWindowsFast(connectionId: string, from: string, to: string) {
  hydrateExcelDailyCache();
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.valueOf() + 86_400_000)) dates.push(isoDate(cursor));

  const bodiesByDate = new Map<string, ProductionBody>();
  const now = Date.now();
  for (const date of dates) {
    const cached = excelDailyCache.get(dailyCacheKey(connectionId, date));
    if (cached && cached.expiresAt > now) bodiesByDate.set(date, cached.body);
  }
  if (bodiesByDate.size === dates.length) {
    if (!existsSync(EXCEL_DAILY_CACHE_FILE)) persistExcelDailyCache();
    return { bodies: dates.map((date) => bodiesByDate.get(date)!), warnings: [] };
  }

  const connection = await getConnection(connectionId);
  if (!connection) return { bodies: [], warnings: [{ from, to, error: "CONNECTION_NOT_FOUND" }] };
  const target = connectionAsTarget(connection);
  const releaseLock = await acquireIxacsConnectionLock(connectionId);
  const warnings: Array<{ from: string; to: string; error: string }> = [];
  try {
    // Another identical Power Query evaluation may have completed while this
    // request waited for the company session. Recheck before calling iXacs.
    const afterWait = Date.now();
    for (const date of dates) {
      if (bodiesByDate.has(date)) continue;
      const cached = excelDailyCache.get(dailyCacheKey(connectionId, date));
      if (cached && cached.expiresAt > afterWait) bodiesByDate.set(date, cached.body);
    }
    const missingDates = dates.filter((date) => !bodiesByDate.has(date));
    if (missingDates.length === 0) return { bodies: dates.map((date) => bodiesByDate.get(date)!), warnings };

    const discovery = await discoverIxacsLines(target);
    const lineUuids = connection.lineUuids.length > 0 ? connection.lineUuids : discovery.lineUuids;
    if (lineUuids.length === 0) return { bodies: [], warnings: [{ from, to, error: "NEED_LINES" }] };
    const prepared = await prepareCtMonitorHistory(
      target,
      discovery.groups.map((group) => group.uuid).filter(Boolean),
      missingDates[0].split("-").reverse().join("/"),
    );
    if (!prepared.ok) return { bodies: [], warnings: [{ from, to, error: `HISTORY_PREPARE_HTTP_${prepared.status}` }] };

    const lineMetadata = new Map(discovery.groups.flatMap((group) => group.lines.map((line) => [line.uuid, {
      productionGroupUuid: group.uuid || null,
      productionGroupName: group.name || null,
      productionLineName: line.name || null,
    }] as const)));
    const statusMetadata = new Map(discovery.statuses.map((status) => [status.uuid, status] as const));
    const fetched = await mapWithConcurrency(missingDates, EXCEL_HISTORY_CONCURRENCY, async (date) => {
      const bizDate = date.split("-").reverse().join("/");
      const options = { bizDates: [bizDate], realTime: false, referer: prepared.referer };
      const [monitorResult, detailResult] = await Promise.all([
        getCtMonitorData(target, lineUuids, options),
        getCtMonitorDetailData(target, lineUuids, options),
      ]);
      if (!monitorResult.ok || !detailResult.ok) {
        return { date, error: monitorResult.error ?? detailResult.error ?? "IXACS_READ_FAILED", body: null };
      }
      const monitorRows = summarizeMonitorJson(monitorResult.responseJson);
      const detailRows = summarizeMonitorDetailJson(detailResult.responseJson);
      const monitorByLine = new Map(monitorRows.map((row) => [row.uuid, row] as const));
      const detailByLine = new Map(detailRows.map((row) => [row.uuid, row] as const));
      const returnedLineUuids = new Set([...monitorByLine.keys(), ...detailByLine.keys()]);
      const rows = [...returnedLineUuids].map((uuid) => {
        const monitor = monitorByLine.get(uuid);
        const detail = detailByLine.get(uuid);
        const statusUuid = monitor?.statusUuid ?? detail?.statusUuid ?? null;
        return {
          ...(detail ?? summarizeMonitorDetailJson({ [uuid]: {} })[0]),
          uuid,
          currentCt: monitor?.cycleTime ?? null,
          bizTime: monitor?.bizTime ?? detail?.bizTime ?? null,
          ...(lineMetadata.get(uuid) ?? {}),
          ...(statusUuid ? {
            statusUuid,
            statusName: statusMetadata.get(statusUuid)?.name ?? null,
            statusBackgroundColor: statusMetadata.get(statusUuid)?.backgroundColor ?? null,
            statusTextColor: statusMetadata.get(statusUuid)?.textColor ?? null,
          } : {}),
        };
      });
      const body: ProductionBody = { ok: true, mode: "historical", date, dateFrom: date, dateTo: date, dateCount: 1, groups: discovery.groups, statuses: discovery.statuses, rows };
      return { date, error: null, body };
    });

    const today = bangkokToday();
    let cacheChanged = false;
    for (const result of fetched) {
      if (!result.body) {
        warnings.push({ from: result.date, to: result.date, error: result.error ?? "IXACS_READ_FAILED" });
        continue;
      }
      bodiesByDate.set(result.date, result.body);
      excelDailyCache.set(dailyCacheKey(connectionId, result.date), {
        expiresAt: Date.now() + (result.date === today ? 60_000 : 365 * 24 * 60 * 60_000),
        body: result.body,
      });
      cacheChanged = true;
    }
    if (cacheChanged) persistExcelDailyCache();
    return { bodies: dates.flatMap((date) => bodiesByDate.get(date) ? [bodiesByDate.get(date)!] : []), warnings };
  } finally {
    releaseLock();
  }
}

function lostTimeTopicLabel(topic: Row) {
  return String(topic.name3rd ?? topic.nameEn ?? topic.nameJa ?? topic.key ?? "").trim();
}

async function lostTimeForDay(requestUrl: string, connectionId: string, date: string) {
  const values = new Map<string, Row>();
  try {
    const response = await readLostTime(new Request(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "day", date }),
    }), { params: Promise.resolve({ id: connectionId }) });
    const body = await payload(response);
    const topics = new Map((body.topics ?? []).map((topic) => [String(topic.key ?? ""), lostTimeTopicLabel(topic)]));
    for (const row of body.rows ?? []) {
      const minutesByTopic = row.minutesByTopic && typeof row.minutesByTopic === "object"
        ? row.minutesByTopic as Record<string, unknown>
        : {};
      const columns: Row = {};
      let total = 0;
      for (const [key, value] of Object.entries(minutesByTopic)) {
        const minutes = numeric(value) ?? 0;
        total += minutes;
        const label = topics.get(key) || key;
        if (label) columns[label] = (numeric(columns[label]) ?? 0) + minutes;
      }
      values.set(String(row.productionLineUuid ?? ""), { "Lost Time รวม": total, ...columns });
    }
    return { values, warnings: [] as Array<{ from: string; to: string; error: string }> };
  } catch (error) {
    return { values, warnings: [{ from: date, to: date, error: error instanceof Error ? error.message : "LOST_TIME_READ_FAILED" }] };
  }
}

async function lostTimeForDates(requestUrl: string, connectionId: string, from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const values = new Map<string, Row>();
  const warnings: Array<{ from: string; to: string; error: string }> = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.valueOf() + 86_400_000)) {
    const date = isoDate(cursor);
    const result = await lostTimeForDay(requestUrl, connectionId, date);
    warnings.push(...result.warnings);
    for (const [lineUuid, columns] of result.values) values.set(`${date}:${lineUuid}`, columns);
  }
  return { values, warnings };
}

async function priorityLostTimeForDates(requestUrl: string, connectionId: string, from: string, to: string) {
  liveLostTimePriority.add(connectionId);
  try {
    return await lostTimeForDates(requestUrl, connectionId, from, to);
  } finally {
    liveLostTimePriority.delete(connectionId);
  }
}

async function cachedLostTimeForDates(connectionId: string, from: string, to: string, bodies: ProductionBody[]) {
  const values = new Map<string, Row>();
  const missingDates = new Set<string>();
  const globalLabels = [
    ...new Set(
      (await getCachedLostTimeTopics(connectionId))
        .map((topic) => lostTimeTopicLabel(topic as unknown as Row))
        .filter(Boolean),
    ),
  ];
  for (const body of bodies) {
    const date = String(body.dateFrom ?? from);
    if (date < from || date > to) continue;
    for (const row of body.rows ?? []) {
      const lineUuid = String(row.uuid ?? row.productionLineUuid ?? "");
      const cached = await getCachedLostTimeLine(connectionId, lineUuid, date);
      const columns: Row = Object.fromEntries(globalLabels.map((label) => [label, null]));
      if (!cached) {
        missingDates.add(date);
        values.set(`${date}:${lineUuid}`, { "Lost Time รวม": null, ...columns });
        continue;
      }
      let total = 0;
      const labels = new Map(cached.topics.map((topic) => [topic.key, lostTimeTopicLabel(topic as unknown as Row)] as const));
      for (const [key, minutes] of Object.entries(cached.minutesByTopic)) {
        total += minutes;
        const label = labels.get(key) || key;
        if (label) columns[label] = (numeric(columns[label]) ?? 0) + minutes;
      }
      values.set(`${date}:${lineUuid}`, { "Lost Time รวม": total, ...columns });
    }
  }
  return { values, missingDates: [...missingDates] };
}

function excelRowHasLostTimeTopics(row: Record<string, unknown>) {
  return Object.keys(row).length > EXCEL_PRODUCTION_FIELD_COUNT;
}

function excelPayloadHasLostTimeTopics(payload: ExcelExportSnapshotPayload) {
  return payload.value.some((row) => excelRowHasLostTimeTopics(row));
}

async function awaitExcelLostTimeForDates(
  requestUrl: string,
  connectionId: string,
  from: string,
  to: string,
  bodies: ProductionBody[],
) {
  const cached = await cachedLostTimeForDates(connectionId, from, to, bodies);
  const values = cached.values;
  const warnings: Array<{ from: string; to: string; error: string }> = [];
  if (cached.missingDates.length === 0) return { values, warnings };

  const today = bangkokToday();
  const missing = [...cached.missingDates].sort((left, right) => {
    if (left === today) return -1;
    if (right === today) return 1;
    return left.localeCompare(right);
  });
  const fetched = await mapWithConcurrency(missing, EXCEL_LOST_TIME_CONCURRENCY, async (date) => {
    const result = await lostTimeForDay(requestUrl, connectionId, date);
    return { date, ...result };
  });
  const failedDates: string[] = [];
  for (const result of fetched) {
    warnings.push(...result.warnings);
    if (result.warnings.length > 0 && result.values.size === 0) {
      failedDates.push(result.date);
      continue;
    }
    for (const [lineUuid, columns] of result.values) values.set(`${result.date}:${lineUuid}`, columns);
  }
  if (failedDates.length > 0) enqueueLostTimeWarm(requestUrl, connectionId, failedDates);
  return { values, warnings };
}

function enqueueLostTimeWarm(requestUrl: string, connectionId: string, dates: string[]) {
  const pending = lostTimeWarmPending.get(connectionId) ?? new Set<string>();
  dates.forEach((date) => pending.add(date));
  if (pending.size === 0) return;
  lostTimeWarmPending.set(connectionId, pending);
  if (lostTimeWarmRunning.has(connectionId)) return;
  const currentTimer = lostTimeWarmTimers.get(connectionId);
  if (currentTimer) clearTimeout(currentTimer);
  const timer = setTimeout(() => void (async () => {
    lostTimeWarmTimers.delete(connectionId);
    lostTimeWarmRunning.add(connectionId);
    try {
      while (pending.size > 0) {
        while (liveLostTimePriority.has(connectionId)) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const date = [...pending].sort().at(-1)!;
        pending.delete(date);
        await lostTimeForDay(requestUrl, connectionId, date);
      }
    } finally {
      lostTimeWarmRunning.delete(connectionId);
      if (pending.size === 0) lostTimeWarmPending.delete(connectionId);
    }
  })(), 0);
  lostTimeWarmTimers.set(connectionId, timer);
}

export async function serveTabularExport(request: Request, id: string, destination: "power-bi" | "excel") {
  const config = await getExportConfig(id);
  const label = destination === "excel" ? "EXCEL" : "POWER_BI";
  if (!config) return NextResponse.json({ error: `${label}_EXPORT_NOT_FOUND`, exportId: id }, { status: 404 });
  if (config.destinationType !== destination) return NextResponse.json({ error: `NOT_A_${label}_EXPORT` }, { status: 400 });
  const settings = destination === "excel" ? config.excelSettings : config.powerBiSettings;
  const apiKey = destination === "excel" ? config.excelApiKey : config.powerBiApiKey;
  if (!authorized(request, apiKey)) {
    return NextResponse.json({ error: `INVALID_${label}_API_KEY` }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  }

  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  const excelCurrent = destination === "excel" && table === "current";
  const excelBulkHistory = destination === "excel" && table === "production" && url.searchParams.get("all") === "1";
  // Power BI still uses seven-day windows in its generated M query. Excel bulk
  // (`all=1`) loads the full configured history in one HTTP round trip.
  const defaultDays = table === "dates" || !table || excelBulkHistory
    ? settings.historyDays
    : Math.min(7, settings.historyDays);
  const range = dateRange(
    settings.historyDays,
    excelCurrent || excelBulkHistory ? null : url.searchParams.get("from"),
    excelCurrent || excelBulkHistory ? null : url.searchParams.get("to"),
    excelCurrent ? 1 : defaultDays,
  );
  if (!range) return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });

  if (!table) {
    const tables = destination === "excel" ? [
      ...(config.excelSettings.tables.includes("history") ? ["production"] : []),
      ...(config.excelSettings.tables.includes("current") ? ["current"] : []),
    ] : [
      ...(settings.datasets.includes("production") ? ["production"] : []),
      ...(settings.datasets.includes("lost-time") ? ["lost-time"] : []),
      ...(settings.includeLineDimension ? ["production-lines"] : []),
      ...(settings.includeDateDimension ? ["dates"] : []),
    ];
    return NextResponse.json({
      exportId: id,
      exportName: config.name,
      tables,
      defaultDateFrom: range.from,
      defaultDateTo: range.to,
      historyDays: settings.historyDays,
    });
  }

  if (table === "dates" && settings.includeDateDimension) {
    const value = Array.from({ length: range.days }, (_, index) => {
      const date = new Date(`${range.from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return { date: isoDate(date), year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1, month: date.getUTCMonth() + 1, monthName: date.toLocaleString("en", { month: "long", timeZone: "UTC" }), day: date.getUTCDate() };
    });
    return NextResponse.json({ table: "DimDate", value });
  }

  try {
    const excelProduction = destination === "excel" && (
      (table === "production" && config.excelSettings.tables.includes("history")) ||
      (table === "current" && config.excelSettings.tables.includes("current"))
    );
    const excelFresh = url.searchParams.get("fresh") === "1";
    const today = bangkokToday();
    const includesToday = range.from <= today && range.to >= today;

    if (excelProduction && destination === "excel" && table === "production" && excelBulkHistory && !excelFresh) {
      const snapshot = await readExcelExportSnapshot(
        id,
        range.from,
        range.to,
        settings.historyDays,
        includesToday,
      );
      if (snapshot && excelPayloadHasLostTimeTopics(snapshot)) {
        return NextResponse.json(snapshot, { headers: { "x-sam-bridge-cache": "snapshot" } });
      }
    }

    const requestedHistoryDays = Number(url.searchParams.get("days"));
    if (
      excelBulkHistory &&
      Number.isFinite(requestedHistoryDays) &&
      requestedHistoryDays !== settings.historyDays
    ) {
      return NextResponse.json({
        error: "EXCEL_HISTORY_DAYS_MISMATCH",
        configuredHistoryDays: settings.historyDays,
        defaultDateFrom: range.from,
        defaultDateTo: range.to,
      }, { status: 409 });
    }

    if (excelProduction || (destination === "power-bi" && ((table === "production" && settings.datasets.includes("production")) || (table === "production-lines" && settings.includeLineDimension)))) {
      const result = destination === "excel" && table === "production"
        ? await productionDailyWindowsFast(config.sourceConnectionId, range.from, range.to)
        : await productionWindows(request.url, config.sourceConnectionId, range.from, range.to, excelCurrent);
      const lostTime = destination === "excel" && table === "current"
        ? await priorityLostTimeForDates(request.url, config.sourceConnectionId, range.from, range.to)
        : { values: new Map<string, Row>(), warnings: [] as Array<{ from: string; to: string; error: string }> };
      if (destination === "excel" && table === "production") {
        const loaded = await awaitExcelLostTimeForDates(
          request.url,
          config.sourceConnectionId,
          range.from,
          range.to,
          result.bodies,
        );
        lostTime.values = loaded.values;
        lostTime.warnings.push(...loaded.warnings);
      }
      result.warnings.push(...lostTime.warnings);
      const bodies = result.bodies;
      if (table === "production-lines") {
        const unique = new Map<string, Row>();
        for (const body of bodies) for (const group of body.groups ?? []) for (const line of group.lines ?? []) {
          const row = { productionLineUuid: line.uuid ?? "", productionLineName: line.name ?? "", productionGroupUuid: group.uuid ?? "", productionGroupName: group.name ?? "" };
          if (inScope(config, row)) unique.set(String(row.productionLineUuid), row);
        }
        return NextResponse.json({ table: "DimProductionLine", partial: result.warnings.length > 0, warnings: result.warnings, value: [...unique.values()] });
      }
      const lostTimeColumns = destination === "excel"
        ? [...new Set([...lostTime.values.values()].flatMap((columns) => Object.keys(columns).filter((key) => key !== "Lost Time รวม")))]
        : [];
      const emptyLostTimeColumns = Object.fromEntries(lostTimeColumns.map((column) => [column, null]));
      const value = bodies.flatMap((body) => (body.rows ?? []).filter((row) => inScope(config, row)).map((row) => destination === "excel" ? {
        Date: String(body.dateFrom ?? range.from),
        productionLineName: String(row.productionLineName ?? ""),
        product: String(row.product ?? ""),
        planNum: numeric(row.planNum),
        actualNum: numeric(row.actualNum),
        averageCt: numeric(row.averageCt),
        baseCt: numeric(row.baseCt),
        pcsPerHour: numeric(row.pcsPerHour),
        volumeRate: numeric(row.volumeRate),
        operationalAvailability: numeric(row.operationalAvailability),
        operatingTime: numeric(row.operatingTime),
        stopTime: numeric(row.stopTime),
        ...emptyLostTimeColumns,
        ...(lostTime.values.get(`${String(body.dateFrom ?? range.from)}:${String(row.uuid ?? row.productionLineUuid ?? "")}`) ?? { "Lost Time รวม": null }),
      } : flat({ ...row, businessDate: body.dateFrom ?? range.from })));
      const responseBody = {
        table: destination === "excel" ? table === "current" ? "tblSAMCurrent" : "tblSAMProduction" : "FactProduction",
        dateFrom: range.from,
        dateTo: range.to,
        partial: result.warnings.length > 0,
        warnings: result.warnings,
        value,
      };
      if (destination === "excel" && table === "production" && excelBulkHistory && excelPayloadHasLostTimeTopics(responseBody as ExcelExportSnapshotPayload)) {
        void writeExcelExportSnapshot(
          id,
          range.from,
          range.to,
          settings.historyDays,
          includesToday,
          responseBody as ExcelExportSnapshotPayload,
        );
      }
      return NextResponse.json(
        responseBody,
        excelCurrent ? { headers: { "cache-control": "no-store, no-cache, max-age=0, must-revalidate", pragma: "no-cache", expires: "0" } } : undefined,
      );
    }

    if (table === "lost-time" && settings.datasets.includes("lost-time")) {
      const response = await readLostTime(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "range", from: range.from, to: range.to }) }), { params: Promise.resolve({ id: config.sourceConnectionId }) });
      const body = await payload(response);
      const topics = new Map((body.topics ?? []).map((topic) => [String(topic.key ?? ""), topic]));
      const value = (body.rows ?? []).filter((row) => inScope(config, row)).flatMap((row) => {
        const minutes = row.minutesByTopic && typeof row.minutesByTopic === "object" ? row.minutesByTopic as Record<string, unknown> : {};
        const counts = row.countByTopic && typeof row.countByTopic === "object" ? row.countByTopic as Record<string, unknown> : {};
        return [...new Set([...Object.keys(minutes), ...Object.keys(counts)])].map((key) => flat({ ...row, minutesByTopic: undefined, countByTopic: undefined, dateFrom: range.from, dateTo: range.to, lostTimeKey: key, lostTimeName: topics.get(key)?.name ?? key, lostMinutes: Number(minutes[key] ?? 0), occurrenceCount: Number(counts[key] ?? 0) }));
      });
      return NextResponse.json({ table: "FactLostTime", dateFrom: range.from, dateTo: range.to, value });
    }
    return NextResponse.json({ error: "TABLE_NOT_ENABLED" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : `${label}_EXPORT_FAILED` }, { status: 502 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveTabularExport(request, id, "power-bi");
}
