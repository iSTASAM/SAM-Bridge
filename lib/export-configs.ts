import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";
import { deleteExportRunState } from "@/lib/export-run-state";
import { deleteExportAlertState } from "@/lib/export-alert-state";
import {
  deleteSapConnection,
  getSapConnection,
  publicSapConnection,
  type PublicSapConnection,
} from "@/lib/sap-connections";

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
export type ExcelSettings = PowerBiSettings & {
  tables: ExcelTable[]; refreshMinutes: 5 | 10 | 15; autoRefresh: boolean;
};
const DEFAULT_EXCEL_SETTINGS: ExcelSettings = {
  datasets: ["production"], tables: ["history", "current"], historyDays: 30,
  includeLineDimension: false, includeDateDimension: false, refreshMinutes: 15, autoRefresh: true,
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

const STATE_FILE = path.join(process.cwd(), "data", "export-configs.json");
let drafts = new Map<string, ExportConfig>();
let hydrated = false;

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

function hydrate(force = false) {
  if (hydrated && !force) return;
  hydrated = true;
  if (!existsSync(STATE_FILE)) {
    drafts = new Map();
    return;
  }
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
      configs?: Record<string, ExportConfig>;
    };
    let generatedApiKey = false;
    drafts = new Map(
      Object.entries(parsed.configs ?? {}).map(([id, config]) => {
        if (!config.powerBiApiKey || !config.excelApiKey) generatedApiKey = true;
        const next = {
          ...config,
          sapConnectionId: config.sapConnectionId ?? "",
          sapAction: (config.sapAction === "custom-mapping" ? "custom-mapping" : "production-result") as SapAction,
          sapOrder: sapOrder(config.sapOrder, null),
          sapMappingValidated: config.sapMappingValidated === true,
          sapConfirmationUnit: config.sapConfirmationUnit?.trim() || "PC",
          alertRules: config.alertRules ?? [],
          powerBiSettings: powerBiSettings(config.powerBiSettings, DEFAULT_POWER_BI_SETTINGS),
          powerBiApiKey: config.powerBiApiKey || randomUUID().replaceAll("-", ""),
          excelSettings: excelSettings(config.excelSettings, DEFAULT_EXCEL_SETTINGS),
          excelApiKey: config.excelApiKey || randomUUID().replaceAll("-", ""),
          lastRunAt: config.lastRunAt ?? null,
          lastRunStatus: config.lastRunStatus ?? null,
          lastRunError: config.lastRunError ?? null,
        };
        return [id, { ...next, status: exportStatus(next) }];
      }),
    );
    // Persist generated keys for legacy Power BI exports so they remain stable.
    if (generatedApiKey) persist();
  } catch {
    drafts = new Map();
  }
}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ configs: Object.fromEntries(drafts) }, null, 2),
    "utf8",
  );
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
  const normalized = powerBiSettings(value, fallback);
  const item = value && typeof value === "object" ? value as Partial<ExcelSettings> : {};
  return {
    ...normalized,
    datasets: ["production"],
    includeLineDimension: false,
    includeDateDimension: false,
    tables: strings(item.tables, fallback.tables).filter((table): table is ExcelTable => table === "history" || table === "current"),
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
    excelSettings: excelSettings(input.excelSettings, current.excelSettings ?? DEFAULT_EXCEL_SETTINGS),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...next,
    status: exportStatus(next),
  };
}

export function listExportConfigs() {
  hydrate(true);
  return [...drafts.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getExportConfig(id: string) {
  hydrate(true);
  return drafts.get(id) ?? null;
}

export function createExportConfig(input: ExportConfigInput) {
  hydrate(true);
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
  drafts.set(id, draft);
  persist();
  return draft;
}

export function updateExportConfig(id: string, input: ExportConfigInput) {
  hydrate(true);
  const current = drafts.get(id);
  if (!current) return null;
  const draft = applyInput(current, input);
  drafts.set(id, draft);
  persist();
  return draft;
}

export function deleteExportConfig(id: string) {
  hydrate(true);
  const current = drafts.get(id);
  const removed = drafts.delete(id);
  if (removed) {
    persist();
    deleteExportRunState(id);
    deleteExportAlertState(id);
    if (current?.sapConnectionId) deleteSapConnection(current.sapConnectionId);
  }
  return removed;
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

export function recordExportRun(id: string, ok: boolean, error?: string | null) {
  hydrate(true);
  const current = drafts.get(id);
  if (!current) return null;
  const next: ExportConfig = {
    ...current,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: ok ? "success" : "error",
    lastRunError: ok ? null : error ?? "Export failed",
  };
  drafts.set(id, next);
  persist();
  return next;
}
