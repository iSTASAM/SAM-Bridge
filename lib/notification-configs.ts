import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";

export type NotificationLine = { uuid: string; name: string; groupName: string };
export type NotificationStatus = { uuid: string; name: string; backgroundColor?: string | null };
export type NotificationRule = {
  id: string;
  channel: "slack";
  connectionId: string;
  customerId: string;
  customerName: string;
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

export type PublicNotificationRule = Omit<NotificationRule, "webhookUrl"> & {
  webhookConfigured: boolean;
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

export function publicNotificationRule(rule: NotificationRule): PublicNotificationRule {
  const { webhookUrl: _secret, ...rest } = rule;
  void _secret;
  return { ...rest, webhookConfigured: Boolean(rule.webhookUrl) };
}

export function listNotificationRules() {
  return Object.values(readRules()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getNotificationRule(id: string) {
  return readRules()[id] ?? null;
}

export function createNotificationRule(input: Partial<NotificationRule>) {
  const webhookUrl = typeof input.webhookUrl === "string" ? input.webhookUrl.trim() : "";
  if (!isSlackWebhookUrl(webhookUrl)) throw new Error("INVALID_SLACK_WEBHOOK_URL");
  if (!input.connectionId || !input.customerId || !input.lines?.length) throw new Error("INVALID_RULE");
  const now = new Date().toISOString();
  const rule: NotificationRule = {
    id: randomUUID(), channel: "slack", connectionId: input.connectionId,
    customerId: input.customerId, customerName: input.customerName?.trim() || input.customerId,
    webhookUrl, lines: input.lines,
    statusByLine: input.statusByLine ?? {}, enabled: true,
    lastRunAt: null, lastRunStatus: null, lastRunError: null, createdAt: now, updatedAt: now,
  };
  const rules = readRules(); rules[rule.id] = rule; writeRules(rules); return rule;
}

export function updateNotificationRule(id: string, input: Partial<NotificationRule>) {
  const rules = readRules();
  const current = rules[id];
  if (!current) return null;

  const nextWebhook =
    typeof input.webhookUrl === "string" && input.webhookUrl.trim()
      ? input.webhookUrl.trim()
      : current.webhookUrl;
  if (!isSlackWebhookUrl(nextWebhook)) throw new Error("INVALID_SLACK_WEBHOOK_URL");

  const connectionId = input.connectionId?.trim() || current.connectionId;
  const customerId = input.customerId?.trim() || current.customerId;
  const lines = input.lines?.length ? input.lines : current.lines;
  if (!connectionId || !customerId || !lines.length) throw new Error("INVALID_RULE");

  const next: NotificationRule = {
    ...current,
    channel: "slack",
    connectionId,
    customerId,
    customerName: input.customerName?.trim() || current.customerName || customerId,
    webhookUrl: nextWebhook,
    lines,
    statusByLine: input.statusByLine ?? current.statusByLine,
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    updatedAt: new Date().toISOString(),
  };
  rules[id] = next;
  writeRules(rules);
  return next;
}

export function deleteNotificationRule(id: string) {
  const rules = readRules();
  if (!rules[id]) return false;
  delete rules[id]; writeRules(rules); return true;
}

export function recordNotificationRun(id: string, ok: boolean, error?: string) {
  const rules = readRules(); const rule = rules[id]; if (!rule) return;
  rules[id] = { ...rule, lastRunAt: new Date().toISOString(), lastRunStatus: ok ? "success" : "error", lastRunError: ok ? null : error ?? "MONITOR_FAILED" };
  writeRules(rules);
}
