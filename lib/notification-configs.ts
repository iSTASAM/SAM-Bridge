import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { decryptSecret, encryptSecret } from "@/lib/connection-secrets";
import { getSlackDestination } from "@/lib/slack-destinations";
import { getSlackSettings } from "@/lib/slack-settings";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";
import { deleteNotificationState } from "@/lib/notification-state";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type NotificationLine = { uuid: string; name: string; groupName: string };
export type NotificationStatus = { uuid: string; name: string; backgroundColor?: string | null };
export type NotificationRule = {
  id: string;
  channel: "slack";
  connectionId: string;
  customerId: string;
  customerName: string;
  destinationId: string | null;
  webhookUrl: string;
  lines: NotificationLine[];
  statusByLine: Record<string, NotificationStatus[]>;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PublicNotificationRule = Omit<NotificationRule, "webhookUrl"> & { webhookConfigured: boolean };

type RuleRow = {
  id: string;
  connection_id: string;
  customer_id: string;
  customer_name: string;
  destination_id: string | null;
  webhook_url: string;
  lines: NotificationLine[];
  status_by_line: Record<string, NotificationStatus[]>;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: "success" | "error" | null;
  last_run_error: string | null;
  created_at: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "notification-configs.json");

function readRules() {
  if (!existsSync(FILE)) return {} as Record<string, NotificationRule>;
  try {
    return (JSON.parse(readFileSync(FILE, "utf8")) as { rules?: Record<string, NotificationRule> }).rules ?? {};
  } catch {
    return {};
  }
}

function writeRules(rules: Record<string, NotificationRule>) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ rules }, null, 2), { encoding: "utf8", mode: 0o600 });
}

function rowToRule(row: RuleRow): NotificationRule {
  return {
    id: row.id,
    channel: "slack",
    connectionId: row.connection_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    destinationId: row.destination_id ?? null,
    webhookUrl: row.webhook_url ? decryptSecret(row.webhook_url) : "",
    lines: row.lines ?? [],
    statusByLine: row.status_by_line ?? {},
    enabled: row.enabled,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunError: row.last_run_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ruleToRow(rule: NotificationRule): RuleRow {
  return {
    id: rule.id,
    connection_id: rule.connectionId,
    customer_id: rule.customerId,
    customer_name: rule.customerName,
    destination_id: rule.destinationId,
    webhook_url: encryptSecret(rule.webhookUrl),
    lines: rule.lines,
    status_by_line: rule.statusByLine,
    enabled: rule.enabled,
    last_run_at: rule.lastRunAt,
    last_run_status: rule.lastRunStatus,
    last_run_error: rule.lastRunError,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

export function publicNotificationRule(rule: NotificationRule): PublicNotificationRule {
  const { webhookUrl: secret, ...rest } = rule;
  return { ...rest, webhookConfigured: Boolean(secret) || Boolean(rule.destinationId) };
}

export async function listNotificationRules() {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("slack_notification_rules").select("*").order("updated_at", { ascending: false });
      if (error) throw new Error(`SLACK_RULES_LOAD_FAILED: ${error.message}`);
      return ((data ?? []) as RuleRow[]).map(rowToRule);
    }
  }
  return Object.values(readRules()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNotificationRule(id: string) {
  return (await listNotificationRules()).find((rule) => rule.id === id) ?? null;
}

async function resolveWebhook(inputWebhook: string | undefined, destinationId: string | null) {
  if (destinationId) {
    const destination = await getSlackDestination(destinationId);
    if (!destination) throw new Error("SLACK_DESTINATION_NOT_FOUND");
    return "";
  }
  const configuredWebhook = (await getSlackSettings()).incomingWebhook;
  const webhookUrl = inputWebhook?.trim() ? inputWebhook.trim() : configuredWebhook;
  if (!isSlackWebhookUrl(webhookUrl)) throw new Error("INVALID_SLACK_WEBHOOK_URL");
  return webhookUrl;
}

export async function createNotificationRule(input: Partial<NotificationRule> & { destinationId?: string | null }) {
  const destinationId = input.destinationId?.trim() || null;
  const webhookUrl = await resolveWebhook(input.webhookUrl, destinationId);
  if (!input.connectionId || !input.customerId || !input.lines?.length) throw new Error("INVALID_RULE");
  if (!destinationId && !webhookUrl) throw new Error("SLACK_DESTINATION_REQUIRED");
  const now = new Date().toISOString();
  const rule: NotificationRule = {
    id: randomUUID(),
    channel: "slack",
    connectionId: input.connectionId,
    customerId: input.customerId,
    customerName: input.customerName?.trim() || input.customerId,
    destinationId,
    webhookUrl,
    lines: input.lines,
    statusByLine: input.statusByLine ?? {},
    enabled: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    createdAt: now,
    updatedAt: now,
  };
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { data, error } = await supabase.from("slack_notification_rules").insert(ruleToRow(rule)).select("*").single();
    if (error) throw new Error(`SLACK_RULE_CREATE_FAILED: ${error.message}`);
    return rowToRule(data as RuleRow);
  }
  const rules = readRules();
  rules[rule.id] = rule;
  writeRules(rules);
  return rule;
}

export async function updateNotificationRule(id: string, input: Partial<NotificationRule> & { destinationId?: string | null }) {
  const current = await getNotificationRule(id);
  if (!current) return null;
  const destinationId =
    input.destinationId === null ? null : input.destinationId?.trim() || current.destinationId;
  const webhookUrl = destinationId
    ? ""
    : typeof input.webhookUrl === "string" && input.webhookUrl.trim()
      ? input.webhookUrl.trim()
      : current.webhookUrl;
  if (!destinationId && !isSlackWebhookUrl(webhookUrl)) throw new Error("INVALID_SLACK_WEBHOOK_URL");
  if (destinationId) {
    const destination = await getSlackDestination(destinationId);
    if (!destination) throw new Error("SLACK_DESTINATION_NOT_FOUND");
  }
  const connectionId = input.connectionId?.trim() || current.connectionId;
  const customerId = input.customerId?.trim() || current.customerId;
  const lines = input.lines?.length ? input.lines : current.lines;
  if (!connectionId || !customerId || !lines.length) throw new Error("INVALID_RULE");
  const next: NotificationRule = {
    ...current,
    connectionId,
    customerId,
    customerName: input.customerName?.trim() || current.customerName || customerId,
    destinationId,
    webhookUrl,
    lines,
    statusByLine: input.statusByLine ?? current.statusByLine,
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    updatedAt: new Date().toISOString(),
  };
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { data, error } = await supabase.from("slack_notification_rules").update(ruleToRow(next)).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(`SLACK_RULE_UPDATE_FAILED: ${error.message}`);
    if (!data) return null;
    // Saving a rule should re-arm it, matching LINE notification behavior.
    await deleteNotificationState(id);
    return rowToRule(data as RuleRow);
  }
  const rules = readRules();
  rules[id] = next;
  writeRules(rules);
  await deleteNotificationState(id);
  return next;
}

export async function deleteNotificationRule(id: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { data, error } = await supabase.from("slack_notification_rules").delete().eq("id", id).select("id");
    if (error) throw new Error(`SLACK_RULE_DELETE_FAILED: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const rules = readRules();
  if (!rules[id]) return false;
  delete rules[id];
  writeRules(rules);
  return true;
}

export async function recordNotificationRun(id: string, ok: boolean, error?: string) {
  const now = new Date().toISOString();
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const result = await supabase
      .from("slack_notification_rules")
      .update({
        last_run_at: now,
        last_run_status: ok ? "success" : "error",
        last_run_error: ok ? null : error ?? "MONITOR_FAILED",
        updated_at: now,
      })
      .eq("id", id);
    if (result.error) throw new Error(`SLACK_RULE_STATE_FAILED: ${result.error.message}`);
    return;
  }
  const rules = readRules();
  const rule = rules[id];
  if (!rule) return;
  rules[id] = {
    ...rule,
    lastRunAt: now,
    lastRunStatus: ok ? "success" : "error",
    lastRunError: ok ? null : error ?? "MONITOR_FAILED",
  };
  writeRules(rules);
}
