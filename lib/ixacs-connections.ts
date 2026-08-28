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
import {
  connectionSecretsConfigured,
  decryptCustomerOptions,
  decryptSecret,
  encryptCustomerOptions,
  encryptSecret,
} from "@/lib/connection-secrets";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

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

type DbRow = {
  id: string;
  name: string;
  base_url: string;
  login_url: string;
  customer_id: string;
  customers: unknown;
  login_id: string;
  password: string;
  basic_auth: string;
  session: string;
  line_uuids: string[] | null;
  is_active: boolean;
  last_ok_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const STATE_FILE = path.join(process.cwd(), "data", "ixacs-connections.json");

let connections = new Map<string, IxacsConnection>();
let activeId: string | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

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

function requireSecretKey() {
  if (!connectionSecretsConfigured()) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  }
}

function rowToConnection(row: DbRow): IxacsConnection {
  requireSecretKey();
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    loginUrl:
      normalizeLoginUrl(row.login_url ?? "") ||
      `${row.base_url.replace(/\/+$/, "")}/gateway/web/login`,
    customerId: decryptSecret(row.customer_id ?? ""),
    customers: decryptCustomerOptions(normalizeCustomers(row.customers)),
    loginId: decryptSecret(row.login_id ?? ""),
    password: decryptSecret(row.password ?? ""),
    basicAuth: row.basic_auth ?? "",
    session: row.session ?? "",
    lineUuids: Array.isArray(row.line_uuids) ? row.line_uuids : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOkAt: row.last_ok_at,
    lastError: row.last_error,
  };
}

function connectionToRow(connection: IxacsConnection, isActive: boolean): Omit<DbRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  requireSecretKey();
  return {
    id: connection.id,
    name: connection.name,
    base_url: connection.baseUrl,
    login_url: connection.loginUrl,
    customer_id: encryptSecret(connection.customerId),
    customers: encryptCustomerOptions(connection.customers),
    login_id: encryptSecret(connection.loginId),
    password: encryptSecret(connection.password),
    basic_auth: connection.basicAuth,
    session: connection.session,
    line_uuids: connection.lineUuids,
    is_active: isActive,
    last_ok_at: connection.lastOkAt,
    last_error: connection.lastError,
    created_at: connection.createdAt,
    updated_at: connection.updatedAt,
  };
}

function hydrateFromFile() {
  if (!existsSync(STATE_FILE)) return;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedConnections;
    connections = new Map(
      Object.entries(parsed.connections ?? {}).map(([id, connection]) => {
        const customers = normalizeCustomers(connection.customers);
        return [
          id,
          {
            ...connection,
            loginUrl:
              normalizeLoginUrl(connection.loginUrl ?? "") ||
              `${connection.baseUrl.replace(/\/+$/, "")}/gateway/web/login`,
            customerId: decryptSecret(connection.customerId ?? ""),
            customers: connectionSecretsConfigured()
              ? decryptCustomerOptions(customers)
              : customers,
            loginId: decryptSecret(connection.loginId ?? ""),
            password: decryptSecret(connection.password ?? ""),
          },
        ];
      }),
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

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  requireSecretKey();
  const { data, error } = await supabase.from("ixacs_connections").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(`SUPABASE_LOAD_FAILED: ${error.message}`);
  connections = new Map((data as DbRow[] | null ?? []).map((row) => [row.id, rowToConnection(row)]));
  activeId = (data as DbRow[] | null ?? []).find((row) => row.is_active)?.id ?? [...connections.keys()][0] ?? null;
}

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (supabaseConfigured()) {
        await hydrateFromSupabase();
      } else {
        hydrateFromFile();
      }
      hydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

function persistFile() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const encryptedEntries = Object.fromEntries(
    [...connections.entries()].map(([id, connection]) => [
      id,
      connectionSecretsConfigured()
        ? {
            ...connection,
            customerId: encryptSecret(connection.customerId),
            customers: encryptCustomerOptions(connection.customers),
            loginId: encryptSecret(connection.loginId),
            password: encryptSecret(connection.password),
          }
        : connection,
    ]),
  );
  const payload: PersistedConnections = {
    activeId,
    connections: encryptedEntries,
  };
  writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

async function upsertSupabase(connection: IxacsConnection, isActive = connection.id === activeId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("ixacs_connections").upsert(connectionToRow(connection, isActive));
  if (error) throw new Error(`SUPABASE_SAVE_FAILED: ${error.message}`);
}

async function deleteSupabase(id: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("ixacs_connections").delete().eq("id", id);
  if (error) throw new Error(`SUPABASE_DELETE_FAILED: ${error.message}`);
}

async function setActiveSupabase(id: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const clear = await supabase.from("ixacs_connections").update({ is_active: false }).neq("id", id);
  if (clear.error) throw new Error(`SUPABASE_SAVE_FAILED: ${clear.error.message}`);
  const set = await supabase.from("ixacs_connections").update({ is_active: true }).eq("id", id);
  if (set.error) throw new Error(`SUPABASE_SAVE_FAILED: ${set.error.message}`);
}

async function persistConnection(connection: IxacsConnection) {
  connections.set(connection.id, connection);
  if (supabaseConfigured()) {
    await upsertSupabase(connection);
  } else {
    persistFile();
  }
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

export async function listConnections(connectionId?: string | null) {
  await ensureHydrated();
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

export async function getConnection(id: string) {
  await ensureHydrated();
  return connections.get(id) ?? null;
}

export async function getActiveConnection() {
  await ensureHydrated();
  if (activeId) {
    const current = connections.get(activeId);
    if (current) return current;
  }
  return [...connections.values()][0] ?? null;
}

export async function findConnectionCredentials(customerId: string, loginId: string) {
  await ensureHydrated();
  return [...connections.values()].filter(
    (connection) =>
      connection.customerId === customerId &&
      connection.loginId === loginId &&
      Boolean(connection.password),
  );
}

export async function authenticateSavedConnection(customerId: string, loginId: string, password: string) {
  await ensureHydrated();
  const company = customerId.trim().toLowerCase();
  const account = loginId.trim().toLowerCase();
  return [...connections.values()].find((connection) => {
    const companyMatches = !company || connection.customerId.toLowerCase() === company || connection.customers.some((customer) => customer.id.toLowerCase() === company);
    return companyMatches && connection.loginId.trim().toLowerCase() === account && connection.password === password && Boolean(password);
  }) ?? null;
}

export async function createConnection(input: ConnectionInput) {
  await ensureHydrated();
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
  const makeActive = !activeId;
  if (makeActive) activeId = id;
  connections.set(id, connection);
  if (supabaseConfigured()) {
    if (makeActive) await setActiveSupabase(id);
    await upsertSupabase(connection, makeActive);
  } else {
    persistFile();
  }
  return connection;
}

export function publicConnection(connection: IxacsConnection) {
  const { password, ...safe } = connection;
  return { ...safe, hasPassword: Boolean(password) };
}

export async function updateConnection(id: string, input: ConnectionInput) {
  await ensureHydrated();
  const current = connections.get(id);
  if (!current) return null;
  const next = applyInput(current, input);
  await persistConnection(next);
  return next;
}

export async function deleteConnection(id: string) {
  await ensureHydrated();
  const existed = connections.delete(id);
  if (!existed) return false;
  if (activeId === id) {
    activeId = [...connections.keys()][0] ?? null;
  }
  if (supabaseConfigured()) {
    await deleteSupabase(id);
    if (activeId) await setActiveSupabase(activeId);
  } else {
    persistFile();
  }
  return true;
}

export async function setActiveConnection(id: string) {
  await ensureHydrated();
  if (!connections.has(id)) return null;
  activeId = id;
  if (supabaseConfigured()) {
    await setActiveSupabase(id);
  } else {
    persistFile();
  }
  return connections.get(id)!;
}

export async function rememberSessionOnActive(session: string) {
  const active = await getActiveConnection();
  if (!active || !session || active.session === session) return;
  await persistConnection({
    ...active,
    session,
    updatedAt: nowIso(),
  });
}

export async function rememberSessionOnConnection(id: string, session: string) {
  await ensureHydrated();
  const connection = connections.get(id);
  if (!connection || !session || connection.session === session) return;
  await persistConnection({ ...connection, session, updatedAt: nowIso() });
}

export async function markConnectionResult(id: string, ok: boolean, error?: string | null) {
  await ensureHydrated();
  const current = connections.get(id);
  if (!current) return null;
  const next: IxacsConnection = {
    ...current,
    lastOkAt: ok ? nowIso() : current.lastOkAt,
    lastError: ok ? null : error ?? "Request failed",
    updatedAt: nowIso(),
  };
  await persistConnection(next);
  return next;
}

export async function rememberConnectionLines(id: string, lineUuids: string[]) {
  await ensureHydrated();
  const current = connections.get(id);
  if (!current) return null;
  const merged = [...new Set([...current.lineUuids, ...lineUuids])];
  if (merged.length === current.lineUuids.length) return current;
  const next = { ...current, lineUuids: merged, updatedAt: nowIso() };
  await persistConnection(next);
  return next;
}

export async function replaceConnectionLines(id: string, lineUuids: string[]) {
  await ensureHydrated();
  const current = connections.get(id);
  if (!current) return null;
  const nextLines = [...new Set(lineUuids)];
  const same =
    nextLines.length === current.lineUuids.length &&
    nextLines.every((uuid) => current.lineUuids.includes(uuid));
  if (same) return current;
  const next = { ...current, lineUuids: nextLines, updatedAt: nowIso() };
  await persistConnection(next);
  return next;
}
