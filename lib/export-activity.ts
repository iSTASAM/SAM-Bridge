import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { ConfirmationPayload } from "@/lib/sap-confirmation";

export type ExportActivity = {
  id: string;
  transactionId: string;
  at: string;
  exportId: string | null;
  exportName: string;
  destination: "SAP";
  result: "simulated";
  source: "iXacs";
  orderId: string;
  product: string;
  plant: string;
  actual: string;
  yieldQuantity: string;
  unit: string;
  mode: "simulation";
  payload: ConfirmationPayload;
};

const FILE = path.join(process.cwd(), "data", "export-activity.json");
let entries: ExportActivity[] = [];
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { activities?: ExportActivity[] };
    entries = Array.isArray(parsed.activities) ? parsed.activities : [];
  } catch {
    entries = [];
  }
}

function persist() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ activities: entries }, null, 2), { encoding: "utf8", mode: 0o600 });
}

function bangkokStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}${month}${day}`;
}

export function nextSimulationId(date = new Date()) {
  hydrate();
  const day = bangkokStamp(date);
  const prefix = `SIM-${day}-`;
  const used = entries
    .filter((item) => item.transactionId.startsWith(prefix))
    .map((item) => Number(item.transactionId.slice(prefix.length)))
    .filter((value) => Number.isFinite(value));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function recordExportActivity(entry: Omit<ExportActivity, "id" | "at">) {
  hydrate();
  const next: ExportActivity = {
    ...entry,
    id: `${entry.transactionId}-${entries.length + 1}`,
    at: new Date().toISOString(),
  };
  entries = [next, ...entries].slice(0, 200);
  persist();
  return next;
}

export function listExportActivity() {
  hydrate();
  return entries;
}
