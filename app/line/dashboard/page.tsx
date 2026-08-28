import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { getConnection } from "@/lib/ixacs-connections";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  summarizeMonitorJson,
  type IxacsStatus,
} from "@/lib/ixacs-client";
import { getLineBoard } from "@/lib/ixacs-store";
import { LinePortal, type LineStatusOption, type LineStatusRow } from "../line-portal";

export const dynamic = "force-dynamic";

function statusCatalog(statuses: IxacsStatus[], statusesByLine: Record<string, IxacsStatus[]>) {
  const map = new Map<string, IxacsStatus>();
  for (const status of statuses) map.set(status.uuid, status);
  for (const list of Object.values(statusesByLine)) {
    for (const status of list) {
      const existing = map.get(status.uuid);
      if (!existing) {
        map.set(status.uuid, status);
        continue;
      }
      map.set(status.uuid, {
        ...existing,
        nameTh: richerName(existing.nameTh, status.nameTh, existing.nameEn, existing.nameJa),
        nameEn: richerName(existing.nameEn, status.nameEn, existing.nameTh, existing.nameJa),
        nameJa: richerName(existing.nameJa, status.nameJa, existing.nameTh, existing.nameEn),
        name: existing.name || status.name,
        backgroundColor: existing.backgroundColor ?? status.backgroundColor,
        textColor: existing.textColor ?? status.textColor,
        blinking: existing.blinking || status.blinking,
        blinkingBackgroundColor: existing.blinkingBackgroundColor ?? status.blinkingBackgroundColor,
        blinkingTextColor: existing.blinkingTextColor ?? status.blinkingTextColor,
      });
    }
  }
  return map;
}

/** Prefer a name that is distinct from the other locales when available. */
function richerName(current: string, next: string, otherA: string, otherB: string) {
  const candidate = (next || current || "").trim();
  if (!candidate) return current || next || "";
  if (current && current !== otherA && current !== otherB) return current;
  if (candidate && candidate !== otherA && candidate !== otherB) return candidate;
  return candidate || current;
}

function toOption(status: IxacsStatus): LineStatusOption {
  return {
    uuid: status.uuid,
    nameTh: status.nameTh || status.name,
    nameEn: status.nameEn || status.name,
    nameJa: status.nameJa || status.name,
    backgroundColor: status.backgroundColor,
    textColor: status.textColor,
    blinking: status.blinking,
    blinkingBackgroundColor: status.blinkingBackgroundColor,
    blinkingTextColor: status.blinkingTextColor,
  };
}

async function optionsForLine(lineUuid: string, selectable: IxacsStatus[], catalog: Map<string, IxacsStatus>) {
  const options = new Map<string, LineStatusOption>();
  for (const status of selectable) {
    const fromCatalog = catalog.get(status.uuid);
    options.set(
      status.uuid,
      toOption(
        fromCatalog
          ? {
              ...status,
              nameTh: richerName(status.nameTh, fromCatalog.nameTh, status.nameEn, status.nameJa),
              nameEn: richerName(status.nameEn, fromCatalog.nameEn, status.nameTh, status.nameJa),
              nameJa: richerName(status.nameJa, fromCatalog.nameJa, status.nameTh, status.nameEn),
            }
          : status,
      ),
    );
  }

  try {
    const board = await getLineBoard(lineUuid);
    for (const status of board?.statuses ?? []) {
      const existing = options.get(status.uuid);
      if (!existing) continue;
      options.set(status.uuid, {
        ...existing,
        nameTh: status.nameTh || existing.nameTh,
        nameEn: status.nameEn || existing.nameEn,
        nameJa: status.nameJa || existing.nameJa,
        backgroundColor: status.bgColor || existing.backgroundColor,
        textColor: status.fontColor || existing.textColor,
        blinking: status.blinking,
        blinkingBackgroundColor: status.blinkingBgColor ?? existing.blinkingBackgroundColor,
        blinkingTextColor: status.blinkingFontColor ?? existing.blinkingTextColor,
      });
    }
  } catch {
    // Push-store enrichment is optional.
  }

  return [...options.values()];
}

function resolveNames(
  statusUuid: string | null,
  status: IxacsStatus | null,
  options: LineStatusOption[],
) {
  const fromOption = statusUuid ? options.find((item) => item.uuid === statusUuid) : null;
  return {
    nameTh: fromOption?.nameTh ?? status?.nameTh ?? status?.name ?? null,
    nameEn: fromOption?.nameEn ?? status?.nameEn ?? status?.name ?? null,
    nameJa: fromOption?.nameJa ?? status?.nameJa ?? status?.name ?? null,
  };
}

export default async function LineDashboardPage() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) redirect("/line/login");

  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) {
    redirect("/line/login");
  }

  const target = connectionAsTarget(connection);
  const discovery = await discoverIxacsLines(target);
  const customers = connection.customers.length
    ? connection.customers
    : connection.customerId
      ? [{ id: connection.customerId, name: connection.name }]
      : [];

  const catalog = statusCatalog(discovery.statuses, discovery.statusesByLine);
  const lineUuids = discovery.lineUuids.length
    ? discovery.lineUuids
    : discovery.groups.flatMap((group) => group.lines.map((line) => line.uuid));

  let dataError = discovery.error ?? null;
  const statusByLine = new Map<string, string | null>();

  if (lineUuids.length > 0) {
    const monitor = await getCtMonitorData(target, lineUuids, { realTime: true });
    if (!monitor.ok) {
      dataError = monitor.error ?? "Could not read iXacs realtime status";
    } else {
      for (const row of summarizeMonitorJson(monitor.responseJson)) {
        statusByLine.set(row.uuid, row.statusUuid);
      }
    }
  }

  const lines: LineStatusRow[] = [];
  for (const group of discovery.groups) {
    for (const line of group.lines) {
      const statusUuid = statusByLine.get(line.uuid) ?? null;
      let status = statusUuid ? catalog.get(statusUuid) ?? null : null;
      const options = await optionsForLine(line.uuid, discovery.statusesByLine[line.uuid] ?? [], catalog);

      // Enrich current (including auto) status names from push store when available.
      if (statusUuid) {
        try {
          const board = await getLineBoard(line.uuid);
          const known = board?.statuses.find((item) => item.uuid === statusUuid);
          if (known) {
            status = {
              uuid: statusUuid,
              name: known.nameTh || known.nameEn || known.nameJa,
              nameTh: known.nameTh,
              nameEn: known.nameEn,
              nameJa: known.nameJa,
              backgroundColor: known.bgColor || status?.backgroundColor || null,
              textColor: known.fontColor || status?.textColor || null,
              blinking: known.blinking,
              blinkingBackgroundColor: known.blinkingBgColor ?? status?.blinkingBackgroundColor ?? null,
              blinkingTextColor: known.blinkingFontColor ?? status?.blinkingTextColor ?? null,
            };
          }
        } catch {
          // optional
        }
      }

      const names = resolveNames(statusUuid, status, options);
      lines.push({
        uuid: line.uuid,
        name: line.name,
        groupUuid: group.uuid,
        groupName: group.name,
        statusUuid,
        nameTh: names.nameTh,
        nameEn: names.nameEn,
        nameJa: names.nameJa,
        backgroundColor: status?.backgroundColor ?? null,
        textColor: status?.textColor ?? null,
        blinking: status?.blinking ?? false,
        blinkingBackgroundColor: status?.blinkingBackgroundColor ?? null,
        blinkingTextColor: status?.blinkingTextColor ?? null,
        options,
      });
    }
  }

  return (
    <LinePortal
      connectionId={connection.id}
      user={{
        displayName: connection.name,
        customerCompanyId: session.customerId || "ไม่ระบุ",
        loginId: connection.loginId,
      }}
      customers={customers}
      groups={discovery.groups}
      lines={lines}
      dataError={dataError}
    />
  );
}
