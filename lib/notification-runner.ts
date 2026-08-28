import { activateConnectionCustomer } from "@/lib/ixacs-activate-customer";
import { connectionAsTarget, getCtMonitorData, summarizeMonitorJson } from "@/lib/ixacs-client";
import { getConnection, markConnectionResult } from "@/lib/ixacs-connections";
import type { NotificationRule } from "@/lib/notification-configs";
import { previousNotificationStatus, rememberNotificationLineStatus, rememberNotificationState, statusTransitions } from "@/lib/notification-state";
import { postSlackWebhook } from "@/lib/slack-webhook";
import type { PushEvent } from "@/lib/ixacs-store";
import { listNotificationRules, recordNotificationRun } from "@/lib/notification-configs";

function escapeSlack(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

function thaiTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const day = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short" }).format(date);
  const year = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} ${month} ${year} · ${time} น.`;
}

function slackColor(value?: string | null) {
  if (!value) return "#E6B800";
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return "#E6B800";
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function colorEmoji(color: string) {
  const value = color.slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  if (r > 175 && g < 130 && b < 130) return "🔴";
  if (r < 100 && g > 135 && b < 150) return "🟢";
  if (r < 110 && g < 160 && b > 150) return "🔵";
  if (r > 140 && b > 130 && g < 130) return "🟣";
  if (r > 180 && g > 180 && b > 180) return "⚪";
  if (r < 90 && g < 90 && b < 90) return "⚫";
  return "🟡";
}

function statusMessage(status: string, line: string, group: string, customer: string, timestamp: Date | string, backgroundColor?: string | null) {
  const color = slackColor(backgroundColor);
  return {
    text: `${status}: ${line}`,
    attachments: [
      { color, blocks: [
        { type: "header", text: { type: "plain_text", text: `${colorEmoji(color)} ${status}`.slice(0, 150), emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: `*${escapeSlack(line)}*\n${escapeSlack(group)} · ${escapeSlack(customer)}` } },
        { type: "context", elements: [{ type: "mrkdwn", text: thaiTimestamp(timestamp) }] },
      ] },
    ],
  };
}

export async function testSlackNotification(rule: NotificationRule) {
  await postSlackWebhook(rule.webhookUrl, { text: `SAM Bridge connected: ${rule.customerName}`, blocks: [
    { type: "header", text: { type: "plain_text", text: "SAM Bridge connected", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `Slack พร้อมรับการแจ้งเตือนสถานะจาก *${escapeSlack(rule.customerName)}* แล้ว` } },
  ] });
}

export async function monitorSlackNotification(rule: NotificationRule) {
  let connection = getConnection(rule.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  if (connection.customerId !== rule.customerId || !connection.session) {
    const activated = await activateConnectionCustomer(rule.connectionId, rule.customerId, { rediscover: false });
    if (!activated.ok) throw new Error(activated.error);
    connection = activated.connection;
  }
  const target = connectionAsTarget(connection);
  const monitor = await getCtMonitorData(target, rule.lines.map((line) => line.uuid));
  markConnectionResult(connection.id, monitor.ok, monitor.error);
  if (!monitor.ok) throw new Error(monitor.error ?? "IXACS_MONITOR_FAILED");
  const rows = summarizeMonitorJson(monitor.responseJson).filter((row) => rule.lines.some((line) => line.uuid === row.uuid));
  const current = Object.fromEntries(rows.map((row) => [row.uuid, row.statusUuid]));
  const changed = new Set(statusTransitions(rule.id, current));
  const outgoing = rows.filter((row) => changed.has(row.uuid) && row.statusUuid && (rule.statusByLine[row.uuid] ?? []).some((status) => status.uuid === row.statusUuid));
  for (const row of outgoing) {
    const line = rule.lines.find((item) => item.uuid === row.uuid);
    const status = (rule.statusByLine[row.uuid] ?? []).find((item) => item.uuid === row.statusUuid)?.name ?? row.statusUuid;
    const selectedStatus = (rule.statusByLine[row.uuid] ?? []).find((item) => item.uuid === row.statusUuid);
    await postSlackWebhook(rule.webhookUrl, statusMessage(status ?? "—", line?.name ?? row.uuid, line?.groupName ?? "—", rule.customerName, new Date(), selectedStatus?.backgroundColor));
  }
  rememberNotificationState(rule.id, current);
  return { checked: rows.length, sent: outgoing.length };
}

export async function dispatchPushNotifications(events: PushEvent[]) {
  const rules = listNotificationRules().filter((rule) => rule.enabled);
  for (const event of events) {
    if (!event.accepted || !event.connectionId || !event.lineUuid || !event.statusUuid) continue;
    for (const rule of rules.filter((item) => item.connectionId === event.connectionId && item.lines.some((line) => line.uuid === event.lineUuid))) {
      const previous = previousNotificationStatus(rule.id, event.lineUuid);
      if (previous === event.statusUuid) continue;
      const selected = (rule.statusByLine[event.lineUuid] ?? []).find((status) => status.uuid === event.statusUuid);
      try {
        if (selected) {
          const line = rule.lines.find((item) => item.uuid === event.lineUuid);
          const statusName = selected.name || event.statusName || event.statusUuid;
          await postSlackWebhook(rule.webhookUrl, statusMessage(statusName, line?.name ?? event.lineUuid, line?.groupName ?? event.groupName ?? "—", rule.customerName, event.receivedAt, selected.backgroundColor ?? event.statusBgColor));
        }
        rememberNotificationLineStatus(rule.id, event.lineUuid, event.statusUuid);
        recordNotificationRun(rule.id, true);
      } catch (error) {
        recordNotificationRun(rule.id, false, error instanceof Error ? error.message : "SLACK_SEND_FAILED");
      }
    }
  }
}
