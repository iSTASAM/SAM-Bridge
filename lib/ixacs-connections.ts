import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  normalizeBaseUrl,
  normalizeBasicAuth,
  normalizeSession,
  parseLineUuids,
} from "@/lib/ixacs-curl";
import { normalizeLoginUrl, type IxacsCustomerOption } from "@/lib/ixacs-login";

export type IxacsConnection = {
  id: string;
  name: string;
  baseUrl: string;
  loginUrl: string;
  customerId: string;
  customers: IxacsCustomerOption[];
  loginId: string;
  password: string;
  basicAuth: string;
  session: string;
  lineUuids: string[];
  createdAt: string;
  updatedAt: string;
  lastOkAt: string | null;
  lastError: string | null;
};

type PersistedConnections = {
  activeId: string | null;
  connections: Record<string, IxacsConnection>;
};

const STATE_FILE = path.join(process.cwd(), "data", "ixacs-connections.json");

let connections = new Map<string, IxacsConnection>();
let activeId: string | null = null;
let hydrated = false;

function nowIso() {
  return new Date().toISOString();
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;

  if (!existsSync(STATE_FILE)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedConnections;
    connections = new Map(
      Object.entries(parsed.connections ?? {}).map(([id, connection]) => [
        id,
        {
          ...connection,
          loginUrl:
            normalizeLoginUrl(connection.loginUrl ?? "") ||
            `${connection.baseUrl.replace(/\/+$/, "")}/gateway/web/login`,
          customerId: connection.customerId ?? "",
          customers: normalizeCustomers(connection.customers),
          loginId: connection.loginId ?? "",
          password: connection.password ?? "",
        },
      ]),
    );
    activeId = parsed.activeId ?? [...connections.keys()][0] ?? null;
    if (activeId && !connections.has(activeId)) {
      activeId = [...connections.keys()][0] ?? null;
    }
  } catch {
    connections = new Map();
    activeId = null;
  }

}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const payload: PersistedConnections = {
    activeId,
    connections: Object.fromEntries(connections),
  };
  writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

export type ConnectionInput = {
  name?: string;
  baseUrl?: string;
  loginUrl?: string;
  customerId?: string;
  customers?: IxacsCustomerOption[];
  loginId?: string;
  password?: string;
  basicAuth?: string;
  session?: string;
  lineUuids?: string[] | string;
};

function normalizeCustomers(value: unknown): IxacsCustomerOption[] {
  if (!Array.isArray(value)) return [];
  const items: IxacsCustomerOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) continue;
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : id;
    items.push({ id, name });
  }
  return items;
}

function applyInput(current: IxacsConnection, input: ConnectionInput): IxacsConnection {
  const lineUuids = Array.isArray(input.lineUuids)
    ? [...new Set(input.lineUuids)]
    : input.lineUuids !== undefined
      ? parseLineUuids(input.lineUuids)
      : current.lineUuids;

  return {
    ...current,
    name: input.name?.trim() || current.name,
    baseUrl: input.baseUrl !== undefined ? normalizeBaseUrl(input.baseUrl) : current.baseUrl,
    loginUrl:
      input.loginUrl !== undefined
        ? normalizeLoginUrl(input.loginUrl) || current.loginUrl
        : current.loginUrl,
    customerId: input.customerId !== undefined ? input.customerId.trim() : current.customerId,
    customers: input.customers !== undefined ? normalizeCustomers(input.customers) : current.customers,
    loginId: input.loginId !== undefined ? input.loginId.trim() : current.loginId,
    password: input.password !== undefined ? input.password : current.password,
    basicAuth:
      input.basicAuth !== undefined ? normalizeBasicAuth(input.basicAuth) : current.basicAuth,
    session: input.session !== undefined ? normalizeSession(input.session) : current.session,
    lineUuids,
    updatedAt: nowIso(),
  };
}

export function listConnections(connectionId?: string | null) {
  hydrate();
  const all = [...connections.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const scoped =
    connectionId === undefined || connectionId === null
      ? all
      : all.filter((connection) => connection.id === connectionId);
  const scopedActive =
    connectionId === undefined || connectionId === null
      ? activeId
      : scoped.some((connection) => connection.id === activeId)
        ? activeId
        : scoped[0]?.id ?? null;
  return {
    activeId: scopedActive,
    connections: scoped.map(publicConnection),
  };
}

export function getConnection(id: string) {
  hydrate();
  return connections.get(id) ?? null;
}

export function getActiveConnection() {
  hydrate();
  if (activeId) {
    const current = connections.get(activeId);
    if (current) return current;
  }
  return [...connections.values()][0] ?? null;
}

export function findConnectionCredentials(customerId: string, loginId: string) {
  hydrate();
  return [...connections.values()].filter(
    (connection) =>
      connection.customerId === customerId &&
      connection.loginId === loginId &&
      Boolean(connection.password),
  );
}

export function authenticateSavedConnection(customerId: string, loginId: string, password: string) {
  hydrate();
  const company = customerId.trim().toLowerCase();
  const account = loginId.trim().toLowerCase();
  return [...connections.values()].find((connection) => {
    const companyMatches = !company || connection.customerId.toLowerCase() === company || connection.customers.some((customer) => customer.id.toLowerCase() === company);
    return companyMatches && connection.loginId.trim().toLowerCase() === account && connection.password === password && Boolean(password);
  }) ?? null;
}

export function createConnection(input: ConnectionInput) {
  hydrate();
  const id = randomUUID();
  const createdAt = nowIso();
  const connection = applyInput(
    {
      id,
      name: "iXacs",
      baseUrl: "https://monitor-pre.ixacs.jp",
      loginUrl: "https://monitor-pre.ixacs.jp/gateway/web/login",
      customerId: "",
      customers: [],
      loginId: "",
      password: "",
      basicAuth: "",
      session: "",
      lineUuids: [],
      createdAt,
      updatedAt: createdAt,
      lastOkAt: null,
      lastError: null,
    },
    input,
  );
  connections.set(id, connection);
  if (!activeId) activeId = id;
  persist();
  return connection;
}

export function publicConnection(connection: IxacsConnection) {
  const { password, ...safe } = connection;
  return { ...safe, hasPassword: Boolean(password) };
}

export function updateConnection(id: string, input: ConnectionInput) {
  hydrate();
  const current = connections.get(id);
  if (!current) return null;
  const next = applyInput(current, input);
  connections.set(id, next);
  persist();
  return next;
}

export function deleteConnection(id: string) {
  hydrate();
  const existed = connections.delete(id);
  if (!existed) return false;
  if (activeId === id) {
    activeId = [...connections.keys()][0] ?? null;
  }
  persist();
  return true;
}

export function setActiveConnection(id: string) {
  hydrate();
  if (!connections.has(id)) return null;
  activeId = id;
  persist();
  return connections.get(id)!;
}

export function rememberSessionOnActive(session: string) {
  const active = getActiveConnection();
  if (!active || !session || active.session === session) return;
  connections.set(active.id, {
    ...active,
    session,
    updatedAt: nowIso(),
  });
  persist();
}

export function rememberSessionOnConnection(id: string, session: string) {
  hydrate();
  const connection = connections.get(id);
  if (!connection || !session || connection.session === session) return;
  connections.set(id, { ...connection, session, updatedAt: nowIso() });
  persist();
}

export function markConnectionResult(id: string, ok: boolean, error?: string | null) {
  hydrate();
  const current = connections.get(id);
  if (!current) return null;
  const next: IxacsConnection = {
    ...current,
    lastOkAt: ok ? nowIso() : current.lastOkAt,
    lastError: ok ? null : error ?? "Request failed",
    updatedAt: nowIso(),
  };
  connections.set(id, next);
  persist();
  return next;
}

export function rememberConnectionLines(id: string, lineUuids: string[]) {
  hydrate();
  const current = connections.get(id);
  if (!current) return null;
  const merged = [...new Set([...current.lineUuids, ...lineUuids])];
  if (merged.length === current.lineUuids.length) return current;
  const next = { ...current, lineUuids: merged, updatedAt: nowIso() };
  connections.set(id, next);
  persist();
  return next;
}

export function replaceConnectionLines(id: string, lineUuids: string[]) {
  hydrate();
  const current = connections.get(id);
  if (!current) return null;
  const nextLines = [...new Set(lineUuids)];
  const same =
    nextLines.length === current.lineUuids.length &&
    nextLines.every((uuid) => current.lineUuids.includes(uuid));
  if (same) return current;
  const next = { ...current, lineUuids: nextLines, updatedAt: nowIso() };
  connections.set(id, next);
  persist();
  return next;
}
