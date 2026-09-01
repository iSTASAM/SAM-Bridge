export type DestinationType =
  | "rest"
  | "webhook"
  | "sap-odata"
  | "sftp"
  | "database"
  | "message-queue"
  | "email"
  | "line"
  | "teams"
  | "slack"
  | "power-bi"
  | "excel"
  | "data-warehouse";

export type ExportFormat = "canonical-json" | "flat-json" | "csv";
export type TriggerMode = "manual" | "schedule" | "data-change";
export type PowerBiDataset = "production" | "lost-time";
export type PowerBiSettings = {
  datasets: PowerBiDataset[];
  historyDays: 30 | 90 | 365;
  includeLineDimension: boolean;
  includeDateDimension: boolean;
};

export const DEFAULT_POWER_BI_SETTINGS: PowerBiSettings = {
  datasets: ["production", "lost-time"],
  historyDays: 90,
  includeLineDimension: true,
  includeDateDimension: true,
};
export type ExcelTable = "history" | "current";
export type ExcelSettings = Omit<PowerBiSettings, "historyDays"> & {
  tables: ExcelTable[];
  /** Rolling lookback in days (default: day-of-month in Asia/Bangkok = month-to-date). */
  historyDays: number;
  refreshMinutes: 5 | 10 | 15;
  autoRefresh: boolean;
};

/** Days from the 1st of the current Bangkok calendar month through today (inclusive). */
export function bangkokDaysFromMonthStart(now = new Date()): number {
  const day = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric" }).format(now),
  );
  return Number.isFinite(day) && day > 0 ? day : 1;
}

export const DEFAULT_EXCEL_SETTINGS: ExcelSettings = {
  datasets: ["production"],
  tables: ["history", "current"],
  historyDays: bangkokDaysFromMonthStart(),
  includeLineDimension: false,
  includeDateDimension: false,
  refreshMinutes: 15,
  autoRefresh: false,
};
export type AlertRule = {
  metric: "currentCtOverBase" | "volumeRate" | "operationalAvailability";
  operator: "below" | "above";
  threshold: number;
  occurrences: number;
};

export type PublicSapConnection = {
  id: string;
  name: string;
  provider: "sap";
  environment: "sandbox";
  api: "production-order";
  serviceUrl: string;
  confirmationServiceUrl: string;
  authentication: { type: "api-key" };
  keyLast4: string;
  lastTestedAt: string | null;
  lastHttpStatus: number | null;
  lastResponseTimeMs: number | null;
  connected: boolean;
};

export type SapAction = "production-result" | "custom-mapping";

export type SapSelectedOrder = {
  id: string;
  product: string;
  plant: string;
  plannedQty: string;
  unit: string;
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
  sapConnection: PublicSapConnection | null;
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
  endpointConfigured: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceGroup = {
  uuid: string;
  name: string;
  lines: { uuid: string; name: string }[];
};

export const FIELD_SECTIONS = [
  {
    id: "context",
    title: "Context",
    description: "Company, connection and collection time",
    fields: [
      ["connection.id", "Connection ID"],
      ["connection.name", "Connection Name"],
      ["businessDate", "Business Date"],
      ["collectedAt", "Collected At"],
    ],
  },
  {
    id: "structure",
    title: "Production structure",
    description: "Group and line identity",
    fields: [
      ["productionGroup.uuid", "Production Group UUID"],
      ["productionGroup.name", "Production Group Name"],
      ["productionLine.uuid", "Production Line UUID"],
      ["productionLine.name", "Production Line Name"],
    ],
  },
  {
    id: "production",
    title: "Production",
    description: "Product and production quantities",
    fields: [
      ["product.code", "Product"],
      ["product.uuid", "Product UUID"],
      ["production.planNum", "Plan Num"],
      ["production.actualNum", "Actual Num"],
    ],
  },
  {
    id: "performance",
    title: "Performance",
    description: "Cycle, rate and operating metrics",
    fields: [
      ["performance.averageCt", "Average CT"],
      ["performance.currentCt", "Current CT"],
      ["performance.baseCt", "CT (Base)"],
      ["performance.pcsPerHour", "Pcs/h"],
      ["performance.volumeRate", "Volume Rate"],
      ["performance.operationalAvailability", "Operational Availability"],
      ["performance.operatingTime", "Operating Time"],
      ["performance.stopTime", "Stop Time"],
    ],
  },
  {
    id: "status",
    title: "Status",
    description: "Status identity and display colors",
    fields: [
      ["status.uuid", "Status UUID"],
      ["status.name", "Status Name"],
      ["status.backgroundColor", "Status Background Color"],
      ["status.textColor", "Status Text Color"],
    ],
  },
  {
    id: "raw",
    title: "Raw iXacs",
    description: "Original detail response for advanced integrations",
    fields: [["raw", "Raw iXacs Record"]],
  },
] as const;

export const ALL_FIELD_IDS = FIELD_SECTIONS.flatMap((section) =>
  section.fields.map(([id]) => id),
);

export type DataPreset = "summary" | "performance" | "full" | "custom";
export type ScopeMode = "all" | "custom";
export type WizardStep = 0 | 1 | 2 | 3 | 4;

export const FIELD_PRESETS: Record<Exclude<DataPreset, "custom">, readonly string[]> = {
  summary: [
    "businessDate",
    "collectedAt",
    "productionGroup.name",
    "productionLine.name",
    "product.code",
    "production.planNum",
    "production.actualNum",
    "status.name",
  ],
  performance: [
    "performance.currentCt",
    "performance.averageCt",
    "performance.baseCt",
    "performance.pcsPerHour",
    "performance.volumeRate",
    "performance.operationalAvailability",
    "performance.operatingTime",
    "performance.stopTime",
  ],
  full: ALL_FIELD_IDS,
};

export const WIZARD_SECTION_META: Record<
  (typeof FIELD_SECTIONS)[number]["id"],
  { title: string; description: string }
> = {
  context: { title: "Context", description: "Company, connection and collection time" },
  structure: { title: "Production structure", description: "Group and line identity" },
  production: { title: "Production", description: "Product and quantities" },
  performance: { title: "Performance", description: "Cycle and operating metrics" },
  status: { title: "Status", description: "Status and presentation" },
  raw: { title: "Advanced", description: "Raw record" },
};

export const DESTINATION_GROUPS: {
  id: "api" | "enterprise" | "file" | "notify" | "analytics";
  items: DestinationType[];
}[] = [
  { id: "api", items: ["rest", "webhook"] },
  { id: "enterprise", items: ["sap-odata", "database", "data-warehouse"] },
  { id: "file", items: ["sftp", "message-queue"] },
  { id: "notify", items: ["line", "teams", "slack", "email"] },
  { id: "analytics", items: ["power-bi", "excel"] },
];

export const WIZARD_DESTINATIONS: Record<
  DestinationType,
  { name: string; description: string }
> = {
  rest: { name: "REST API", description: "Send data to an HTTP endpoint" },
  webhook: { name: "Webhook", description: "Notify another application" },
  "sap-odata": { name: "SAP", description: "Connect production data to SAP Production Order" },
  sftp: { name: "SFTP", description: "Deliver files over SFTP" },
  database: { name: "Database", description: "Write data to a database" },
  "message-queue": { name: "Message Queue", description: "Publish asynchronous events" },
  email: { name: "Email", description: "Send scheduled summaries" },
  line: { name: "LINE", description: "Send operational notifications" },
  teams: { name: "Microsoft Teams", description: "Post updates to a Teams workflow" },
  slack: { name: "Slack", description: "Post updates to a Slack channel" },
  "power-bi": { name: "Power BI", description: "Prepare a dataset for reporting" },
  excel: { name: "Microsoft Excel", description: "Download .xlsx or refresh with Power Query" },
  "data-warehouse": { name: "Data Warehouse", description: "Load normalized historical data" },
};

export const DESTINATIONS: {
  id: DestinationType;
  name: string;
  description: string;
  endpointLabel: string;
  placeholder: string;
}[] = [
  { id: "rest", name: "REST API", description: "Send records to an HTTP endpoint", endpointLabel: "Endpoint URL", placeholder: "https://erp.example.com/api/production" },
  { id: "webhook", name: "Webhook", description: "Notify an application when data changes", endpointLabel: "Webhook URL", placeholder: "https://example.com/webhooks/ixacs" },
  { id: "sap-odata", name: "SAP", description: "Connect to SAP Production Order", endpointLabel: "Service URL", placeholder: "Paste the Service URL from SAP Business Accelerator Hub" },
  { id: "sftp", name: "SFTP", description: "Deliver CSV or JSON files", endpointLabel: "SFTP host / folder", placeholder: "sftp.example.com/outbound/production" },
  { id: "database", name: "Database", description: "Write to a destination database", endpointLabel: "Database host / alias", placeholder: "factory-reporting-db" },
  { id: "message-queue", name: "Message Queue", description: "Publish reliable asynchronous events", endpointLabel: "Queue / topic", placeholder: "production-events" },
  { id: "email", name: "Email", description: "Send scheduled summaries", endpointLabel: "Recipients", placeholder: "production@example.com" },
  { id: "line", name: "LINE", description: "Send operational notifications", endpointLabel: "Channel / audience", placeholder: "Factory alerts" },
  { id: "teams", name: "Microsoft Teams", description: "Post updates to a Teams workflow", endpointLabel: "Workflow URL / channel", placeholder: "Production team" },
  { id: "slack", name: "Slack", description: "Post updates to a Slack channel", endpointLabel: "Slack Incoming Webhook URL", placeholder: "https://hooks.slack.com/services/..." },
  { id: "power-bi", name: "Power BI", description: "Prepare a dataset for reporting", endpointLabel: "Workspace / dataset", placeholder: "Factory Operations / iXacs" },
  { id: "excel", name: "Microsoft Excel", description: "Download a .xlsx file or refresh an existing workbook", endpointLabel: "Workbook", placeholder: "Production report.xlsm" },
  { id: "data-warehouse", name: "Data Warehouse", description: "Load normalized historical data", endpointLabel: "Warehouse / dataset", placeholder: "operations.ixacs_production" },
];
