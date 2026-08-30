import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  summarizeMonitorJson,
  type IxacsStatus,
} from "@/lib/ixacs-client";
import { getConnection, type IxacsConnection } from "@/lib/ixacs-connections";
import { acquireIxacsConnectionLock } from "@/lib/ixacs-request-lock";
import type { PushEvent } from "@/lib/ixacs-store";

export type LiveLineStatus = {
  statusUuid: string | null;
  statusName: string | null;
  statusNameTh: string | null;
  statusNameEn: string | null;
  statusNameJa: string | null;
  statusBgColor: string | null;
  statusFontColor: string | null;
  statusBlinking: boolean;
  statusBlinkingBgColor: string | null;
  statusBlinkingFontColor: string | null;
  receivedAt: string;
};

type CacheGlobals = typeof globalThis & {
  __pushLiveStatusCache?: Map<string, { expiresAt: number; value: Map<string, LiveLineStatus> }>;
};

const CACHE_MS = 5_000;
const shared = globalThis as CacheGlobals;
const liveCache = (shared.__pushLiveStatusCache ??= new Map());

function pickStatus(discovery: Awaited<ReturnType<typeof discoverIxacsLines>>, lineUuid: string, statusUuid: string | null) {
  if (!statusUuid) return null;
  const perLine = discovery.statusesByLine[lineUuid] ?? [];
  return perLine.find((item) => item.uuid === statusUuid)
    ?? discovery.statuses.find((item) => item.uuid === statusUuid)
    ?? null;
}

function toLiveStatus(status: IxacsStatus | null, statusUuid: string | null, receivedAt: string): LiveLineStatus {
  return {
    statusUuid,
    statusName: status?.name ?? null,
    statusNameTh: status?.nameTh || status?.name || null,
    statusNameEn: status?.nameEn || status?.name || null,
    statusNameJa: status?.nameJa || status?.name || null,
    statusBgColor: status?.backgroundColor ?? null,
    statusFontColor: status?.textColor ?? null,
    statusBlinking: status?.blinking ?? false,
    statusBlinkingBgColor: status?.blinkingBackgroundColor ?? null,
    statusBlinkingFontColor: status?.blinkingTextColor ?? null,
    receivedAt,
  };
}

export function applyLiveStatus(event: PushEvent, live: LiveLineStatus | null): PushEvent {
  if (!live) {
    return {
      ...event,
      statusUuid: null,
      statusName: null,
      statusNameTh: null,
      statusNameEn: null,
      statusNameJa: null,
      statusBgColor: null,
      statusFontColor: null,
      statusBlinking: false,
      statusBlinkingBgColor: null,
      statusBlinkingFontColor: null,
    };
  }
  return {
    ...event,
    statusUuid: live.statusUuid,
    statusName: live.statusName,
    statusNameTh: live.statusNameTh,
    statusNameEn: live.statusNameEn,
    statusNameJa: live.statusNameJa,
    statusBgColor: live.statusBgColor,
    statusFontColor: live.statusFontColor,
    statusBlinking: live.statusBlinking,
    statusBlinkingBgColor: live.statusBlinkingBgColor,
    statusBlinkingFontColor: live.statusBlinkingFontColor,
    receivedAt: event.receivedAt || live.receivedAt,
  };
}

export async function getLiveLineStatuses(connectionId: string, lineUuids: string[]) {
  const unique = [...new Set(lineUuids.filter(Boolean))];
  const empty = new Map<string, LiveLineStatus>();
  if (!connectionId || unique.length === 0) return empty;

  const cacheKey = `${connectionId}:${[...unique].sort().join(",")}`;
  const cached = liveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const connection = await getConnection(connectionId);
  if (!connection?.baseUrl) return empty;

  const releaseLock = await acquireIxacsConnectionLock(connectionId);
  try {
    const cachedAfterWait = liveCache.get(cacheKey);
    if (cachedAfterWait && cachedAfterWait.expiresAt > Date.now()) return cachedAfterWait.value;

    const live = await fetchLiveStatuses(connection, unique);
    liveCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value: live });
    return live;
  } finally {
    releaseLock();
  }
}

export async function getLiveLineStatusesByConnection(lines: { connectionId: string; lineUuid: string }[]) {
  const grouped = new Map<string, string[]>();
  for (const line of lines) {
    if (!line.connectionId || !line.lineUuid) continue;
    const list = grouped.get(line.connectionId) ?? [];
    list.push(line.lineUuid);
    grouped.set(line.connectionId, list);
  }

  const merged = new Map<string, LiveLineStatus>();
  await Promise.all(
    [...grouped.entries()].map(async ([connectionId, lineUuids]) => {
      const live = await getLiveLineStatuses(connectionId, lineUuids);
      for (const [lineUuid, status] of live) {
        merged.set(`${connectionId}:${lineUuid}`, status);
      }
    }),
  );
  return merged;
}

async function fetchLiveStatuses(connection: IxacsConnection, lineUuids: string[]) {
  const result = new Map<string, LiveLineStatus>();
  const receivedAt = new Date().toISOString();
  try {
    const target = connectionAsTarget(connection);
    const [discovery, monitor] = await Promise.all([
      discoverIxacsLines(target),
      getCtMonitorData(target, lineUuids),
    ]);
    if (!monitor.ok) return result;
    const rows = new Map(summarizeMonitorJson(monitor.responseJson).map((row) => [row.uuid, row]));
    for (const lineUuid of lineUuids) {
      const statusUuid = rows.get(lineUuid)?.statusUuid ?? null;
      result.set(lineUuid, toLiveStatus(pickStatus(discovery, lineUuid, statusUuid), statusUuid, receivedAt));
    }
  } catch {
    return result;
  }
  return result;
}
