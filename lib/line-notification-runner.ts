import { connectionAsTarget, getCtMonitorData, summarizeMonitorJson } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import {
  listLineNotificationRules,
  markLineNotificationSent,
  rememberLineNotificationObservation,
  type LineNotificationRule,
} from "@/lib/line-notification-rules";
import { pushLineMessages } from "@/lib/line-messaging";
import type { PushEvent } from "@/lib/ixacs-store";

function statusLabel(rule: LineNotificationRule) {
  return rule.statusNameTh || rule.statusNameEn || rule.statusNameJa || rule.statusUuid;
}

function flexColor(value: string | null) {
  if (!value) return "#B42318";
  const hex = value.trim().match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex) return `#${hex[1]}`;
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return "#B42318";
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function displayTime(observedAt: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(observedAt));
}

async function notifyRule(rule: LineNotificationRule, observedAt: string) {
  const status = statusLabel(rule);
  const statusColor = flexColor(rule.statusBackgroundColor);
  const result = await pushLineMessages(rule.lineUserId, [
    {
      type: "flex",
      altText: `แจ้งเตือน ${rule.lineName}: ${status}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#071B33",
          paddingAll: "20px",
          spacing: "sm",
          contents: [
            { type: "text", text: "SAM BRIDGE", color: "#67C8FF", weight: "bold", size: "xs" },
            { type: "text", text: "Machine Alert", color: "#FFFFFF", weight: "bold", size: "xl" },
            { type: "text", text: "ตรวจพบการเปลี่ยนสถานะเครื่องจักร", color: "#AFC4D9", size: "xs" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "lg",
          paddingAll: "20px",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              spacing: "md",
              alignItems: "center",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  width: "6px",
                  height: "54px",
                  cornerRadius: "3px",
                  backgroundColor: statusColor,
                  contents: [{ type: "text", text: " ", size: "xxs" }],
                },
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  contents: [
                    { type: "text", text: "สถานะปัจจุบัน", size: "xs", color: "#728399" },
                    { type: "text", text: status, weight: "bold", size: "xl", color: "#071B33", wrap: true },
                  ],
                },
              ],
            },
            { type: "separator", color: "#E6ECF2" },
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                { type: "text", text: "เครื่องจักร / ไลน์ผลิต", size: "xs", color: "#728399" },
                { type: "text", text: rule.lineName, weight: "bold", size: "md", color: "#172B4D", wrap: true },
                ...(rule.groupName
                  ? [{ type: "text", text: rule.groupName, size: "sm", color: "#52667A", wrap: true }]
                  : []),
              ],
            },
            { type: "text", text: displayTime(observedAt), size: "xs", color: "#8A9BAD" },
          ],
        },
        footer: {
          type: "box",
          layout: "horizontal",
          paddingAll: "14px",
          backgroundColor: "#F4F8FC",
          contents: [
            { type: "text", text: "iXacs  •  Real-time notification", size: "xs", color: "#52667A", align: "center" },
          ],
        },
      },
    },
  ]);
  if (!result.ok) throw new Error(result.error);
  await markLineNotificationSent(rule.id, observedAt);
}

async function observe(
  rules: LineNotificationRule[],
  connectionId: string,
  lineUuid: string,
  statusUuid: string | null,
  observedAt: string,
) {
  let sent = 0;
  const matching = rules.filter(
    (rule) => rule.enabled && rule.connectionId === connectionId && rule.lineUuid === lineUuid,
  );
  for (const rule of matching) {
    const state = await rememberLineNotificationObservation(rule, statusUuid, observedAt);
    rule.observedStatusUuid = statusUuid;
    rule.statusStartedAt = state.statusStartedAt;
    rule.lastNotifiedAt = state.lastNotifiedAt;
    if (statusUuid !== rule.statusUuid || state.lastNotifiedAt) {
      continue;
    }
    await notifyRule(rule, observedAt);
    rule.lastNotifiedAt = observedAt;
    sent += 1;
  }
  return sent;
}

export async function dispatchLineNotificationEvents(events: PushEvent[]) {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  let sent = 0;
  for (const event of events) {
    if (!event.accepted || !event.connectionId || !event.lineUuid) continue;
    sent += await observe(rules, event.connectionId, event.lineUuid, event.statusUuid, event.receivedAt);
  }
  return { checked: events.length, sent };
}

export async function monitorLineNotifications() {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  const byConnection = new Map<string, LineNotificationRule[]>();
  for (const rule of rules) {
    byConnection.set(rule.connectionId, [...(byConnection.get(rule.connectionId) ?? []), rule]);
  }

  let checked = 0;
  let sent = 0;
  const errors: string[] = [];
  for (const [connectionId, connectionRules] of byConnection) {
    try {
      const connection = await getConnection(connectionId);
      if (!connection) throw new Error("CONNECTION_NOT_FOUND");
      const lineUuids = [...new Set(connectionRules.map((rule) => rule.lineUuid))];
      const response = await getCtMonitorData(connectionAsTarget(connection), lineUuids, { realTime: true });
      if (!response.ok) throw new Error(response.error ?? "IXACS_MONITOR_FAILED");
      const observedAt = new Date().toISOString();
      for (const row of summarizeMonitorJson(response.responseJson)) {
        checked += 1;
        sent += await observe(connectionRules, connectionId, row.uuid, row.statusUuid, observedAt);
      }
    } catch (error) {
      errors.push(`${connectionId}: ${error instanceof Error ? error.message : "MONITOR_FAILED"}`);
    }
  }
  return { checked, sent, errors };
}
