import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getConnection, listConnections } from "@/lib/ixacs-connections";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type KeyStatus = "active" | "disabled";
export type KeyEnvironment = "live" | "test";

export type IssuedApiKey = {
  key: string;
  createdAt: string;
  name: string | null;
  status: KeyStatus;
  environment: KeyEnvironment;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lineUuid: string | null;
  connectionId: string | null;
  groupUuid: string | null;
  groupName: string | null;
  lineName: string | null;
};

type DbRow = {
  key: string;
  created_at: string;
  name: string | null;
  status: string;
  environment: string;
  expires_at: string | null;
  last_used_at: string | null;
  line_uuid: string | null;
  connection_id: string | null;
  group_uuid: string | null;
  group_name: string | null;
  line_name: string | null;
};

type PersistedKeys = {
  apiKeys: Record<string, IssuedApiKey>;
};

const FILE = path.join(process.cwd(), "data", "push-api-keys.json");
const LEGACY_STATE_FILE = path.join(process.cwd(), "data", "andon-state.json");

let apiKeys = new Map<string, IssuedApiKey>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function normalizeKey(item: Partial<IssuedApiKey> & { key: string }): IssuedApiKey {
  return {
    key: item.key,
    createdAt: item.createdAt ?? new Date().toISOString(),
    name: item.name ?? item.lineName ?? null,
    status: item.status === "disabled" ? "disabled" : "active",
    environment: item.environment === "test" ? "test" : "live",
    expiresAt: item.expiresAt ?? null,
    lastUsedAt: item.lastUsedAt ?? null,
    lineUuid: item.lineUuid ?? null,
    connectionId: item.connectionId ?? null,
    groupUuid: item.groupUuid ?? null,
    groupName: item.groupName ?? null,
    lineName: item.lineName ?? null,
  };
}

function rowToKey(row: DbRow): IssuedApiKey {
  return normalizeKey({
    key: row.key,
    createdAt: row.created_at,
    name: row.name,
    status: row.status === "disabled" ? "disabled" : "active",
    environment: row.environment === "test" ? "test" : "live",
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    lineUuid: row.line_uuid,
    connectionId: row.connection_id,
    groupUuid: row.group_uuid,
    groupName: row.group_name,
    lineName: row.line_name,
  });
}

function keyToRow(item: IssuedApiKey): DbRow {
  return {
    key: item.key,
    created_at: item.createdAt,
    name: item.name,
    status: item.status,
    environment: item.environment,
    expires_at: item.expiresAt,
    last_used_at: item.lastUsedAt,
    line_uuid: item.lineUuid,
    connection_id: item.connectionId,
    group_uuid: item.groupUuid,
    group_name: item.groupName,
    line_name: item.lineName,
  };
}

function readLegacyAndonKeys(): IssuedApiKey[] {
  if (!existsSync(LEGACY_STATE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LEGACY_STATE_FILE, "utf8")) as {
      apiKeys?: Record<string, Partial<IssuedApiKey> & { key?: string }>;
      lines?: Record<string, { nameTh?: string; receivedAt?: string; connectionId?: string | null; groupUuid?: string | null; xApiKey?: string | null }>;
    };
    const items = new Map<string, IssuedApiKey>();
    for (const [key, item] of Object.entries(parsed.apiKeys ?? {})) {
      items.set(key, normalizeKey({ ...item, key: item.key ?? key }));
    }
    for (const [lineUuid, line] of Object.entries(parsed.lines ?? {})) {
      const legacyKey = line.xApiKey;
      if (!legacyKey || items.has(legacyKey)) continue;
      items.set(legacyKey, normalizeKey({
        key: legacyKey,
        createdAt: line.receivedAt ?? new Date().toISOString(),
        name: line.nameTh ?? null,
        status: "active",
        environment: "live",
        lastUsedAt: line.receivedAt ?? null,
        lineUuid,
        connectionId: line.connectionId ?? null,
        groupUuid: line.groupUuid ?? null,
        lineName: line.nameTh ?? null,
      }));
    }
    return [...items.values()];
  } catch {
    return [];
  }
}

function hydrateFromFile() {
  const fromFile = existsSync(FILE)
    ? (() => {
        try {
          const parsed = JSON.parse(readFileSync(FILE, "utf8")) as PersistedKeys;
          return Object.entries(parsed.apiKeys ?? {}).map(([key, item]) =>
            normalizeKey({ ...item, key: item.key ?? key }),
          );
        } catch {
          return [] as IssuedApiKey[];
        }
      })()
    : [];
  const legacy = fromFile.length === 0 ? readLegacyAndonKeys() : [];
  apiKeys = new Map([...fromFile, ...legacy].map((item) => [item.key, item]));
}

function persistFile() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const payload: PersistedKeys = { apiKeys: Object.fromEntries(apiKeys) };
  writeFileSync(FILE, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase
    .from("push_api_keys")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`PUSH_KEYS_LOAD_FAILED: ${error.message}`);
  const rows = (data as DbRow[] | null) ?? [];
  apiKeys = new Map(rows.map((row) => [row.key, rowToKey(row)]));

  if (apiKeys.size > 0) return;

  // One-time migrate from local andon-state / push-api-keys file into Supabase.
  const local = (() => {
    hydrateFromFile();
    return [...apiKeys.values()];
  })();
  if (local.length === 0) {
    apiKeys = new Map();
    return;
  }
  const { error: upsertError } = await supabase.from("push_api_keys").upsert(local.map(keyToRow));
  if (upsertError) throw new Error(`PUSH_KEYS_MIGRATE_FAILED: ${upsertError.message}`);
  apiKeys = new Map(local.map((item) => [item.key, item]));
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
      // Fill missing connectionId from known line → company mapping when possible.
      const available = (await listConnections()).connections;
      let changed = false;
      for (const item of apiKeys.values()) {
        if (item.connectionId || !item.lineUuid) continue;
        const match = available.find((connection) => connection.lineUuids.includes(item.lineUuid!));
        if (match) {
          item.connectionId = match.id;
          changed = true;
        }
      }
      if (changed) await persistAll();
      hydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

async function upsertSupabase(item: IssuedApiKey) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("push_api_keys").upsert(keyToRow(item));
  if (error) throw new Error(`PUSH_KEYS_SAVE_FAILED: ${error.message}`);
}

async function deleteSupabase(key: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("push_api_keys").delete().eq("key", key);
  if (error) throw new Error(`PUSH_KEYS_DELETE_FAILED: ${error.message}`);
}

async function persistKey(item: IssuedApiKey) {
  apiKeys.set(item.key, item);
  if (supabaseConfigured()) {
    await upsertSupabase(item);
  } else {
    persistFile();
  }
}

async function persistAll() {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    if (apiKeys.size === 0) return;
    const { error } = await supabase.from("push_api_keys").upsert([...apiKeys.values()].map(keyToRow));
    if (error) throw new Error(`PUSH_KEYS_SAVE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
}

export async function issueApiKey(input: {
  connectionId: string;
  groupUuid: string;
  groupName: string;
  lineUuid: string;
  lineName: string;
  name?: string;
  environment?: KeyEnvironment;
  expiresAt?: string | null;
}) {
  await ensureHydrated();
  const connection = await getConnection(input.connectionId);
  if (!connection || !connection.lineUuids.includes(input.lineUuid)) return null;
  const key = randomUUID();
  const name = input.name?.trim() || input.lineName;
  const issued = normalizeKey({
    key,
    createdAt: new Date().toISOString(),
    name,
    status: "active",
    environment: input.environment === "test" ? "test" : "live",
    expiresAt: input.expiresAt ?? null,
    lastUsedAt: null,
    lineUuid: input.lineUuid,
    connectionId: input.connectionId,
    groupUuid: input.groupUuid,
    groupName: input.groupName,
    lineName: input.lineName,
  });
  await persistKey(issued);
  return issued;
}

export async function getIssuedKey(key: string) {
  await ensureHydrated();
  return apiKeys.get(key) ?? null;
}

export async function revokeApiKey(key: string) {
  await ensureHydrated();
  const existed = apiKeys.delete(key);
  if (!existed) return false;
  if (supabaseConfigured()) {
    await deleteSupabase(key);
  } else {
    persistFile();
  }
  return true;
}

export async function setApiKeyStatus(key: string, status: KeyStatus) {
  await ensureHydrated();
  const issued = apiKeys.get(key);
  if (!issued) return null;
  issued.status = status;
  await persistKey(issued);
  return issued;
}

export async function rotateApiKey(key: string) {
  await ensureHydrated();
  const issued = apiKeys.get(key);
  if (!issued) return null;
  const next = randomUUID();
  apiKeys.delete(key);
  const rotated = normalizeKey({ ...issued, key: next, lastUsedAt: null });
  if (supabaseConfigured()) {
    await deleteSupabase(key);
    await upsertSupabase(rotated);
  }
  apiKeys.set(next, rotated);
  if (!supabaseConfigured()) persistFile();
  return rotated;
}

/** Persist whatever is already on the in-memory key (e.g. after a push batch). */
export async function saveApiKey(key: string) {
  await ensureHydrated();
  const issued = apiKeys.get(key);
  if (!issued) return null;
  await persistKey(issued);
  return issued;
}

export async function getIssuedKeys(connectionId?: string | null) {
  await ensureHydrated();
  return Promise.all(
    [...apiKeys.values()]
      .filter((item) => connectionId == null || item.connectionId === connectionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(async (item) => {
        const connection = item.connectionId ? await getConnection(item.connectionId) : null;
        return {
          key: item.key,
          createdAt: item.createdAt,
          name: item.name ?? item.lineName ?? null,
          status: item.status === "disabled" ? "disabled" : ("active" as const),
          environment: item.environment === "test" ? "test" : ("live" as const),
          expiresAt: item.expiresAt ?? null,
          lastUsedAt: item.lastUsedAt ?? null,
          company: connection ? { id: connection.id, name: connection.name } : null,
          line: item.lineUuid
            ? {
                uuid: item.lineUuid,
                nameTh: item.lineName ?? item.lineUuid,
                nameEn: item.lineName ?? item.lineUuid,
                nameJa: item.lineName ?? item.lineUuid,
              }
            : null,
          group: item.groupUuid
            ? {
                uuid: item.groupUuid,
                nameTh: item.groupName ?? item.groupUuid,
                nameEn: item.groupName ?? item.groupUuid,
                nameJa: item.groupName ?? item.groupUuid,
              }
            : null,
        };
      }),
  );
}

export async function isPushAuthorized(apiKey: string | null) {
  await ensureHydrated();
  if (process.env.PUSH_API_KEY && apiKey === process.env.PUSH_API_KEY) return true;
  if (!apiKey) return false;
  const issued = apiKeys.get(apiKey);
  if (!issued) return false;
  if (issued.status === "disabled") return false;
  if (issued.expiresAt && Date.parse(issued.expiresAt) < Date.now()) return false;
  return true;
}

export async function getPushKeyAssignment(apiKey: string | null) {
  await ensureHydrated();
  if (!apiKey) return null;
  const issued = apiKeys.get(apiKey);
  if (!issued) return null;
  return { connectionId: issued.connectionId, lineUuid: issued.lineUuid };
}

/** Active (non-disabled, non-expired) push keys for a company → controllable production lines. */
export async function getControllableLineUuids(connectionId: string): Promise<Set<string>> {
  await ensureHydrated();
  const now = Date.now();
  const ids = new Set<string>();
  for (const item of apiKeys.values()) {
    if (item.connectionId !== connectionId) continue;
    if (item.status === "disabled") continue;
    if (item.expiresAt && Date.parse(item.expiresAt) < now) continue;
    if (item.lineUuid) ids.add(item.lineUuid);
  }
  return ids;
}

export async function isLineControllable(connectionId: string, lineUuid: string) {
  const ids = await getControllableLineUuids(connectionId);
  return ids.has(lineUuid);
}

export function pushKeysStorage() {
  return supabaseConfigured() ? ("supabase" as const) : ("file" as const);
}
