import { randomUUID } from "crypto";
import { connectionSecretsConfigured, decryptSecret, encryptSecret } from "@/lib/connection-secrets";
import { maskBotToken, invalidateSlackSettingsCache } from "@/lib/slack-settings";
import { slackApi } from "@/lib/slack-webhook";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type SlackDestination = {
  id: string;
  name: string;
  channelId: string;
  botToken: string;
  enabled: boolean;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicSlackDestination = {
  id: string;
  name: string;
  channelId: string;
  botTokenConfigured: boolean;
  botTokenPreview: string;
  enabled: boolean;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type DestinationRow = {
  id: string;
  name: string;
  channel_id: string;
  bot_token: string;
  enabled: boolean;
  ai_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
};

function strip(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function isBotToken(value: string) {
  return /^xoxb-[A-Za-z0-9-]+$/.test(value);
}

function isChannelId(value: string) {
  return /^[CG][A-Z0-9]+$/i.test(value);
}

function formatChannelName(name: string, channelId: string) {
  const clean = strip(name);
  if (!clean || clean === channelId) return channelId;
  return clean.startsWith("#") ? clean : `#${clean}`;
}

async function conversationsInfo(botToken: string, channelId: string) {
  const jsonResult = await slackApi(botToken, "conversations.info", { channel: channelId });
  if (jsonResult.ok || jsonResult.error === "missing_scope") return jsonResult;

  // Some workspaces respond more reliably to form-encoded conversations.info
  try {
    const response = await fetch("https://slack.com/api/conversations.info", {
      method: "POST",
      headers: {
        authorization: `Bearer ${botToken}`,
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: new URLSearchParams({ channel: channelId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return (await response.json().catch(() => ({
      ok: false,
      error: `HTTP_${response.status}`,
    }))) as { ok: boolean; error?: string; needed?: string; channel?: unknown };
  } catch {
    return jsonResult;
  }
}

async function resolveSlackChannelName(botToken: string, channelId: string) {
  const result = await conversationsInfo(botToken, channelId);
  if (result.ok) {
    const channel = result.channel as { name?: string; name_normalized?: string } | undefined;
    return { name: strip(channel?.name || channel?.name_normalized), error: "" };
  }
  const err = String(result.error ?? "UNKNOWN");
  if (err === "missing_scope") {
    return { name: "", error: `SLACK_MISSING_SCOPE:${String(result.needed ?? "channels:read")}` };
  }
  if (err === "channel_not_found" || err === "not_in_channel") {
    return { name: "", error: "SLACK_CHANNEL_INFO_FAILED" };
  }
  return { name: "", error: `SLACK_CHANNEL_INFO_FAILED:${err}` };
}

function rowToDestination(row: DestinationRow): SlackDestination {
  return {
    id: row.id,
    name: row.name || "",
    channelId: row.channel_id || "",
    botToken: row.bot_token ? decryptSecret(row.bot_token) : "",
    enabled: row.enabled !== false,
    aiEnabled: row.ai_enabled === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function publicSlackDestination(item: SlackDestination): PublicSlackDestination {
  return {
    id: item.id,
    name: formatChannelName(item.name, item.channelId),
    channelId: item.channelId,
    botTokenConfigured: Boolean(item.botToken),
    botTokenPreview: item.botToken ? maskBotToken(item.botToken) : "",
    enabled: item.enabled,
    aiEnabled: item.aiEnabled,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function clearSingletonDestinationCredentials() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("slack_settings")
    .update({
      channel_id: "",
      bot_token: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  invalidateSlackSettingsCache();
}

async function ensureMigratedFromSingleton() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { count } = await supabase.from("slack_destinations").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  // Only migrate from the DB singleton row — env fallback must not recreate deleted destinations.
  const { data: row } = await supabase.from("slack_settings").select("channel_id, bot_token").eq("id", 1).maybeSingle();
  const channelId = strip((row as { channel_id?: string } | null)?.channel_id);
  const encryptedToken = strip((row as { bot_token?: string } | null)?.bot_token);
  const botToken = encryptedToken ? decryptSecret(encryptedToken) : "";
  if (!channelId || !botToken) return;

  const now = new Date().toISOString();
  const resolvedName = await resolveSlackChannelName(botToken, channelId).catch(() => ({ name: "", error: "" }));
  const { error } = await supabase.from("slack_destinations").insert({
    id: randomUUID(),
    name: resolvedName.name || channelId,
    channel_id: channelId,
    bot_token: encryptSecret(botToken),
    enabled: true,
    ai_enabled: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`SLACK_DESTINATION_MIGRATE_FAILED: ${error.message}`);
  // Credentials now live in destinations — clear singleton so delete stays deleted.
  await clearSingletonDestinationCredentials();
}

export async function listSlackDestinations() {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  await ensureMigratedFromSingleton().catch(() => undefined);
  const { data, error } = await supabase.from("slack_destinations").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(`SLACK_DESTINATIONS_LOAD_FAILED: ${error.message}`);
  const destinations = ((data ?? []) as DestinationRow[]).map(rowToDestination);
  for (const item of destinations) {
    if (item.name && item.name !== item.channelId) continue;
    if (!item.botToken || !item.channelId) continue;
    const resolved = await resolveSlackChannelName(item.botToken, item.channelId).catch(() => ({ name: "", error: "" }));
    if (!resolved.name) continue;
    item.name = resolved.name;
    try {
      await supabase
        .from("slack_destinations")
        .update({ name: resolved.name, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch {
      // best-effort name refresh
    }
  }
  return destinations;
}

export async function getSlackDestination(id: string) {
  if (!supabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("slack_destinations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`SLACK_DESTINATION_LOAD_FAILED: ${error.message}`);
  return data ? rowToDestination(data as DestinationRow) : null;
}

export async function getSlackDestinationByChannelId(channelId: string) {
  if (!supabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const clean = strip(channelId);
  if (!clean) return null;
  const { data, error } = await supabase
    .from("slack_destinations")
    .select("*")
    .eq("channel_id", clean)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`SLACK_DESTINATION_LOAD_FAILED: ${error.message}`);
  return data ? rowToDestination(data as DestinationRow) : null;
}

export async function createSlackDestination(input: {
  name?: string;
  channelId: string;
  botToken: string;
}): Promise<{ destination: SlackDestination; warning?: string }> {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  const channelId = strip(input.channelId);
  const botToken = strip(input.botToken);
  if (!isBotToken(botToken)) throw new Error("INVALID_SLACK_BOT_TOKEN");
  if (!isChannelId(channelId)) throw new Error("INVALID_SLACK_CHANNEL_ID");
  const auth = await slackApi(botToken, "auth.test", {});
  if (!auth.ok) throw new Error(`SLACK_AUTH_FAILED: ${auth.error ?? "UNKNOWN"}`);
  const resolved = await resolveSlackChannelName(botToken, channelId);
  const name = resolved.name || strip(input.name) || channelId;
  const now = new Date().toISOString();
  const id = randomUUID();
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data, error } = await supabase
    .from("slack_destinations")
    .insert({
      id,
      name,
      channel_id: channelId,
      bot_token: encryptSecret(botToken),
      enabled: true,
      ai_enabled: false,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`SLACK_DESTINATION_CREATE_FAILED: ${error.message}`);
  return {
    destination: rowToDestination(data as DestinationRow),
    warning: resolved.name ? undefined : resolved.error || undefined,
  };
}

export async function updateSlackDestination(
  id: string,
  input: { name?: string; channelId?: string; botToken?: string; enabled?: boolean; aiEnabled?: boolean },
): Promise<{ destination: SlackDestination; warning?: string } | null> {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!connectionSecretsConfigured()) throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  const current = await getSlackDestination(id);
  if (!current) return null;

  const flagsOnly =
    input.name === undefined &&
    input.channelId === undefined &&
    input.botToken === undefined &&
    (typeof input.enabled === "boolean" || typeof input.aiEnabled === "boolean");

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  if (flagsOnly) {
    const { data, error } = await supabase
      .from("slack_destinations")
      .update({
        enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
        ai_enabled: typeof input.aiEnabled === "boolean" ? input.aiEnabled : current.aiEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`SLACK_DESTINATION_UPDATE_FAILED: ${error.message}`);
    if (!data) return null;
    return { destination: rowToDestination(data as DestinationRow) };
  }

  const channelId = strip(input.channelId) || current.channelId;
  const botToken = strip(input.botToken) || current.botToken;
  if (!isBotToken(botToken)) throw new Error("INVALID_SLACK_BOT_TOKEN");
  if (!isChannelId(channelId)) throw new Error("INVALID_SLACK_CHANNEL_ID");
  if (strip(input.botToken)) {
    const auth = await slackApi(botToken, "auth.test", {});
    if (!auth.ok) throw new Error(`SLACK_AUTH_FAILED: ${auth.error ?? "UNKNOWN"}`);
  }
  const resolved = await resolveSlackChannelName(botToken, channelId);
  const name = resolved.name || strip(input.name) || current.name || channelId;
  const { data, error } = await supabase
    .from("slack_destinations")
    .update({
      name,
      channel_id: channelId,
      bot_token: encryptSecret(botToken),
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      ai_enabled: typeof input.aiEnabled === "boolean" ? input.aiEnabled : current.aiEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`SLACK_DESTINATION_UPDATE_FAILED: ${error.message}`);
  if (!data) return null;
  return {
    destination: rowToDestination(data as DestinationRow),
    warning: resolved.name ? undefined : resolved.error || undefined,
  };
}

export async function deleteSlackDestination(id: string) {
  if (!supabaseConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data, error } = await supabase.from("slack_destinations").delete().eq("id", id).select("id");
  if (error) throw new Error(`SLACK_DESTINATION_DELETE_FAILED: ${error.message}`);
  const deleted = (data?.length ?? 0) > 0;
  if (deleted) {
    const { count } = await supabase.from("slack_destinations").select("id", { count: "exact", head: true });
    if ((count ?? 0) === 0) {
      // Prevent one-time singleton migration from recreating the deleted channel.
      await clearSingletonDestinationCredentials().catch(() => undefined);
    }
  }
  return deleted;
}

export async function testSlackDestination(id: string) {
  const destination = await getSlackDestination(id);
  if (!destination?.botToken || !destination.channelId) throw new Error("SLACK_NOT_CONFIGURED");
  const result = await slackApi(destination.botToken, "chat.postMessage", {
    channel: destination.channelId,
    text: "SAM Bridge connected",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "SAM Bridge connected", emoji: true } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Slack พร้อมรับการแจ้งเตือนสถานะแล้ว · \`${destination.channelId}\``,
        },
      },
    ],
  });
  if (!result.ok) throw new Error(`SLACK_${String(result.error ?? "SEND_FAILED").toUpperCase()}`);
}
