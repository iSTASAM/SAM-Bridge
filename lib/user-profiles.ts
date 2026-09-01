import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import type { AuthRole, AuthSession } from "@/lib/auth";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type UserProfile = {
  id: string;
  role: AuthRole;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  adminAccountId: string | null;
  connectionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUserProfile = {
  id: string;
  role: AuthRole;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  canChangePassword: boolean;
};

type DbRow = {
  id: string;
  role: AuthRole;
  username: string;
  display_name: string;
  avatar_url: string | null;
  admin_account_id: string | null;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "user-profiles.json");
const AVATAR_DIR = path.join(process.cwd(), "data", "user-avatars");
const AVATAR_ROUTE = "/api/user/profile/avatar";

let store = new Map<string, UserProfile>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export function profileIdFromSession(session: Pick<AuthSession, "role" | "username" | "connectionId" | "adminAccountId">) {
  if (session.role === "admin") {
    const accountId = session.adminAccountId?.trim();
    if (accountId && accountId !== "env") return `admin:${accountId}`;
    return `admin:env:${session.username.trim().toLowerCase()}`;
  }
  const connectionId = session.connectionId?.trim() ?? "";
  return `user:${connectionId}:${session.username.trim().toLowerCase()}`;
}

function avatarFileName(profileId: string) {
  return profileId.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function avatarFilePath(profileId: string) {
  return path.join(AVATAR_DIR, avatarFileName(profileId));
}

function normalize(item: Partial<UserProfile> & Pick<UserProfile, "id" | "role" | "username">): UserProfile {
  const now = new Date().toISOString();
  const username = item.username.trim();
  const displayName = (item.displayName ?? username).trim() || username;
  return {
    id: item.id,
    role: item.role,
    username,
    displayName,
    avatarUrl: item.avatarUrl ?? null,
    adminAccountId: item.adminAccountId ?? null,
    connectionId: item.connectionId ?? null,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

function rowToProfile(row: DbRow): UserProfile {
  return normalize({
    id: row.id,
    role: row.role,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    adminAccountId: row.admin_account_id,
    connectionId: row.connection_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function profileToRow(item: UserProfile): DbRow {
  return {
    id: item.id,
    role: item.role,
    username: item.username,
    display_name: item.displayName,
    avatar_url: item.avatarUrl,
    admin_account_id: item.adminAccountId,
    connection_id: item.connectionId,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function publicProfile(item: UserProfile): PublicUserProfile {
  return {
    id: item.id,
    role: item.role,
    username: item.username,
    displayName: item.displayName,
    avatarUrl: item.avatarUrl,
    canChangePassword: item.role === "admin",
  };
}

function hydrateFromFile() {
  const next = new Map<string, UserProfile>();
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { profiles?: Record<string, Partial<UserProfile>> };
      for (const [id, raw] of Object.entries(parsed.profiles ?? {})) {
        if (!raw.username || !raw.role) continue;
        const item = normalize({
          ...raw,
          id: raw.id || id,
          role: raw.role,
          username: raw.username,
        });
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
  const profiles = Object.fromEntries([...store.entries()].map(([id, item]) => [id, item]));
  writeFileSync(FILE, JSON.stringify({ profiles }, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(`USER_PROFILES_LOAD_FAILED: ${error.message}`);
  const rows = (data as DbRow[] | null) ?? [];
  store = new Map(rows.map((row) => {
    const item = rowToProfile(row);
    return [item.id, item] as const;
  }));
  if (store.size > 0) return;
  hydrateFromFile();
  if (store.size === 0) return;
  const { error: upsertError } = await supabase.from("user_profiles").upsert([...store.values()].map(profileToRow));
  if (upsertError) throw new Error(`USER_PROFILES_MIGRATE_FAILED: ${upsertError.message}`);
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

async function persistProfile(item: UserProfile) {
  store.set(item.id, item);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("user_profiles").upsert(profileToRow(item));
    if (error) throw new Error(`USER_PROFILES_SAVE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
}

function profileSeed(session: AuthSession): UserProfile {
  const id = profileIdFromSession(session);
  const adminAccountId = session.role === "admin" ? (session.adminAccountId ?? "env") : null;
  return normalize({
    id,
    role: session.role,
    username: session.username,
    displayName: session.username,
    avatarUrl: null,
    adminAccountId,
    connectionId: session.connectionId ?? null,
  });
}

export async function getProfileForSession(session: AuthSession) {
  await ensureHydrated();
  const id = profileIdFromSession(session);
  const existing = store.get(id);
  if (existing) return publicProfile(existing);
  const created = profileSeed(session);
  await persistProfile(created);
  return publicProfile(created);
}

export async function updateProfileForSession(
  session: AuthSession,
  input: { displayName?: string; adminAccountId?: string },
) {
  await ensureHydrated();
  const id = profileIdFromSession(session);
  let current = store.get(id);
  if (!current) {
    current = profileSeed(session);
  }
  const displayName = input.displayName !== undefined ? input.displayName.trim() : current.displayName;
  if (!displayName) throw new Error("DISPLAY_NAME_REQUIRED");
  const next = normalize({
    ...current,
    displayName,
    adminAccountId: input.adminAccountId ?? current.adminAccountId,
    updatedAt: new Date().toISOString(),
  });
  await persistProfile(next);
  return publicProfile(next);
}

export async function setProfileAvatar(session: AuthSession, buffer: Buffer, contentType: string) {
  await ensureHydrated();
  const id = profileIdFromSession(session);
  let current = store.get(id);
  if (!current) current = profileSeed(session);
  mkdirSync(AVATAR_DIR, { recursive: true });
  const base = avatarFilePath(id);
  for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif"]) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) unlinkSync(candidate);
  }
  const ext =
    contentType === "image/png" ? ".png"
      : contentType === "image/webp" ? ".webp"
        : contentType === "image/gif" ? ".gif"
          : ".jpg";
  writeFileSync(`${base}${ext}`, buffer);
  const avatarUrl = `${AVATAR_ROUTE}?v=${Date.now()}`;
  const next = normalize({ ...current, avatarUrl, updatedAt: new Date().toISOString() });
  await persistProfile(next);
  return publicProfile(next);
}

export function readProfileAvatar(profileId: string) {
  const base = avatarFilePath(profileId);
  for (const ext of [".webp", ".png", ".jpg", ".jpeg", ".gif"]) {
    const file = `${base}${ext}`;
    if (!existsSync(file)) continue;
    const buffer = readFileSync(file);
    const contentType =
      ext === ".png" ? "image/png"
        : ext === ".webp" ? "image/webp"
          : ext === ".gif" ? "image/gif"
            : "image/jpeg";
    return { buffer, contentType };
  }
  return null;
}

export function defaultAvatarUrl() {
  return "/mock-user.svg";
}
