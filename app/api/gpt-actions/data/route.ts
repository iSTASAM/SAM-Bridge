import { NextResponse } from "next/server";
import { POST as readConnectionData } from "@/app/api/connections/[id]/data/route";
import { authenticateGptAction, isGptCompanyAllowed } from "@/lib/gpt-actions";
import { getConnection } from "@/lib/ixacs-connections";
import { periodWarnings, resolveGptActionPeriod, type GptActionPeriod } from "@/lib/gpt-action-period";

export const dynamic = "force-dynamic";

const PRODUCTION_FIELDS = [
  "uuid", "productionGroupUuid", "productionGroupName", "productionLineName",
  "statusUuid", "statusName", "product", "productUuid", "bizTime", "planNum",
  "actualNum", "currentCt", "averageCt", "baseCt", "pcsPerHour", "volumeRate",
  "operationalAvailability", "operatingTime", "stopTime",
] as const;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function metric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").replace(/%$/, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function compactProduction(
  payload: Record<string, unknown>,
  period: GptActionPeriod,
  company: { id: string; name: string },
  lineId: string,
  lineName: string,
) {
  const sourceRows = Array.isArray(payload.rows)
    ? payload.rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
  const normalizedName = lineName.trim().toLocaleLowerCase();
  const matchingRows = sourceRows.filter((row) => {
    if (lineId && text(row.uuid) !== lineId) return false;
    if (normalizedName && !text(row.productionLineName).toLocaleLowerCase().includes(normalizedName)) return false;
    return true;
  });
  const rows: Array<Record<string, unknown> & { achievementPercent: number | null }> = matchingRows.slice(0, 100).map((row) => {
    const compact = Object.fromEntries(PRODUCTION_FIELDS.map((field) => [field, row[field] ?? null]));
    const plan = metric(row.planNum);
    const actual = metric(row.actualNum);
    return {
      ...compact,
      achievementPercent: plan && actual !== null ? Math.round(actual / plan * 10_000) / 100 : null,
    };
  });
  const totalPlan = rows.reduce((sum, row) => sum + (metric(row.planNum) ?? 0), 0);
  const totalActual = rows.reduce((sum, row) => sum + (metric(row.actualNum) ?? 0), 0);
  const coverage = payload.coverage && typeof payload.coverage === "object"
    ? payload.coverage as Record<string, unknown>
    : null;
  const coverageComplete = coverage?.complete !== false;
  return {
    ok: true,
    source: "iXacs production data (same pipeline as the settings data page)",
    companyId: company.id,
    companyName: company.name,
    period,
    mode: payload.mode,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    dateCount: period.dateCount,
    receivedAt: payload.receivedAt,
    requestedLineId: lineId || null,
    requestedLineName: lineName || null,
    matchedLineCount: matchingRows.length,
    returnedLineCount: rows.length,
    truncated: matchingRows.length > rows.length,
    summary: {
      totalPlan: Math.round(totalPlan * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      achievementPercent: totalPlan > 0 ? Math.round(totalActual / totalPlan * 10_000) / 100 : null,
    },
    units: {
      planNum: "pcs",
      actualNum: "pcs",
      currentCt: "sec",
      averageCt: "sec",
      baseCt: "sec",
      pcsPerHour: "pcs/hour",
      volumeRate: "percent",
      operationalAvailability: "percent",
      operatingTime: "hour",
      stopTime: "hour",
    },
    coverage,
    warnings: periodWarnings(period, coverageComplete),
    rows,
  };
}

export async function GET(request: Request) {
  if (!authenticateGptAction(request)) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  const lineId = url.searchParams.get("lineId")?.trim() ?? "";
  const lineName = url.searchParams.get("lineName")?.trim() ?? "";
  const company = companyId ? await getConnection(companyId) : null;
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!isGptCompanyAllowed(companyId)) {
    return NextResponse.json({ error: "This API key cannot access the requested company" }, { status: 403 });
  }
  const periodResult = resolveGptActionPeriod(url);
  if (!periodResult.ok) return NextResponse.json({ error: periodResult.error }, { status: 400 });
  const internal = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(periodResult.body),
  });
  const response = await readConnectionData(internal, { params: Promise.resolve({ id: companyId }) });
  if (!response.ok) return response;
  const payload = await response.json() as Record<string, unknown>;
  const compact = compactProduction(payload, periodResult.period, company, lineId, lineName);
  if ((lineId || lineName) && compact.matchedLineCount === 0) {
    const availableLines = (Array.isArray(payload.rows) ? payload.rows : [])
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      .slice(0, 100)
      .map((row) => ({ id: text(row.uuid), name: text(row.productionLineName) }));
    return NextResponse.json({
      error: "Production line not found",
      requestedLineId: lineId || null,
      requestedLineName: lineName || null,
      availableLines,
    }, { status: 404 });
  }
  return NextResponse.json(compact, { headers: { "cache-control": "no-store" } });
}
