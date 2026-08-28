import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const SAP_ENVIRONMENTS = ["sandbox"] as const;
export const SAP_APIS = ["production-order"] as const;

export type SapEnvironment = (typeof SAP_ENVIRONMENTS)[number];
export type SapApi = (typeof SAP_APIS)[number];

export type SapConnection = {
  id: string;
  name: string;
  provider: "sap";
  environment: SapEnvironment;
  api: SapApi;
  serviceUrl: string;
  confirmationServiceUrl: string;
  apiKey: string;
  lastTestedAt: string | null;
  lastHttpStatus: number | null;
  lastResponseTimeMs: number | null;
  lastTestOk: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicSapConnection = {
  id: string;
  name: string;
  provider: "sap";
  environment: SapEnvironment;
  api: SapApi;
  serviceUrl: string;
  confirmationServiceUrl: string;
  authentication: { type: "api-key" };
  keyLast4: string;
  lastTestedAt: string | null;
  lastHttpStatus: number | null;
  lastResponseTimeMs: number | null;
  connected: boolean;
};

export type SapTestResult = {
  ok: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  operation: "GET /ProductionOrder";
  apiLabel: "Production Order API";
};

export type SapConnectionInput = {
  name?: string;
  environment?: string;
  api?: string;
  serviceUrl?: string;
  confirmationServiceUrl?: string;
  apiKey?: string;
};

const FILE = path.join(process.cwd(), "data", "sap-connections.json");
const TEST_TIMEOUT_MS = 20_000;
const TEST_PATH = "/ProductionOrder";

let store = new Map<string, SapConnection>();
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as {
      connections?: Record<string, SapConnection>;
    };
    store = new Map(
      Object.entries(parsed.connections ?? {}).flatMap(([id, value]) => {
        if (!value?.apiKey || !value.serviceUrl) return [];
        return [[id, normalize(value, id)]];
      }),
    );
  } catch {
    store = new Map();
  }
}

function persist() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(
    FILE,
    JSON.stringify({ connections: Object.fromEntries(store) }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
}

function normalize(value: Partial<SapConnection>, id: string): SapConnection {
  const now = new Date().toISOString();
  return {
    id,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "SAP Sandbox",
    provider: "sap",
    environment: value.environment === "sandbox" ? "sandbox" : "sandbox",
    api: value.api === "production-order" ? "production-order" : "production-order",
    serviceUrl: typeof value.serviceUrl === "string" ? value.serviceUrl.trim() : "",
    confirmationServiceUrl:
      typeof value.confirmationServiceUrl === "string" ? value.confirmationServiceUrl.trim() : "",
    apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    lastTestedAt: typeof value.lastTestedAt === "string" ? value.lastTestedAt : null,
    lastHttpStatus: typeof value.lastHttpStatus === "number" ? value.lastHttpStatus : null,
    lastResponseTimeMs:
      typeof value.lastResponseTimeMs === "number" ? value.lastResponseTimeMs : null,
    lastTestOk: value.lastTestOk === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function keyLast4(apiKey: string) {
  const trimmed = apiKey.trim();
  return trimmed.slice(-4);
}

export function publicSapConnection(connection: SapConnection): PublicSapConnection {
  return {
    id: connection.id,
    name: connection.name,
    provider: "sap",
    environment: connection.environment,
    api: connection.api,
    serviceUrl: connection.serviceUrl,
    confirmationServiceUrl: connection.confirmationServiceUrl,
    authentication: { type: "api-key" },
    keyLast4: keyLast4(connection.apiKey),
    lastTestedAt: connection.lastTestedAt,
    lastHttpStatus: connection.lastHttpStatus,
    lastResponseTimeMs: connection.lastResponseTimeMs,
    connected: connection.lastTestOk === true,
  };
}

export function listSapConnections() {
  hydrate();
  return [...store.values()];
}

export function getSapConnection(id: string) {
  hydrate();
  return store.get(id) ?? null;
}

export function deleteSapConnection(id: string) {
  hydrate();
  const removed = store.delete(id);
  if (removed) persist();
  return removed;
}

function applyInput(current: SapConnection, input: SapConnectionInput): SapConnection {
  const suppliedKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  return {
    ...current,
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : current.name,
    environment: input.environment === "sandbox" ? "sandbox" : current.environment,
    api: input.api === "production-order" ? "production-order" : current.api,
    serviceUrl:
      typeof input.serviceUrl === "string" && input.serviceUrl.trim()
        ? input.serviceUrl.trim()
        : current.serviceUrl,
    confirmationServiceUrl:
      typeof input.confirmationServiceUrl === "string"
        ? input.confirmationServiceUrl.trim()
        : current.confirmationServiceUrl,
    apiKey: suppliedKey || current.apiKey,
    updatedAt: new Date().toISOString(),
  };
}

export function saveSapConnection(id: string | null, input: SapConnectionInput) {
  hydrate();
  const now = new Date().toISOString();
  const current =
    (id ? store.get(id) : null) ??
    ({
      id: randomUUID(),
      name: "SAP Sandbox",
      provider: "sap",
      environment: "sandbox",
      api: "production-order",
      serviceUrl: "",
      confirmationServiceUrl: "",
      apiKey: "",
      lastTestedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      lastTestOk: false,
      createdAt: now,
      updatedAt: now,
    } satisfies SapConnection);
  const next = applyInput(current, input);
  if (!next.apiKey || !next.serviceUrl) return null;
  store.set(next.id, next);
  persist();
  return next;
}

export function recordSapTest(id: string, result: SapTestResult) {
  hydrate();
  const current = store.get(id);
  if (!current) return null;
  const next: SapConnection = {
    ...current,
    lastTestedAt: new Date().toISOString(),
    lastHttpStatus: result.httpStatus,
    lastResponseTimeMs: result.responseTimeMs,
    lastTestOk: result.ok,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, next);
  persist();
  return next;
}

export function parseSapServiceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("SERVICE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("SERVICE_URL_INVALID");
  }
  if (parsed.protocol !== "https:") throw new Error("SERVICE_URL_HTTPS");
  for (const key of [...parsed.searchParams.keys()]) {
    if (/key|token|secret|password/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.hash = "";
  return parsed;
}

export function buildSapProductionOrderTestUrl(serviceUrl: string) {
  const parsed = parseSapServiceUrl(serviceUrl);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  if (last.toLowerCase() === "$metadata") {
    parsed.pathname = parsed.pathname.replace(/\/\$metadata$/i, TEST_PATH);
  } else if (!/^productionorder$/i.test(last)) {
    parsed.pathname = `${parsed.pathname}${TEST_PATH}`;
  }
  const originAndPath = `${parsed.origin}${parsed.pathname}`;
  const leftover = new URLSearchParams(parsed.search);
  leftover.delete("$top");
  leftover.delete("%24top");
  const extra = leftover.toString();
  return extra ? `${originAndPath}?$top=1&${extra}` : `${originAndPath}?$top=1`;
}

function looksLikeHtml(contentType: string, body: string) {
  if (contentType.includes("text/html")) return true;
  const trimmed = body.trim();
  return /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

export async function testSapProductionOrder(
  serviceUrl: string,
  apiKey: string,
): Promise<SapTestResult> {
  const key = apiKey.trim();
  if (!key) {
    return {
      ok: false,
      httpStatus: null,
      responseTimeMs: 0,
      operation: "GET /ProductionOrder",
      apiLabel: "Production Order API",
    };
  }
  const url = buildSapProductionOrderTestUrl(serviceUrl);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        APIKey: key,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    const responseTimeMs = Date.now() - started;
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text().catch(() => "");
    const ok = response.status === 200 && !looksLikeHtml(contentType, body);
    return {
      ok,
      httpStatus: response.status,
      responseTimeMs,
      operation: "GET /ProductionOrder",
      apiLabel: "Production Order API",
    };
  } catch {
    return {
      ok: false,
      httpStatus: null,
      responseTimeMs: Date.now() - started,
      operation: "GET /ProductionOrder",
      apiLabel: "Production Order API",
    };
  }
}
