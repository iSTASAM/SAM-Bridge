"use client";

import { useEffect, useMemo, useState } from "react";
import { FiBell, FiPlus, FiTrash2 } from "react-icons/fi";
import { useLocale, type Locale } from "@/app/locale-context";
import type { LineNotificationRule } from "@/lib/line-notification-rules";
import type { LineStatusRow } from "./line-portal";
import styles from "./line-portal.module.css";

const COPY = {
  th: {
    title: "ตั้งค่าการแจ้งเตือน",
    lead: "เลือกสถานะที่ต้องการ ระบบจะแจ้ง LINE ของคุณทันทีเมื่อเครื่องเข้าสู่สถานะนั้น ต้องแอดเพื่อน OA และทดสอบด้วยการเปลี่ยนสถานะ",
    hint: "ถ้าเครื่องอยู่ในสถานะนี้แล้ว ระบบจะส่งทันทีเมื่อกดเพิ่ม",
    line: "เครื่องจักร / ไลน์ผลิต",
    status: "สถานะที่ต้องการแจ้ง",
    add: "เพิ่มการแจ้งเตือน",
    adding: "กำลังบันทึก...",
    yourRules: "การแจ้งเตือนของฉัน",
    empty: "ยังไม่มีการตั้งค่าแจ้งเตือน",
    enabled: "เปิดใช้งาน",
    paused: "หยุดชั่วคราว",
    remove: "ลบ",
    loadError: "ไม่สามารถโหลดการตั้งค่าได้",
    saveError: "บันทึกการตั้งค่าไม่สำเร็จ",
    noStatuses: "ไลน์นี้ไม่มีสถานะให้เลือก",
  },
  en: {
    title: "Notification settings",
    lead: "Choose a status. Your LINE account is notified as soon as the machine enters it. Add the OA as a friend, then change the status to test.",
    hint: "If the machine is already in this status, a notification is sent when you add the rule.",
    line: "Machine / production line",
    status: "Status to notify",
    add: "Add notification",
    adding: "Saving...",
    yourRules: "My notifications",
    empty: "No notification rules yet",
    enabled: "Enabled",
    paused: "Paused",
    remove: "Delete",
    loadError: "Could not load notification settings",
    saveError: "Could not save notification settings",
    noStatuses: "This line has no selectable statuses",
  },
  ja: {
    title: "通知設定",
    lead: "通知するステータスを選択すると、設備がその状態になった時点ですぐに通知します。OA を友だち追加し、ステータス変更で確認してください。",
    hint: "すでにその状態の場合は、追加した時点で通知します。",
    line: "設備・生産ライン",
    status: "通知するステータス",
    add: "通知を追加",
    adding: "保存中...",
    yourRules: "自分の通知",
    empty: "通知ルールはありません",
    enabled: "有効",
    paused: "一時停止",
    remove: "削除",
    loadError: "通知設定を読み込めませんでした",
    saveError: "通知設定を保存できませんでした",
    noStatuses: "このラインには選択可能なステータスがありません",
  },
} as const;

function statusName(locale: Locale, rule: LineNotificationRule) {
  if (locale === "en") return rule.statusNameEn || rule.statusNameTh || rule.statusNameJa || rule.statusUuid;
  if (locale === "ja") return rule.statusNameJa || rule.statusNameEn || rule.statusNameTh || rule.statusUuid;
  return rule.statusNameTh || rule.statusNameEn || rule.statusNameJa || rule.statusUuid;
}

function optionName(locale: Locale, option: LineStatusRow["options"][number]) {
  if (locale === "en") return option.nameEn || option.nameTh || option.nameJa || option.uuid;
  if (locale === "ja") return option.nameJa || option.nameEn || option.nameTh || option.uuid;
  return option.nameTh || option.nameEn || option.nameJa || option.uuid;
}

export function LineNotificationSettings({ lines }: { lines: LineStatusRow[] }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const selectableLines = useMemo(() => lines.filter((line) => line.options.length > 0), [lines]);
  const [rules, setRules] = useState<LineNotificationRule[]>([]);
  const [lineUuid, setLineUuid] = useState(selectableLines[0]?.uuid ?? "");
  const selectedLine = selectableLines.find((line) => line.uuid === lineUuid) ?? selectableLines[0];
  const [statusUuid, setStatusUuid] = useState(selectedLine?.options[0]?.uuid ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/line/api/notification-rules", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { rules?: LineNotificationRule[] };
        if (!response.ok) throw new Error("LOAD_FAILED");
        if (!cancelled) setRules(data.rules ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(copy.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.loadError]);

  function selectLine(nextUuid: string) {
    setLineUuid(nextUuid);
    const nextLine = selectableLines.find((line) => line.uuid === nextUuid);
    setStatusUuid(nextLine?.options[0]?.uuid ?? "");
  }

  async function addRule() {
    if (!selectedLine || !statusUuid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/line/api/notification-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lineUuid: selectedLine.uuid,
          statusUuid,
          currentStatusUuid: selectedLine.statusUuid,
        }),
      });
      const data = (await response.json()) as { rule?: LineNotificationRule; error?: string };
      if (!response.ok || !data.rule) throw new Error(data.error || "SAVE_FAILED");
      setRules((current) => [data.rule!, ...current.filter((rule) => rule.id !== data.rule!.id)]);
    } catch {
      setError(copy.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: LineNotificationRule) {
    const response = await fetch(`/line/api/notification-rules/${encodeURIComponent(rule.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    }).catch(() => null);
    if (!response?.ok) {
      setError(copy.saveError);
      return;
    }
    setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item));
  }

  async function removeRule(rule: LineNotificationRule) {
    const response = await fetch(`/line/api/notification-rules/${encodeURIComponent(rule.id)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setError(copy.saveError);
      return;
    }
    setRules((current) => current.filter((item) => item.id !== rule.id));
  }

  return (
    <div className={styles.notificationLayout}>
      <section className={styles.card}>
        <div className={styles.notificationTitleRow}>
          <span className={styles.notificationIcon} aria-hidden><FiBell size={18} /></span>
          <div>
            <h2 className={styles.notificationTitle}>{copy.title}</h2>
            <p className={styles.notificationLead}>{copy.lead}</p>
            <p className={styles.notificationLead}>{copy.hint}</p>
          </div>
        </div>

        <div className={styles.notificationForm}>
          <label className={styles.field}>
            <span>{copy.line}</span>
            <select value={selectedLine?.uuid ?? ""} onChange={(event) => selectLine(event.target.value)}>
              {selectableLines.map((line) => <option key={line.uuid} value={line.uuid}>{line.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>{copy.status}</span>
            <select value={statusUuid} onChange={(event) => setStatusUuid(event.target.value)} disabled={!selectedLine}>
              {selectedLine?.options.map((option) => (
                <option key={option.uuid} value={option.uuid}>{optionName(locale, option)}</option>
              ))}
            </select>
            {!selectedLine ? <small>{copy.noStatuses}</small> : null}
          </label>
          <button type="button" className={styles.primaryAction} disabled={!selectedLine || !statusUuid || busy} onClick={() => void addRule()}>
            <FiPlus size={16} aria-hidden />
            {busy ? copy.adding : copy.add}
          </button>
        </div>
        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      </section>

      <section>
        <p className={styles.sectionLabel}>{copy.yourRules}</p>
        {loading ? <p className={styles.empty}>…</p> : null}
        {!loading && rules.length === 0 ? <p className={styles.empty}>{copy.empty}</p> : null}
        <div className={styles.ruleList}>
          {rules.map((rule) => (
            <article key={rule.id} className={`${styles.ruleCard} ${!rule.enabled ? styles.ruleDisabled : ""}`}>
              <div className={styles.ruleMain}>
                <span className={styles.ruleDot} style={{ background: rule.statusBackgroundColor || "#8A8A8A" }} aria-hidden />
                <div>
                  <strong>{rule.lineName}</strong>
                  <span>{statusName(locale, rule)}</span>
                </div>
              </div>
              <div className={styles.ruleActions}>
                <button type="button" className={styles.ruleToggle} aria-pressed={rule.enabled} onClick={() => void toggleRule(rule)}>
                  {rule.enabled ? copy.enabled : copy.paused}
                </button>
                <button type="button" className={styles.ruleDelete} aria-label={copy.remove} title={copy.remove} onClick={() => void removeRule(rule)}>
                  <FiTrash2 size={15} aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
