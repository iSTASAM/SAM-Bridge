import type { ExportConfig } from "@/lib/export-configs";
import {
  bangkokBizDate,
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorDetailData,
  getCtMonitorData,
  summarizeMonitorJson,
  summarizeMonitorDetailJson,
  type MonitorDetailRow,
} from "@/lib/ixacs-client";
import { getConnection, markConnectionResult } from "@/lib/ixacs-connections";
import { postSlackWebhook, type SlackMessage } from "@/lib/slack-webhook";
import {
  changedRecordIndexes,
  rememberExportRunState,
} from "@/lib/export-run-state";
import { matchingAlertIndexes } from "@/lib/export-alert-state";

type CanonicalRecord = Record<string, unknown>;

function valueAt(record: CanonicalRecord, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function setAt(record: CanonicalRecord, path: string, value: unknown) {
  const keys = path.split(".");
  let target = record;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      target[key] = value;
      return;
    }
    const next = target[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) target[key] = {};
    target = target[key] as CanonicalRecord;
  });
}

function canonicalRecord(
  config: ExportConfig,
  connection: { id: string; name: string },
  row: MonitorDetailRow,
  collectedAt: string,
) {
  return {
    connection: { id: connection.id, name: connection.name },
    businessDate:
      typeof row.raw.d === "string" && row.raw.d ? row.raw.d : bangkokBizDate(),
    collectedAt,
    productionGroup: {
      uuid: row.productionGroupUuid,
      name: row.productionGroupName,
    },
    productionLine: { uuid: row.uuid, name: row.productionLineName },
    product: { code: row.product, uuid: row.productUuid },
    production: { planNum: row.planNum, actualNum: row.actualNum },
    performance: {
      currentCt: row.currentCt,
      averageCt: row.averageCt,
      baseCt: row.baseCt,
      pcsPerHour: row.pcsPerHour,
      volumeRate: row.volumeRate,
      operationalAvailability: row.operationalAvailability,
      operatingTime: row.operatingTime,
      stopTime: row.stopTime,
    },
    status: {
      uuid: row.statusUuid,
      name: row.statusName,
      backgroundColor: row.statusBackgroundColor,
      textColor: row.statusTextColor,
    },
    raw: row.raw,
    export: { id: config.id, name: config.name },
  } satisfies CanonicalRecord;
}

function selectFields(config: ExportConfig, record: CanonicalRecord) {
  if (config.format === "flat-json" || config.format === "csv") {
    return Object.fromEntries(
      config.fields.flatMap((field) => {
        const value = valueAt(record, field);
        return value == null && !config.includeNulls ? [] : [[field, value ?? null]];
      }),
    );
  }

  const selected: CanonicalRecord = {};
  for (const field of config.fields) {
    const value = valueAt(record, field);
    if (value == null && !config.includeNulls) continue;
    setAt(selected, field, value ?? null);
  }
  return selected;
}

const SLACK_FIELD_META: Record<string, { label: string; unit?: string }> = {
  "connection.id": { label: "Connection ID" },
  "connection.name": { label: "Connection" },
  businessDate: { label: "Business Date" },
  collectedAt: { label: "Collected At" },
  "productionGroup.uuid": { label: "Group UUID" },
  "productionGroup.name": { label: "Production Group" },
  "productionLine.uuid": { label: "Line UUID" },
  "productionLine.name": { label: "Production Line" },
  "product.code": { label: "Product" },
  "product.uuid": { label: "Product UUID" },
  "production.planNum": { label: "Plan", unit: "pcs" },
  "production.actualNum": { label: "Actual", unit: "pcs" },
  "performance.averageCt": { label: "Average CT", unit: "sec" },
  "performance.currentCt": { label: "Current CT", unit: "sec" },
  "performance.baseCt": { label: "CT (Base)", unit: "sec" },
  "performance.pcsPerHour": { label: "Production Rate", unit: "pcs/h" },
  "performance.volumeRate": { label: "Volume Rate", unit: "%" },
  "performance.operationalAvailability": { label: "Operational Availability", unit: "%" },
  "performance.operatingTime": { label: "Operating Time", unit: "h" },
  "performance.stopTime": { label: "Stop Time", unit: "h" },
  "status.uuid": { label: "Status UUID" },
  "status.name": { label: "Status" },
  "status.backgroundColor": { label: "Status Background" },
  "status.textColor": { label: "Status Text" },
};

const PROMOTED_FIELDS = new Set([
  "productionGroup.name",
  "productionLine.name",
  "product.code",
  "status.name",
]);

function escapeSlack(value: unknown) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inlineCode(value: unknown) {
  return `\`${escapeSlack(value).replaceAll("`", "'")}\``;
}

function displayValue(field: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (field === "collectedAt") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-GB", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  const unit = SLACK_FIELD_META[field]?.unit;
  return unit ? `${text} ${unit}` : text;
}

function statusEmoji(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (/stop|error|alarm|abnormal|fault|停止|異常/.test(status)) return ":red_circle:";
  if (/wait|idle|pause|setup|待機|段取/.test(status)) return ":large_yellow_circle:";
  if (/run|operat|production|稼働|運転/.test(status)) return ":large_green_circle:";
  return ":gear:";
}

function splitText(text: string, maxLength = 2700) {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const breakAt = Math.max(remaining.lastIndexOf("\n", maxLength), maxLength / 2);
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).replace(/^\n/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function alertSummary(config: ExportConfig, record: CanonicalRecord) {
  const messages = config.alertRules.flatMap((rule) => {
    if (rule.metric === "currentCtOverBase") {
      const current = valueAt(record, "performance.currentCt");
      const base = valueAt(record, "performance.baseCt");
      return [{
        title: "รอบการผลิตช้ากว่ามาตรฐาน",
        detail: `*Current CT:* ${inlineCode(displayValue("performance.currentCt", current))}  ›  *Base CT:* ${inlineCode(displayValue("performance.baseCt", base))}`,
        count: `เข้าเงื่อนไขครบ ${rule.occurrences} รอบผลิต`,
      }];
    }
    const field = rule.metric === "volumeRate"
      ? "performance.volumeRate"
      : "performance.operationalAvailability";
    const label = rule.metric === "volumeRate" ? "Volume Rate" : "Operational Availability";
    return [{
      title: `${label} ${rule.operator === "above" ? "สูงกว่า" : "ต่ำกว่า"}เกณฑ์`,
      detail: `*${label}:* ${inlineCode(displayValue(field, valueAt(record, field)))}  •  *เกณฑ์:* ${inlineCode(`${rule.threshold} %`)}`,
      count: `เข้าเงื่อนไขครบ ${rule.occurrences} รอบผลิต`,
    }];
  });
  if (!messages.length) return [];
  return [{
    type: "section",
    text: {
      type: "mrkdwn",
      text: messages.map((message) => `:warning: *${message.title}*\n${message.detail}\n_${message.count}_`).join("\n\n"),
    },
  }];
}

function recordBlocks(config: ExportConfig, record: CanonicalRecord, index: number) {
  const line = valueAt(record, "productionLine.name") || valueAt(record, "productionLine.uuid");
  const status = valueAt(record, "status.name");
  const title = `${statusEmoji(status)} *${escapeSlack(line || `Record ${index + 1}`)}*`;
  const context = [
    config.fields.includes("productionGroup.name")
      ? `Group: ${escapeSlack(valueAt(record, "productionGroup.name") ?? "—")}`
      : null,
    config.fields.includes("product.code")
      ? `Product: ${escapeSlack(valueAt(record, "product.code") ?? "—")}`
      : null,
    config.fields.includes("status.name")
      ? `Status: ${escapeSlack(status ?? "—")}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const fields = config.fields.flatMap((field) => {
    if (field === "raw" || PROMOTED_FIELDS.has(field)) return [];
    const value = valueAt(record, field);
    if (value == null && !config.includeNulls) return [];
    const label = SLACK_FIELD_META[field]?.label ?? field;
    return [{
      type: "mrkdwn",
      text: `*${label}*\n${inlineCode(displayValue(field, value))}`,
    }];
  });
  const blocks: Array<Record<string, unknown>> = [
    ...alertSummary(config, record),
    {
      type: "section",
      text: { type: "mrkdwn", text: [title, context.join("  •  ")].filter(Boolean).join("\n") },
    },
  ];
  for (let fieldIndex = 0; fieldIndex < Math.max(1, fields.length); fieldIndex += 10) {
    if (fields.length) blocks.push({
      type: "section",
      ...(fieldIndex === 0 ? { text: { type: "mrkdwn", text: "*ข้อมูลที่เลือกส่ง*" } } : {}),
      fields: fields.slice(fieldIndex, fieldIndex + 10),
    });
  }
  if (config.fields.includes("raw")) {
    const raw = JSON.stringify(valueAt(record, "raw") ?? {}, null, 2);
    blocks.push(
      ...splitText(raw).map((chunk, chunkIndex) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${chunkIndex === 0 ? "*Raw iXacs*\n" : "*Raw iXacs (continued)*\n"}\`\`\`\n${chunk}\n\`\`\``,
        },
      })),
    );
  }
  blocks.push({ type: "divider" });
  return blocks;
}

export function buildSlackMessages(
  config: ExportConfig,
  records: CanonicalRecord[],
): SlackMessage[] {
  const sections = records.flatMap((record, index) => recordBlocks(config, record, index));
  const pages: SlackMessage[] = [];
  const pageSize = 46;
  for (let index = 0; index < Math.max(1, sections.length); index += pageSize) {
    const page = sections.slice(index, index + pageSize);
    const pageNumber = Math.floor(index / pageSize) + 1;
    const totalPages = Math.max(1, Math.ceil(sections.length / pageSize));
    pages.push({
      text: `${config.name}: ${records.length} iXacs production line(s)`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: config.name.slice(0, 150), emoji: true },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `SAM Bridge • ตรงตามเงื่อนไขที่กำหนด • ${records.length} production line(s)${totalPages > 1 ? ` • Page ${pageNumber}/${totalPages}` : ""}`,
            },
          ],
        },
        ...(page.length
          ? page
          : [{ type: "section", text: { type: "mrkdwn", text: "No matching iXacs data." } }]),
      ],
    });
  }
  return pages;
}

export async function testSlackExport(config: ExportConfig) {
  if (config.destinationType !== "slack") throw new Error("SLACK_ONLY");
  await postSlackWebhook(config.endpoint, {
    text: `${config.name}: Slack connection test successful`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "SAM Bridge connected", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${config.name}* can now send iXacs data to this channel.`,
        },
      },
    ],
  });
  return { messageCount: 1 };
}

export async function runSlackExport(config: ExportConfig) {
  if (config.destinationType !== "slack") throw new Error("SLACK_ONLY");
  if (config.triggerMode !== "data-change" || !config.alertRules?.length) {
    throw new Error("ALERT_RULES_REQUIRED");
  }
  const connection = getConnection(config.sourceConnectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");

  const target = connectionAsTarget(connection);
  const discovery = await discoverIxacsLines(target);
  const discoveredLines = discovery.groups.flatMap((group) => group.lines.map((line) => line.uuid));
  const groupLines = discovery.groups
    .filter((group) => config.groupUuids.includes(group.uuid))
    .flatMap((group) => group.lines.map((line) => line.uuid));
  const lineUuids = [
    ...new Set(
      config.allLines || config.allGroups
        ? discoveredLines.length ? discoveredLines : connection.lineUuids
        : config.lineUuids.length ? config.lineUuids : groupLines,
    ),
  ];
  if (!lineUuids.length) throw new Error("NO_PRODUCTION_LINES");

  const [result, monitorResult] = await Promise.all([
    getCtMonitorDetailData(target, lineUuids),
    getCtMonitorData(target, lineUuids),
  ]);
  markConnectionResult(connection.id, result.ok && monitorResult.ok, result.error ?? monitorResult.error);
  if (!result.ok || !monitorResult.ok) throw new Error(result.error ?? monitorResult.error ?? "IXACS_DATA_FAILED");
  const currentCtByLine = new Map(summarizeMonitorJson(monitorResult.responseJson).map((row) => [row.uuid, row.cycleTime]));

  const lineMetadata = new Map(
    discovery.groups.flatMap((group) =>
      group.lines.map((line) => [
        line.uuid,
        {
          productionGroupUuid: group.uuid || null,
          productionGroupName: group.name || null,
          productionLineName: line.name || null,
        },
      ] as const),
    ),
  );
  const statusMetadata = new Map(discovery.statuses.map((status) => [status.uuid, status] as const));
  const rows = summarizeMonitorDetailJson(result.responseJson)
    .filter((row) => lineUuids.includes(row.uuid))
    .map((row) => ({
      ...row,
      currentCt: currentCtByLine.get(row.uuid) ?? null,
      ...(lineMetadata.get(row.uuid) ?? {}),
      ...(row.statusUuid
        ? {
            statusName: statusMetadata.get(row.statusUuid)?.name ?? null,
            statusBackgroundColor: statusMetadata.get(row.statusUuid)?.backgroundColor ?? null,
            statusTextColor: statusMetadata.get(row.statusUuid)?.textColor ?? null,
          }
        : {}),
    }));
  const collectedAt = new Date().toISOString();
  const canonical = rows.map((row) => canonicalRecord(config, connection, row, collectedAt));
  const changeFields = config.fields.filter((field) => field !== "collectedAt");
  const changeConfig = { ...config, fields: changeFields };
  const stateRecords = canonical.map((record, index) => ({
    key: rows[index]?.uuid ?? String(index),
    value: selectFields(changeConfig, record),
  }));
  const changeSet = changedRecordIndexes(config.id, stateRecords);
  const exportIndexes = matchingAlertIndexes(
    config.id,
    config.alertRules,
    canonical.map((value, index) => ({ key: rows[index]?.uuid ?? String(index), value })),
  );
  const outgoing = exportIndexes.map((index) => canonical[index]);
  const messages = outgoing.length ? buildSlackMessages(config, outgoing) : [];

  for (const message of messages) await postSlackWebhook(config.endpoint, message);
  rememberExportRunState(config.id, changeSet.next);

  return {
    rowCount: outgoing.length,
    sourceRowCount: rows.length,
    unchangedCount: rows.length - outgoing.length,
    messageCount: messages.length,
    collectedAt,
    liveRows: rows.map((row) => ({
      uuid: row.uuid,
      productionGroupUuid: row.productionGroupUuid,
      productionLineName: row.productionLineName,
      currentCt: row.currentCt,
      baseCt: row.baseCt,
      actualNum: row.actualNum,
      receivedAt: collectedAt,
    })),
  };
}
