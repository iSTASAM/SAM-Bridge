import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type ExcelExportSnapshotPayload = {
  table: string;
  dateFrom: string;
  dateTo: string;
  partial: boolean;
  warnings: Array<{ from: string; to: string; error: string }>;
  value: Record<string, unknown>[];
};

type SnapshotGlobals = typeof globalThis & {
  __excelExportSnapshotMemory?: Map<string, { expiresAt: number; payload: ExcelExportSnapshotPayload }>;
};

const shared = globalThis as SnapshotGlobals;
const memoryCache = shared.__excelExportSnapshotMemory ??= new Map();

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  return value.slice(0, 10);
}

function cacheKey(exportId: string, dateFrom: string, dateTo: string, historyDays: number) {
  return `${exportId}:${dateFrom}:${dateTo}:${historyDays}`;
}

export function excelSnapshotTtlMs(includesToday: boolean) {
  // Slightly longer than a 1-minute Excel refresh so auto-refresh usually hits cache.
  return includesToday ? 90_000 : 24 * 60 * 60_000;
}

export async function readExcelExportSnapshot(
  exportId: string,
  dateFrom: string,
  dateTo: string,
  historyDays: number,
  includesToday: boolean,
): Promise<ExcelExportSnapshotPayload | null> {
  const ttlMs = excelSnapshotTtlMs(includesToday);
  const key = cacheKey(exportId, dateFrom, dateTo, historyDays);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  if (!supabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("excel_export_snapshots")
    .select("date_from, date_to, history_days, payload, updated_at")
    .eq("export_id", exportId)
    .maybeSingle();
  if (error || !data) return null;
  if (normalizeIsoDate(data.date_from) !== dateFrom || normalizeIsoDate(data.date_to) !== dateTo) return null;
  if (Number(data.history_days) !== historyDays) return null;

  const updatedAt = Date.parse(String(data.updated_at));
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > ttlMs) return null;

  const payload = data.payload as ExcelExportSnapshotPayload;
  if (!payload || !Array.isArray(payload.value)) return null;

  memoryCache.set(key, { expiresAt: updatedAt + ttlMs, payload });
  return payload;
}

export async function writeExcelExportSnapshot(
  exportId: string,
  dateFrom: string,
  dateTo: string,
  historyDays: number,
  includesToday: boolean,
  payload: ExcelExportSnapshotPayload,
) {
  const ttlMs = excelSnapshotTtlMs(includesToday);
  const key = cacheKey(exportId, dateFrom, dateTo, historyDays);
  memoryCache.set(key, { expiresAt: Date.now() + ttlMs, payload });

  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("excel_export_snapshots").upsert({
    export_id: exportId,
    date_from: dateFrom,
    date_to: dateTo,
    history_days: historyDays,
    payload,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteExcelExportSnapshot(exportId: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`${exportId}:`)) memoryCache.delete(key);
  }
  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("excel_export_snapshots").delete().eq("export_id", exportId);
}
