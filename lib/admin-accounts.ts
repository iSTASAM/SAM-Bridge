import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type AdminAccount = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicAdmin = {
  id: string;
  username: string;
  source: "env" | "app";
  createdAt: string | null;
};

type DbRow = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "admin-accounts.json");
const KEYLEN = 64;

let store = new Map<string, AdminAccount>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function normalizeUsername(value: string) {
  return value.trim();
}

function usernameKey(value: string) {
  return normalizeUsername(value).toLowerCase();
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyAdminPassword(password: string, stored: string) {
  const [kind, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  try {
    const next = scryptSync(password, salt, KEYLEN);
    const prev = Buffer.from(hash, "hex");
    if (prev.length !== next.length) return false;
    return timingSafeEqual(prev, next);
  } catch {
    return false;
  }
}

function envAdmin(): PublicAdmin | null {
  const username = process.env.AUTH_USER?.trim() ?? "";
  if (!username) return null;
  return { id: "env", username, source: "env", createdAt: null };
}

function publicAdmin(item: AdminAccount): PublicAdmin {
  return { id: item.id, username: item.username, source: "app", createdAt: item.createdAt };
}

function normalize(item: Partial<AdminAccount> & { id: string; username: string; passwordHash: string }): AdminAccount {
  const now = new Date().toISOString();
  return {
    id: item.id,
    username: normalizeUsername(item.username),
    passwordHash: item.passwordHash,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

function rowToAccount(row: DbRow): AdminAccount {
  return normalize({
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function accountToRow(item: AdminAccount): DbRow {
  return {
    id: item.id,
    username: item.username,
    password_hash: item.passwordHash,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function hydrateFromFile() {
  const next = new Map<string, AdminAccount>();
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { accounts?: Record<string, Partial<AdminAccount>> };
      for (const [id, raw] of Object.entries(parsed.accounts ?? {})) {
        if (!raw.username || !raw.passwordHash) continue;
        const item = normalize({ ...raw, id: raw.id || id, username: raw.username, passwordHash: raw.passwordHash });
        next.set(item.id, item);
      }
    } catch {
      /* ignore */
    }
  }
  store = next;
}

function persistFile() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const accounts = Object.fromEntries([...store.values()].map((item) => [item.id, item]));
  writeFileSync(FILE, JSON.stringify({ accounts }, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase.from("admin_accounts").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(`ADMIN_ACCOUNTS_LOAD_FAILED: ${error.message}`);
  const rows = (data as DbRow[] | null) ?? [];
  store = new Map(rows.map((row) => {
    const item = rowToAccount(row);
    return [item.id, item] as const;
  }));
  if (store.size > 0) return;
  hydrateFromFile();
  if (store.size === 0) return;
  const { error: upsertError } = await supabase.from("admin_accounts").upsert([...store.values()].map(accountToRow));
  if (upsertError) throw new Error(`ADMIN_ACCOUNTS_MIGRATE_FAILED: ${upsertError.message}`);
}

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (supabaseConfigured()) await hydrateFromSupabase();
      else hydrateFromFile();
      hydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

function findByUsername(username: string) {
  const key = usernameKey(username);
  return [...store.values()].find((item) => usernameKey(item.username) === key) ?? null;
}

function envUsername() {
  return process.env.AUTH_USER?.trim() ?? "";
}

export async function listPublicAdmins(): Promise<PublicAdmin[]> {
  await ensureHydrated();
  if (supabaseConfigured()) await hydrateFromSupabase();
  const env = envAdmin();
  const app = [...store.values()].sort((a, b) => a.username.localeCompare(b.username)).map(publicAdmin);
  return env ? [env, ...app] : app;
}

export async function getPublicAdmin(id: string): Promise<PublicAdmin | null> {
  if (id === "env") return envAdmin();
  await ensureHydrated();
  if (supabaseConfigured()) await hydrateFromSupabase();
  const item = store.get(id);
  return item ? publicAdmin(item) : null;
}

export async function verifyAdminAccount(username: string, password: string) {
  await ensureHydrated();
  if (supabaseConfigured()) await hydrateFromSupabase();
  const item = findByUsername(username);
  if (!item || !verifyAdminPassword(password, item.passwordHash)) return null;
  return item;
}

export async function createAdminAccount(username: string, password: string) {
  await ensureHydrated();
  const name = normalizeUsername(username);
  if (!name) throw new Error("ADMIN_USERNAME_REQUIRED");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD_SHORT");
  if (usernameKey(name) === usernameKey(envUsername()) && envUsername()) throw new Error("ADMIN_USERNAME_TAKEN");
  if (findByUsername(name)) throw new Error("ADMIN_USERNAME_TAKEN");
  const now = new Date().toISOString();
  const next = normalize({
    id: randomUUID(),
    username: name,
    passwordHash: hashAdminPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  store.set(next.id, next);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("admin_accounts").insert(accountToRow(next));
    if (error) throw new Error(`ADMIN_ACCOUNTS_SAVE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
  return publicAdmin(next);
}

export async function updateAdminAccount(id: string, input: { username?: string; password?: string }) {
  await ensureHydrated();
  if (id === "env") throw new Error("ADMIN_ENV_LOCKED");
  const current = store.get(id);
  if (!current) return null;
  const username = input.username !== undefined ? normalizeUsername(input.username) : current.username;
  if (!username) throw new Error("ADMIN_USERNAME_REQUIRED");
  if (input.password !== undefined && input.password.length > 0 && input.password.length < 8) {
    throw new Error("ADMIN_PASSWORD_SHORT");
  }
  const taken = findByUsername(username);
  if (taken && taken.id !== id) throw new Error("ADMIN_USERNAME_TAKEN");
  if (usernameKey(username) === usernameKey(envUsername()) && envUsername()) throw new Error("ADMIN_USERNAME_TAKEN");
  const next = normalize({
    ...current,
    username,
    passwordHash: input.password ? hashAdminPassword(input.password) : current.passwordHash,
    updatedAt: new Date().toISOString(),
  });
  store.set(id, next);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("admin_accounts").update(accountToRow(next)).eq("id", id);
    if (error) throw new Error(`ADMIN_ACCOUNTS_SAVE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
  return publicAdmin(next);
}

export async function deleteAdminAccount(id: string) {
  await ensureHydrated();
  if (id === "env") throw new Error("ADMIN_ENV_LOCKED");
  if (!store.has(id)) return false;
  store.delete(id);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("admin_accounts").delete().eq("id", id);
    if (error) throw new Error(`ADMIN_ACCOUNTS_DELETE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
  return true;
}
