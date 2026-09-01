import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";
import { deleteExportRunState } from "@/lib/export-run-state";
import { deleteExportAlertState } from "@/lib/export-alert-state";
import {
  connectionSecretsConfigured,
  decryptSecret,
  encryptSecret,
} from "@/lib/connection-secrets";
import {
  deleteSapConnection,
  getSapConnection,
  publicSapConnection,
  type PublicSapConnection,
} from "@/lib/sap-connections";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import { deleteExcelExportSnapshot } from "@/lib/excel-export-snapshot";

export const DESTINATION_TYPES = [
  "rest",
  "webhook",
  "sap-odata",
  "sftp",
  "database",
  "message-queue",
  "email",
  "line",
  "teams",
  "slack",
  "power-bi",
  "excel",
  "data-warehouse",
] as const;

export type DestinationType = (typeof DESTINATION_TYPES)[number];
export type ExportFormat = "canonical-json" | "flat-json" | "csv";
export type TriggerMode = "manual" | "schedule" | "data-change";
export type PowerBiDataset = "production" | "lost-time";
export type PowerBiSettings = {
  datasets: PowerBiDataset[];
  historyDays: 30 | 90 | 365;
  includeLineDimension: boolean;
  includeDateDimension: boolean;
};
const DEFAULT_POWER_BI_SETTINGS: PowerBiSettings = {
  datasets: ["production", "lost-time"],
  historyDays: 90,
  includeLineDimension: true,
  includeDateDimension: true,
};
export type ExcelTable = "history" | "current";
export type ExcelSettings = Omit<PowerBiSettings, "historyDays"> & {
  tables: ExcelTable[];
  historyDays: number;
  refreshMinutes: 5 | 10 | 15;
  autoRefresh: boolean;
};

function bangkokDaysFromMonthStart(now = new Date()): number {
  const day = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric" }).format(now),
  );
  return Number.isFinite(day) && day > 0 ? day : 1;
}

const DEFAULT_EXCEL_SETTINGS: ExcelSettings = {
  datasets: ["production"],
  tables: ["history", "current"],
  historyDays: bangkokDaysFromMonthStart(),
  includeLineDimension: false,
  includeDateDimension: false,
  refreshMinutes: 15,
  autoRefresh: false,
};
export type SapAction = "production-result" | "custom-mapping";
export type SapSelectedOrder = {
  id: string;
  product: string;
  plant: string;
  plannedQty: string;
  unit: string;
};
export type AlertRule = {
  metric: "currentCtOverBase" | "volumeRate" | "operationalAvailability";
  operator: "below" | "above";
  threshold: number;
  occurrences: number;
};

export type ExportConfig = {
  id: string;
  name: string;
  description: string;
  sourceConnectionId: string;
  groupUuids: string[];
  lineUuids: string[];
  allGroups: boolean;
  allLines: boolean;
  fields: string[];
  destinationType: DestinationType;
  destinationName: string;
  endpoint: string;
  sapConnectionId: string;
  sapAction: SapAction;
  sapOrder: SapSelectedOrder | null;
  sapMappingValidated: boolean;
  sapConfirmationUnit: string;
  format: ExportFormat;
  triggerMode: TriggerMode;
  intervalMinutes: number;
  changesOnly: boolean;
  includeNulls: boolean;
  alertRules: AlertRule[];
  powerBiSettings: PowerBiSettings;
  powerBiApiKey: string;
  excelSettings: ExcelSettings;
  excelApiKey: string;
  status: "draft" | "ready";
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExportConfigInput = Partial<
  Omit<
    ExportConfig,
    | "id"
    | "status"
    | "lastRunAt"
    | "lastRunStatus"
    | "lastRunError"
    | "createdAt"
    | "updatedAt"
    | "powerBiApiKey"
    | "excelApiKey"
  >
>;

export type PublicExportConfig = Omit<ExportConfig, "endpoint"> & {
  endpoint: string;
  endpointConfigured: boolean;
  sapConnection: PublicSapConnection | null;
};

type DbRow = {
  id: string;
  name: string;
  description: string;
  source_connection_id: string | null;
  group_uuids: string[] | null;
  line_uuids: string[] | null;
  all_groups: boolean;
  all_lines: boolean;
  fields: string[] | null;
  destination_type: string;
  destination_name: string;
  endpoint: string;
  sap_connection_id: string;
  sap_action: string;
  sap_order: unknown;
  sap_mapping_validated: boolean;
  sap_confirmation_unit: string;
  format: string;
  trigger_mode: string;
  interval_minutes: number;
  changes_only: boolean;
  include_nulls: boolean;
  alert_rules: unknown;
  power_bi_settings: unknown;
  power_bi_api_key: string;
  excel_settings: unknown;
  excel_api_key: string;
  status: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  created_at: string;
  updated_at: string;
};

const STATE_FILE = path.join(process.cwd(), "data", "export-configs.json");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let drafts = new Map<string, ExportConfig>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function maybeEncrypt(value: string) {
  return connectionSecretsConfigured() ? encryptSecret(value) : value;
}

function maybeDecrypt(value: string) {
  return value.startsWith("enc:v1:") ? decryptSecret(value) : value;
}

function uuidOrNull(value: string) {
  return UUID_RE.test(value) ? value : null;
}

function sapReady(sapConnectionId: string) {
  if (!sapConnectionId) return false;
  return getSapConnection(sapConnectionId)?.lastTestOk === true;
}

function exportStatus(config: Pick<ExportConfig, "destinationType" | "endpoint" | "sapConnectionId" | "triggerMode" | "alertRules" | "powerBiApiKey" | "powerBiSettings" | "excelApiKey" | "excelSettings">): "draft" | "ready" {
  if (
    config.destinationType === "slack" &&
    isSlackWebhookUrl(config.endpoint) &&
    config.triggerMode === "data-change" &&
    config.alertRules.length > 0
  ) return "ready";
  if (config.destinationType === "sap-odata" && sapReady(config.sapConnectionId)) return "ready";
  if (config.destinationType === "power-bi" && config.powerBiApiKey && config.powerBiSettings.datasets.length > 0) return "ready";
  if (config.destinationType === "excel" && config.excelApiKey && config.excelSettings.tables.length > 0) return "ready";
  return "draft";
}

function normalizeStored(config: Partial<ExportConfig> & { id: string }): { config: ExportConfig; generatedApiKey: boolean } {
  const generatedApiKey = !config.powerBiApiKey || !config.excelApiKey;
  const next = {
    id: config.id,
    name: config.name || "Untitled export",
    description: config.description ?? "",
    sourceConnectionId: config.sourceConnectionId ?? "",
    groupUuids: config.groupUuids ?? [],
    lineUuids: config.lineUuids ?? [],
    allGroups: config.allGroups !== false,
    allLines: config.allLines !== false,
    fields: config.fields ?? [],
    destinationType: DESTINATION_TYPES.includes(config.destinationType as DestinationType)
      ? (config.destinationType as DestinationType)
      : "rest",
    destinationName: config.destinationName ?? "",
    endpoint: maybeDecrypt(config.endpoint ?? ""),
    sapConnectionId: config.sapConnectionId ?? "",
    sapAction: (config.sapAction === "custom-mapping" ? "custom-mapping" : "production-result") as SapAction,
    sapOrder: sapOrder(config.sapOrder, null),
    sapMappingValidated: config.sapMappingValidated === true,
    sapConfirmationUnit: config.sapConfirmationUnit?.trim() || "PC",
    format:
      config.format === "flat-json" || config.format === "csv" || config.format === "canonical-json"
        ? config.format
        : "canonical-json",
    triggerMode:
      config.triggerMode === "schedule" || config.triggerMode === "data-change" || config.triggerMode === "manual"
        ? config.triggerMode
        : "manual",
    intervalMinutes: typeof config.intervalMinutes === "number" ? config.intervalMinutes : 15,
    changesOnly: config.changesOnly !== false,
    includeNulls: config.includeNulls === true,
    alertRules: config.alertRules ?? [],
    powerBiSettings: powerBiSettings(config.powerBiSettings, DEFAULT_POWER_BI_SETTINGS),
    powerBiApiKey: config.powerBiApiKey || randomUUID().replaceAll("-", ""),
    excelSettings: excelSettings(config.excelSettings, DEFAULT_EXCEL_SETTINGS),
    excelApiKey: config.excelApiKey || randomUUID().replaceAll("-", ""),
    lastRunAt: config.lastRunAt ?? null,
    lastRunStatus: config.lastRunStatus === "success" || config.lastRunStatus === "error" ? config.lastRunStatus : null,
    lastRunError: config.lastRunError ?? null,
    createdAt: config.createdAt || new Date().toISOString(),
    updatedAt: config.updatedAt || config.createdAt || new Date().toISOString(),
    status: "draft" as const,
  };
  return { config: { ...next, status: exportStatus(next) }, generatedApiKey };
}

function rowToConfig(row: DbRow): ExportConfig {
  return normalizeStored({
    id: row.id,
    name: row.name,
    description: row.description,
    sourceConnectionId: row.source_connection_id ?? "",
    groupUuids: row.group_uuids ?? [],
    lineUuids: row.line_uuids ?? [],
    allGroups: row.all_groups,
    allLines: row.all_lines,
    fields: row.fields ?? [],
    destinationType: row.destination_type as DestinationType,
    destinationName: row.destination_name,
    endpoint: row.endpoint,
    sapConnectionId: row.sap_connection_id,
    sapAction: row.sap_action as SapAction,
    sapOrder: sapOrder(row.sap_order, null),
    sapMappingValidated: row.sap_mapping_validated,
    sapConfirmationUnit: row.sap_confirmation_unit,
    format: row.format as ExportFormat,
    triggerMode: row.trigger_mode as TriggerMode,
    intervalMinutes: row.interval_minutes,
    changesOnly: row.changes_only,
    includeNulls: row.include_nulls,
    alertRules: row.alert_rules as AlertRule[],
    powerBiSettings: row.power_bi_settings as PowerBiSettings,
    powerBiApiKey: maybeDecrypt(row.power_bi_api_key ?? ""),
    excelSettings: row.excel_settings as ExcelSettings,
    excelApiKey: maybeDecrypt(row.excel_api_key ?? ""),
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status as ExportConfig["lastRunStatus"],
    lastRunError: row.last_run_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }).config;
}

function coerceSourceConnectionId(
  connectionId: string,
  validConnectionIds: ReadonlySet<string> | null,
): string {
  const id = connectionId.trim();
  if (!id || !uuidOrNull(id)) return "";
  if (!validConnectionIds) return id;
  return validConnectionIds.has(id) ? id : "";
}

function configToRow(
  config: ExportConfig,
  validConnectionIds: ReadonlySet<string> | null = null,
): Omit<DbRow, "created_at" | "updated_at"> & {
  created_at: string;
  updated_at: string;
} {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    source_connection_id: uuidOrNull(coerceSourceConnectionId(config.sourceConnectionId, validConnectionIds)),
    group_uuids: config.groupUuids,
    line_uuids: config.lineUuids,
    all_groups: config.allGroups,
    all_lines: config.allLines,
    fields: config.fields,
    destination_type: config.destinationType,
    destination_name: config.destinationName,
    endpoint: maybeEncrypt(config.endpoint),
    sap_connection_id: config.sapConnectionId,
    sap_action: config.sapAction,
    sap_order: config.sapOrder,
    sap_mapping_validated: config.sapMappingValidated,
    sap_confirmation_unit: config.sapConfirmationUnit,
    format: config.format,
    trigger_mode: config.triggerMode,
    interval_minutes: config.intervalMinutes,
    changes_only: config.changesOnly,
    include_nulls: config.includeNulls,
    alert_rules: config.alertRules,
    power_bi_settings: config.powerBiSettings,
    power_bi_api_key: maybeEncrypt(config.powerBiApiKey),
    excel_settings: config.excelSettings,
    excel_api_key: maybeEncrypt(config.excelApiKey),
    status: config.status,
    last_run_at: config.lastRunAt,
    last_run_status: config.lastRunStatus,
    last_run_error: config.lastRunError,
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

function hydrateFromFile() {
  if (!existsSync(STATE_FILE)) {
    drafts = new Map();
    return false;
  }
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
      configs?: Record<string, ExportConfig>;
    };
    let generatedApiKey = false;
    drafts = new Map(
      Object.entries(parsed.configs ?? {}).map(([id, raw]) => {
        const { config, generatedApiKey: generated } = normalizeStored({ ...raw, id });
        if (generated) generatedApiKey = true;
        return [id, config];
      }),
    );
    return generatedApiKey;
  } catch {
    drafts = new Map();
    return false;
  }
}

function persistFile() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ configs: Object.fromEntries(drafts) }, null, 2),
    "utf8",
  );
}

/** Remove a stale row from the legacy local file when Supabase is authoritative. */
function purgeLocalExportConfig(id: string) {
  if (!existsSync(STATE_FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
      configs?: Record<string, ExportConfig>;
    };
    if (!parsed.configs?.[id]) return;
    delete parsed.configs[id];
    if (Object.keys(parsed.configs).length === 0) {
      unlinkSync(STATE_FILE);
      return;
    }
    writeFileSync(STATE_FILE, JSON.stringify(parsed, null, 2), "utf8");
  } catch {
    // Best-effort cleanup only.
  }
}

async function loadValidConnectionIds() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("ixacs_connections").select("id");
  if (error) {
    console.warn("export_configs: could not load ixacs_connections for FK check:", error.message);
    return null;
  }
  return new Set((data ?? []).map((row) => String(row.id)));
}

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase.from("export_configs").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(`EXPORTS_LOAD_FAILED: ${error.message}`);
  const rows = (data as DbRow[] | null) ?? [];
  drafts = new Map(rows.map((row) => [row.id, rowToConfig(row)]));
}

async function fetchOneFromSupabase(id: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase.from("export_configs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`EXPORTS_LOAD_FAILED: ${error.message}`);
  return data ? rowToConfig(data as DbRow) : null;
}

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (supabaseConfigured()) {
        await hydrateFromSupabase();
      } else if (hydrateFromFile()) {
        persistFile();
      }
      hydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

async function persistConfig(config: ExportConfig) {
  drafts.set(config.id, config);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const validConnectionIds = await loadValidConnectionIds();
    const coerced = {
      ...config,
      sourceConnectionId: coerceSourceConnectionId(config.sourceConnectionId, validConnectionIds),
    };
    if (
      config.sourceConnectionId &&
      !coerced.sourceConnectionId &&
      validConnectionIds &&
      !validConnectionIds.has(config.sourceConnectionId)
    ) {
      throw new Error("EXPORTS_CONNECTION_NOT_FOUND");
    }
    drafts.set(config.id, coerced);
    const { error } = await supabase.from("export_configs").upsert(configToRow(coerced, validConnectionIds));
    if (error) throw new Error(`EXPORTS_SAVE_FAILED: ${error.message}`);
    if (coerced.destinationType === "excel") await deleteExcelExportSnapshot(coerced.id);
    return;
  }
  persistFile();
}

async function removeConfig(id: string) {
  const current = drafts.get(id);
  drafts.delete(id);

  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("export_configs").delete().eq("id", id);
    if (error) throw new Error(`EXPORTS_DELETE_FAILED: ${error.message}`);
    purgeLocalExportConfig(id);
    await deleteExcelExportSnapshot(id);
  } else {
    if (!current) return false;
    persistFile();
  }

  deleteExportRunState(id);
  deleteExportAlertState(id);
  if (current?.sapConnectionId) deleteSapConnection(current.sapConnectionId);
  return true;
}

function strings(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function alertRules(value: unknown, fallback: AlertRule[]) {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rule = item as Partial<AlertRule>;
    if (rule.metric !== "currentCtOverBase" && rule.metric !== "volumeRate" && rule.metric !== "operationalAvailability") return [];
    const normalized: AlertRule = {
      metric: rule.metric,
      operator: rule.metric === "currentCtOverBase" ? "above" : rule.operator === "above" ? "above" : "below",
      threshold: rule.metric === "currentCtOverBase"
        ? 0
        : typeof rule.threshold === "number" && Number.isFinite(rule.threshold)
          ? rule.threshold
          : 0,
      occurrences: typeof rule.occurrences === "number" && Number.isFinite(rule.occurrences) ? Math.max(1, Math.round(rule.occurrences)) : 1,
    };
    return [normalized];
  });
}

function powerBiSettings(value: unknown, fallback: PowerBiSettings): PowerBiSettings {
  if (!value || typeof value !== "object") return { ...fallback, datasets: [...fallback.datasets] };
  const item = value as Partial<PowerBiSettings>;
  const datasets = strings(item.datasets).filter((dataset): dataset is PowerBiDataset => dataset === "production" || dataset === "lost-time");
  return {
    datasets,
    historyDays: item.historyDays === 30 || item.historyDays === 365 ? item.historyDays : 90,
    includeLineDimension: typeof item.includeLineDimension === "boolean" ? item.includeLineDimension : fallback.includeLineDimension,
    includeDateDimension: typeof item.includeDateDimension === "boolean" ? item.includeDateDimension : fallback.includeDateDimension,
  };
}

function excelSettings(value: unknown, fallback: ExcelSettings): ExcelSettings {
  const item = value && typeof value === "object" ? (value as Partial<ExcelSettings>) : {};
  const rawDays = Number(item.historyDays);
  const historyDays = Number.isFinite(rawDays)
    ? Math.min(3660, Math.max(1, Math.round(rawDays)))
    : fallback.historyDays;
  const tables = strings(item.tables, fallback.tables).filter(
    (table): table is ExcelTable => table === "history" || table === "current",
  );
  return {
    datasets: ["production"],
    historyDays,
    includeLineDimension: false,
    includeDateDimension: false,
    tables: tables.length > 0 ? tables : [...fallback.tables],
    refreshMinutes: item.refreshMinutes === 5 || item.refreshMinutes === 10 ? item.refreshMinutes : 15,
    autoRefresh: typeof item.autoRefresh === "boolean" ? item.autoRefresh : fallback.autoRefresh,
  };
}

function sapOrder(value: unknown, fallback: SapSelectedOrder | null): SapSelectedOrder | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<SapSelectedOrder>;
  if (typeof item.id !== "string" || !item.id.trim()) return fallback;
  return {
    id: item.id.trim(),
    product: typeof item.product === "string" ? item.product : "",
    plant: typeof item.plant === "string" ? item.plant : "",
    plannedQty: typeof item.plannedQty === "string" ? item.plannedQty : "",
    unit: typeof item.unit === "string" && item.unit.trim() ? item.unit : "PC",
  };
}

function applyInput(current: ExportConfig, input: ExportConfigInput): ExportConfig {
  const destinationType = DESTINATION_TYPES.includes(input.destinationType as DestinationType)
    ? (input.destinationType as DestinationType)
    : current.destinationType;
  const destinationChanged = destinationType !== current.destinationType;
  const suppliedEndpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : null;
  const endpoint = destinationChanged
    ? suppliedEndpoint ?? ""
    : destinationType === "slack" && suppliedEndpoint === "" && current.endpoint
      ? current.endpoint
      : suppliedEndpoint ?? current.endpoint;
  const sapConnectionId =
    destinationType === "sap-odata"
      ? typeof input.sapConnectionId === "string"
        ? input.sapConnectionId.trim()
        : destinationChanged
          ? ""
          : current.sapConnectionId
      : "";
  if (current.sapConnectionId && current.sapConnectionId !== sapConnectionId) {
    deleteSapConnection(current.sapConnectionId);
  }
  const resolvedExcelSettings = (() => {
    const settings = excelSettings(input.excelSettings, current.excelSettings ?? DEFAULT_EXCEL_SETTINGS);
    if (destinationType !== "excel") return settings;
    return {
      ...settings,
      tables: settings.tables.length > 0 ? settings.tables : [...DEFAULT_EXCEL_SETTINGS.tables],
    };
  })();
  const next = {
    ...current,
    name: typeof input.name === "string" ? input.name.trim() : current.name,
    description:
      typeof input.description === "string" ? input.description.trim() : current.description,
    sourceConnectionId:
      typeof input.sourceConnectionId === "string"
        ? input.sourceConnectionId
        : current.sourceConnectionId,
    groupUuids: strings(input.groupUuids, current.groupUuids),
    lineUuids: strings(input.lineUuids, current.lineUuids),
    allGroups: typeof input.allGroups === "boolean" ? input.allGroups : current.allGroups,
    allLines: typeof input.allLines === "boolean" ? input.allLines : current.allLines,
    fields: strings(input.fields, current.fields),
    destinationType,
    destinationName:
      typeof input.destinationName === "string"
        ? input.destinationName.trim()
        : current.destinationName,
    endpoint,
    sapConnectionId,
    sapAction:
      input.sapAction === "production-result" || input.sapAction === "custom-mapping"
        ? input.sapAction
        : destinationChanged
          ? "production-result"
          : current.sapAction ?? "production-result",
    sapOrder: destinationType === "sap-odata" ? sapOrder(input.sapOrder, destinationChanged ? null : current.sapOrder ?? null) : null,
    sapMappingValidated:
      destinationType === "sap-odata"
        ? typeof input.sapMappingValidated === "boolean"
          ? input.sapMappingValidated
          : destinationChanged
            ? false
            : current.sapMappingValidated ?? false
        : false,
    sapConfirmationUnit:
      destinationType === "sap-odata"
        ? typeof input.sapConfirmationUnit === "string" && input.sapConfirmationUnit.trim()
          ? input.sapConfirmationUnit.trim().toUpperCase()
          : destinationChanged
            ? "PC"
            : current.sapConfirmationUnit || "PC"
        : "PC",
    format:
      input.format === "canonical-json" || input.format === "flat-json" || input.format === "csv"
        ? input.format
        : current.format,
    triggerMode: destinationType === "slack"
      ? "data-change" as const
      : input.triggerMode === "manual" || input.triggerMode === "schedule" || input.triggerMode === "data-change"
        ? input.triggerMode
        : current.triggerMode,
    intervalMinutes:
      typeof input.intervalMinutes === "number" && Number.isFinite(input.intervalMinutes)
        ? Math.max(1, Math.round(input.intervalMinutes))
        : current.intervalMinutes,
    changesOnly:
      typeof input.changesOnly === "boolean" ? input.changesOnly : current.changesOnly,
    includeNulls:
      typeof input.includeNulls === "boolean" ? input.includeNulls : current.includeNulls,
    alertRules: alertRules(input.alertRules, current.alertRules ?? []),
    powerBiSettings: powerBiSettings(input.powerBiSettings, current.powerBiSettings ?? DEFAULT_POWER_BI_SETTINGS),
    excelSettings: resolvedExcelSettings,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...next,
    status: exportStatus(next),
  };
}

export async function listExportConfigs() {
  if (supabaseConfigured()) {
    await hydrateFromSupabase();
    hydrated = true;
  } else {
    await ensureHydrated();
  }
  return [...drafts.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getExportConfig(id: string) {
  if (supabaseConfigured()) {
    const config = await fetchOneFromSupabase(id);
    if (config) drafts.set(id, config);
    else drafts.delete(id);
    return config;
  }
  await ensureHydrated();
  return drafts.get(id) ?? null;
}

export async function createExportConfig(input: ExportConfigInput) {
  if (supabaseConfigured()) {
    await hydrateFromSupabase();
    hydrated = true;
  } else {
    await ensureHydrated();
  }
  const now = new Date().toISOString();
  const id = randomUUID();
  const draft = applyInput(
    {
      id,
      name: "Untitled export",
      description: "",
      sourceConnectionId: "",
      groupUuids: [],
      lineUuids: [],
      allGroups: true,
      allLines: true,
      fields: [],
      destinationType: "rest",
      destinationName: "",
      endpoint: "",
      sapConnectionId: "",
      sapAction: "production-result",
      sapOrder: null,
      sapMappingValidated: false,
      sapConfirmationUnit: "PC",
      format: "canonical-json",
      triggerMode: "manual",
      intervalMinutes: 15,
      changesOnly: true,
      includeNulls: false,
      alertRules: [],
      powerBiSettings: { ...DEFAULT_POWER_BI_SETTINGS, datasets: [...DEFAULT_POWER_BI_SETTINGS.datasets] },
      powerBiApiKey: randomUUID().replaceAll("-", ""),
      excelSettings: { ...DEFAULT_EXCEL_SETTINGS, datasets: [...DEFAULT_EXCEL_SETTINGS.datasets], tables: [...DEFAULT_EXCEL_SETTINGS.tables] },
      excelApiKey: randomUUID().replaceAll("-", ""),
      status: "draft",
      lastRunAt: null,
      lastRunStatus: null,
      lastRunError: null,
      createdAt: now,
      updatedAt: now,
    },
    input,
  );
  await persistConfig(draft);
  return draft;
}

export async function updateExportConfig(id: string, input: ExportConfigInput) {
  const current = (await getExportConfig(id)) ?? drafts.get(id) ?? null;
  if (!current) return null;
  const draft = applyInput(current, input);
  await persistConfig(draft);
  return draft;
}

export async function deleteExportConfig(id: string) {
  if (supabaseConfigured()) {
    if (!drafts.has(id)) {
      const existing = await fetchOneFromSupabase(id);
      if (!existing) return false;
      drafts.set(id, existing);
    }
    return removeConfig(id);
  }
  await ensureHydrated();
  if (!drafts.has(id)) return false;
  return removeConfig(id);
}

export function publicExportConfig(config: ExportConfig): PublicExportConfig {
  const hideEndpoint =
    config.destinationType === "slack" || config.destinationType === "sap-odata";
  const sap = config.sapConnectionId ? getSapConnection(config.sapConnectionId) : null;
  return {
    ...config,
    endpoint: hideEndpoint ? "" : config.endpoint,
    endpointConfigured: Boolean(config.endpoint) || Boolean(sap),
    sapConnectionId: config.sapConnectionId ?? "",
    sapConnection: sap ? publicSapConnection(sap) : null,
    status: exportStatus(config),
  };
}

export async function recordExportRun(id: string, ok: boolean, error?: string | null) {
  const current = (await getExportConfig(id)) ?? drafts.get(id) ?? null;
  if (!current) return null;
  const next: ExportConfig = {
    ...current,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: ok ? "success" : "error",
    lastRunError: ok ? null : error ?? "Export failed",
  };
  await persistConfig(next);
  return next;
}

export function exportConfigsStorage() {
  return supabaseConfigured() ? ("supabase" as const) : ("file" as const);
}
