import { connectionAsTarget, getCtMonitorData, summarizeMonitorJson } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";
import {
  listLineNotificationRules,
  markLineNotificationSent,
  rememberLineNotificationObservation,
  type LineNotificationRule,
} from "@/lib/line-notification-rules";
import { isLineMessagingUserId, pushLineMessages } from "@/lib/line-messaging";
import type { PushEvent } from "@/lib/ixacs-store";

function statusLabel(rule: LineNotificationRule) {
  return rule.statusNameTh || rule.statusNameEn || rule.statusNameJa || rule.statusUuid;
}

function flexColor(value: string | null, fallback: string) {
  if (!value) return fallback;
  const hex = value.trim().match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex) return `#${hex[1]}`;
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function contrastText(background: string) {
  const hex = flexColor(background, "#B42318");
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#FFFFFF";
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
  const statusBg = flexColor(rule.statusBackgroundColor, "#1D4ED8");
  const statusFg = flexColor(rule.statusTextColor ?? null, contrastText(statusBg));
  const result = await pushLineMessages(rule.lineUserId, [
    {
      type: "flex",
      altText: `${rule.lineName}: ${status}`,
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#071B33",
          paddingAll: "16px",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "SAM BRIDGE", color: "#67C8FF", weight: "bold", size: "xs", flex: 1 },
                { type: "text", text: displayTime(observedAt), color: "#8A9BAD", size: "xxs", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: statusBg,
              cornerRadius: "8px",
              paddingAll: "14px",
              contents: [
                {
                  type: "text",
                  text: status,
                  color: statusFg,
                  weight: "bold",
                  size: "lg",
                  align: "center",
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              spacing: "xs",
              contents: [
                { type: "text", text: rule.lineName, color: "#FFFFFF", weight: "bold", size: "sm", wrap: true },
                ...(rule.groupName
                  ? [{ type: "text", text: rule.groupName, color: "#AFC4D9", size: "xs", wrap: true }]
                  : []),
              ],
            },
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
    (rule) =>
      rule.enabled &&
      rule.lineUuid === lineUuid &&
      isLineMessagingUserId(rule.lineUserId) &&
      (!connectionId || rule.connectionId === connectionId),
  );
  for (const rule of matching) {
    const alreadyObserved = rule.observedStatusUuid === statusUuid;
    if (alreadyObserved && statusUuid !== rule.statusUuid) continue;
    if (alreadyObserved && rule.lastNotifiedAt) continue;
    if (alreadyObserved && !rule.lastNotifiedAt) {
      const ageMs = Date.now() - Date.parse(rule.updatedAt);
      if (Number.isFinite(ageMs) && ageMs < 60_000) continue;
    }
    const state = await rememberLineNotificationObservation(rule, statusUuid, observedAt);
    rule.observedStatusUuid = statusUuid;
    rule.statusStartedAt = state.statusStartedAt;
    rule.lastNotifiedAt = state.lastNotifiedAt;
    if (statusUuid !== rule.statusUuid || state.lastNotifiedAt) {
      continue;
    }
    try {
      await notifyRule(rule, observedAt);
      rule.lastNotifiedAt = observedAt;
      sent += 1;
      console.log("LINE notification card sent", {
        ruleId: rule.id,
        lineUuid: rule.lineUuid,
        statusUuid,
      });
    } catch (error) {
      console.warn("LINE notification send failed:", {
        ruleId: rule.id,
        lineUuid: rule.lineUuid,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  return sent;
}

export async function dispatchLineStatusChange(
  lineUuid: string,
  statusUuid: string | null,
  observedAt = new Date().toISOString(),
  connectionId?: string | null,
) {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  return observe(rules, connectionId ?? "", lineUuid, statusUuid, observedAt);
}

export async function dispatchLineStatusSnapshots(
  snapshots: Array<{ lineUuid: string; statusUuid: string | null }>,
  observedAt = new Date().toISOString(),
  connectionId?: string | null,
) {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  if (rules.length === 0) return 0;
  const wanted = new Set(rules.map((rule) => rule.lineUuid));
  let sent = 0;
  for (const snapshot of snapshots) {
    if (!snapshot.lineUuid || !wanted.has(snapshot.lineUuid)) continue;
    sent += await observe(rules, connectionId ?? "", snapshot.lineUuid, snapshot.statusUuid, observedAt);
  }
  return sent;
}

export async function dispatchLineNotificationEvents(events: PushEvent[]) {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  let sent = 0;
  for (const event of events) {
    if (!event.accepted || !event.lineUuid) continue;
    sent += await observe(rules, event.connectionId ?? "", event.lineUuid, event.statusUuid, event.receivedAt);
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
