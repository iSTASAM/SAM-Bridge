import { NextResponse } from "next/server";
import { POST as readLostTime } from "@/app/api/connections/[id]/lost-time/route";
import { authenticateGptAction, isGptCompanyAllowed } from "@/lib/gpt-actions";
import { getConnection } from "@/lib/ixacs-connections";
import { periodWarnings, resolveGptActionPeriod, type GptActionPeriod } from "@/lib/gpt-action-period";

export const dynamic = "force-dynamic";

type LostTimeTopic = {
  key?: unknown;
  status?: unknown;
  nameJa?: unknown;
  nameEn?: unknown;
  name3rd?: unknown;
};

type LostTimeRow = {
  companyId?: unknown;
  companyName?: unknown;
  productionGroupName?: unknown;
  productionLineUuid?: unknown;
  productionLineName?: unknown;
  minutesByTopic?: unknown;
  countByTopic?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function compactLostTime(
  payload: Record<string, unknown>,
  period: GptActionPeriod,
  company: { id: string; name: string },
  filters?: { lineId?: string; lineName?: string },
) {
  const topics = Array.isArray(payload.topics) ? payload.topics as LostTimeTopic[] : [];
  const allRows = Array.isArray(payload.rows) ? payload.rows as LostTimeRow[] : [];
  const lineId = filters?.lineId?.trim() ?? "";
  const lineName = filters?.lineName?.trim().toLocaleLowerCase("en-US") ?? "";
  const rows = allRows.filter((row) =>
    (!lineId || text(row.productionLineUuid) === lineId) &&
    (!lineName || text(row.productionLineName).toLocaleLowerCase("en-US").includes(lineName)),
  );
  const topicByKey = new Map(topics.map((topic) => [text(topic.key), topic]));
  const causeTotals = new Map<string, { minutes: number; occurrences: number; lines: Set<string> }>();

  const lineSummaries = rows.map((row) => {
    const minutesByTopic = row.minutesByTopic && typeof row.minutesByTopic === "object"
      ? row.minutesByTopic as Record<string, unknown>
      : {};
    const countByTopic = row.countByTopic && typeof row.countByTopic === "object"
      ? row.countByTopic as Record<string, unknown>
      : {};
    const causes = Object.entries(minutesByTopic)
      .map(([key, value]) => ({ key, minutes: finiteNumber(value), occurrences: finiteNumber(countByTopic[key]) }))
      .filter((item) => item.minutes > 0)
      .sort((left, right) => right.minutes - left.minutes);
    const lineId = text(row.productionLineUuid);
    for (const cause of causes) {
      const current = causeTotals.get(cause.key) ?? { minutes: 0, occurrences: 0, lines: new Set<string>() };
      current.minutes += cause.minutes;
      current.occurrences += cause.occurrences;
      if (lineId) current.lines.add(lineId);
      causeTotals.set(cause.key, current);
    }
    return {
      productionLineId: lineId,
      productionLineName: text(row.productionLineName),
      productionGroupName: text(row.productionGroupName),
      totalLostTimeMinutes: rounded(causes.reduce((sum, cause) => sum + cause.minutes, 0)),
      topCauses: causes.slice(0, 10).map((cause) => ({
        cause: causeName(topicByKey.get(cause.key), cause.key),
        minutes: rounded(cause.minutes),
        occurrences: cause.occurrences,
      })),
    };
  }).sort((left, right) => right.totalLostTimeMinutes - left.totalLostTimeMinutes);

  const totalMinutes = [...causeTotals.values()].reduce((sum, cause) => sum + cause.minutes, 0);
  let cumulativeMinutes = 0;
  const pareto = [...causeTotals.entries()]
    .sort((left, right) => right[1].minutes - left[1].minutes)
    .map(([key, cause], index) => {
      cumulativeMinutes += cause.minutes;
      const topic = topicByKey.get(key);
      return {
        rank: index + 1,
        key,
        cause: causeName(topic, key),
        status: text(topic?.status),
        minutes: rounded(cause.minutes),
        occurrences: cause.occurrences,
        percent: totalMinutes ? rounded(cause.minutes / totalMinutes * 100) : 0,
        cumulativePercent: totalMinutes ? rounded(cumulativeMinutes / totalMinutes * 100) : 0,
        linesAffected: cause.lines.size,
      };
    });

  const failedRequestCount = finiteNumber(payload.failedRequestCount);
  const sourceLineCount = finiteNumber(payload.lineCount);
  return {
    ok: true,
    source: "iXacs getShutOffHoursGraphData (same pipeline as the settings Lost Time page)",
    companyId: company.id,
    companyName: company.name,
    period,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    dateCount: period.dateCount,
    sourceLineCount,
    matchedLineCount: rows.length,
    returnedLineCount: lineSummaries.length,
    requestedLineId: lineId || null,
    requestedLineName: filters?.lineName?.trim() || null,
    summary: {
      totalLostTimeMinutes: rounded(totalMinutes),
      causeCount: pareto.length,
      eventCount: [...causeTotals.values()].reduce((sum, cause) => sum + cause.occurrences, 0),
      note: "Aggregated from iXacs getShutOffHoursGraphData. The source provides duration and occurrence counts, not timeline events.",
    },
    units: { lostTime: "minutes", occurrences: "count" },
    dataQuality: {
      complete: failedRequestCount === 0,
      failedRequestCount,
      cachedLineCount: finiteNumber(payload.cachedLineCount),
      fetchedLineCount: finiteNumber(payload.fetchedLineCount),
    },
    warnings: periodWarnings(period, failedRequestCount === 0),
    pareto,
    lines: lineSummaries,
  };
}

function causeName(topic: LostTimeTopic | undefined, fallback: string) {
  return text(topic?.name3rd) || text(topic?.nameEn) || text(topic?.nameJa) || text(topic?.status) || fallback;
}

export async function GET(request: Request) {
  if (!authenticateGptAction(request)) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  const company = companyId ? await getConnection(companyId) : null;
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!isGptCompanyAllowed(companyId)) {
    return NextResponse.json({ error: "This API key cannot access the requested company" }, { status: 403 });
  }
  const lineId = url.searchParams.get("lineId")?.trim() ?? "";
  const lineName = url.searchParams.get("lineName")?.trim() ?? "";
  const periodResult = resolveGptActionPeriod(url);
  if (!periodResult.ok) return NextResponse.json({ error: periodResult.error }, { status: 400 });
  const internal = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(periodResult.body),
  });
  const response = await readLostTime(internal, { params: Promise.resolve({ id: companyId }) });
  if (!response.ok) return response;
  const payload = await response.json() as Record<string, unknown>;
  const compact = compactLostTime(payload, periodResult.period, company, { lineId, lineName });
  if ((lineId || lineName) && compact.matchedLineCount === 0) {
    const availableLines = (Array.isArray(payload.rows) ? payload.rows : [])
      .filter((row): row is LostTimeRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      .slice(0, 100)
      .map((row) => ({ id: text(row.productionLineUuid), name: text(row.productionLineName) }));
    return NextResponse.json({
      error: "Production line not found",
      requestedLineId: lineId || null,
      requestedLineName: lineName || null,
      availableLines,
    }, { status: 404 });
  }
  return NextResponse.json(compact, {
    headers: { "cache-control": "no-store" },
  });
}
