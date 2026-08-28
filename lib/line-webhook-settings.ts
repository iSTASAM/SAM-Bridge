import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { decryptSecret, encryptSecret, connectionSecretsConfigured } from "@/lib/connection-secrets";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type LineWebhookSettings = {
  publicUrl: string;
  channelSecret: string;
  liffId: string;
  lineLoginChannelId: string;
  updatedAt: string;
};

export type LineSettingsSource = "env" | "supabase" | "file" | "mixed";

type DbRow = {
  id: number;
  public_url: string;
  channel_secret: string;
  liff_id: string;
  line_login_channel_id: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "line-webhook-settings.json");

function strip(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
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
    liffId: strip(process.env.LINE_LIFF_ID),
    lineLoginChannelId: strip(process.env.LINE_LOGIN_CHANNEL_ID),
  };
}

function readFileSettings(): LineWebhookSettings | null {
  if (!existsSync(FILE)) return null;
  try {
    const value = JSON.parse(readFileSync(FILE, "utf8")) as Partial<LineWebhookSettings>;
    if (!value.publicUrl && !value.channelSecret) return null;
    return {
      publicUrl: value.publicUrl ?? "",
      channelSecret: value.channelSecret ?? "",
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
    liff_id: value.liffId,
    line_login_channel_id: value.lineLoginChannelId,
    updated_at: value.updatedAt,
  });
  if (error) throw new Error(`LINE_SETTINGS_SAVE_FAILED: ${error.message}`);
}

function mergeSettings(stored: LineWebhookSettings | null): LineWebhookSettings | null {
  const env = fromEnv();
  const merged: LineWebhookSettings = {
    publicUrl: env.publicUrl || stored?.publicUrl || "",
    channelSecret: env.channelSecret || stored?.channelSecret || "",
    liffId: env.liffId || stored?.liffId || "",
    lineLoginChannelId: env.lineLoginChannelId || stored?.lineLoginChannelId || "",
    updatedAt: stored?.updatedAt || "",
  };
  if (!merged.publicUrl && !merged.channelSecret && !merged.liffId && !merged.lineLoginChannelId) {
    return null;
  }
  return merged;
}

/** Sync/env-only path for LINE webhook — must stay under LINE's timeout. */
export function getLineChannelSecretFast(): string {
  const envSecret = strip(process.env.LINE_CHANNEL_SECRET);
  if (envSecret) return envSecret;
  return readFileSettings()?.channelSecret ?? "";
}

export async function getLineChannelSecret(): Promise<string> {
  const fast = getLineChannelSecretFast();
  if (fast) return fast;
  if (!supabaseConfigured()) return "";
  try {
    const stored = await Promise.race([
      readSupabaseSettings(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    return stored?.channelSecret ?? "";
  } catch {
    return "";
  }
}

export async function getLineWebhookSettings(): Promise<LineWebhookSettings | null> {
  const env = fromEnv();
  // Prefer env for speed when Messaging credentials are already deployed.
  if (env.channelSecret && env.liffId && env.lineLoginChannelId) {
    return mergeSettings(null);
  }

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
  return mergeSettings(stored);
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
) {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");

  const current = await getLineWebhookSettings();
  const secret = strip(channelSecret) || current?.channelSecret || "";
  if (!secret) throw new Error("CHANNEL_SECRET_REQUIRED");
  const nextLiffId = strip(liffId) || current?.liffId || "";
  const nextChannelId = strip(lineLoginChannelId) || current?.lineLoginChannelId || "";
  if (!nextLiffId) throw new Error("LIFF_ID_REQUIRED");
  if (!nextChannelId) throw new Error("LINE_LOGIN_CHANNEL_ID_REQUIRED");
  if (!/^\d+-[A-Za-z0-9_-]+$/.test(nextLiffId)) throw new Error("INVALID_LIFF_ID");
  if (!/^\d+$/.test(nextChannelId)) throw new Error("INVALID_LINE_LOGIN_CHANNEL_ID");

  const value: LineWebhookSettings = {
    publicUrl: normalizePublicUrl(publicUrl || current?.publicUrl || envPublicUrl() || "https://sam-bridge.vercel.app"),
    channelSecret: secret,
    liffId: nextLiffId,
    lineLoginChannelId: nextChannelId,
    updatedAt: new Date().toISOString(),
  };

  await writeSupabaseSettings(value);
  // Keep a local mirror for offline/dev only.
  try {
    writeFileSettings(value);
  } catch {
    // ignore ephemeral FS
  }
  return value;
}
