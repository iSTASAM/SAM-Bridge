import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  productionDayKey,
  productionDayRange,
  resolveDayKey,
} from "@/lib/production-day";
import {
  getActiveConnection,
  getConnection,
  rememberSessionOnActive,
  rememberSessionOnConnection,
} from "@/lib/ixacs-connections";
import {
  getIssuedKey as getStoredIssuedKey,
  getIssuedKeys as listStoredApiKeys,
  getPushKeyAssignment as getStoredPushKeyAssignment,
  isPushAuthorized as isStoredPushAuthorized,
  issueApiKey as issueStoredApiKey,
  revokeApiKey as revokeStoredApiKey,
  rotateApiKey as rotateStoredApiKey,
  saveApiKey,
  setApiKeyStatus as setStoredApiKeyStatus,
  type IssuedApiKey,
  type KeyEnvironment,
  type KeyStatus,
} from "@/lib/push-api-keys";

export type { IssuedApiKey, KeyEnvironment, KeyStatus };

export type AndonStatus = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  bgColor: string;
  fontColor: string;
  blinking: boolean;
  blinkingBgColor: string | null;
  blinkingFontColor: string | null;
  dispOrd: number;
  statusCode: string | null;
  lastSeenAt: string;
};

export type HistorySegment = {
  id: string;
  statusUuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  bgColor: string;
  fontColor: string;
  startedAt: string;
  endedAt: string | null;
};

export type ProductionGroup = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  dispOrd: number;
  connectionId?: string | null;
};

export type ProductionLine = {
  uuid: string;
  groupUuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  currentStatusUuid: string | null;
  productUuid: string | null;
  receivedAt: string | null;
  connectionId?: string | null;
};

export type PushEvent = {
  id: string;
  receivedAt: string;
  connectionId: string | null;
  customerId?: string | null;
  hasEvent?: boolean;
  companyName: string | null;
  groupUuid: string | null;
  groupName: string | null;
  groupNameTh?: string | null;
  groupNameEn?: string | null;
  groupNameJa?: string | null;
  lineUuid: string | null;
  lineName: string | null;
  lineNameTh?: string | null;
  lineNameEn?: string | null;
  lineNameJa?: string | null;
  statusUuid: string | null;
  statusName: string | null;
  statusNameTh?: string | null;
  statusNameEn?: string | null;
  statusNameJa?: string | null;
  statusBgColor?: string | null;
  statusFontColor?: string | null;
  statusBlinking?: boolean;
  statusBlinkingBgColor?: string | null;
  statusBlinkingFontColor?: string | null;
  productUuid: string | null;
  productName: string | null;
  accepted: boolean;
  error: string | null;
  payloadPreview: string;
};

type PersistedState = {
  groups: Record<string, ProductionGroup>;
  lines: Record<string, ProductionLine>;
  statusesByLine: Record<string, Record<string, AndonStatus>>;
  historyByLine: Record<string, HistorySegment[]>;
  /** @deprecated Keys live in Supabase / push-api-keys.json — kept optional for old files. */
  apiKeys?: Record<string, IssuedApiKey>;
  pushEvents?: PushEvent[];
};

const STATE_FILE = path.join(process.cwd(), "data", "andon-state.json");
const UNGROUPED = "ungrouped";
const MAX_HISTORY = 20_000;
const MAX_PUSH_EVENTS = 2_000;

let groups = new Map<string, ProductionGroup>();
let lines = new Map<string, ProductionLine>();
let statusesByLine = new Map<string, Map<string, AndonStatus>>();
let historyByLine = new Map<string, HistorySegment[]>();
let pushEvents: PushEvent[] = [];
let webhookSession: string | null = null;
let hydrated = false;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readUuid(value: unknown): string | null {
  const text = readString(value);
  if (!text || text === "00000000-0000-0000-0000-000000000000") return null;
  return text;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function localizedFromIXacs(record: Record<string, unknown> | null, fallback: string) {
  const nameTh = readString(record?.name3rd) ?? readString(record?.nameTh);
  const nameEn = readString(record?.nameEn);
  const nameJa = readString(record?.nameJa);
  return {
    nameTh: nameTh ?? nameEn ?? nameJa ?? fallback,
    nameEn: nameEn ?? nameTh ?? nameJa ?? fallback,
    nameJa: nameJa ?? nameEn ?? nameTh ?? fallback,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function ensureUngrouped() {
  if (!groups.has(UNGROUPED)) {
    groups.set(UNGROUPED, {
      uuid: UNGROUPED,
      nameTh: "ไม่มีกลุ่ม",
      nameEn: "Ungrouped",
      nameJa: "未分類",
      dispOrd: 9999,
    });
  }
}

function statusMap(lineUuid: string) {
  let map = statusesByLine.get(lineUuid);
  if (!map) {
    map = new Map();
    statusesByLine.set(lineUuid, map);
  }
  return map;
}

function historyList(lineUuid: string) {
  let list = historyByLine.get(lineUuid);
  if (!list) {
    list = [];
    historyByLine.set(lineUuid, list);
  }
  return list;
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;

  if (!existsSync(STATE_FILE)) {
    ensureUngrouped();
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedState & {
      lastPush?: {
        receivedAt: string;
        productionLineUuid: string | null;
        productionLineNameTh?: string | null;
        productionLineNameEn?: string | null;
        productionLineNameJa?: string | null;
        productionLineName?: string | null;
        andonStatusStyleUuid?: string | null;
        productUuid?: string | null;
      };
      statuses?: Record<string, AndonStatus>;
      history?: HistorySegment[];
    };

    if (parsed.groups && parsed.lines) {
      groups = new Map(Object.entries(parsed.groups));
      lines = new Map(
        Object.entries(parsed.lines).map(([id, line]) => {
          const rest = { ...line } as ProductionLine & { xApiKey?: string | null };
          delete rest.xApiKey;
          return [id, rest];
        }),
      );
      statusesByLine = new Map(
        Object.entries(parsed.statusesByLine ?? {}).map(([id, items]) => [
          id,
          new Map(Object.entries(items)),
        ]),
      );
      historyByLine = new Map(Object.entries(parsed.historyByLine ?? {}));
      pushEvents = Array.isArray(parsed.pushEvents) ? parsed.pushEvents.slice(-MAX_PUSH_EVENTS) : [];
    } else if (parsed.lastPush?.productionLineUuid) {
      const lineUuid = parsed.lastPush.productionLineUuid;
      ensureUngrouped();
      lines.set(lineUuid, {
        uuid: lineUuid,
        groupUuid: UNGROUPED,
        nameTh: parsed.lastPush.productionLineNameTh ?? parsed.lastPush.productionLineName ?? lineUuid,
        nameEn: parsed.lastPush.productionLineNameEn ?? parsed.lastPush.productionLineName ?? lineUuid,
        nameJa: parsed.lastPush.productionLineNameJa ?? parsed.lastPush.productionLineName ?? lineUuid,
        currentStatusUuid: parsed.lastPush.andonStatusStyleUuid ?? null,
        productUuid: parsed.lastPush.productUuid ?? null,
        receivedAt: parsed.lastPush.receivedAt,
      });
      statusesByLine.set(lineUuid, new Map(Object.entries(parsed.statuses ?? {})));
      historyByLine.set(lineUuid, parsed.history ?? []);
    }
  } catch {
    groups = new Map();
    lines = new Map();
    statusesByLine = new Map();
    historyByLine = new Map();
    pushEvents = [];
  }

  ensureUngrouped();
}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const payload: PersistedState = {
    groups: Object.fromEntries(groups),
    lines: Object.fromEntries(lines),
    statusesByLine: Object.fromEntries(
      [...statusesByLine.entries()].map(([id, map]) => [id, Object.fromEntries(map)]),
    ),
    historyByLine: Object.fromEntries(historyByLine),
    pushEvents,
  };
  writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

export function extractSession(cookieHeader: string | null, parsed: unknown): string | null {
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)SESSION=([^;]+)/i);
    if (match?.[1]) return match[1];
  }

  const root = asRecord(parsed);
  if (!root) return null;

  for (const key of ["session", "SESSION", "sessionId"]) {
    const value = readString(root[key]);
    if (value) return value;
  }

  return null;
}

function rememberStatus(
  lineUuid: string,
  style: Record<string, unknown>,
  receivedAt: string,
) {
  const uuid = readUuid(style.uuid);
  if (!uuid) return;

  const nameTh = readString(style.dispString3rd);
  const nameEn = readString(style.dispStringEn);
  const nameJa = readString(style.dispStringJa);
  const previous = statusMap(lineUuid).get(uuid);
  const nextTh = nameTh ?? previous?.nameTh ?? "";
  const nextEn = nameEn ?? previous?.nameEn ?? "";
  const nextJa = nameJa ?? previous?.nameJa ?? "";
  const fallback = nextTh || nextEn || nextJa || "Unknown";
  statusMap(lineUuid).set(uuid, {
    uuid,
    nameTh: nextTh || (nextEn || nextJa ? "" : fallback),
    nameEn: nextEn || (nextTh || nextJa ? "" : fallback),
    nameJa: nextJa || (nextTh || nextEn ? "" : fallback),
    bgColor: readString(style.bgColor) ?? previous?.bgColor ?? "#3a3f4a",
    fontColor: readString(style.fontColor) ?? previous?.fontColor ?? "#ffffff",
    blinking: readString(style.blinkingFlg) === "1",
    blinkingBgColor: readString(style.blinkingBgColor) ?? previous?.blinkingBgColor ?? null,
    blinkingFontColor: readString(style.blinkingFontColor) ?? previous?.blinkingFontColor ?? null,
    dispOrd: readNumber(style.dispOrd, previous?.dispOrd ?? 99),
    statusCode: readString(style.status) ?? previous?.statusCode ?? null,
    lastSeenAt: receivedAt,
  });
}

function rememberHistory(
  lineUuid: string,
  statusUuid: string,
  style: Record<string, unknown> | null,
  receivedAt: string,
) {
  const history = historyList(lineUuid);
  const last = history[history.length - 1];
  if (last && last.statusUuid === statusUuid && last.endedAt === null) return;

  if (last && last.endedAt === null) last.endedAt = receivedAt;

  const known = statusMap(lineUuid).get(statusUuid);
  history.push({
    id: `${receivedAt}-${statusUuid}`,
    statusUuid,
    nameTh: readString(style?.dispString3rd) ?? known?.nameTh ?? "",
    nameEn: readString(style?.dispStringEn) ?? known?.nameEn ?? "",
    nameJa: readString(style?.dispStringJa) ?? known?.nameJa ?? "",
    bgColor: readString(style?.bgColor) ?? known?.bgColor ?? "#3a3f4a",
    fontColor: readString(style?.fontColor) ?? known?.fontColor ?? "#ffffff",
    startedAt: receivedAt,
    endedAt: null,
  });

  if (history.length > MAX_HISTORY) {
    historyByLine.set(lineUuid, history.slice(-MAX_HISTORY));
  }
}

async function rememberPushItem(
  parsed: unknown,
  sessionFromRequest: string | null,
  apiKeyFromHeader: string | null = null,
) {
  await hydrate();

  const issuedKey = apiKeyFromHeader ? await getStoredIssuedKey(apiKeyFromHeader) : null;
  const connectionId = issuedKey?.connectionId ?? null;

  const root = asRecord(parsed);
  const group = asRecord(root?.productionGroup);
  const line = asRecord(root?.productionLine);
  const product = asRecord(root?.product);
  const style = asRecord(root?.andonStatusStyle);
  const styleCatalogValue = root?.andonStatusStyles ?? root?.statusStyles;
  const styleCatalogItems = Array.isArray(styleCatalogValue)
    ? styleCatalogValue
    : asRecord(styleCatalogValue)
      ? Object.values(asRecord(styleCatalogValue)!)
      : [];
  const styleCatalog = styleCatalogItems
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const status = asRecord(root?.status);
  const receivedAt = new Date().toISOString();

  const lineUuid = readUuid(line?.uuid) ?? readUuid(status?.productionLineUuid);
  if (!lineUuid) return { ok: false, error: "MISSING_LINE_UUID" } as const;

  const assignedConnection = connectionId ? await getConnection(connectionId) : null;
  if (issuedKey && !assignedConnection) {
    return { ok: false, error: "KEY_HAS_NO_COMPANY" } as const;
  }
  if (
    assignedConnection &&
    assignedConnection.lineUuids.length > 0 &&
    !assignedConnection.lineUuids.includes(lineUuid)
  ) {
    return { ok: false, error: "LINE_NOT_IN_COMPANY" } as const;
  }
  if (issuedKey?.lineUuid && issuedKey.lineUuid !== lineUuid) {
    return { ok: false, error: "KEY_ASSIGNED_TO_ANOTHER_LINE" } as const;
  }

  const groupUuid = readUuid(group?.uuid) ?? readUuid(line?.groupUuid) ?? UNGROUPED;
  if (issuedKey?.groupUuid && issuedKey.groupUuid !== groupUuid) {
    return { ok: false, error: "KEY_ASSIGNED_TO_ANOTHER_GROUP" } as const;
  }

  if (sessionFromRequest) {
    webhookSession = sessionFromRequest;
    // Keep login-backed connection sessions intact. Push SESSION tokens often
    // cannot call ctMonitor/regist and would break status changes.
    if (connectionId) {
      const assigned = await getConnection(connectionId);
      if (assigned && !assigned.password) {
        await rememberSessionOnConnection(connectionId, sessionFromRequest);
      }
    } else {
      await rememberSessionOnActive(sessionFromRequest);
    }
  }

  ensureUngrouped();

  if (groupUuid !== UNGROUPED) {
    const names = localizedFromIXacs(group, groups.get(groupUuid)?.nameTh ?? groupUuid);
    groups.set(groupUuid, {
      uuid: groupUuid,
      ...names,
      dispOrd: readNumber(group?.dispOrd, groups.get(groupUuid)?.dispOrd ?? 99),
      connectionId,
    });
  }

  const existing = lines.get(lineUuid);
  const statusUuid = readUuid(style?.uuid) ?? readUuid(status?.andonStatusStyleUuid);
  const lineNames = localizedFromIXacs(line, existing?.nameTh ?? lineUuid);

  lines.set(lineUuid, {
    uuid: lineUuid,
    groupUuid,
    nameTh: lineNames.nameTh,
    nameEn: lineNames.nameEn,
    nameJa: lineNames.nameJa,
    currentStatusUuid: statusUuid ?? existing?.currentStatusUuid ?? null,
    productUuid: readUuid(product?.uuid) ?? readUuid(status?.productUuid),
    receivedAt,
    connectionId,
  });

  if (issuedKey) {
    if (!issuedKey.lineUuid) issuedKey.lineUuid = lineUuid;
    issuedKey.lastUsedAt = receivedAt;
  }

  for (const catalogStyle of styleCatalog) rememberStatus(lineUuid, catalogStyle, receivedAt);
  if (style) rememberStatus(lineUuid, style, receivedAt);
  if (statusUuid) rememberHistory(lineUuid, statusUuid, style, receivedAt);

  return { ok: true, connectionId, lineUuid } as const;
}

function pushItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const root = asRecord(parsed);
  if (!root) return [parsed];
  for (const key of ["events", "records", "items", "data"]) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  return [parsed];
}

async function recordPushEvent(
  item: unknown,
  apiKey: string | null,
  result: { ok: boolean; error?: string },
) {
  const root = asRecord(item);
  const group = asRecord(root?.productionGroup);
  const line = asRecord(root?.productionLine);
  const status = asRecord(root?.status);
  const style = asRecord(root?.andonStatusStyle);
  const product = asRecord(root?.product);
  const issued = apiKey ? await getStoredIssuedKey(apiKey) : null;
  const connection = issued?.connectionId ? await getConnection(issued.connectionId) : null;
  const lineUuid = readUuid(line?.uuid) ?? readUuid(status?.productionLineUuid) ?? issued?.lineUuid ?? null;
  const statusUuid = readUuid(style?.uuid) ?? readUuid(status?.andonStatusStyleUuid);
  const knownStatus = lineUuid && statusUuid ? statusMap(lineUuid).get(statusUuid) ?? null : null;
  const groupNames = localizedFromIXacs(group, issued?.groupName ?? "");
  const lineNames = localizedFromIXacs(line, issued?.lineName ?? lineUuid ?? "");
  let payloadPreview = "";
  try {
    payloadPreview = JSON.stringify(item).slice(0, 12_000);
  } catch {
    payloadPreview = "[Unserializable payload]";
  }
  const event: PushEvent = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    connectionId: issued?.connectionId ?? null,
    companyName: connection?.name ?? null,
    groupUuid: readUuid(group?.uuid) ?? readUuid(line?.groupUuid) ?? issued?.groupUuid ?? null,
    groupName: readString(group?.name3rd) ?? readString(group?.nameEn) ?? issued?.groupName ?? null,
    groupNameTh: groupNames.nameTh || null,
    groupNameEn: groupNames.nameEn || null,
    groupNameJa: groupNames.nameJa || null,
    lineUuid,
    lineName: readString(line?.name3rd) ?? readString(line?.nameEn) ?? issued?.lineName ?? null,
    lineNameTh: lineNames.nameTh || null,
    lineNameEn: lineNames.nameEn || null,
    lineNameJa: lineNames.nameJa || null,
    statusUuid,
    statusName: knownStatus?.nameTh ?? readString(style?.dispString3rd) ?? readString(style?.dispStringEn),
    statusNameTh: knownStatus?.nameTh ?? readString(style?.dispString3rd),
    statusNameEn: knownStatus?.nameEn ?? readString(style?.dispStringEn),
    statusNameJa: knownStatus?.nameJa ?? readString(style?.dispStringJa),
    statusBgColor: knownStatus?.bgColor ?? readString(style?.bgColor),
    statusFontColor: knownStatus?.fontColor ?? readString(style?.fontColor),
    statusBlinking: knownStatus?.blinking ?? readString(style?.blinkingFlg) === "1",
    statusBlinkingBgColor: knownStatus?.blinkingBgColor ?? readString(style?.blinkingBgColor),
    statusBlinkingFontColor: knownStatus?.blinkingFontColor ?? readString(style?.blinkingFontColor),
    productUuid: readUuid(product?.uuid) ?? readUuid(status?.productUuid),
    productName: readString(product?.name3rd) ?? readString(product?.nameEn),
    accepted: result.ok,
    error: result.ok ? null : result.error ?? "REJECTED",
    payloadPreview,
  };
  pushEvents.push(event);
  if (pushEvents.length > MAX_PUSH_EVENTS) pushEvents = pushEvents.slice(-MAX_PUSH_EVENTS);
  return event;
}

export async function rememberPushBatch(
  parsed: unknown,
  sessionFromRequest: string | null,
  apiKeyFromHeader: string | null = null,
) {
  await hydrate();
  const items = pushItems(parsed);
  if (items.length > 5_000) {
    return { ok: false, error: "TOO_MANY_RECORDS", accepted: 0, rejected: items.length, acceptedEvents: [] as PushEvent[] } as const;
  }

  let accepted = 0;
  const errors: Record<string, number> = {};
  let assignment: { connectionId: string | null; lineUuid: string } | null = null;
  const acceptedEvents: PushEvent[] = [];
  for (const item of items) {
    const result = await rememberPushItem(item, sessionFromRequest, apiKeyFromHeader);
    if (result.ok) {
      acceptedEvents.push(await recordPushEvent(item, apiKeyFromHeader, result));
      accepted += 1;
      assignment = { connectionId: result.connectionId, lineUuid: result.lineUuid };
    } else {
      errors[result.error] = (errors[result.error] ?? 0) + 1;
    }
  }
  if (accepted > 0) {
    persist();
    if (apiKeyFromHeader) await saveApiKey(apiKeyFromHeader);
  }
  return {
    ok: accepted > 0 && accepted === items.length,
    partial: accepted > 0 && accepted < items.length,
    accepted,
    rejected: items.length - accepted,
    errors,
    assignment,
    acceptedEvents,
  } as const;
}

function matchesPushSearch(event: PushEvent, search: string) {
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

export async function getPushEvents(input: {
  connectionId?: string | null;
  lineUuid?: string | null;
  statusUuid?: string | null;
  status?: "accepted" | "rejected" | null;
  search?: string | null;
  offset?: number;
  limit?: number;
  latestPerLine?: boolean;
}) {
  await hydrate();
  const search = input.search?.trim().toLowerCase() ?? "";
  const scoped = [...pushEvents].reverse().filter((event) => {
    if (input.connectionId != null && event.connectionId !== input.connectionId) return false;
    return true;
  });

  const lines = new Map<string, { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null }>();
  const statuses = new Map<string, { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null; bgColor: string | null }>();
  for (const event of scoped) {
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

  let filtered = scoped.filter((event) => {
    if (input.lineUuid && event.lineUuid !== input.lineUuid) return false;
    if (input.statusUuid && event.statusUuid !== input.statusUuid) return false;
    if (input.status === "accepted" && !event.accepted) return false;
    if (input.status === "rejected" && event.accepted) return false;
    if (search && !matchesPushSearch(event, search)) return false;
    return true;
  });
  if (input.latestPerLine) {
    const seen = new Set<string>();
    filtered = filtered.filter((event) => {
      const key = `${event.connectionId ?? "unknown"}:${event.lineUuid ?? event.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  return {
    total: filtered.length,
    offset,
    limit,
    events: filtered.slice(offset, offset + limit),
    lines: [...lines.values()].sort((a, b) => (a.nameTh ?? a.name ?? "").localeCompare(b.nameTh ?? b.name ?? "", "th")),
    statuses: [...statuses.values()].sort((a, b) => (a.nameTh ?? a.name ?? "").localeCompare(b.nameTh ?? b.name ?? "", "th")),
  };
}

export async function deletePushEvents(connectionId: string, lineUuid: string) {
  await hydrate();
  const before = pushEvents.length;
  pushEvents = pushEvents.filter(
    (event) => event.connectionId !== connectionId || event.lineUuid !== lineUuid,
  );
  const deleted = before - pushEvents.length;
  if (deleted > 0) persist();
  return deleted;
}

export async function deletePushEvent(id: string) {
  await hydrate();
  const next = pushEvents.filter((event) => event.id !== id);
  if (next.length === pushEvents.length) return false;
  pushEvents = next;
  persist();
  return true;
}

export async function getPushEvent(id: string) {
  await hydrate();
  return pushEvents.find((event) => event.id === id) ?? null;
}

export async function rememberPush(
  parsed: unknown,
  sessionFromRequest: string | null,
  apiKeyFromHeader: string | null = null,
) {
  return await rememberPushBatch(parsed, sessionFromRequest, apiKeyFromHeader);
}

function clipHistory(
  history: HistorySegment[],
  start: number,
  end: number,
  now: number,
) {
  return history.flatMap((item) => {
    const segStart = new Date(item.startedAt).getTime();
    const segEnd = item.endedAt ? new Date(item.endedAt).getTime() : now;
    if (segEnd <= start || segStart >= end) return [];

    const clippedEnd = Math.min(segEnd, end);
    const stillOpen = item.endedAt === null && now < end;

    return [
      {
        ...item,
        startedAt: new Date(Math.max(segStart, start)).toISOString(),
        endedAt: stillOpen ? null : new Date(clippedEnd).toISOString(),
      },
    ];
  });
}

function earliestDayKey() {
  let earliest: string | null = null;
  for (const history of historyByLine.values()) {
    for (const item of history) {
      const key = productionDayKey(new Date(item.startedAt).getTime());
      if (!earliest || key < earliest) earliest = key;
    }
  }
  return earliest;
}

function statusAtTime(lineUuid: string, history: HistorySegment[], at: number) {
  const openOrLast = [...history].reverse().find((item) => {
    const start = new Date(item.startedAt).getTime();
    const end = item.endedAt ? new Date(item.endedAt).getTime() : at;
    return start <= at && at <= end;
  });
  const uuid = openOrLast?.statusUuid ?? history[history.length - 1]?.statusUuid;
  if (!uuid) return null;
  return statusMap(lineUuid).get(uuid) ?? null;
}

export async function getOverview(dayRaw?: string | null, connectionId?: string | null) {
  await hydrate();
  const now = Date.now();
  const day = resolveDayKey(dayRaw, now);
  const currentDay = productionDayKey(now);
  const { start, end } = productionDayRange(day);
  const isLive = day === currentDay;
  const at = isLive ? now : end - 1;

  return {
    day,
    currentDay,
    earliestDay: earliestDayKey(),
    dayStart: new Date(start).toISOString(),
    dayEnd: new Date(end).toISOString(),
    isLive,
    groups: [...groups.values()]
      .sort((a, b) => a.dispOrd - b.dispOrd || a.nameTh.localeCompare(b.nameTh, "th"))
      .map((group) => ({
        uuid: group.uuid,
        nameTh: group.nameTh,
        nameEn: group.nameEn,
        nameJa: group.nameJa,
        dispOrd: group.dispOrd,
        lines: [...lines.values()]
          .filter((line) => line.groupUuid === group.uuid)
          .filter((line) => connectionId == null || line.connectionId === connectionId)
          .sort((a, b) => a.nameTh.localeCompare(b.nameTh, "th"))
          .map((line) => {
            const history = clipHistory(historyList(line.uuid), start, end, now);
            const live = line.currentStatusUuid
              ? statusMap(line.uuid).get(line.currentStatusUuid) ?? null
              : null;
            const currentStatus = isLive ? live : statusAtTime(line.uuid, history, at);
            return {
              uuid: line.uuid,
              groupUuid: line.groupUuid,
              nameTh: line.nameTh,
              nameEn: line.nameEn,
              nameJa: line.nameJa,
              receivedAt: isLive ? line.receivedAt : history[history.length - 1]?.endedAt ?? history[history.length - 1]?.startedAt ?? null,
              currentStatus,
              history,
            };
          }),
      }))
      .filter((group) => group.lines.length > 0),
  };
}

export async function getLineBoard(lineUuid: string, dayRaw?: string | null) {
  await hydrate();
  const line = lines.get(lineUuid);
  if (!line) return null;
  const group = groups.get(line.groupUuid) ?? null;
  const connection = line.connectionId ? await getConnection(line.connectionId) : null;
  const now = Date.now();
  const day = resolveDayKey(dayRaw, now);
  const currentDay = productionDayKey(now);
  const { start, end } = productionDayRange(day);
  const isLive = day === currentDay;
  const history = clipHistory(historyList(lineUuid), start, end, now);
  const live = line.currentStatusUuid
    ? statusMap(lineUuid).get(line.currentStatusUuid) ?? null
    : null;
  const current = isLive ? live : statusAtTime(lineUuid, history, end - 1);

  return {
    connectionId: line.connectionId ?? null,
    hasSession: Boolean(connection?.session),
    sessionSource: connection?.session ? "connection" : null,
    productionLineUuid: line.uuid,
    productionLineName: line.nameTh,
    productionLineNameTh: line.nameTh,
    productionLineNameEn: line.nameEn,
    productionLineNameJa: line.nameJa,
    groupUuid: line.groupUuid,
    groupNameTh: group?.nameTh ?? null,
    groupNameEn: group?.nameEn ?? null,
    groupNameJa: group?.nameJa ?? null,
    productUuid: line.productUuid,
    andonStatusStyleUuid: current?.uuid ?? null,
    andonStatusName: current?.nameTh ?? null,
    receivedAt: isLive
      ? line.receivedAt
      : history[history.length - 1]?.endedAt ?? history[history.length - 1]?.startedAt ?? null,
    day,
    currentDay,
    earliestDay: earliestDayKey(),
    dayStart: new Date(start).toISOString(),
    dayEnd: new Date(end).toISOString(),
    isLive,
    statuses: [...statusMap(lineUuid).values()].sort((a, b) => {
      if (a.dispOrd !== b.dispOrd) return a.dispOrd - b.dispOrd;
      return a.nameTh.localeCompare(b.nameTh, "th");
    }),
    history,
  };
}

export async function issueApiKey(input: {
  connectionId: string;
  groupUuid: string;
  groupName: string;
  lineUuid: string;
  lineName: string;
  name?: string;
  environment?: KeyEnvironment;
  expiresAt?: string | null;
}) {
  return issueStoredApiKey(input);
}

export async function getIssuedKey(key: string) {
  return getStoredIssuedKey(key);
}

export async function revokeApiKey(key: string) {
  return revokeStoredApiKey(key);
}

export async function setApiKeyStatus(key: string, status: KeyStatus) {
  return setStoredApiKeyStatus(key, status);
}

export async function rotateApiKey(key: string) {
  return rotateStoredApiKey(key);
}

export async function getIssuedKeys(connectionId?: string | null) {
  await hydrate();
  const stored = await listStoredApiKeys(connectionId);
  return stored.map((item) => {
    const line = item.line ? lines.get(item.line.uuid) ?? null : null;
    const group = line ? groups.get(line.groupUuid) ?? null : null;
    return {
      ...item,
      line: line
        ? {
            uuid: line.uuid,
            nameTh: line.nameTh,
            nameEn: line.nameEn,
            nameJa: line.nameJa,
          }
        : item.line,
      group: group
        ? {
            uuid: group.uuid,
            nameTh: group.nameTh,
            nameEn: group.nameEn,
            nameJa: group.nameJa,
          }
        : item.group,
    };
  });
}

export async function applyMonitorRows(
  rows: { uuid: string; statusUuid: string | null; productUuid: string | null }[],
) {
  await hydrate();
  const receivedAt = new Date().toISOString();
  let updated = 0;

  for (const row of rows) {
    const line = lines.get(row.uuid);
    if (!line) continue;
    lines.set(row.uuid, {
      ...line,
      currentStatusUuid: row.statusUuid ?? line.currentStatusUuid,
      productUuid: row.productUuid ?? line.productUuid,
      receivedAt,
    });
    if (row.statusUuid) rememberHistory(row.uuid, row.statusUuid, null, receivedAt);
    updated += 1;
  }

  if (updated > 0) persist();
  return updated;
}

export async function knownLineUuids() {
  await hydrate();
  return [...lines.keys()].filter((id) => id !== UNGROUPED);
}

export async function getLine(lineUuid: string) {
  await hydrate();
  return lines.get(lineUuid) ?? null;
}

export async function isStatusForLine(lineUuid: string, statusUuid: string) {
  await hydrate();
  return statusMap(lineUuid).has(statusUuid);
}

export async function getSession(): Promise<string | null> {
  await hydrate();
  return (await getActiveConnection())?.session || webhookSession || null;
}

export async function getSessionSource(): Promise<"connection" | "webhook" | null> {
  await hydrate();
  if ((await getActiveConnection())?.session) return "connection";
  if (webhookSession) return "webhook";
  return null;
}

export async function isPushAuthorized(apiKey: string | null) {
  return isStoredPushAuthorized(apiKey);
}

export async function getPushKeyAssignment(apiKey: string | null) {
  return getStoredPushKeyAssignment(apiKey);
}
