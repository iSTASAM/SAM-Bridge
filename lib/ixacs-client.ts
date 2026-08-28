import type { IxacsConnection } from "@/lib/ixacs-connections";

export type IxacsTarget = {
  baseUrl: string;
  basicAuth: string;
  session: string;
  refreshSession?: () => Promise<string>;
};

export type IxacsCallResult = {
  ok: boolean;
  status: number;
  url: string;
  requestBody: string;
  responseText: string;
  responseJson: unknown;
  error?: string;
};

export type IxacsLineDiscoveryResult = {
  ok: boolean;
  groupUuids: string[];
  lineUuids: string[];
  groups: IxacsProductionGroup[];
  /** Flat unique catalog (all lines). Prefer statusesByLine for per-line UIs. */
  statuses: IxacsStatus[];
  /** Selectable andon statuses for each production line (from realtime modals). */
  statusesByLine: Record<string, IxacsStatus[]>;
  error?: string;
};

export type IxacsStatus = {
  uuid: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
};

export type IxacsProductionLine = {
  uuid: string;
  name: string;
};

export type IxacsProductionGroup = {
  uuid: string;
  name: string;
  lines: IxacsProductionLine[];
};

const DUMMY_LINE = "00000000-0000-0000-0000-000000000001";
const DISCOVERY_CACHE_MS = 5 * 60 * 1000;
const discoveryCache = new Map<
  string,
  { expiresAt: number; result: IxacsLineDiscoveryResult }
>();
const DISCOVERY_CACHE_VERSION = "statuses-by-line-v1";

export function connectionAsTarget(connection: IxacsConnection): IxacsTarget {
  let refreshing: Promise<string> | null = null;
  const target: IxacsTarget = {
    baseUrl: connection.baseUrl,
    basicAuth: connection.basicAuth,
    session: connection.session,
    refreshSession: async () => {
      if (refreshing) return refreshing;
      refreshing = (async () => {
        const [{ loginIxacs }, connectionStore] = await Promise.all([
          import("@/lib/ixacs-login"),
          import("@/lib/ixacs-connections"),
        ]);
        const current = await connectionStore.getConnection(connection.id);
        if (!current?.password) return "";
        const login = await loginIxacs({
          loginUrl: current.loginUrl,
          customerId: current.customers.length > 0 ? "" : current.customerId,
          selectedCustomerId: current.customerId || undefined,
          loginId: current.loginId,
          password: current.password,
          basicAuth: current.basicAuth,
        });
        if (!login.ok || !login.session) {
          await connectionStore.markConnectionResult(
            connection.id,
            false,
            login.error ?? "Automatic login failed",
          );
          return "";
        }
        target.session = login.session;
        await connectionStore.rememberSessionOnConnection(connection.id, login.session);
        return login.session;
      })().finally(() => {
        refreshing = null;
      });
      return refreshing;
    },
  };
  return target;
}

function originOf(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function authorizationHeader(basicAuth: string) {
  if (!basicAuth) return null;
  return basicAuth.startsWith("Basic ") ? basicAuth : `Basic ${basicAuth}`;
}

function valuesFromInputs(html: string, idPrefix: string) {
  const values: string[] = [];
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const id = tag.match(/\bid=["']([^"']+)["']/i)?.[1] ?? "";
    const value = tag.match(/\bvalue=["']([^"']+)["']/i)?.[1] ?? "";
    if (id.startsWith(idPrefix) && value) values.push(value);
  }
  return [...new Set(values)];
}

function decodeHtmlText(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      return named[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function parseGroupNames(html: string) {
  const names = new Map<string, string>();
  for (const match of html.matchAll(
    /<label\b[^>]*\bfor=["']g2-([^"']+)["'][^>]*>([\s\S]*?)<\/label>/gi,
  )) {
    names.set(match[1], decodeHtmlText(match[2]));
  }
  return names;
}

function parseProductionGroups(
  groupHtml: string,
  realtimeHtml: string,
  groupUuids: string[],
) {
  const groupNames = parseGroupNames(groupHtml);
  const linesByGroup = new Map<string, IxacsProductionLine[]>();

  for (const match of realtimeHtml.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    const uuid = row.match(
      /<input\b[^>]*\bid=["']productLineId_[^"']+["'][^>]*\bvalue=["']([^"']+)["']/i,
    )?.[1];
    if (!uuid) continue;

    const groupUuid = row.match(/[?&](?:amp;)?groupUuid=([^&"']+)/i)?.[1] ?? "";
    const nameHtml = row.match(
      /<td\b[^>]*\bclass=["'][^"']*\bs-proline\b[^"']*["'][^>]*>([\s\S]*?)<a\b/i,
    )?.[1];
    const name = decodeHtmlText(nameHtml ?? "") || uuid;
    const lines = linesByGroup.get(groupUuid) ?? [];
    lines.push({ uuid, name });
    linesByGroup.set(groupUuid, lines);
  }

  const knownGroups = groupUuids.map((uuid) => ({
    uuid,
    name: groupNames.get(uuid) || uuid,
    lines: linesByGroup.get(uuid) ?? [],
  }));
  const known = new Set(groupUuids);
  for (const [uuid, lines] of linesByGroup) {
    if (!known.has(uuid)) {
      knownGroups.push({ uuid, name: groupNames.get(uuid) || uuid || "Ungrouped", lines });
    }
  }
  return knownGroups;
}

type StatusColors = {
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
};

function parseStatusColors(html: string) {
  const colors = new Map<string, StatusColors>();
  for (const match of html.matchAll(/\.cls_([\da-f-]+)\s*\{([^}]*)\}/gi)) {
    const rules = match[2];
    const backgroundColor = rules.match(/background-color\s*:\s*(#[\da-f]{3,8})/i)?.[1] ?? null;
    const textColor = rules.match(/(?:^|;)\s*color\s*:\s*(#[\da-f]{3,8})/i)?.[1] ?? null;
    const blinking = /animation\s*:/i.test(rules) || /blink/i.test(rules);
    colors.set(match[1], {
      backgroundColor,
      textColor,
      blinking,
      blinkingBackgroundColor: blinking ? backgroundColor : null,
      blinkingTextColor: blinking ? textColor : null,
    });
  }

  for (const match of html.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}/gi)) {
    const block = match[2];
    const frames = [...block.matchAll(/background-color\s*:\s*(#[\da-f]{3,8})/gi)].map((item) => item[1]);
    const textFrames = [...block.matchAll(/(?:^|[;{])\s*color\s*:\s*(#[\da-f]{3,8})/gi)].map((item) => item[1]);
    if (frames.length < 2 && textFrames.length < 2) continue;
    const uuidMatch = match[1].match(/([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})/i);
    if (!uuidMatch) continue;
    const current = colors.get(uuidMatch[1]);
    if (!current) continue;
    colors.set(uuidMatch[1], {
      ...current,
      blinking: true,
      blinkingBackgroundColor: frames[1] ?? frames[0] ?? current.backgroundColor,
      blinkingTextColor: textFrames[1] ?? textFrames[0] ?? current.textColor,
    });
  }
  return colors;
}

/** iXacs sometimes emits unresolved message keys like ??out.of.biz.hour_th?? */
function normalizeStatusName(raw: string, uuid: string) {
  const name = decodeHtmlText(raw);
  if (!name) return uuid;
  if (/^\?\?.+\?\?$/.test(name)) {
    if (/out\.of\.biz\.hour/i.test(name)) return "นอกเวลาทำงาน";
    return "";
  }
  return name;
}

function statusFromParts(
  uuid: string,
  rawName: string,
  colors: Map<string, StatusColors>,
): IxacsStatus | null {
  const name = normalizeStatusName(rawName, uuid);
  if (!name) return null;
  const statusColors = colors.get(uuid);
  return {
    uuid,
    name,
    backgroundColor: statusColors?.backgroundColor ?? null,
    textColor: statusColors?.textColor ?? null,
    blinking: statusColors?.blinking ?? false,
    blinkingBackgroundColor: statusColors?.blinkingBackgroundColor ?? null,
    blinkingTextColor: statusColors?.blinkingTextColor ?? null,
  };
}

function parseStatuses(html: string): IxacsStatus[] {
  const colors = parseStatusColors(html);
  const statuses = new Map<string, IxacsStatus>();
  for (const match of html.matchAll(
    /<div\b[^>]*\bid=["']st_([\da-f-]+)["'][^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const status = statusFromParts(match[1], match[2], colors);
    if (status) statuses.set(status.uuid, status);
  }
  return [...statuses.values()];
}

/** Per-line selectable statuses from andon_reg modals on the realtime monitor page. */
function parseStatusesByLine(html: string): Record<string, IxacsStatus[]> {
  const colors = parseStatusColors(html);
  const catalogNames = new Map<string, string>();
  for (const match of html.matchAll(
    /<div\b[^>]*\bid=["']st_([\da-f-]+)["'][^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const name = normalizeStatusName(match[2], match[1]);
    if (name) catalogNames.set(match[1], name);
  }

  const byLine: Record<string, IxacsStatus[]> = {};
  const modalStarts = [...html.matchAll(/id=["']andon_reg(\d+-\d+)["']/gi)];
  for (let index = 0; index < modalStarts.length; index += 1) {
    const start = modalStarts[index].index ?? 0;
    const end =
      index + 1 < modalStarts.length
        ? (modalStarts[index + 1].index ?? html.length)
        : html.length;
    const block = html.slice(start, end);
    const lineUuid = block.match(
      /id=["']productionLineUuid_\d+-\d+["'][^>]*\bvalue=["']([^"']+)["']/i,
    )?.[1];
    if (!lineUuid) continue;

    const statuses = new Map<string, IxacsStatus>();
    for (const match of block.matchAll(
      /id=["']andonStatusStyleUuid_\d+-\d+-\d+["'][^>]*\bvalue=["']([^"']+)["']/gi,
    )) {
      const uuid = match[1];
      if (statuses.has(uuid)) continue;
      const named = block.match(
        new RegExp(
          `class=["'][^"']*\\bcls_${uuid}\\b[^"']*["'][^>]*>([\\s\\S]*?)</a>`,
          "i",
        ),
      )?.[1];
      const status = statusFromParts(uuid, named ?? catalogNames.get(uuid) ?? uuid, colors);
      if (status) statuses.set(status.uuid, status);
    }

    byLine[lineUuid] = [...statuses.values()];
  }
  return byLine;
}

export async function ixacsWebGet(target: IxacsTarget, url: string, canRetry = true) {
  const headers: Record<string, string> = {};
  const authorization = authorizationHeader(target.basicAuth);
  if (authorization) headers.authorization = authorization;
  if (target.session) headers.cookie = `last_langage=; SESSION=${target.session}`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  const finalUrl = new URL(response.url);
  const unauthorized =
    response.status === 401 ||
    response.status === 403 ||
    finalUrl.pathname === "/gateway/web/login" ||
    /\bname=["']customerId["']/i.test(text);
  if (unauthorized && canRetry && target.refreshSession && await target.refreshSession()) {
    return ixacsWebGet(target, url, false);
  }
  return { ok: response.ok && !unauthorized, status: response.status, text };
}

export async function discoverIxacsLines(
  target: IxacsTarget,
): Promise<IxacsLineDiscoveryResult> {
  const origin = originOf(target.baseUrl);
  const cacheKey = `${DISCOVERY_CACHE_VERSION}:${origin}:${target.session}`;
  const cached = discoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const empty = {
    groupUuids: [] as string[],
    lineUuids: [] as string[],
    groups: [] as IxacsProductionGroup[],
    statuses: [] as IxacsStatus[],
    statusesByLine: {} as Record<string, IxacsStatus[]>,
  };

  try {
    const groupPage = await ixacsWebGet(
      target,
      `${origin}/ct-monitor/web/ctMonitor/summary/selectGroup`,
    );
    if (!groupPage.ok) {
      return {
        ok: false,
        ...empty,
        error: "Could not open the CT Monitor group page",
      };
    }

    const groupUuids = valuesFromInputs(groupPage.text, "g2-");
    if (groupUuids.length === 0) {
      const directLines = valuesFromInputs(groupPage.text, "productLineId_");
      return {
        ok: directLines.length > 0,
        ...empty,
        groupUuids: [],
        lineUuids: directLines,
        error: directLines.length > 0 ? undefined : "No production groups were found",
      };
    }

    const realtimeUrl = new URL(
      "/ct-monitor/web/ctMonitor/monitor/realtime",
      origin,
    );
    realtimeUrl.searchParams.set("groupUuids", groupUuids.join(","));
    const realtimePage = await ixacsWebGet(target, realtimeUrl.toString());
    if (!realtimePage.ok) {
      return {
        ok: false,
        ...empty,
        groupUuids,
        error: "Could not open the CT Monitor realtime page",
      };
    }

    const groups = parseProductionGroups(groupPage.text, realtimePage.text, groupUuids);
    const statusesByLine = parseStatusesByLine(realtimePage.text);
    const statuses = parseStatuses(realtimePage.text);
    const lineUuids = groups.flatMap((group) => group.lines.map((line) => line.uuid));
    const result = {
      ok: lineUuids.length > 0,
      groupUuids,
      lineUuids,
      groups,
      statuses,
      statusesByLine,
      error: lineUuids.length > 0 ? undefined : "No production lines were found",
    };
    if (result.ok) {
      discoveryCache.set(cacheKey, { expiresAt: Date.now() + DISCOVERY_CACHE_MS, result });
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      ...empty,
      error: error instanceof Error ? error.message : "Line discovery failed",
    };
  }
}

/** Full status catalog for one line from the CT Monitor detail page (includes auto statuses). */
export async function discoverIxacsLineStatuses(
  target: IxacsTarget,
  groupUuid: string,
  productionLineUuid: string,
): Promise<IxacsStatus[]> {
  const origin = originOf(target.baseUrl);
  const detailUrl = new URL("/ct-monitor/web/ctMonitor/detail/realtime", origin);
  detailUrl.searchParams.set("groupUuid", groupUuid);
  detailUrl.searchParams.set("productionLineUuid", productionLineUuid);
  const page = await ixacsWebGet(target, detailUrl.toString());
  if (!page.ok) return [];
  return parseStatuses(page.text);
}

export function bangkokBizDate(ms = Date.now()) {
  return new Date(ms).toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" });
}

export async function ixacsFormPost(
  target: IxacsTarget,
  apiPath: string,
  body: URLSearchParams,
  options?: { referer?: string },
  canRetry = true,
): Promise<IxacsCallResult> {
  const origin = originOf(target.baseUrl);
  const url = `${origin}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const requestBody = body.toString();
  const headers: Record<string, string> = {
    accept: "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    priority: "u=1, i",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0",
    "x-requested-with": "XMLHttpRequest",
    origin,
    referer: options?.referer ?? `${origin}/ct-monitor/web/ctMonitor/monitor/realtime`,
  };

  const authorization = authorizationHeader(target.basicAuth);
  if (authorization) headers.authorization = authorization;
  if (target.session) headers.cookie = `SESSION=${target.session}; last_langage=`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: requestBody,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await response.text();
  let responseJson: unknown = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    responseJson = null;
  }

  const looksLikeLogin =
    response.status === 401 ||
    response.status === 403 ||
    (typeof responseText === "string" &&
      /<html/i.test(responseText) &&
      /login|session/i.test(responseText));

  if (looksLikeLogin && canRetry && target.refreshSession && await target.refreshSession()) {
    return ixacsFormPost(target, apiPath, body, options, false);
  }

  const success =
    response.ok &&
    responseJson !== null &&
    !looksLikeLogin &&
    !(
      typeof responseJson === "object" &&
      responseJson !== null &&
      "success" in responseJson &&
      (responseJson as { success?: boolean }).success === false
    );

  return {
    ok: success,
    status: response.status,
    url,
    requestBody,
    responseText,
    responseJson,
    error: success
      ? undefined
      : looksLikeLogin
        ? "Session expired or unauthorized"
        : `HTTP ${response.status}`,
  };
}

export async function getCtMonitorData(
  target: IxacsTarget,
  productionLineUuids: string[],
  options?: { bizDate?: string; bizDates?: string[]; realTime?: boolean; referer?: string },
) {
  const body = new URLSearchParams();
  const lines = productionLineUuids.length > 0 ? productionLineUuids : [DUMMY_LINE];
  for (const uuid of lines) body.append("productionLines", uuid);
  const bizDates = options?.bizDates?.length
    ? options.bizDates
    : [options?.bizDate ?? bangkokBizDate()];
  for (const bizDate of bizDates) body.append("bizDates", bizDate);
  body.set("bizTimeFrom", "");
  body.set("bizTimeTo", "");
  body.set("productUuid", "");
  body.set("onlyProductFlg", "1");
  body.set("realTimeFlg", options?.realTime === false ? "0" : "1");
  return ixacsFormPost(target, "/ct-monitor/api/ctMonitor/getCtMonitorData", body, options);
}

export async function getCtMonitorDetailData(
  target: IxacsTarget,
  productionLineUuids: string[],
  options?: { bizDate?: string; bizDates?: string[]; realTime?: boolean; referer?: string },
) {
  const body = new URLSearchParams();
  const lines = productionLineUuids.length > 0 ? productionLineUuids : [DUMMY_LINE];
  for (const uuid of lines) body.append("productionLines", uuid);
  const bizDates = options?.bizDates?.length
    ? options.bizDates
    : [options?.bizDate ?? bangkokBizDate()];
  for (const bizDate of bizDates) body.append("bizDates", bizDate);
  body.set("bizTimeFrom", "");
  body.set("bizTimeTo", "");
  body.set("productUuid", "");
  body.set("onlyProductFlg", "1");
  body.set("realTimeFlg", options?.realTime === false ? "0" : "1");
  return ixacsFormPost(target, "/ct-monitor/api/ctMonitor/getCtMonitorDetailData", body, options);
}

export async function getStatusGunttData(
  target: IxacsTarget,
  groupUuid: string,
  productionLineUuid: string,
  options?: { bizDates?: string[]; realTime?: boolean },
) {
  const origin = originOf(target.baseUrl);
  const bizDates = options?.bizDates?.length ? options.bizDates : [bangkokBizDate()];
  const firstDate = bizDates[0];
  const query = new URLSearchParams({ groupUuid, productionLineUuid });
  const referer = options?.realTime === false
    ? `${origin}/ct-monitor/web/ctMonitor/detail?${query}&productUuid=&bizDates=${encodeURIComponent(firstDate)}&dispType=`
    : `${origin}/ct-monitor/web/ctMonitor/detail/realtime?${query}`;
  const body = new URLSearchParams({ groupUuid, productionLineUuid, productUuid: "", bizTimeFrom: "", bizTimeTo: "" });
  for (const bizDate of bizDates) body.append("bizDates", bizDate);
  return ixacsFormPost(target, "/ct-monitor/api/ctMonitor/getStatusGunttData", body, { referer });
}

export async function getShutOffHoursGraphData(
  target: IxacsTarget,
  groupUuid: string,
  productionLineUuid: string,
  options?: { bizDate?: string; bizDates?: string[]; realTime?: boolean },
) {
  const origin = originOf(target.baseUrl);
  const bizDates = options?.bizDates?.length
    ? options.bizDates
    : [options?.bizDate ?? bangkokBizDate()];
  const query = new URLSearchParams({ groupUuid, productionLineUuid });
  const historicalQuery = new URLSearchParams({
    groupUuid,
    productionLineUuid,
    productUuid: "",
    dispType: "",
  });
  for (const bizDate of bizDates) historicalQuery.append("bizDates", bizDate);
  const referer = options?.realTime === false
    ? `${origin}/ct-monitor/web/ctMonitor/detail?${historicalQuery}`
    : `${origin}/ct-monitor/web/ctMonitor/detail/realtime?${query}`;

  // iXacs prepares the selected line/date in the web session when the detail
  // page is opened. Calling the graph endpoint without this step returns null.
  const prepared = await ixacsWebGet(target, referer);
  if (!prepared.ok) return prepared;
  return ixacsFormPost(
    target,
    "/ct-monitor/api/ctMonitor/getShutOffHoursGraphData",
    new URLSearchParams(),
    { referer },
  );
}

export type LostTimeSegment = {
  statusUuid: string | null;
  statusName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number | null;
  raw: Record<string, unknown>;
};

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  return null;
}

function numericMinutes(value: unknown, key: string) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  if (/millisecond|durationms|elapsedms|^ms$/i.test(key)) return number / 60_000;
  if (/second|durationsec|elapsedsec/i.test(key)) return number / 60;
  if (/hour/i.test(key)) return number * 60;
  return number;
}

export function summarizeStatusGunttJson(payload: unknown): LostTimeSegment[] {
  const objects: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    objects.push(row);
    Object.values(row).forEach((child) => { if (child && typeof child === "object") visit(child); });
  };
  visit(payload);
  return objects.flatMap((row) => {
    const statusUuidValue = firstValue(row, ["statusUuid", "andonStatusUuid", "statusId", "s", "uuid"]);
    const statusNameValue = firstValue(row, ["statusName", "andonStatusName", "title", "label", "name"]);
    const startValue = firstValue(row, ["startedAt", "startAt", "startDateTime", "startTime", "timeFrom", "from", "start", "st"]);
    const endValue = firstValue(row, ["endedAt", "endAt", "endDateTime", "endTime", "timeTo", "to", "end", "et"]);
    const durationKeys = ["minutes", "durationMinutes", "lostTimeMinutes", "durationMs", "elapsedMs", "durationSeconds", "duration", "elapsed"];
    const durationKey = durationKeys.find((key) => row[key] !== undefined);
    let minutes = durationKey ? numericMinutes(row[durationKey], durationKey) : null;
    if (minutes === null && startValue !== null && endValue !== null) {
      const start = new Date(String(startValue)).valueOf();
      const end = new Date(String(endValue)).valueOf();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) minutes = (end - start) / 60_000;
    }
    if (minutes === null && statusUuidValue === null && startValue === null) return [];
    return [{ statusUuid: statusUuidValue == null ? null : String(statusUuidValue), statusName: statusNameValue == null ? null : String(statusNameValue), startedAt: startValue == null ? null : String(startValue), endedAt: endValue == null ? null : String(endValue), minutes, raw: row }];
  });
}

export type StatusGunttTopic = {
  key: string;
  status: string;
  nameJa: string;
  nameEn: string;
  name3rd: string;
  backgroundColor: string | null;
};

export type StatusGunttTableSummary = {
  topics: StatusGunttTopic[];
  minutesByTopic: Record<string, number>;
};

export type ShutOffHoursSummary = {
  topics: StatusGunttTopic[];
  minutesByTopic: Record<string, number>;
  countByTopic: Record<string, number>;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusGunttTopicKey(row: Record<string, unknown>) {
  return [
    textValue(row.status),
    textValue(row.dispStringJa) || textValue(row.nameJa),
    textValue(row.dispStringEn) || textValue(row.nameEn),
    textValue(row.dispString3rd) || textValue(row.name3rd),
  ].join("\u001f");
}

const EXCLUDED_SHUT_OFF_TOPICS = new Set([
  "power off",
  "หยุดตามแผน",
  "ช่วงพัก",
]);

function isExcludedShutOffTopic(topic: StatusGunttTopic) {
  return [topic.nameJa, topic.nameEn, topic.name3rd].some((name) =>
    EXCLUDED_SHUT_OFF_TOPICS.has(name.trim().toLocaleLowerCase("en-US")),
  );
}

/** Aggregate iXacs shut-off graph series into minutes and occurrence counts. */
export function summarizeShutOffHoursGraph(payload: unknown): ShutOffHoursSummary {
  const root = recordValue(payload);
  const graph = recordValue(root?.shutOffHoursGraphData);
  const series = Array.isArray(graph?.seriesList)
    ? graph.seriesList.map(recordValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
  const topics: StatusGunttTopic[] = [];
  const minutesByTopic: Record<string, number> = {};
  const countByTopic: Record<string, number> = {};

  for (const item of series) {
    const style = recordValue(item.style) ?? {};
    const topic: StatusGunttTopic = {
      key: statusGunttTopicKey(style),
      status: textValue(style.status),
      nameJa: textValue(style.dispStringJa) || textValue(style.nameJa),
      nameEn: textValue(style.dispStringEn) || textValue(style.nameEn),
      name3rd: textValue(style.dispString3rd) || textValue(style.name3rd),
      backgroundColor: textValue(style.bgColor) || null,
    };
    if (!topic.nameJa && !topic.nameEn && !topic.name3rd) continue;
    if (isExcludedShutOffTopic(topic)) continue;
    const seconds = Number(item.timeSeconds);
    const count = Number(item.cnt);
    topics.push(topic);
    minutesByTopic[topic.key] = Number.isFinite(seconds) && seconds >= 0 ? seconds / 60 : 0;
    countByTopic[topic.key] = Number.isFinite(count) && count >= 0 ? count : 0;
  }

  return { topics, minutesByTopic, countByTopic };
}

/** Build columns and durations from the real getStatusGunttData response. */
export function summarizeStatusGunttTable(payload: unknown): StatusGunttTableSummary {
  const root = recordValue(payload);
  const histogram = recordValue(root?.statusHistData);
  if (!histogram) return { topics: [], minutesByTopic: {} };

  const styles = Array.isArray(histogram.styleList)
    ? histogram.styleList.map(recordValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
  const events = Array.isArray(histogram.dataList)
    ? histogram.dataList.map(recordValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];

  const topics: StatusGunttTopic[] = [];
  const styleByLabel = new Map<string, StatusGunttTopic>();
  for (const style of styles) {
    const status = textValue(style.status);
    if (status === "NORMAL") continue;
    const topic: StatusGunttTopic = {
      key: statusGunttTopicKey(style),
      status,
      nameJa: textValue(style.dispStringJa) || textValue(style.nameJa),
      nameEn: textValue(style.dispStringEn) || textValue(style.nameEn),
      name3rd: textValue(style.dispString3rd) || textValue(style.name3rd),
      backgroundColor: textValue(style.bgColor) || null,
    };
    if (!topic.nameJa && !topic.nameEn && !topic.name3rd) continue;
    topics.push(topic);
    for (const label of [topic.nameJa, topic.nameEn, topic.name3rd]) {
      if (label) styleByLabel.set(label, topic);
    }
  }

  const minutesByTopic: Record<string, number> = {};
  for (const event of events) {
    const labels = [
      textValue(event.dispStringJa) || textValue(event.nameJa),
      textValue(event.dispStringEn) || textValue(event.nameEn),
      textValue(event.dispString3rd) || textValue(event.name3rd),
    ];
    const topic = labels.map((label) => styleByLabel.get(label)).find(Boolean);
    if (!topic) continue;

    const length = Number(event.length);
    const begin = Number(event.beginDateMs);
    const end = Number(event.endDateMs);
    const milliseconds = Number.isFinite(length) && length >= 0
      ? length
      : Number.isFinite(begin) && Number.isFinite(end) && end >= begin
        ? end - begin
        : null;
    if (milliseconds === null) continue;
    minutesByTopic[topic.key] = (minutesByTopic[topic.key] ?? 0) + milliseconds / 60_000;
  }

  return { topics, minutesByTopic };
}

export type StatusGunttEvent = {
  status: string;
  nameJa: string;
  nameEn: string;
  name3rd: string;
  backgroundColor: string | null;
  startMs: number;
  endMs: number;
};

function epochMs(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number < 1e11 ? number * 1000 : number;
}

/** Timeline events from getStatusGunttData, including NORMAL / operating status. */
export function listStatusGunttEvents(payload: unknown): StatusGunttEvent[] {
  const root = recordValue(payload);
  const histogram = recordValue(root?.statusHistData);
  if (!histogram) return [];

  const styles = Array.isArray(histogram.styleList)
    ? histogram.styleList.map(recordValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
  const events = Array.isArray(histogram.dataList)
    ? histogram.dataList.map(recordValue).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];

  const styleByLabel = new Map<string, { status: string; nameJa: string; nameEn: string; name3rd: string; backgroundColor: string | null }>();
  const styleByStatus = new Map<string, { status: string; nameJa: string; nameEn: string; name3rd: string; backgroundColor: string | null }>();
  for (const style of styles) {
    const topic = {
      status: textValue(style.status),
      nameJa: textValue(style.dispStringJa) || textValue(style.nameJa),
      nameEn: textValue(style.dispStringEn) || textValue(style.nameEn),
      name3rd: textValue(style.dispString3rd) || textValue(style.name3rd),
      backgroundColor: textValue(style.bgColor) || null,
    };
    if (!topic.status && !topic.nameJa && !topic.nameEn && !topic.name3rd) continue;
    if (topic.status) styleByStatus.set(topic.status, topic);
    for (const label of [topic.nameJa, topic.nameEn, topic.name3rd]) {
      if (label) styleByLabel.set(label, topic);
    }
  }

  const parsed = events.flatMap((event) => {
    const labels = [
      textValue(event.dispStringJa) || textValue(event.nameJa),
      textValue(event.dispStringEn) || textValue(event.nameEn),
      textValue(event.dispString3rd) || textValue(event.name3rd),
    ];
    const status = textValue(event.status);
    const topic = labels.map((label) => styleByLabel.get(label)).find(Boolean)
      ?? (status ? styleByStatus.get(status) : undefined);
    const startMs = epochMs(event.beginDateMs) ?? epochMs(event.startDateMs) ?? epochMs(event.startMs);
    const length = Number(event.length);
    const explicitEnd = epochMs(event.endDateMs) ?? epochMs(event.endMs);
    const endMs = explicitEnd
      ?? (startMs !== null && Number.isFinite(length) && length >= 0 ? startMs + length : null);
    if (startMs === null) return [];
    return [{
      status: topic?.status || status,
      nameJa: topic?.nameJa || labels[0],
      nameEn: topic?.nameEn || labels[1],
      name3rd: topic?.name3rd || labels[2],
      backgroundColor: topic?.backgroundColor ?? (textValue(event.bgColor) || null),
      startMs,
      endMs: endMs ?? startMs,
    }];
  }).sort((left, right) => left.startMs - right.startMs);

  return parsed.map((event, index) => {
    if (event.endMs > event.startMs) return event;
    const next = parsed[index + 1];
    return { ...event, endMs: next ? next.startMs : event.startMs };
  });
}

export function mergeStatusGunttEvents(events: StatusGunttEvent[], rangeEndMs: number) {
  const merged: StatusGunttEvent[] = [];
  for (const event of events) {
    const endMs = event.endMs > event.startMs ? event.endMs : rangeEndMs;
    const previous = merged.at(-1);
    if (
      previous
      && previous.status === event.status
      && previous.nameEn === event.nameEn
      && previous.nameJa === event.nameJa
      && previous.name3rd === event.name3rd
      && event.startMs - previous.endMs <= 1000
    ) {
      previous.endMs = Math.max(previous.endMs, endMs);
      continue;
    }
    merged.push({ ...event, endMs });
  }
  return merged;
}

export async function prepareCtMonitorHistory(
  target: IxacsTarget,
  groupUuids: string[],
  bizDate: string,
) {
  const origin = originOf(target.baseUrl);
  const query = new URLSearchParams();
  for (const uuid of groupUuids) query.append("groupUuids", uuid);
  query.set("bizDate", bizDate);
  const path = `/ct-monitor/web/ctMonitor/monitor?${query}`;
  const result = await ixacsWebGet(target, `${origin}${path}`);
  return { ...result, referer: `${origin}${path}` };
}

export async function probeIxacs(target: IxacsTarget) {
  return getCtMonitorData(target, [DUMMY_LINE]);
}

export type MonitorLineRow = {
  uuid: string;
  statusUuid: string | null;
  product: string | null;
  productUuid: string | null;
  cycleTime: string | null;
  bizTime: string | null;
};

export function summarizeMonitorJson(payload: unknown): MonitorLineRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([uuid, value]) => {
    const row = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      uuid,
      statusUuid: typeof row.s === "string" && row.s ? row.s : null,
      product: typeof row.p === "string" && row.p ? row.p : null,
      productUuid: typeof row.pu === "string" && row.pu ? row.pu : null,
      cycleTime: typeof row.ct === "string" && row.ct ? row.ct : null,
      bizTime: typeof row.bt === "string" && row.bt ? row.bt : null,
    };
  });
}

export type MonitorDetailRow = {
  uuid: string;
  productionGroupUuid: string | null;
  productionGroupName: string | null;
  productionLineName: string | null;
  statusUuid: string | null;
  statusName: string | null;
  statusBackgroundColor: string | null;
  statusTextColor: string | null;
  product: string | null;
  productUuid: string | null;
  bizTime: string | null;
  planNum: string | null;
  actualNum: string | null;
  currentCt: string | null;
  averageCt: string | null;
  baseCt: string | null;
  pcsPerHour: string | null;
  volumeRate: string | null;
  operationalAvailability: string | null;
  operatingTime: string | null;
  stopTime: string | null;
  raw: Record<string, unknown>;
};

function detailValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === "string") return value || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function summarizeMonitorDetailJson(payload: unknown): MonitorDetailRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([uuid, value]) => {
    const row = value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    return {
      uuid,
      productionGroupUuid: null,
      productionGroupName: null,
      productionLineName: null,
      statusUuid: detailValue(row, "s"),
      statusName: null,
      statusBackgroundColor: null,
      statusTextColor: null,
      product: detailValue(row, "p"),
      productUuid: detailValue(row, "pu"),
      bizTime: detailValue(row, "bt"),
      planNum: detailValue(row, "pn"),
      actualNum: detailValue(row, "n"),
      currentCt: detailValue(row, "ct"),
      averageCt: detailValue(row, "act"),
      baseCt: detailValue(row, "bct"),
      pcsPerHour: detailValue(row, "nph"),
      volumeRate: detailValue(row, "vr"),
      operationalAvailability: detailValue(row, "oa"),
      operatingTime: detailValue(row, "t"),
      stopTime: detailValue(row, "ot"),
      raw: row,
    };
  });
}
