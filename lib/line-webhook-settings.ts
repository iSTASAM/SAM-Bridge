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

type DbRow = {
  id: number;
  public_url: string;
  channel_secret: string;
  liff_id: string;
  line_login_channel_id: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "line-webhook-settings.json");

function envPublicUrl() {
  const explicit = process.env.LINE_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      return normalizePublicUrl(explicit);
    } catch {
      return "";
    }
  }
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

function fromEnv(): Partial<LineWebhookSettings> {
  return {
    publicUrl: envPublicUrl(),
    channelSecret: process.env.LINE_CHANNEL_SECRET?.trim() || "",
    liffId: process.env.LINE_LIFF_ID?.trim() || "",
    lineLoginChannelId: process.env.LINE_LOGIN_CHANNEL_ID?.trim() || "",
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
  return mergeSettings(stored);
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
  const current = await getLineWebhookSettings();
  const secret = channelSecret.trim() || current?.channelSecret || "";
  if (!secret) throw new Error("CHANNEL_SECRET_REQUIRED");
  const nextLiffId = liffId.trim() || current?.liffId || "";
  const nextChannelId = lineLoginChannelId.trim() || current?.lineLoginChannelId || "";
  if (nextLiffId && !/^\d+-[A-Za-z0-9_-]+$/.test(nextLiffId)) throw new Error("INVALID_LIFF_ID");
  if (nextChannelId && !/^\d+$/.test(nextChannelId)) throw new Error("INVALID_LINE_LOGIN_CHANNEL_ID");
  const value: LineWebhookSettings = {
    publicUrl: normalizePublicUrl(publicUrl),
    channelSecret: secret,
    liffId: nextLiffId,
    lineLoginChannelId: nextChannelId,
    updatedAt: new Date().toISOString(),
  };
  if (supabaseConfigured()) {
    await writeSupabaseSettings(value);
  } else {
    writeFileSettings(value);
  }
  return value;
}
