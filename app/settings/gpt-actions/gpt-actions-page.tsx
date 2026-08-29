"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiExternalLink, FiKey, FiRefreshCw } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import "@/app/styles/globals/68-gpt-actions.css";

type Connection = { id: string; name: string; lastOkAt: string | null };
type Settings = {
  configured: boolean;
  managedByEnvironment: boolean;
  keyPrefix: string;
  keyCreatedAt: string | null;
  allowedCompanyIds: string[];
  connections: Connection[];
};

const COPY = {
  th: {
    title: "GPT Actions",
    endpoint: "Public URL",
    schema: "OpenAPI Schema URL",
    privacy: "Privacy Policy URL",
    copy: "คัดลอก",
    copied: "คัดลอกแล้ว",
    keyTitle: "API key",
    createKey: "สร้าง API key",
    rotateKey: "หมุนเปลี่ยน key",
    envKey: "ควบคุมโดย GPT_ACTION_API_KEY ใน environment",
    oneTime: "คัดลอกตอนนี้ — หลังออกจากหน้านี้จะไม่สามารถดู key เต็มได้อีก",
    rotateConfirm: "API key เดิมจะใช้งานไม่ได้ทันที ต้องการหมุนเปลี่ยน key หรือไม่?",
    companies: "บริษัทที่อนุญาต",
    allCompanies: "ทุกบริษัท",
    save: "บันทึกสิทธิ์",
    saved: "บันทึกแล้ว",
    prompt: "Instructions แนะนำ",
    promptText: "เมื่อผู้ใช้ถามข้อมูล iXacs ให้เรียก listCompanies หากยังไม่ทราบ companyId ใช้ getProductionData สำหรับผลผลิต/Cycle Time/สถานะ และ getLostTime สำหรับเวลาสูญเสีย ถ้าต้องวิเคราะห์ร่วมกันให้เรียกทั้งสอง Action ด้วย companyId และช่วงวันที่เดียวกัน ตรวจ period, warnings และ dataQuality ก่อนวิเคราะห์ ระบุช่วงวันที่จริงและหน่วยทุกครั้ง ผลหลายวันเป็นยอดรวมทั้งช่วง ไม่ใช่ข้อมูลรายวัน จึงห้ามสรุปแนวโน้มรายวันจากผลรวม หากต้องการแนวโน้มรายวันให้เรียก mode=day แยกแต่ละวันที่ต้องเปรียบเทียบ ห้ามคาดเดาตัวเลขที่ไม่มีใน API และตอบภาษาเดียวกับผู้ใช้",
    openPolicy: "เปิดนโยบายความเป็นส่วนตัว",
    noCompanies: "ยังไม่มี iXacs connection กรุณาสร้างที่เมนู iXacs ก่อน",
    loadError: "โหลดการตั้งค่าไม่สำเร็จ",
  },
  en: {
    title: "GPT Actions",
    endpoint: "Public URL",
    schema: "OpenAPI Schema URL",
    privacy: "Privacy Policy URL",
    copy: "Copy",
    copied: "Copied",
    keyTitle: "API key",
    createKey: "Create API key",
    rotateKey: "Rotate key",
    envKey: "Managed by GPT_ACTION_API_KEY in the environment",
    oneTime: "Copy it now — the full key cannot be viewed again after leaving this page.",
    rotateConfirm: "The old API key will stop working immediately. Rotate it?",
    companies: "Allowed companies",
    allCompanies: "All companies",
    save: "Save access",
    saved: "Saved",
    prompt: "Suggested instructions",
    promptText: "For iXacs questions, call listCompanies when companyId is unknown. Use getProductionData for output, cycle time, and status; use getLostTime for downtime. For combined analysis, call both with the same companyId and date parameters. Check period, warnings, and dataQuality before analyzing; always state the effective date range and units. Multi-day results are totals for the whole period, not daily observations, so never infer daily trends from aggregates. For a daily trend, call mode=day separately for every date being compared. Never invent numbers absent from the API, and answer in the user's language.",
    openPolicy: "Open privacy policy",
    noCompanies: "No iXacs connection yet. Create one from the iXacs menu first.",
    loadError: "Could not load settings",
  },
  ja: {
    title: "GPT Actions",
    endpoint: "公開 URL",
    schema: "OpenAPI Schema URL",
    privacy: "Privacy Policy URL",
    copy: "コピー",
    copied: "コピー済み",
    keyTitle: "API key",
    createKey: "API key を作成",
    rotateKey: "key を更新",
    envKey: "環境変数 GPT_ACTION_API_KEY で管理されています",
    oneTime: "今すぐコピーしてください。この画面を離れると完全な key は再表示できません。",
    rotateConfirm: "古い API key は直ちに無効になります。更新しますか？",
    companies: "許可する会社",
    allCompanies: "全会社",
    save: "権限を保存",
    saved: "保存済み",
    prompt: "推奨 Instructions",
    promptText: "iXacs に関する質問では companyId が不明なら listCompanies を呼び出します。生産数、Cycle Time、状態には getProductionData、停止時間には getLostTime を使用し、統合分析では同じ companyId と日付条件で両方を呼び出します。分析前に period、warnings、dataQuality を確認し、実際の対象期間と単位を明記します。複数日の結果は期間全体の集計であり日別データではないため、集計値から日別傾向を推測しません。日別傾向が必要な場合は、比較する各日について mode=day を個別に呼び出します。API にない数値は推測せず、ユーザーと同じ言語で回答します。",
    openPolicy: "プライバシーポリシーを開く",
    noCompanies: "iXacs connection がありません。先に iXacs メニューで作成してください。",
    loadError: "設定を読み込めませんでした",
  },
} as const;

function normalizedOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function GptActionsPage({ publicUrl }: { publicUrl: string }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [settings, setSettings] = useState<Settings | null>(null);
  const [revealedKey, setRevealedKey] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/gpt-actions/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(copy.loadError);
        return response.json() as Promise<Settings>;
      })
      .then((value) => {
        setSettings(value);
        setSelected(value.allowedCompanyIds);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [copy.loadError]);

  const base = normalizedOrigin(publicUrl);
  const schemaUrl = base ? `${base}/api/gpt-actions/openapi.json` : "";
  const privacyUrl = base ? `${base}/gpt-actions/privacy` : "";
  const selectedLabel = selected.length === 0 ? copy.allCompanies : `${selected.length}/${settings?.connections.length ?? 0}`;

  async function copyValue(id: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? "" : current)), 1400);
  }

  async function rotateKey() {
    if (settings?.configured && !window.confirm(copy.rotateConfirm)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/gpt-actions/settings", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as Settings & { apiKey?: string; error?: string };
    setBusy(false);
    if (!response.ok || !data.apiKey) {
      setError(data.error || copy.loadError);
      return;
    }
    setSettings((current) => (current ? { ...current, ...data } : data));
    setRevealedKey(data.apiKey);
  }

  async function saveCompanies() {
    setBusy(true);
    setSaved(false);
    setError("");
    const response = await fetch("/api/gpt-actions/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allowedCompanyIds: selected }),
    });
    const data = (await response.json().catch(() => ({}))) as Partial<Settings> & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || copy.loadError);
      return;
    }
    setSettings((current) => (current ? { ...current, ...data } : current));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="console-page gpt-page">
      <header>
        <h1 className="console-title">{copy.title}</h1>
      </header>

      {error ? <p className="inline-error" role="alert">{error}</p> : null}

      <section className="console-section">
        <CopyRow
          label={copy.endpoint}
          value={base}
          id="origin"
          copied={copied}
          copyLabel={copy.copy}
          copiedText={copy.copied}
          onCopy={copyValue}
        />
        <CopyRow
          label={copy.schema}
          value={schemaUrl}
          id="schema"
          copied={copied}
          copyLabel={copy.copy}
          copiedText={copy.copied}
          onCopy={copyValue}
        />
        <CopyRow
          label={copy.privacy}
          value={privacyUrl}
          id="privacy"
          copied={copied}
          copyLabel={copy.copy}
          copiedText={copy.copied}
          onCopy={copyValue}
        />
      </section>

      <section className="console-section">
        <div className="console-section-head">
          <div>
            <h2 className="console-section-title">{copy.keyTitle}</h2>
          </div>
          <button
            className="btn btn-primary console-icon-btn"
            type="button"
            disabled={busy || settings?.managedByEnvironment}
            aria-label={settings?.configured ? copy.rotateKey : copy.createKey}
            onClick={() => void rotateKey()}
          >
            {settings?.configured ? <FiRefreshCw size={16} /> : <FiKey size={16} />}
          </button>
        </div>
        {revealedKey ? (
          <div className="gpt-key-banner">
            <p>{copy.oneTime}</p>
            <CopyRow
              label="Bearer API key"
              value={revealedKey}
              id="key"
              copied={copied}
              copyLabel={copy.copy}
              copiedText={copy.copied}
              onCopy={copyValue}
            />
          </div>
        ) : settings?.configured ? (
          <div className="gpt-key-mask">
            <code>{settings.keyPrefix}</code>
            <span>
              {settings.managedByEnvironment
                ? copy.envKey
                : settings.keyCreatedAt
                  ? new Date(settings.keyCreatedAt).toLocaleString(locale)
                  : ""}
            </span>
          </div>
        ) : null}
      </section>

      <section className="console-section">
        <div className="console-section-head">
          <div>
            <h2 className="console-section-title">
              {copy.companies}
              <span className="gpt-badge">{selectedLabel}</span>
            </h2>
          </div>
        </div>
        <div className="gpt-company-list">
          {settings?.connections.length ? (
            settings.connections.map((company) => (
              <label key={company.id} className="gpt-company">
                <input
                  type="checkbox"
                  checked={selected.includes(company.id)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(company.id)
                        ? current.filter((id) => id !== company.id)
                        : [...current, company.id],
                    )
                  }
                />
                <span>
                  <strong>{company.name}</strong>
                  <code>{company.id}</code>
                </span>
              </label>
            ))
          ) : (
            <p className="gpt-empty">{copy.noCompanies}</p>
          )}
        </div>
        <div className="gpt-section-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy || !settings?.connections.length}
            onClick={() => void saveCompanies()}
          >
            {saved ? <FiCheck /> : null}
            {saved ? copy.saved : copy.save}
          </button>
        </div>
      </section>

      <section className="console-section">
        <div className="gpt-prompt">
          <div className="gpt-prompt-head">
            <strong>{copy.prompt}</strong>
            <button
              type="button"
              className="btn-icon"
              aria-label={copied === "prompt" ? copy.copied : copy.copy}
              onClick={() => void copyValue("prompt", copy.promptText)}
            >
              {copied === "prompt" ? <FiCheck size={16} /> : <FiCopy size={16} />}
            </button>
          </div>
          <p>{copy.promptText}</p>
        </div>
        <a className="gpt-policy-link" href={privacyUrl || "/gpt-actions/privacy"} target="_blank" rel="noreferrer">
          {copy.openPolicy}
          <FiExternalLink />
        </a>
      </section>
    </div>
  );
}

function CopyRow({
  label,
  value,
  id,
  copied,
  copyLabel,
  copiedText,
  onCopy,
}: {
  label: string;
  value: string;
  id: string;
  copied: string;
  copyLabel: string;
  copiedText: string;
  onCopy: (id: string, value: string) => Promise<void>;
}) {
  return (
    <div className="gpt-copy-row">
      <span className="console-label">{label}</span>
      <div className="copy-field">
        <code>{value || "—"}</code>
        <button
          type="button"
          className="btn-icon"
          disabled={!value}
          aria-label={copied === id ? copiedText : copyLabel}
          onClick={() => void onCopy(id, value)}
        >
          {copied === id ? <FiCheck size={16} /> : <FiCopy size={16} />}
        </button>
      </div>
    </div>
  );
}
