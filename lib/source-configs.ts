import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  SOURCE_CONNECTORS,
  SOURCE_DOMAINS,
  type SourceConfig,
  type SourceConfigInput,
  type SourceDomain,
  type SourceFormat,
  type SourceType,
} from "@/app/settings/sources/types";

const STATE_FILE = path.join(process.cwd(), "data", "source-configs.json");
let configs = new Map<string, SourceConfig>();
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(STATE_FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
      configs?: Record<string, SourceConfig>;
    };
    configs = new Map(Object.entries(parsed.configs ?? {}));
  } catch {
    configs = new Map();
  }
}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ configs: Object.fromEntries(configs) }, null, 2),
    "utf8",
  );
}

function uniqueDomains(value: unknown, fallback: SourceDomain[]) {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set(SOURCE_DOMAINS.map((domain) => domain.id));
  return [...new Set(value.filter((domain): domain is SourceDomain => allowed.has(domain as SourceDomain)))];
}

function uniqueStrings(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))];
}

function applyInput(current: SourceConfig, input: Partial<SourceConfigInput>): SourceConfig {
  const connector = SOURCE_CONNECTORS.find((item) => item.id === input.type);
  const type = connector ? connector.id : current.type;
  const selectedConnector = connector ?? SOURCE_CONNECTORS.find((item) => item.id === type)!;
  const format = selectedConnector.formats.includes(input.format as SourceFormat)
    ? (input.format as SourceFormat)
    : selectedConnector.formats.includes(current.format)
      ? current.format
      : selectedConnector.formats[0];
  const requestedMode = input.ingestionMode;
  const ingestionMode =
    requestedMode && selectedConnector.modes.includes(requestedMode)
      ? requestedMode
      : selectedConnector.modes.includes(current.ingestionMode)
        ? current.ingestionMode
        : selectedConnector.modes[0];
  return {
    ...current,
    name: typeof input.name === "string" ? input.name.trim() : current.name,
    description: typeof input.description === "string" ? input.description.trim() : current.description,
    type,
    site: typeof input.site === "string" ? input.site.trim() : current.site,
    owner: typeof input.owner === "string" ? input.owner.trim() : current.owner,
    endpoint: typeof input.endpoint === "string" ? input.endpoint.trim() : current.endpoint,
    resource: typeof input.resource === "string" ? input.resource.trim() : current.resource,
    authMode: input.authMode === "api-key" || input.authMode === "basic" || input.authMode === "certificate" || input.authMode === "none" ? input.authMode : current.authMode,
    ingestionMode,
    intervalMinutes: typeof input.intervalMinutes === "number" && Number.isFinite(input.intervalMinutes) ? Math.max(1, Math.round(input.intervalMinutes)) : current.intervalMinutes,
    format,
    domains: uniqueDomains(input.domains, current.domains),
    connectionId: typeof input.connectionId === "string" ? input.connectionId.trim() : current.connectionId,
    groupUuids: uniqueStrings(input.groupUuids, current.groupUuids),
    lineUuids: uniqueStrings(input.lineUuids, current.lineUuids),
    uploadFileName: typeof input.uploadFileName === "string" ? input.uploadFileName.trim() : current.uploadFileName,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export function listSourceConfigs() {
  hydrate();
  return [...configs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSourceConfig(id: string) {
  hydrate();
  return configs.get(id) ?? null;
}

export function createSourceConfig(input: Partial<SourceConfigInput>) {
  hydrate();
  const now = new Date().toISOString();
  const type = SOURCE_CONNECTORS.some((item) => item.id === input.type) ? input.type! : "rest-api";
  const connector = SOURCE_CONNECTORS.find((item) => item.id === type)!;
  const config = applyInput({
    id: randomUUID(),
    name: "Untitled source",
    description: "",
    type: type as SourceType,
    site: "",
    owner: "",
    endpoint: "",
    resource: "",
    authMode: "none",
    ingestionMode: connector.modes[0],
    intervalMinutes: 15,
    format: connector.formats[0],
    domains: [],
    connectionId: "",
    groupUuids: [],
    lineUuids: [],
    uploadFileName: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }, input);
  configs.set(config.id, config);
  persist();
  return config;
}

export function updateSourceConfig(id: string, input: Partial<SourceConfigInput>) {
  hydrate();
  const current = configs.get(id);
  if (!current) return null;
  const config = applyInput(current, input);
  configs.set(id, config);
  persist();
  return config;
}

export function deleteSourceConfig(id: string) {
  hydrate();
  const removed = configs.delete(id);
  if (removed) persist();
  return removed;
}
