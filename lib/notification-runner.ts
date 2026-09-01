import { activateConnectionCustomer } from "@/lib/ixacs-activate-customer";
import { connectionAsTarget, getCtMonitorData, summarizeMonitorJson } from "@/lib/ixacs-client";
import { getConnection, markConnectionResult } from "@/lib/ixacs-connections";
import type { NotificationRule } from "@/lib/notification-configs";
import {
  claimNotificationLineStatus,
  releaseNotificationLineStatus,
} from "@/lib/notification-state";
import { postSlackWebhook, isSlackWebhookUrl, slackApi, type SlackMessage } from "@/lib/slack-webhook";
import { getSlackDestination, listSlackDestinations } from "@/lib/slack-destinations";
import { getSlackSettings } from "@/lib/slack-settings";
import type { PushEvent } from "@/lib/ixacs-store";
import { listNotificationRules, recordNotificationRun } from "@/lib/notification-configs";

function escapeSlack(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function postSlackAlert(message: SlackMessage, destinationId?: string | null, webhookUrl?: string | null) {
  if (destinationId) {
    const destination = await getSlackDestination(destinationId);
    if (!destination) throw new Error("SLACK_DESTINATION_NOT_FOUND");
    if (!destination.enabled) throw new Error("SLACK_DESTINATION_DISABLED");
    if (!destination.botToken || !destination.channelId) throw new Error("SLACK_DESTINATION_NOT_FOUND");
    const result = await slackApi(destination.botToken, "chat.postMessage", {
      channel: destination.channelId,
      text: message.text,
      ...(message.blocks ? { blocks: message.blocks } : {}),
      ...(message.attachments ? { attachments: message.attachments } : {}),
    });
    if (!result.ok) throw new Error(`SLACK_${String(result.error ?? "SEND_FAILED").toUpperCase()}`);
    return;
  }

  if (webhookUrl && isSlackWebhookUrl(webhookUrl)) {
    await postSlackWebhook(webhookUrl, message);
    return;
  }

  const destinations = await listSlackDestinations().catch(() => []);
  const first = destinations.find((item) => item.enabled && item.botToken && item.channelId);
  if (first) {
    await postSlackAlert(message, first.id);
    return;
  }

  const settings = await getSlackSettings();
  if (settings.botToken && settings.channelId) {
    const result = await slackApi(settings.botToken, "chat.postMessage", {
      channel: settings.channelId,
      text: message.text,
      ...(message.blocks ? { blocks: message.blocks } : {}),
      ...(message.attachments ? { attachments: message.attachments } : {}),
    });
    if (!result.ok) throw new Error(`SLACK_${String(result.error ?? "SEND_FAILED").toUpperCase()}`);
    return;
  }
  if (isSlackWebhookUrl(settings.incomingWebhook)) {
    await postSlackWebhook(settings.incomingWebhook, message);
    return;
  }
  throw new Error("SLACK_NOT_CONFIGURED");
}

function thaiTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const day = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", month: "short" }).format(date);
  const year = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day} ${month} ${year} · ${time} น.`;
}

function slackColor(value?: string | null) {
  if (!value) return "#E6B800";
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return "#E6B800";
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
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

function statusMessage(
  status: string,
  line: string,
  group: string,
  customer: string,
  timestamp: Date | string,
  backgroundColor?: string | null,
) {
  const color = slackColor(backgroundColor);
  const title = `${colorEmoji(color)} ${status}`.slice(0, 150);
  return {
    text: `${status}: ${line}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${escapeSlack(line)}*\n${escapeSlack(group)} · ${escapeSlack(customer)}`,
        },
      },
      { type: "context", elements: [{ type: "mrkdwn", text: thaiTimestamp(timestamp) }] },
    ],
  };
}

function statusesForLine(rule: NotificationRule, lineUuid: string) {
  const raw = (rule.statusByLine?.[lineUuid] ?? []) as Array<
    string | { uuid?: string; name?: string; backgroundColor?: string | null }
  >;
  return raw
    .map((item) => {
      const uuid = typeof item === "string" ? item : item?.uuid || "";
      if (!uuid) return null;
      if (typeof item === "string") return { uuid, name: item, backgroundColor: null as string | null };
      return {
        uuid,
        name: item.name || uuid,
        backgroundColor: item.backgroundColor ?? null,
      };
    })
    .filter((item): item is { uuid: string; name: string; backgroundColor: string | null } => Boolean(item));
}

function rulesForLine(rules: NotificationRule[], lineUuid: string, connectionId: string) {
  return rules.filter((rule) => {
    if (!rule.enabled || !rule.lines.some((line) => line.uuid === lineUuid)) return false;
    if (connectionId && rule.connectionId && rule.connectionId !== connectionId) {
      console.warn("Slack notification: connectionId differs; matching by lineUuid anyway", {
        ruleId: rule.id,
        ruleConnectionId: rule.connectionId,
        eventConnectionId: connectionId,
        lineUuid,
      });
    }
    return true;
  });
}

async function resolveLiveStatusUuid(
  connectionId: string,
  lineUuid: string,
  fallback: string | null,
  customerId?: string | null,
) {
  if (!connectionId || !lineUuid) return fallback;
  try {
    let connection = await getConnection(connectionId);
    if (!connection?.baseUrl) return fallback;
    // Match monitorSlackNotification: keep the correct tenant session alive so
    // idle Push webhooks can still resolve status when the payload omits it.
    if (customerId && connection.password) {
      const activated = await activateConnectionCustomer(connectionId, customerId, { rediscover: false });
      if (activated.ok) connection = activated.connection;
    }
    const live = await getCtMonitorData(connectionAsTarget(connection), [lineUuid], { realTime: true });
    if (!live.ok) return fallback;
    return summarizeMonitorJson(live.responseJson).find((row) => row.uuid === lineUuid)?.statusUuid ?? fallback;
  } catch (error) {
    console.warn("Slack notification live-status resolve failed:", error);
    return fallback;
  }
}

/**
 * Always re-read live CT (with session refresh). Prefer push when both disagree —
 * live can lag right after a real status change and previously stuck claim state.
 */
async function resolveStatusUuidForPush(
  connectionId: string,
  lineUuid: string,
  pushStatusUuid: string | null,
  customerId?: string | null,
) {
  const live = await resolveLiveStatusUuid(connectionId, lineUuid, null, customerId);
  if (pushStatusUuid && live && pushStatusUuid !== live) {
    console.log("Slack notification: preferring push status over live CT", {
      lineUuid,
      pushStatusUuid,
      liveStatusUuid: live,
    });
    return pushStatusUuid;
  }
  return live ?? pushStatusUuid;
}

const deliverLocks = new Map<string, Promise<boolean>>();

async function deliverRuleAlert(
  rule: NotificationRule,
  lineUuid: string,
  statusUuid: string,
  observedAt: string,
  fallback?: {
    lineName?: string | null;
    groupName?: string | null;
    statusName?: string | null;
    statusBgColor?: string | null;
  },
) {
  const lockKey = `${rule.id}:${lineUuid}:${statusUuid}`;
  const pending = deliverLocks.get(lockKey);
  if (pending) return pending;

  const work = (async () => {
    const selected = statusesForLine(rule, lineUuid).find((status) => status.uuid === statusUuid);
    // Claim every observed transition (including non-watched) so a leave from a
    // watched status is recorded and a later re-entry can notify again.
    const claim = await claimNotificationLineStatus(rule.id, lineUuid, statusUuid);
    if (!claim.claimed) {
      console.log("Slack notification skip: same_status", {
        ruleId: rule.id,
        lineUuid,
        statusUuid,
        previous: claim.previousStatus,
      });
      return false;
    }

    try {
      if (selected) {
        const line = rule.lines.find((item) => item.uuid === lineUuid);
        const statusName = selected.name || fallback?.statusName || statusUuid;
        await postSlackAlert(
          statusMessage(
            statusName,
            line?.name ?? fallback?.lineName ?? lineUuid,
            line?.groupName ?? fallback?.groupName ?? "—",
            rule.customerName,
            observedAt,
            selected.backgroundColor ?? fallback?.statusBgColor,
          ),
          rule.destinationId,
          rule.webhookUrl,
        );
        console.log("Slack notification sent", {
          ruleId: rule.id,
          destinationId: rule.destinationId,
          lineUuid,
          statusUuid,
          previous: claim.previousStatus,
        });
      } else {
        console.log("Slack notification watch:", {
          ruleId: rule.id,
          lineUuid,
          observed: statusUuid,
          previous: claim.previousStatus,
          waitingFor: statusesForLine(rule, lineUuid).map((item) => item.uuid),
        });
      }
      // Delivery state is authoritative; run metadata must not turn a successful
      // Slack post into a retry (and therefore a duplicate notification).
      await recordNotificationRun(rule.id, true).catch((stateError) => {
        console.warn("Slack notification run metadata update failed:", stateError);
      });
      return Boolean(selected);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SLACK_SEND_FAILED";
      if (selected) {
        await releaseNotificationLineStatus(
          rule.id,
          lineUuid,
          statusUuid,
          claim.previousStatus,
        ).catch((releaseError) => {
          console.error("Slack notification claim release failed:", releaseError);
        });
      }
      await recordNotificationRun(rule.id, false, message).catch(() => undefined);
      throw error;
    }
  })();

  deliverLocks.set(lockKey, work);
  try {
    return await work;
  } finally {
    deliverLocks.delete(lockKey);
  }
}

export async function testSlackNotification(rule: NotificationRule) {
  await postSlackAlert(
    {
      text: `SAM Bridge connected: ${rule.customerName}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "SAM Bridge connected", emoji: true } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Slack พร้อมรับการแจ้งเตือนสถานะจาก *${escapeSlack(rule.customerName)}* แล้ว`,
          },
        },
      ],
    },
    rule.destinationId,
    rule.webhookUrl,
  );
}

export async function testSlackWebhookConnection() {
  await postSlackAlert({
    text: "SAM Bridge connected",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "SAM Bridge connected", emoji: true } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Slack พร้อมรับการแจ้งเตือนสถานะแล้ว",
        },
      },
    ],
  });
}

export async function monitorSlackNotification(rule: NotificationRule) {
  let connection = await getConnection(rule.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  if (connection.customerId !== rule.customerId || !connection.session) {
    const activated = await activateConnectionCustomer(rule.connectionId, rule.customerId, { rediscover: false });
    if (!activated.ok) throw new Error(activated.error);
    connection = activated.connection;
  }
  const target = connectionAsTarget(connection);
  const monitor = await getCtMonitorData(
    target,
    rule.lines.map((line) => line.uuid),
    { realTime: true },
  );
  await markConnectionResult(connection.id, monitor.ok, monitor.error);
  if (!monitor.ok) throw new Error(monitor.error ?? "IXACS_MONITOR_FAILED");
  const rows = summarizeMonitorJson(monitor.responseJson).filter((row) =>
    rule.lines.some((line) => line.uuid === row.uuid),
  );
  const observedAt = new Date().toISOString();
  let sent = 0;
  for (const row of rows) {
    if (!row.statusUuid) continue;
    try {
      if (await deliverRuleAlert(rule, row.uuid, row.statusUuid, observedAt)) sent += 1;
    } catch (error) {
      console.warn("Slack monitor send failed:", {
        ruleId: rule.id,
        lineUuid: row.uuid,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
  return { checked: rows.length, sent };
}

/** Poll all enabled Slack rules — same role as monitorLineNotifications. */
export async function monitorSlackNotifications() {
  const rules = (await listNotificationRules()).filter((rule) => rule.enabled);
  let checked = 0;
  let sent = 0;
  const errors: string[] = [];
  for (const rule of rules) {
    try {
      const result = await monitorSlackNotification(rule);
      checked += result.checked;
      sent += result.sent;
      await recordNotificationRun(rule.id, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "MONITOR_FAILED";
      await recordNotificationRun(rule.id, false, message).catch(() => undefined);
      errors.push(`${rule.id}: ${message}`);
    }
  }
  return { checked, sent, errors };
}

/** Live poll / snapshot path — same role as dispatchLineStatusSnapshots for LINE. */
export async function dispatchSlackStatusSnapshots(
  snapshots: Array<{ lineUuid: string; statusUuid: string | null; connectionId?: string | null }>,
  observedAt = new Date().toISOString(),
) {
  const rules = (await listNotificationRules()).filter((rule) => rule.enabled);
  if (rules.length === 0) return 0;
  const wanted = new Set(rules.flatMap((rule) => rule.lines.map((line) => line.uuid)));
  let sent = 0;
  const errors: string[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.lineUuid || !wanted.has(snapshot.lineUuid) || !snapshot.statusUuid) continue;
    const matching = rulesForLine(rules, snapshot.lineUuid, snapshot.connectionId ?? "");
    for (const rule of matching) {
      try {
        if (await deliverRuleAlert(rule, snapshot.lineUuid, snapshot.statusUuid, observedAt)) {
          sent += 1;
        }
      } catch (error) {
        errors.push(`${rule.id}: ${error instanceof Error ? error.message : "SLACK_SEND_FAILED"}`);
      }
    }
  }
  if (errors.length > 0) {
    console.warn("Slack notification from snapshots failed:", errors.join("; "));
  }
  return sent;
}

export async function dispatchPushNotifications(events: PushEvent[]) {
  const { ensureNotificationMonitorLoop } = await import("@/lib/notification-monitor-loop");
  ensureNotificationMonitorLoop();

  const rules = (await listNotificationRules()).filter((rule) => rule.enabled);
  const errors: string[] = [];

  const targets = new Map<
    string,
    {
      connectionId: string;
      lineUuid: string;
      statusUuid: string | null;
      observedAt: string;
      lineName?: string | null;
      groupName?: string | null;
      statusName?: string | null;
      statusBgColor?: string | null;
      companyName?: string | null;
    }
  >();

  for (const event of events) {
    if (!event.accepted || !event.lineUuid) continue;
    const connectionId =
      event.connectionId || rules.find((rule) => rule.lines.some((line) => line.uuid === event.lineUuid))?.connectionId || "";
    targets.set(`${connectionId}:${event.lineUuid}`, {
      connectionId,
      lineUuid: event.lineUuid,
      statusUuid: event.statusUuid,
      observedAt: event.receivedAt,
      lineName: event.lineName,
      groupName: event.groupName,
      statusName: event.statusName,
      statusBgColor: event.statusBgColor,
      companyName: event.companyName,
    });
  }

  for (const target of targets.values()) {
    const matching = rulesForLine(rules, target.lineUuid, target.connectionId);

    if (matching.length === 0) {
      console.log("Slack notification skip: no enabled rule for line", {
        lineUuid: target.lineUuid,
        connectionId: target.connectionId,
      });
      continue;
    }

    const customerId = matching.find((rule) => rule.customerId)?.customerId ?? null;
    const statusUuid = await resolveStatusUuidForPush(
      target.connectionId,
      target.lineUuid,
      target.statusUuid,
      customerId,
    );
    if (!statusUuid) {
      console.log("Slack notification skip: no status resolved", {
        lineUuid: target.lineUuid,
        connectionId: target.connectionId,
        pushStatusUuid: target.statusUuid,
      });
      continue;
    }

    for (const rule of matching) {
      try {
        await deliverRuleAlert(rule, target.lineUuid, statusUuid, target.observedAt, target);
      } catch (error) {
        errors.push(`${rule.id}: ${error instanceof Error ? error.message : "SLACK_SEND_FAILED"}`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`SLACK_NOTIFICATION_DISPATCH_FAILED: ${errors.join("; ")}`);
}
