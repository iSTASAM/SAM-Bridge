export type SourceType =
  | "rest-api"
  | "webhook"
  | "file-upload"
  | "sftp"
  | "database"
  | "mqtt"
  | "opc-ua"
  | "modbus-tcp"
  | "erp-mrp"
  | "qms"
  | "energy-meter"
  | "manual-form";

export type SourceCategory = "api" | "file" | "factory" | "business" | "people";
export type IngestionMode = "push" | "poll" | "stream" | "manual";
export type SourceFormat = "json" | "csv" | "excel" | "markdown" | "xml" | "binary";
export type SourceDomain =
  | "production-order"
  | "machine-event"
  | "downtime"
  | "quality"
  | "maintenance"
  | "material"
  | "people-shift"
  | "energy"
  | "kaizen";

export type SourceConfig = {
  id: string;
  name: string;
  description: string;
  type: SourceType;
  site: string;
  owner: string;
  endpoint: string;
  resource: string;
  authMode: "none" | "api-key" | "basic" | "certificate";
  ingestionMode: IngestionMode;
  intervalMinutes: number;
  format: SourceFormat;
  domains: SourceDomain[];
  connectionId: string;
  groupUuids: string[];
  lineUuids: string[];
  uploadFileName: string;
  status: "draft";
  createdAt: string;
  updatedAt: string;
};

export type SourceConfigInput = Omit<
  SourceConfig,
  "id" | "status" | "createdAt" | "updatedAt"
>;

export type SourceConnector = {
  id: SourceType;
  category: SourceCategory;
  name: string;
  description: string;
  modes: IngestionMode[];
  formats: SourceFormat[];
  endpointLabel: string;
  endpointPlaceholder: string;
  resourceLabel: string;
  resourcePlaceholder: string;
};

export const SOURCE_CONNECTORS: SourceConnector[] = [
  { id: "rest-api", category: "api", name: "REST API", description: "Pull master or transaction data from an HTTP API", modes: ["poll"], formats: ["json", "xml"], endpointLabel: "Base URL", endpointPlaceholder: "https://erp.example.com/api", resourceLabel: "Resource path", resourcePlaceholder: "/production-orders" },
  { id: "webhook", category: "api", name: "Inbound Webhook", description: "Receive events pushed from another application", modes: ["push"], formats: ["json"], endpointLabel: "SAM endpoint", endpointPlaceholder: "Generated after activation", resourceLabel: "Event key", resourcePlaceholder: "production.updated" },
  { id: "file-upload", category: "file", name: "File Upload", description: "Upload Markdown, planning and master files manually", modes: ["manual"], formats: ["markdown", "csv", "excel"], endpointLabel: "Upload area", endpointPlaceholder: "SAM Bridge upload", resourceLabel: "File pattern", resourcePlaceholder: "instructions.md / production_plan_*.xlsx" },
  { id: "sftp", category: "file", name: "SFTP Folder", description: "Watch a folder for recurring inbound files", modes: ["poll"], formats: ["csv", "json", "xml"], endpointLabel: "SFTP host", endpointPlaceholder: "sftp.factory.local", resourceLabel: "Remote folder", resourcePlaceholder: "/inbound/production" },
  { id: "database", category: "file", name: "Database", description: "Read from a table, view or incremental query", modes: ["poll"], formats: ["json"], endpointLabel: "Server / database", endpointPlaceholder: "sql-factory-01 / MES", resourceLabel: "Table or view", resourcePlaceholder: "dbo.vw_ProductionOrder" },
  { id: "mqtt", category: "factory", name: "MQTT", description: "Subscribe to machine and IoT event topics", modes: ["stream"], formats: ["json", "binary"], endpointLabel: "Broker URL", endpointPlaceholder: "mqtts://broker.factory.local:8883", resourceLabel: "Topic filter", resourcePlaceholder: "factory/+/machine/+/status" },
  { id: "opc-ua", category: "factory", name: "OPC UA", description: "Read structured values from PLC, SCADA or Edge gateways", modes: ["poll", "stream"], formats: ["binary"], endpointLabel: "Server endpoint", endpointPlaceholder: "opc.tcp://edge-gateway:4840", resourceLabel: "Node set / namespace", resourcePlaceholder: "ns=2;s=Production" },
  { id: "modbus-tcp", category: "factory", name: "Modbus TCP", description: "Collect registers through a SAM Edge Agent", modes: ["poll"], formats: ["binary"], endpointLabel: "Gateway address", endpointPlaceholder: "192.168.10.20:502", resourceLabel: "Register profile", resourcePlaceholder: "Energy meter profile" },
  { id: "erp-mrp", category: "business", name: "ERP / MRP", description: "Receive orders, products, BOM and production plans", modes: ["poll", "push"], formats: ["json", "csv", "xml"], endpointLabel: "System URL / alias", endpointPlaceholder: "SAP PRD / Dynamics 365", resourceLabel: "Service / interface", resourcePlaceholder: "Production Order interface" },
  { id: "qms", category: "business", name: "Quality / QMS", description: "Receive inspection, defect, scrap and rework results", modes: ["poll", "push"], formats: ["json", "csv"], endpointLabel: "System URL / alias", endpointPlaceholder: "Factory QMS", resourceLabel: "Dataset / interface", resourcePlaceholder: "Inspection results" },
  { id: "energy-meter", category: "factory", name: "Energy Meter", description: "Collect electricity, water, air and gas consumption", modes: ["poll", "stream"], formats: ["json", "binary"], endpointLabel: "Gateway / broker", endpointPlaceholder: "Energy gateway", resourceLabel: "Meter group", resourcePlaceholder: "Plant 1 utilities" },
  { id: "manual-form", category: "people", name: "Manual Form", description: "Let operators add reasons, checks and Kaizen context", modes: ["manual"], formats: ["json"], endpointLabel: "Form channel", endpointPlaceholder: "SAM Bridge web form", resourceLabel: "Form template", resourcePlaceholder: "Downtime reason" },
];

export const SOURCE_DOMAINS: Array<{
  id: SourceDomain;
  name: string;
  description: string;
  event: string;
}> = [
  { id: "production-order", name: "Production orders", description: "Plan, target, product, lot and due date", event: "production.order.received" },
  { id: "machine-event", name: "Machine events", description: "Status, alarm, counter and sensor values", event: "machine.event.received" },
  { id: "downtime", name: "Downtime", description: "Start, end, reason and responsible team", event: "downtime.recorded" },
  { id: "quality", name: "Quality", description: "Inspection, NG, defect, scrap and rework", event: "quality.result.received" },
  { id: "maintenance", name: "Maintenance", description: "Breakdown, PM, work order and spare parts", event: "maintenance.event.received" },
  { id: "material", name: "Material & WIP", description: "Lot, barcode, issue, return and inventory movement", event: "material.movement.received" },
  { id: "people-shift", name: "People & shifts", description: "Shift, operator, leader and skill context", event: "workforce.shift.received" },
  { id: "energy", name: "Energy", description: "Electricity, water, compressed air, gas and CO₂", event: "energy.reading.received" },
  { id: "kaizen", name: "Kaizen", description: "Problem, cause, action, owner and result", event: "kaizen.item.received" },
];

export const SOURCE_CATEGORIES: Array<{ id: SourceCategory; name: string }> = [
  { id: "api", name: "API & Events" },
  { id: "file", name: "Files & Database" },
  { id: "factory", name: "Factory & OT" },
  { id: "business", name: "Business Systems" },
  { id: "people", name: "People & Kaizen" },
];
