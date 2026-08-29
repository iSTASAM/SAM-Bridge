import { NextResponse } from "next/server";
import { serveTabularExport } from "@/app/api/power-bi/exports/[id]/route";
import { getExportConfig, recordExportRun } from "@/lib/export-configs";
import { buildExcelWorkbook, excelFilename } from "@/lib/excel-workbook";

export const dynamic = "force-dynamic";

type TablePayload = {
  table?: string;
  value?: Array<Record<string, unknown>>;
  error?: string;
};

function bangkokOffsetDays(daysAgo: number) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(`${value.year}-${value.month}-${value.day}T00:00:00Z`);
  const from = new Date(today.valueOf() - (daysAgo - 1) * 86_400_000);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

async function fetchExcelTable(request: Request, id: string, apiKey: string, table: string, from?: string, to?: string) {
  const url = new URL(request.url);
  url.pathname = `/api/excel/exports/${id}`;
  url.search = "";
  url.searchParams.set("table", table);
  if (from) url.searchParams.set("from", from);
  if (to) url.searchParams.set("to", to);
  const response = await serveTabularExport(
    new Request(url, { headers: { authorization: `Bearer ${apiKey}` } }),
    id,
    "excel",
  );
  const body = (await response.json().catch(() => ({}))) as TablePayload;
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "EXCEL_EXPORT_FAILED");
  }
  return {
    name: body.table || (table === "current" ? "tblSAMCurrent" : "tblSAMProduction"),
    rows: Array.isArray(body.value) ? body.value : [],
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getExportConfig(id);
  if (!config) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (config.destinationType !== "excel") {
    return NextResponse.json({ error: "NOT_AN_EXCEL_EXPORT" }, { status: 400 });
  }
  if (!config.excelApiKey || config.excelSettings.tables.length === 0) {
    return NextResponse.json({ error: "EXCEL_EXPORT_NOT_READY" }, { status: 400 });
  }

  try {
    const range = bangkokOffsetDays(config.excelSettings.historyDays);
    const sheets = [];
    if (config.excelSettings.tables.includes("history")) {
      sheets.push(await fetchExcelTable(request, id, config.excelApiKey, "production", range.from, range.to));
    }
    if (config.excelSettings.tables.includes("current")) {
      sheets.push(await fetchExcelTable(request, id, config.excelApiKey, "current"));
    }
    if (sheets.length === 0) {
      return NextResponse.json({ error: "NO_EXCEL_TABLES" }, { status: 400 });
    }

    const buffer = await buildExcelWorkbook(sheets);
    const filename = excelFilename(config.name);
    recordExportRun(id, true);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXCEL_EXPORT_FAILED";
    recordExportRun(id, false, message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
