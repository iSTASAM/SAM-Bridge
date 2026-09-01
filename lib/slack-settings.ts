import { existsSync, readFileSync } from "fs";
import path from "path";
import { connectionSecretsConfigured, decryptSecret, encryptSecret } from "@/lib/connection-secrets";
import { isSlackWebhookUrl, slackApi } from "@/lib/slack-webhook";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type SlackSettings = {
  publicUrl: string;
  incomingWebhook: string;
  channelId: string;
  botToken: string;
  signingSecret: string;
  updatedAt: string;
};

type SlackSettingsRow = {
  public_url: string;
  incoming_webhook: string;
  channel_id: string;
  bot_token: string;
  signing_secret: string;
  updated_at: string;
};

const LEGACY_FILE = path.join(process.cwd(), "data", "notification-configs.json");
let cache: { value: SlackSettings; expiresAt: number } | null = null;

export function invalidateSlackSettingsCache() {
  cache = null;
}

function strip(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function publicUrlFromEnv() {
  const value = strip(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL);
  return value ? `https://${value.replace(/^https?:\/\//, "")}` : "";
}

function validatePublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PUBLIC_HTTPS_URL_REQUIRED");
  }
  return url.origin;
}

function decodeSecret(value: string) {
  return value ? decryptSecret(value) : "";
}

function rowToSettings(row: SlackSettingsRow): SlackSettings {
  return {
    publicUrl: row.public_url || "",
    incomingWebhook: decodeSecret(row.incoming_webhook),
    channelId: row.channel_id || "",
    botToken: decodeSecret(row.bot_token),
    signingSecret: decodeSecret(row.signing_secret),
    updatedAt: row.updated_at || "",
  };
}

function legacyWebhook() {
  if (!existsSync(LEGACY_FILE)) return "";
  try {
    const parsed = JSON.parse(readFileSync(LEGACY_FILE, "utf8")) as { rules?: Record<string, { webhookUrl?: string }> };
    return Object.values(parsed.rules ?? {}).find((rule) => isSlackWebhookUrl(rule.webhookUrl ?? ""))?.webhookUrl ?? "";
  } catch {
    return "";
  }
}

export async function getSlackSettings(): Promise<SlackSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  let value: SlackSettings = {
    publicUrl: publicUrlFromEnv(),
    incomingWebhook: strip(process.env.SLACK_INCOMING_WEBHOOK) || legacyWebhook(),
    channelId: strip(process.env.SLACK_CHANNEL_ID),
    botToken: strip(process.env.SLACK_BOT_TOKEN),
    signingSecret: strip(process.env.SLACK_SIGNING_SECRET),
    updatedAt: "",
  };
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("slack_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw new Error(`SLACK_SETTINGS_LOAD_FAILED: ${error.message}`);
      if (data) {
        const stored = rowToSettings(data as SlackSettingsRow);
        value = {
          publicUrl: stored.publicUrl || value.publicUrl,
          incomingWebhook: stored.incomingWebhook || value.incomingWebhook,
          channelId: stored.channelId || value.channelId,
          botToken: stored.botToken || value.botToken,
          signingSecret: stored.signingSecret || value.signingSecret,
          updatedAt: stored.updatedAt,
        };
      }
    }
  }
  cache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

function isBotToken(value: string) {
  return /^xoxb-[A-Za-z0-9-]+$/.test(value);
}

export function maskBotToken(token: string) {
  const parts = token.split("-");
  if (parts.length < 3 || parts[0] !== "xoxb") return "xoxb-••••••••••••••••";
  const team = parts[1] ?? "";
  const bot = parts[2] ?? "";
  const visibleBot = bot.slice(0, Math.min(10, bot.length));
  return `xoxb-${team}-${visibleBot}${"x".repeat(15)}`;
}

export async function saveSlackSettings(input: Partial<SlackSettings>) {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  const current = await getSlackSettings();
  const publicUrlRaw = strip(input.publicUrl) || current.publicUrl || publicUrlFromEnv();
  const next: SlackSettings = {
    publicUrl: publicUrlRaw ? validatePublicUrl(publicUrlRaw) : "",
    incomingWebhook: strip(input.incomingWebhook) || current.incomingWebhook,
    channelId: strip(input.channelId) || current.channelId,
    botToken: strip(input.botToken) || current.botToken,
    signingSecret: strip(input.signingSecret) || current.signingSecret,
    updatedAt: new Date().toISOString(),
  };
  if (!isBotToken(next.botToken)) throw new Error("INVALID_SLACK_BOT_TOKEN");
  if (!/^[CG][A-Z0-9]+$/i.test(next.channelId)) throw new Error("INVALID_SLACK_CHANNEL_ID");
  if (next.incomingWebhook && !isSlackWebhookUrl(next.incomingWebhook)) throw new Error("INVALID_SLACK_WEBHOOK_URL");
  if (next.signingSecret && next.signingSecret.length < 24) throw new Error("INVALID_SLACK_SIGNING_SECRET");

  const auth = await slackApi(next.botToken, "auth.test", {});
  if (!auth.ok) throw new Error(`SLACK_AUTH_FAILED: ${auth.error ?? "UNKNOWN"}`);

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("slack_settings").upsert({
    id: 1,
    public_url: next.publicUrl,
    incoming_webhook: encryptSecret(next.incomingWebhook),
    channel_id: next.channelId,
    bot_token: encryptSecret(next.botToken),
    signing_secret: encryptSecret(next.signingSecret),
    updated_at: next.updatedAt,
  });
  if (error) throw new Error(`SLACK_SETTINGS_SAVE_FAILED: ${error.message}`);
  cache = { value: next, expiresAt: Date.now() + 30_000 };
  return next;
}

/** Workspace-level Event Subscriptions settings (Signing Secret + public URL). */
export async function saveSlackEventSettings(input: { publicUrl?: string; signingSecret?: string }) {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  const current = await getSlackSettings();
  const publicUrlRaw = strip(input.publicUrl) || current.publicUrl || publicUrlFromEnv();
  const signingSecret = strip(input.signingSecret) || current.signingSecret;
  if (strip(input.signingSecret) && signingSecret.length < 24) throw new Error("INVALID_SLACK_SIGNING_SECRET");
  if (!signingSecret) throw new Error("INVALID_SLACK_SIGNING_SECRET");
  const next: SlackSettings = {
    ...current,
    publicUrl: publicUrlRaw ? validatePublicUrl(publicUrlRaw) : "",
    signingSecret,
    updatedAt: new Date().toISOString(),
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { error } = await supabase.from("slack_settings").upsert({
    id: 1,
    public_url: next.publicUrl,
    incoming_webhook: next.incomingWebhook ? encryptSecret(next.incomingWebhook) : "",
    channel_id: next.channelId,
    bot_token: next.botToken ? encryptSecret(next.botToken) : "",
    signing_secret: encryptSecret(next.signingSecret),
    updated_at: next.updatedAt,
  });
  if (error) throw new Error(`SLACK_SETTINGS_SAVE_FAILED: ${error.message}`);
  cache = { value: next, expiresAt: Date.now() + 30_000 };
  return next;
}

export function publicSlackSettings(settings: SlackSettings) {
  return {
    configured: Boolean(settings.botToken && settings.channelId),
    publicUrl: settings.publicUrl,
    callbackUrl: settings.publicUrl ? `${settings.publicUrl}/api/slack/events` : "",
    incomingWebhookConfigured: Boolean(settings.incomingWebhook),
    channelId: settings.channelId,
    botTokenConfigured: Boolean(settings.botToken),
    botTokenPreview: settings.botToken ? maskBotToken(settings.botToken) : "",
    signingSecretConfigured: Boolean(settings.signingSecret),
    updatedAt: settings.updatedAt || null,
    supabaseConfigured: supabaseConfigured(),
  };
}
