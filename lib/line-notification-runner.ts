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

function rulesForLine(rules: LineNotificationRule[], lineUuid: string, connectionId: string) {
  return rules.filter((rule) => {
    if (!rule.enabled || rule.lineUuid !== lineUuid) return false;
    if (!isLineMessagingUserId(rule.lineUserId)) {
      console.warn("LINE notification skip: rule user is not a Messaging API user id", {
        ruleId: rule.id,
        lineUserId: rule.lineUserId,
      });
      return false;
    }
    if (connectionId && rule.connectionId && rule.connectionId !== connectionId) {
      console.warn("LINE notification: connectionId differs; matching by lineUuid anyway", {
        ruleId: rule.id,
        ruleConnectionId: rule.connectionId,
        eventConnectionId: connectionId,
        lineUuid,
      });
    }
    return true;
  });
}

async function resolveLiveStatusUuid(connectionId: string, lineUuid: string, fallback: string | null) {
  if (!connectionId || !lineUuid) return fallback;
  try {
    const connection = await getConnection(connectionId);
    if (!connection?.baseUrl) return fallback;
    const live = await getCtMonitorData(connectionAsTarget(connection), [lineUuid], { realTime: true });
    if (!live.ok) return fallback;
    return summarizeMonitorJson(live.responseJson).find((row) => row.uuid === lineUuid)?.statusUuid ?? fallback;
  } catch (error) {
    console.warn("LINE notification live-status resolve failed:", error);
    return fallback;
  }
}

export async function dispatchLineCurrentStatus(connectionId: string, lineUuid: string) {
  const statusUuid = await resolveLiveStatusUuid(connectionId, lineUuid, null);
  if (!statusUuid) return { statusUuid: null, sent: 0 };
  const sent = await dispatchLineStatusChange(lineUuid, statusUuid, new Date().toISOString(), connectionId);
  return { statusUuid, sent };
}

async function observe(
  rules: LineNotificationRule[],
  connectionId: string,
  lineUuid: string,
  statusUuid: string | null,
  observedAt: string,
  strictDelivery = false,
) {
  let sent = 0;
  const deliveryErrors: string[] = [];
  const matching = rulesForLine(rules, lineUuid, connectionId);
  if (!matching.length) {
    console.log("LINE notification skip: no enabled Messaging-API rules for line", { lineUuid, connectionId });
    return 0;
  }
  if (!statusUuid) {
    console.warn("LINE notification skip: missing statusUuid", { lineUuid, connectionId, rules: matching.length });
    return 0;
  }

  for (const rule of matching) {
    // Same non-target status already recorded — nothing to do.
    if (rule.observedStatusUuid === statusUuid && statusUuid !== rule.statusUuid) continue;
    // Already notified for this continuous stay in the target status.
    if (rule.observedStatusUuid === statusUuid && statusUuid === rule.statusUuid && rule.lastNotifiedAt) {
      continue;
    }

    const state = await rememberLineNotificationObservation(rule, statusUuid, observedAt);
    rule.observedStatusUuid = statusUuid;
    rule.statusStartedAt = state.statusStartedAt;
    rule.lastNotifiedAt = state.lastNotifiedAt;
    if (statusUuid !== rule.statusUuid) {
      console.log("LINE notification watch:", {
        ruleId: rule.id,
        lineUuid,
        observed: statusUuid,
        waitingFor: rule.statusUuid,
      });
      continue;
    }
    if (state.lastNotifiedAt) continue;

    // durationMinutes <= 0 → fire as soon as the target status is observed.
    const holdMs = Math.max(0, rule.durationMinutes) * 60_000;
    if (holdMs > 0) {
      const startedAt = Date.parse(state.statusStartedAt ?? observedAt);
      if (!Number.isFinite(startedAt) || Date.now() - startedAt < holdMs) {
        console.log("LINE notification hold:", {
          ruleId: rule.id,
          durationMinutes: rule.durationMinutes,
          statusStartedAt: state.statusStartedAt,
        });
        continue;
      }
    }
    try {
      await notifyRule(rule, observedAt);
      rule.lastNotifiedAt = observedAt;
      sent += 1;
      console.log("LINE notification card sent", {
        ruleId: rule.id,
        lineUserId: rule.lineUserId,
        lineUuid: rule.lineUuid,
        statusUuid,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "LINE_SEND_FAILED";
      console.warn("LINE notification send failed:", {
        ruleId: rule.id,
        lineUuid: rule.lineUuid,
        lineUserId: rule.lineUserId,
        error: message,
      });
      deliveryErrors.push(`${rule.id}: ${message}`);
    }
  }
  if (strictDelivery && deliveryErrors.length > 0) {
    throw new Error(`LINE_NOTIFICATION_DELIVERY_FAILED: ${deliveryErrors.join("; ")}`);
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
  snapshots: Array<{ lineUuid: string; statusUuid: string | null; connectionId?: string | null }>,
  observedAt = new Date().toISOString(),
  connectionId?: string | null,
) {
  const rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  if (rules.length === 0) return 0;
  const wanted = new Set(rules.map((rule) => rule.lineUuid));
  let sent = 0;
  for (const snapshot of snapshots) {
    if (!snapshot.lineUuid || !wanted.has(snapshot.lineUuid)) continue;
    sent += await observe(
      rules,
      snapshot.connectionId ?? connectionId ?? "",
      snapshot.lineUuid,
      snapshot.statusUuid,
      observedAt,
    );
  }
  return sent;
}

export async function dispatchLineNotificationEvents(events: PushEvent[]) {
  let rules: LineNotificationRule[] = [];
  try {
    rules = (await listLineNotificationRules()).filter((rule) => rule.enabled);
  } catch (error) {
    console.error("LINE notification rules load failed:", error);
    return { checked: events.length, sent: 0, error: "RULES_LOAD_FAILED" };
  }
  if (rules.length === 0) {
    console.log("LINE notification: no enabled rules configured");
    return { checked: events.length, sent: 0 };
  }

  const targets = new Map<string, { connectionId: string; statusUuid: string | null; observedAt: string }>();
  for (const event of events) {
    if (!event.accepted || !event.lineUuid) continue;
    const connectionId = event.connectionId || rules.find((rule) => rule.lineUuid === event.lineUuid)?.connectionId || "";
    targets.set(`${connectionId}:${event.lineUuid}`, {
      connectionId,
      statusUuid: event.statusUuid,
      observedAt: event.receivedAt,
    });
  }

  let sent = 0;
  for (const [key, target] of targets) {
    const lineUuid = key.slice(key.indexOf(":") + 1);
    // Always re-read live iXacs status: Push payloads often omit andonStatusStyle.
    const statusUuid = await resolveLiveStatusUuid(target.connectionId, lineUuid, target.statusUuid);
    console.log("LINE notification from Push", {
      lineUuid,
      connectionId: target.connectionId,
      pushStatusUuid: target.statusUuid,
      liveStatusUuid: statusUuid,
    });
    sent += await observe(rules, target.connectionId, lineUuid, statusUuid, target.observedAt, true);
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
