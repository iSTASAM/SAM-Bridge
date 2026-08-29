import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { decryptSecret, encryptSecret, connectionSecretsConfigured } from "@/lib/connection-secrets";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type LineWebhookSettings = {
  publicUrl: string;
  channelSecret: string;
  channelAccessToken: string;
  liffId: string;
  lineLoginChannelId: string;
  updatedAt: string;
};

export type LineSettingsSource = "env" | "supabase" | "file" | "mixed";

type DbRow = {
  id: number;
  public_url: string;
  channel_secret: string;
  channel_access_token?: string | null;
  liff_id: string;
  line_login_channel_id: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "line-webhook-settings.json");

let secretCache: { value: string; expiresAt: number } | null = null;
let accessTokenCache: { value: string; expiresAt: number } | null = null;

function strip(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function rememberSecret(value: string) {
  if (!value) {
    secretCache = null;
    return;
  }
  secretCache = { value, expiresAt: Date.now() + 60_000 };
}

function rememberAccessToken(value: string) {
  if (!value) {
    accessTokenCache = null;
    return;
  }
  accessTokenCache = { value, expiresAt: Date.now() + 60_000 };
}

function envPublicUrl() {
  const explicit = strip(process.env.LINE_PUBLIC_URL);
  if (explicit) {
    try {
      return normalizePublicUrl(explicit);
    } catch {
      return "";
    }
  }
  const production = strip(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`;
  const vercel = strip(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

function fromEnv(): Partial<LineWebhookSettings> {
  return {
    publicUrl: envPublicUrl(),
    channelSecret: strip(process.env.LINE_CHANNEL_SECRET),
    channelAccessToken: strip(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    liffId: strip(process.env.LINE_LIFF_ID),
    lineLoginChannelId: strip(process.env.LINE_LOGIN_CHANNEL_ID),
  };
}

function readFileSettings(): LineWebhookSettings | null {
  if (!existsSync(FILE)) return null;
  try {
    const value = JSON.parse(readFileSync(FILE, "utf8")) as Partial<LineWebhookSettings>;
    if (!value.publicUrl && !value.channelSecret && !value.channelAccessToken) return null;
    return {
      publicUrl: value.publicUrl ?? "",
      channelSecret: value.channelSecret ?? "",
      channelAccessToken: value.channelAccessToken ?? "",
      liffId: value.liffId ?? "",
      lineLoginChannelId: value.lineLoginChannelId ?? "",
      updatedAt: value.updatedAt ?? "",
    };
  } catch {
    return null;
  }
}

function writeFileSettings(value: LineWebhookSettings) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function readSupabaseSettings(): Promise<LineWebhookSettings | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("line_webhook_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`LINE_SETTINGS_LOAD_FAILED: ${error.message}`);
  if (!data) return null;
  const row = data as DbRow;
  return {
    publicUrl: row.public_url ?? "",
    channelSecret: row.channel_secret ? decryptSecret(row.channel_secret) : "",
    channelAccessToken: row.channel_access_token ? decryptSecret(row.channel_access_token) : "",
    liffId: row.liff_id ?? "",
    lineLoginChannelId: row.line_login_channel_id ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

async function writeSupabaseSettings(value: LineWebhookSettings) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  const { error } = await supabase.from("line_webhook_settings").upsert({
    id: 1,
    public_url: value.publicUrl,
    channel_secret: encryptSecret(value.channelSecret),
    channel_access_token: value.channelAccessToken ? encryptSecret(value.channelAccessToken) : "",
    liff_id: value.liffId,
    line_login_channel_id: value.lineLoginChannelId,
    updated_at: value.updatedAt,
  });
  if (error) throw new Error(`LINE_SETTINGS_SAVE_FAILED: ${error.message}`);
}

function mergeSettings(stored: LineWebhookSettings | null): LineWebhookSettings | null {
  const env = fromEnv();
  // Stored (Supabase/UI) wins over env so renewed Messaging API credentials apply immediately.
  const merged: LineWebhookSettings = {
    publicUrl: stored?.publicUrl || env.publicUrl || "",
    channelSecret: stored?.channelSecret || env.channelSecret || "",
    channelAccessToken: stored?.channelAccessToken || env.channelAccessToken || "",
    liffId: stored?.liffId || env.liffId || "",
    lineLoginChannelId: stored?.lineLoginChannelId || env.lineLoginChannelId || "",
    updatedAt: stored?.updatedAt || "",
  };
  if (
    !merged.publicUrl &&
    !merged.channelSecret &&
    !merged.channelAccessToken &&
    !merged.liffId &&
    !merged.lineLoginChannelId
  ) {
    return null;
  }
  return merged;
}

/** Prefer Supabase (settings UI), then env, then local file. Cached for LINE timeout. */
export function getLineChannelSecretFast(): string {
  if (secretCache && secretCache.expiresAt > Date.now()) return secretCache.value;
  const envSecret = strip(process.env.LINE_CHANNEL_SECRET);
  if (envSecret) return envSecret;
  return readFileSettings()?.channelSecret ?? "";
}

export async function getLineChannelSecret(): Promise<string> {
  if (secretCache && secretCache.expiresAt > Date.now()) return secretCache.value;

  if (supabaseConfigured()) {
    try {
      const stored = await Promise.race([
        readSupabaseSettings(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ]);
      if (stored?.channelSecret) {
        rememberSecret(stored.channelSecret);
        return stored.channelSecret;
      }
    } catch {
      // fall through to env
    }
  }

  const fallback = getLineChannelSecretFast();
  if (fallback) rememberSecret(fallback);
  return fallback;
}

export async function getLineChannelAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.value;

  if (supabaseConfigured()) {
    try {
      const stored = await Promise.race([
        readSupabaseSettings(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ]);
      if (stored?.channelAccessToken) {
        rememberAccessToken(stored.channelAccessToken);
        return stored.channelAccessToken;
      }
    } catch {
      // fall through
    }
  }

  const fromEnv = strip(process.env.LINE_CHANNEL_ACCESS_TOKEN);
  if (fromEnv) {
    rememberAccessToken(fromEnv);
    return fromEnv;
  }
  const fromFile = readFileSettings()?.channelAccessToken ?? "";
  if (fromFile) rememberAccessToken(fromFile);
  return fromFile;
}

export async function getLineWebhookSettings(): Promise<LineWebhookSettings | null> {
  let stored: LineWebhookSettings | null = null;
  if (supabaseConfigured()) {
    try {
      stored = await readSupabaseSettings();
    } catch {
      stored = readFileSettings();
    }
  } else {
    stored = readFileSettings();
  }
  const merged = mergeSettings(stored);
  if (merged?.channelSecret) rememberSecret(merged.channelSecret);
  if (merged?.channelAccessToken) rememberAccessToken(merged.channelAccessToken);
  return merged;
}

export async function getLineWebhookSettingsMeta() {
  const settings = await getLineWebhookSettings();
  const env = fromEnv();
  let storage: LineSettingsSource = "file";
  if (supabaseConfigured()) storage = env.channelSecret && !settings?.updatedAt ? "env" : "supabase";
  else if (env.channelSecret) storage = "env";
  if (env.channelSecret && settings?.updatedAt) storage = "mixed";
  return {
    settings,
    storage,
    supabaseConfigured: supabaseConfigured(),
  };
}

export function normalizePublicUrl(value: string) {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("PUBLIC_HTTPS_URL_REQUIRED");
  }
  return url.origin;
}

export async function saveLineWebhookSettings(
  publicUrl: string,
  channelSecret: string,
  liffId = "",
  lineLoginChannelId = "",
  channelAccessToken = "",
) {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");

  const current = await getLineWebhookSettings();
  const secret = strip(channelSecret) || current?.channelSecret || "";
  if (!secret) throw new Error("CHANNEL_SECRET_REQUIRED");
  const accessToken = strip(channelAccessToken) || current?.channelAccessToken || "";
  if (!accessToken) throw new Error("CHANNEL_ACCESS_TOKEN_REQUIRED");
  const nextLiffId = strip(liffId) || current?.liffId || "";
  const nextChannelId = strip(lineLoginChannelId) || current?.lineLoginChannelId || "";
  if (!nextLiffId) throw new Error("LIFF_ID_REQUIRED");
  if (!nextChannelId) throw new Error("LINE_LOGIN_CHANNEL_ID_REQUIRED");
  if (!/^\d+-[A-Za-z0-9_-]+$/.test(nextLiffId)) throw new Error("INVALID_LIFF_ID");
  if (!/^\d+$/.test(nextChannelId)) throw new Error("INVALID_LINE_LOGIN_CHANNEL_ID");

  const value: LineWebhookSettings = {
    publicUrl: normalizePublicUrl(publicUrl || current?.publicUrl || envPublicUrl() || "https://sam-bridge.vercel.app"),
    channelSecret: secret,
    channelAccessToken: accessToken,
    liffId: nextLiffId,
    lineLoginChannelId: nextChannelId,
    updatedAt: new Date().toISOString(),
  };

  await writeSupabaseSettings(value);
  rememberSecret(value.channelSecret);
  rememberAccessToken(value.channelAccessToken);
  // Keep a local mirror for offline/dev only.
  try {
    writeFileSettings(value);
  } catch {
    // ignore ephemeral FS
  }
  return value;
}
