"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiDatabase, FiDownload, FiEdit2, FiPlus, FiSend, FiTrash2, FiZap } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import type { Connection } from "../connections/types";
import { EXPORT_COPY } from "./copy";
import { DEST_ICONS } from "./destination-icons";
import { DeleteExportDialog } from "./delete-export-dialog";
import { DESTINATIONS, type ExportConfig } from "./types";

const RUN_COPY = {
  th: {
    subtitle: "ตั้งค่าการส่งข้อมูล iXacs ไปยังระบบปลายทาง ขณะนี้ Slack และ Excel พร้อมใช้งานจริง",
    create: "สร้าง Data Export",
    ready: "พร้อมส่ง",
    draft: "ยังไม่พร้อม",
    nameCol: "ชื่อ",
    statusCol: "สถานะ",
    actionsCol: "จัดการ",
    liveCt: "Current CT แบบ Realtime",
    liveUpdating: "กำลังเชื่อมต่อ…",
    liveUpdated: (time: string) => `อัปเดต ${time}`,
    liveEmpty: "ยังอ่านข้อมูล CT ล่าสุดจาก iXacs ไม่ได้",
    liveMore: (n: number) => `และอีก ${n} Production Line`,
    delayed: (count: number, total: number) => `ช้ากว่ามาตรฐาน · ${count} / ${total} รอบผลิต`,
    onTrack: "อยู่ในมาตรฐาน · 0 รอบผลิต",
    test: "ทดสอบ Slack",
    send: "ตรวจเงื่อนไขและส่ง",
    testing: "กำลังทดสอบ…",
    sending: "กำลังส่ง…",
    downloadExcel: "ดาวน์โหลด Excel",
    downloadingExcel: "กำลังสร้างไฟล์…",
    downloadOk: "ดาวน์โหลดไฟล์ Excel สำเร็จ",
    downloadFailed: "สร้างไฟล์ Excel ไม่สำเร็จ",
    testOk: "เชื่อมต่อ Slack สำเร็จ",
    sendOk: (rows: number, messages: number) => `ส่ง ${rows} ไลน์ไป Slack สำเร็จ (${messages} ข้อความ)`,
    noChanges: "ข้อมูลยังไม่เปลี่ยน จึงไม่มีข้อความใหม่ถูกส่ง",
    failed: "ส่งไป Slack ไม่สำเร็จ",
    webhookNeeded: "กรอก Slack Incoming Webhook URL เพื่อเปิดใช้งาน",
  },
  en: {
    subtitle: "Configure iXacs delivery to destination systems. Slack and Excel delivery are available.",
    create: "Create data export",
    ready: "Ready",
    draft: "Not ready",
    nameCol: "Name",
    statusCol: "Status",
    actionsCol: "Actions",
    liveCt: "Realtime Current CT",
    liveUpdating: "Connecting…",
    liveUpdated: (time: string) => `Updated ${time}`,
    liveEmpty: "Could not read the latest CT from iXacs",
    liveMore: (n: number) => `and ${n} more production lines`,
    delayed: (count: number, total: number) => `Above base · ${count} / ${total} cycles`,
    onTrack: "On track · 0 cycles",
    test: "Test Slack",
    send: "Check conditions & send",
    testing: "Testing…",
    sending: "Sending…",
    downloadExcel: "Download Excel",
    downloadingExcel: "Building file…",
    downloadOk: "Excel file downloaded",
    downloadFailed: "Could not build the Excel file",
    testOk: "Slack connection successful",
    sendOk: (rows: number, messages: number) => `Sent ${rows} lines to Slack (${messages} message(s))`,
    noChanges: "No data changed, so no new message was sent.",
    failed: "Could not send to Slack",
    webhookNeeded: "Add a Slack Incoming Webhook URL to enable sending",
  },
  ja: {
    subtitle: "iXacsデータの出力先を設定します。SlackとExcelへの出力が利用できます。",
    create: "Data Exportを作成",
    ready: "送信可能",
    draft: "未設定",
    nameCol: "名前",
    statusCol: "状態",
    actionsCol: "操作",
    liveCt: "Realtime Current CT",
    liveUpdating: "接続中…",
    liveUpdated: (time: string) => `更新 ${time}`,
    liveEmpty: "iXacs から最新の CT を取得できません",
    liveMore: (n: number) => `ほか ${n} の Production Line`,
    delayed: (count: number, total: number) => `基準超過 · ${count} / ${total} サイクル`,
    onTrack: "基準内 · 0 サイクル",
    test: "Slackをテスト",
    send: "条件を確認して送信",
    testing: "テスト中…",
    sending: "送信中…",
    downloadExcel: "Excelをダウンロード",
    downloadingExcel: "ファイル作成中…",
    downloadOk: "Excelファイルをダウンロードしました",
    downloadFailed: "Excelファイルを作成できませんでした",
    testOk: "Slack接続に成功しました",
    sendOk: (rows: number, messages: number) => `${rows}ラインをSlackへ送信しました（${messages}メッセージ）`,
    noChanges: "データに変更がないため、新しいメッセージは送信されませんでした。",
    failed: "Slackへの送信に失敗しました",
    webhookNeeded: "Slack Incoming Webhook URLを設定してください",
  },
} as const;

type LiveRow = {
  uuid: string;
  productionGroupUuid?: string | null;
  productionLineName?: string | null;
  currentCt?: string | number | null;
  baseCt?: string | number | null;
  actualNum?: string | number | null;
  receivedAt?: string;
};

type AlertProgress = Record<string, Record<string, Record<string, number>>>;

function activityTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function ExportList() {
  const { locale } = useLocale();
  const copy = EXPORT_COPY[locale];
  const [configs, setConfigs] = useState<ExportConfig[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ExportConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [liveRows, setLiveRows] = useState<Record<string, LiveRow[]>>({});
  const [alertProgress, setAlertProgress] = useState<AlertProgress>({});
  const [liveReceivedAt, setLiveReceivedAt] = useState<string | null>(null);
  const livePullingRef = useRef(false);
  const runCopy = RUN_COPY[locale];

  const load = useCallback(async () => {
    const [exportsResponse, connectionsResponse, statusResponse] = await Promise.all([
      fetch("/api/exports", { cache: "no-store" }),
      fetch("/api/connections", { cache: "no-store" }),
      fetch("/api/exports/status", { cache: "no-store" }),
    ]);
    const exportsData = (await exportsResponse.json()) as { configs?: ExportConfig[] };
    const connectionsData = (await connectionsResponse.json()) as { connections?: Connection[] };
    const statusData = (await statusResponse.json().catch(() => ({}))) as { progress?: AlertProgress };
    const configs = exportsData.configs ?? [];
    const slackConnectionIds = [...new Set(configs.filter((config) => config.destinationType === "slack").map((config) => config.sourceConnectionId).filter(Boolean))];
    const liveEntries = await Promise.all(slackConnectionIds.map(async (connectionId) => {
      const response = await fetch(`/api/connections/${connectionId}/data`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; rows?: LiveRow[] };
      return [connectionId, response.ok && data.ok ? data.rows ?? [] : []] as const;
    }));
    setConfigs(configs);
    setConnections(connectionsData.connections ?? []);
    setAlertProgress(statusData.progress ?? {});
    setLiveRows(Object.fromEntries(liveEntries));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const monitoredConfigs = configs.filter(
      (config) => config.destinationType === "slack" && config.status === "ready",
    );
    if (monitoredConfigs.length === 0) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    const pullLive = async () => {
      if (livePullingRef.current || document.visibilityState === "hidden") return;
      livePullingRef.current = true;
      controller = new AbortController();
      try {
        const entries = await Promise.all(monitoredConfigs.map(async (config) => {
          const response = await fetch(`/api/exports/${config.id}/monitor`, {
            method: "POST",
            signal: controller?.signal,
          });
          const data = (await response.json().catch(() => ({}))) as { ok?: boolean; liveRows?: LiveRow[]; collectedAt?: string };
          return { configId: config.id, ok: response.ok && data.ok, rows: data.liveRows ?? [], receivedAt: data.collectedAt ?? null };
        }));
        if (cancelled) return;
        setLiveRows((current) => {
          const next = { ...current };
          for (const entry of entries) if (entry.ok) next[entry.configId] = entry.rows;
          return next;
        });
        const latest = entries.map((entry) => entry.receivedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
        if (latest) setLiveReceivedAt(latest);
        const statusResponse = await fetch("/api/exports/status", { cache: "no-store", signal: controller.signal });
        const statusData = (await statusResponse.json().catch(() => ({}))) as { progress?: AlertProgress };
        if (!cancelled && statusResponse.ok) setAlertProgress(statusData.progress ?? {});
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Keep the last successful snapshot visible while the next round retries.
        }
      } finally {
        livePullingRef.current = false;
      }
    };

    void pullLive();
    const timer = window.setInterval(() => void pullLive(), 1_000);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      livePullingRef.current = false;
    };
  }, [configs]);

  const connectionNames = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection.name])),
    [connections],
  );

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    await fetch(`/api/exports/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await load();
    setBusy(false);
  }

  async function runSlack(config: ExportConfig, action: "test" | "run") {
    const busyKey = `${config.id}:${action}`;
    setActionBusy(busyKey);
    setFeedback((current) => {
      const next = { ...current };
      delete next[config.id];
      return next;
    });
    try {
      const response = await fetch(`/api/exports/${config.id}/${action}`, { method: "POST" });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        rowCount?: number;
        messageCount?: number;
        unchangedCount?: number;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "EXPORT_FAILED");
      setFeedback((current) => ({
        ...current,
        [config.id]: {
          ok: true,
          text:
            action === "test"
              ? runCopy.testOk
              : (result.rowCount ?? 0) === 0
                ? runCopy.noChanges
                : runCopy.sendOk(result.rowCount ?? 0, result.messageCount ?? 0),
        },
      }));
      await load();
    } catch {
      setFeedback((current) => ({
        ...current,
        [config.id]: { ok: false, text: runCopy.failed },
      }));
    } finally {
      setActionBusy(null);
    }
  }

  async function downloadExcel(config: ExportConfig) {
    const busyKey = `${config.id}:excel`;
    setActionBusy(busyKey);
    setFeedback((current) => {
      const next = { ...current };
      delete next[config.id];
      return next;
    });
    try {
      const response = await fetch(`/api/exports/${config.id}/excel`);
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "EXCEL_EXPORT_FAILED");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      const filename = decodeURIComponent(match?.[1] || match?.[2] || `${config.name}.xlsx`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setFeedback((current) => ({
        ...current,
        [config.id]: { ok: true, text: runCopy.downloadOk },
      }));
      await load();
    } catch {
      setFeedback((current) => ({
        ...current,
        [config.id]: { ok: false, text: runCopy.downloadFailed },
      }));
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="console-page export-page">
      <header className="export-page-head">
        <div>
          <h1 className="console-title">{copy.title}</h1>
        </div>
        <Link href="/settings/exports/new" className="btn btn-primary console-icon-btn" aria-label={runCopy.create}>
          <FiPlus size={16} />
        </Link>
      </header>

      {loading ? (
        <div className="export-table-wrap" aria-busy="true">
          <div className="export-table-loading">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className="skeleton" />
            ))}
          </div>
        </div>
      ) : configs.length === 0 ? (
        <section className="export-empty">
          <span className="export-empty-icon"><FiDatabase size={22} /></span>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
          <Link href="/settings/exports/new" className="btn btn-primary console-icon-btn" aria-label={runCopy.create}>
            <FiPlus size={16} />
          </Link>
        </section>
      ) : (
        <div className="export-table-wrap">
          <table className="export-table">
            <thead>
              <tr>
                <th>{runCopy.nameCol}</th>
                <th>{copy.source}</th>
                <th>{copy.destination}</th>
                <th>{runCopy.statusCol}</th>
                <th className="export-table-actions-col">{runCopy.actionsCol}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const destination = DESTINATIONS.find((item) => item.id === config.destinationType);
                const DestIcon = DEST_ICONS[config.destinationType];
                const ctRule = config.alertRules.find((rule) => rule.metric === "currentCtOverBase");
                const scopedRows = (liveRows[config.id] ?? liveRows[config.sourceConnectionId] ?? []).filter((row) =>
                  config.allGroups || config.allLines ||
                  (config.lineUuids.length ? config.lineUuids.includes(row.uuid) : config.groupUuids.includes(row.productionGroupUuid ?? "")),
                );
                const showLive = config.destinationType === "slack" && Boolean(ctRule);
                return (
                  <Fragment key={config.id}>
                    <tr>
                      <td>
                        <div className="export-table-name">
                          <strong>{config.name}</strong>
                          {config.description ? <span>{config.description}</span> : null}
                          {config.destinationType === "slack" && config.status !== "ready" ? (
                            <span className="export-table-hint">{runCopy.webhookNeeded}</span>
                          ) : null}
                          {feedback[config.id] ? (
                            <span className={`export-table-feedback ${feedback[config.id].ok ? "is-ok" : "is-error"}`}>
                              {feedback[config.id].text}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>{connectionNames.get(config.sourceConnectionId) || "—"}</td>
                      <td>
                        <span className="export-table-dest">
                          {DestIcon ? <DestIcon size={16} /> : null}
                          {destination?.name ?? config.destinationType}
                        </span>
                      </td>
                      <td>
                        <span className={`export-draft-badge ${config.status === "ready" ? "is-ready" : ""}`}>
                          {config.status === "ready" ? runCopy.ready : runCopy.draft}
                        </span>
                      </td>
                      <td className="export-table-actions-col">
                        <div className="export-table-actions">
                          {config.destinationType === "slack" && config.status === "ready" ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={Boolean(actionBusy)}
                                onClick={() => void runSlack(config, "test")}
                              >
                                <FiZap size={15} />
                                {actionBusy === `${config.id}:test` ? runCopy.testing : runCopy.test}
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={Boolean(actionBusy)}
                                onClick={() => void runSlack(config, "run")}
                              >
                                <FiSend size={15} />
                                {actionBusy === `${config.id}:run` ? runCopy.sending : runCopy.send}
                              </button>
                            </>
                          ) : null}
                          {config.destinationType === "excel" && config.status === "ready" ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={Boolean(actionBusy)}
                              onClick={() => void downloadExcel(config)}
                            >
                              <FiDownload size={15} />
                              {actionBusy === `${config.id}:excel` ? runCopy.downloadingExcel : runCopy.downloadExcel}
                            </button>
                          ) : null}
                          <Link href={`/settings/exports/${config.id}`} className="btn-icon" title={copy.edit} aria-label={copy.edit}>
                            <FiEdit2 size={16} />
                          </Link>
                          <button type="button" className="btn-icon" title={copy.remove} onClick={() => setDeleteTarget(config)}>
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {showLive && ctRule ? (
                      <tr className="export-table-live-row">
                        <td colSpan={5}>
                          <div className="export-ct-status">
                            <div className="export-ct-status-head">
                              <strong><i className="export-live-dot" />{runCopy.liveCt}</strong>
                              <span>{liveReceivedAt ? runCopy.liveUpdated(activityTime(liveReceivedAt)) : runCopy.liveUpdating}</span>
                            </div>
                            {scopedRows.length ? scopedRows.slice(0, 4).map((row) => {
                              const current = Number(row.currentCt);
                              const base = Number(row.baseCt);
                              const delayed = Number.isFinite(current) && Number.isFinite(base) && current > base;
                              const count = alertProgress[config.id]?.[row.uuid]?.currentCtOverBase ?? 0;
                              return (
                                <div className="export-ct-row" key={row.uuid}>
                                  <div>
                                    <strong>{row.productionLineName || row.uuid}</strong>
                                    <span>
                                      Current {Number.isFinite(current) ? current : "—"}s · Base {Number.isFinite(base) ? base : "—"}s · Actual {row.actualNum ?? "—"}
                                    </span>
                                  </div>
                                  <span className={delayed ? "is-delayed" : "is-normal"}>
                                    {delayed ? runCopy.delayed(count, ctRule.occurrences) : runCopy.onTrack}
                                  </span>
                                </div>
                              );
                            }) : <p className="export-ct-empty">{runCopy.liveEmpty}</p>}
                            {scopedRows.length > 4 ? <small className="export-ct-more">{runCopy.liveMore(scopedRows.length - 4)}</small> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteExportDialog
        open={Boolean(deleteTarget)}
        copy={copy}
        target={deleteTarget}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
