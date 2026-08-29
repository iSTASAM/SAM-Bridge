import type { Locale } from "@/app/locale-context";
import type { LinePreviewModel, LinePreviewTone } from "./types";

function toneFromStatus(name: string): LinePreviewTone {
  const value = name.toLowerCase();
  if (/available|พร้อม|稼働|空き|green|run|正常/.test(value)) return "available";
  if (/busy|ไม่ว่าง|稼働中|運転|yellow|warn|作業/.test(value)) return "busy";
  if (/offline|off|หยุด|切断|停止|error|lost|down|red/.test(value)) return "offline";
  return "neutral";
}

const UI = {
  th: {
    oaName: "SAM Bridge",
    oaBadge: "Official Account",
    connectedLabel: "Connected",
    userMessage: "ตรวจสอบสถานะระบบ",
    botReady: "อัปเดตสถานะล่าสุด",
    botAlert: "พบรายการที่ควรตรวจสอบ",
    monitorTitle: "สถานะ iXacs",
    detailsCta: "ดูรายละเอียด",
    checkCta: "ตรวจสอบ",
    notifyCta: "แจ้งทีม",
    activityLabel: "กิจกรรมล่าสุด",
    alertTitle: "แจ้งเตือนระบบ",
    updatedPrefix: "อัปเดต",
    menuHero: "ดูสถานะระบบ",
    menu: [
      { id: "ixacs", label: "iXacs", kind: "ixacs" as const },
      { id: "reports", label: "รายงาน", kind: "home" as const },
      { id: "alerts", label: "แจ้งเตือน", kind: "alerts" as const },
      { id: "dash", label: "Dashboard", kind: "home" as const },
      { id: "refresh", label: "Refresh", kind: "refresh" as const },
      { id: "more", label: "เพิ่มเติม", kind: "more" as const },
    ],
    demoCompany: "ตัวอย่างบริษัท",
    demoLines: [
      { id: "d1", name: "Line 01", status: "พร้อม", tone: "available" as const },
      { id: "d2", name: "Line 02", status: "ไม่ว่าง", tone: "busy" as const },
      { id: "d3", name: "Line 03", status: "Offline", tone: "offline" as const },
    ],
    demoAlertDetail: "Connection lost",
  },
  en: {
    oaName: "SAM Bridge",
    oaBadge: "Official Account",
    connectedLabel: "Connected",
    userMessage: "Check system status",
    botReady: "Latest status update",
    botAlert: "There is an item that needs attention",
    monitorTitle: "iXacs status",
    detailsCta: "View details",
    checkCta: "Inspect",
    notifyCta: "Notify team",
    activityLabel: "Last activity",
    alertTitle: "System alert",
    updatedPrefix: "Updated",
    menuHero: "View system status",
    menu: [
      { id: "ixacs", label: "iXacs", kind: "ixacs" as const },
      { id: "reports", label: "Reports", kind: "home" as const },
      { id: "alerts", label: "Alerts", kind: "alerts" as const },
      { id: "dash", label: "Dashboard", kind: "home" as const },
      { id: "refresh", label: "Refresh", kind: "refresh" as const },
      { id: "more", label: "More", kind: "more" as const },
    ],
    demoCompany: "Sample company",
    demoLines: [
      { id: "d1", name: "Line 01", status: "Available", tone: "available" as const },
      { id: "d2", name: "Line 02", status: "Busy", tone: "busy" as const },
      { id: "d3", name: "Line 03", status: "Offline", tone: "offline" as const },
    ],
    demoAlertDetail: "Connection lost",
  },
  ja: {
    oaName: "SAM Bridge",
    oaBadge: "Official Account",
    connectedLabel: "Connected",
    userMessage: "システム状態を確認",
    botReady: "最新ステータスです",
    botAlert: "確認が必要な項目があります",
    monitorTitle: "iXacsステータス",
    detailsCta: "詳細を見る",
    checkCta: "確認する",
    notifyCta: "チームに通知",
    activityLabel: "最終アクティビティ",
    alertTitle: "システムアラート",
    updatedPrefix: "更新",
    menuHero: "システム状態を見る",
    menu: [
      { id: "ixacs", label: "iXacs", kind: "ixacs" as const },
      { id: "reports", label: "レポート", kind: "home" as const },
      { id: "alerts", label: "通知", kind: "alerts" as const },
      { id: "dash", label: "Dashboard", kind: "home" as const },
      { id: "refresh", label: "Refresh", kind: "refresh" as const },
      { id: "more", label: "その他", kind: "more" as const },
    ],
    demoCompany: "サンプル会社",
    demoLines: [
      { id: "d1", name: "Line 01", status: "Available", tone: "available" as const },
      { id: "d2", name: "Line 02", status: "Busy", tone: "busy" as const },
      { id: "d3", name: "Line 03", status: "Offline", tone: "offline" as const },
    ],
    demoAlertDetail: "Connection lost",
  },
} as const;

function formatTime(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function demoLinePreview(locale: Locale = "th"): LinePreviewModel {
  const ui = UI[locale];
  const offline = ui.demoLines.find((line) => line.tone === "offline") ?? ui.demoLines[2];
  return {
    source: "demo",
    oaName: ui.oaName,
    oaBadge: ui.oaBadge,
    connectedLabel: ui.connectedLabel,
    companyName: ui.demoCompany,
    updatedLabel: `${ui.updatedPrefix} ${formatTime(new Date().toISOString(), locale)}`,
    updatedAt: new Date().toISOString(),
    userMessage: ui.userMessage,
    botReady: ui.botReady,
    botAlert: ui.botAlert,
    monitorTitle: ui.monitorTitle,
    detailsCta: ui.detailsCta,
    checkCta: ui.checkCta,
    notifyCta: ui.notifyCta,
    lines: ui.demoLines.map((line) => ({ ...line, color: null })),
    alert: {
      title: ui.alertTitle,
      lineName: offline.name,
      detail: ui.demoAlertDetail,
      activityLabel: ui.activityLabel,
      activity: formatTime(new Date(Date.now() - 4 * 60_000).toISOString(), locale),
    },
    menu: ui.menu.map((item) => ({ ...item })),
    menuHero: ui.menuHero,
  };
}

type OverviewLine = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  receivedAt: string | null;
  currentStatus: {
    nameTh?: string;
    nameEn?: string;
    nameJa?: string;
    bgColor?: string;
  } | null;
};

type OverviewGroup = { lines: OverviewLine[] };

export function normalizeOverviewPreview(input: {
  locale: Locale;
  companyName: string;
  groups: OverviewGroup[];
}): LinePreviewModel {
  const ui = UI[input.locale];
  const pickName = (line: OverviewLine) =>
    input.locale === "en" ? line.nameEn || line.nameTh : input.locale === "ja" ? line.nameJa || line.nameTh : line.nameTh || line.nameEn;

  const pickStatus = (line: OverviewLine) => {
    const status = line.currentStatus;
    if (!status) return input.locale === "en" ? "Unknown" : input.locale === "ja" ? "不明" : "ไม่ทราบ";
    return input.locale === "en"
      ? status.nameEn || status.nameTh || "—"
      : input.locale === "ja"
        ? status.nameJa || status.nameTh || "—"
        : status.nameTh || status.nameEn || "—";
  };

  const flat = input.groups.flatMap((group) => group.lines);
  const lines = flat.slice(0, 4).map((line) => {
    const status = pickStatus(line);
    return {
      id: line.uuid,
      name: pickName(line),
      status,
      tone: toneFromStatus(status),
      color: line.currentStatus?.bgColor ?? null,
    };
  });

  const latest = flat
    .map((line) => line.receivedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  const alertLine =
    lines.find((line) => line.tone === "offline") ??
    lines.find((line) => line.tone === "busy") ??
    null;

  return {
    source: "live",
    oaName: ui.oaName,
    oaBadge: ui.oaBadge,
    connectedLabel: ui.connectedLabel,
    companyName: input.companyName,
    updatedLabel: `${ui.updatedPrefix} ${formatTime(latest, input.locale)}`,
    updatedAt: latest,
    userMessage: ui.userMessage,
    botReady: ui.botReady,
    botAlert: alertLine ? ui.botAlert : null,
    monitorTitle: ui.monitorTitle,
    detailsCta: ui.detailsCta,
    checkCta: ui.checkCta,
    notifyCta: ui.notifyCta,
    lines: lines.length
      ? lines
      : ui.demoLines.map((line) => ({ ...line, color: null })),
    alert: alertLine
      ? {
          title: ui.alertTitle,
          lineName: alertLine.name,
          detail: alertLine.status,
          activityLabel: ui.activityLabel,
          activity: formatTime(latest, input.locale),
        }
      : null,
    menu: ui.menu.map((item) => ({ ...item })),
    menuHero: ui.menuHero,
  };
}

export function normalizePortalLinesPreview(input: {
  locale: Locale;
  companyName: string;
  lines: Array<{
    uuid: string;
    name: string;
    nameTh: string | null;
    nameEn: string | null;
    nameJa: string | null;
    backgroundColor: string | null;
    receivedAt?: string | null;
  }>;
}): LinePreviewModel {
  const ui = UI[input.locale];
  const rows = input.lines.slice(0, 4).map((line) => {
    const status =
      input.locale === "en"
        ? line.nameEn || line.nameTh || "—"
        : input.locale === "ja"
          ? line.nameJa || line.nameTh || "—"
          : line.nameTh || line.nameEn || "—";
    return {
      id: line.uuid,
      name: line.name,
      status,
      tone: toneFromStatus(status),
      color: line.backgroundColor,
    };
  });

  const latest =
    input.lines
      .map((line) => line.receivedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const alertLine = rows.find((line) => line.tone === "offline") ?? null;

  return {
    source: "live",
    oaName: ui.oaName,
    oaBadge: ui.oaBadge,
    connectedLabel: ui.connectedLabel,
    companyName: input.companyName,
    updatedLabel: `${ui.updatedPrefix} ${formatTime(latest, input.locale)}`,
    updatedAt: latest,
    userMessage: ui.userMessage,
    botReady: ui.botReady,
    botAlert: alertLine ? ui.botAlert : null,
    monitorTitle: ui.monitorTitle,
    detailsCta: ui.detailsCta,
    checkCta: ui.checkCta,
    notifyCta: ui.notifyCta,
    lines: rows.length ? rows : ui.demoLines.map((line) => ({ ...line, color: null })),
    alert: alertLine
      ? {
          title: ui.alertTitle,
          lineName: alertLine.name,
          detail: alertLine.status,
          activityLabel: ui.activityLabel,
          activity: formatTime(latest, input.locale),
        }
      : null,
    menu: ui.menu.map((item) => ({ ...item })),
    menuHero: ui.menuHero,
  };
}
