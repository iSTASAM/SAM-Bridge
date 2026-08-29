import { cookies } from "next/headers";
import { AUTH_COOKIE, readSessionToken, sessionConnectionScope } from "@/lib/auth";
import { getConnection, listConnections } from "@/lib/ixacs-connections";
import {
  connectionAsTarget,
  discoverIxacsLines,
  getCtMonitorData,
  summarizeMonitorJson,
} from "@/lib/ixacs-client";
import { getLineBoard, getOverview } from "@/lib/ixacs-store";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { demoLinePreview, normalizeOverviewPreview, normalizePortalLinesPreview } from "./normalize";
import type { LinePreviewModel } from "./types";

export async function loadLinePreviewData(locale: "th" | "en" | "ja" = "th"): Promise<LinePreviewModel> {
  const jar = await cookies();

  // Prefer a LINE portal session when the cookie is present (path=/line normally
  // keeps this off `/`, but reuse the same stack if available).
  const lineSession = await readLineSessionToken(jar.get(LINE_AUTH_COOKIE)?.value);
  if (lineSession) {
    try {
      const connection = await getConnection(lineSession.connectionId);
      if (
        connection &&
        connection.loginId.trim().toLowerCase() === lineSession.loginId.trim().toLowerCase()
      ) {
        const target = connectionAsTarget(connection);
        const discovery = await discoverIxacsLines(target);
        const lineUuids = discovery.lineUuids.length
          ? discovery.lineUuids
          : discovery.groups.flatMap((group) => group.lines.map((line) => line.uuid));
        const statusByLine = new Map<string, string | null>();
        if (lineUuids.length > 0) {
          const monitor = await getCtMonitorData(target, lineUuids, { realTime: true });
          if (monitor.ok) {
            for (const row of summarizeMonitorJson(monitor.responseJson)) {
              statusByLine.set(row.uuid, row.statusUuid);
            }
          }
        }

        const rows = [];
        for (const group of discovery.groups) {
          for (const line of group.lines) {
            const statusUuid = statusByLine.get(line.uuid) ?? null;
            let nameTh: string | null = null;
            let nameEn: string | null = null;
            let nameJa: string | null = null;
            let backgroundColor: string | null = null;
            let receivedAt: string | null = null;
            try {
              const board = await getLineBoard(line.uuid);
              receivedAt = board?.receivedAt ?? null;
              const known = statusUuid
                ? board?.statuses.find((item) => item.uuid === statusUuid)
                : null;
              if (known) {
                nameTh = known.nameTh;
                nameEn = known.nameEn;
                nameJa = known.nameJa;
                backgroundColor = known.bgColor || null;
              }
            } catch {
              // optional enrichment
            }
            rows.push({
              uuid: line.uuid,
              name: line.name,
              nameTh,
              nameEn,
              nameJa,
              backgroundColor,
              receivedAt,
            });
          }
        }

        return normalizePortalLinesPreview({
          locale,
          companyName: connection.name || lineSession.customerId || "SAM Bridge",
          lines: rows,
        });
      }
    } catch {
      // fall through
    }
  }

  // Web console session → push-store overview (read-only, scoped).
  const webSession = await readSessionToken(jar.get(AUTH_COOKIE)?.value);
  if (webSession) {
    try {
      const scope = sessionConnectionScope(webSession);
      if (scope === "") return demoLinePreview(locale);
      const overview = await getOverview(null, scope);
      const { connections } = await listConnections();
      const scoped =
        scope == null
          ? connections[0]
          : connections.find((item) => item.id === scope) ?? null;
      return normalizeOverviewPreview({
        locale,
        companyName: scoped?.name || webSession.username || "SAM Bridge",
        groups: overview.groups,
      });
    } catch {
      // fall through
    }
  }

  return demoLinePreview(locale);
}
