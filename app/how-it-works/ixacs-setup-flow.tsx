"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiArrowUpRight, FiCheck, FiCopy } from "react-icons/fi";
import { useLocale, type Locale } from "../locale-context";

export type DocsSlug = "ixacs-connection" | "data-explorer" | "lost-time" | "push-api" | "excel-exports" | "sap-integration";
type Localized = { th: string; en: string; ja: string };
type TocItem = Localized & { id: string };
type DocsEntry = Localized & { slug: DocsSlug; group: Localized; summary: Localized; sections: TocItem[] };

const DATA_EXPLORER_URL = "/settings/2c96efff-6dd3-4e85-88d8-88d2e1438bd9/data";
const LOST_TIME_URL = "/settings/2c96efff-6dd3-4e85-88d8-88d2e1438bd9/data/lost-time?companies=2c96efff-6dd3-4e85-88d8-88d2e1438bd9&mode=day&date=2026-09-01&customers=i1625962667";
const PUSH_API_URL = "/settings/push";
const EXPORTS_URL = "/settings/exports";

const DOCS: DocsEntry[] = [
  {
    slug: "ixacs-connection",
    group: { th: "สถาปัตยกรรม", en: "Architecture", ja: "アーキテクチャ" },
    th: "เพิ่มเครื่อง iXacs",
    en: "Add an iXacs machine",
    ja: "iXacs マシンの追加",
    summary: { th: "จากการรับ Credential จนถึงการบันทึก", en: "From receiving credentials to saving", ja: "認証情報の取得から接続の保存まで" },
    sections: [
      { id: "overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "request", th: "Request จาก Settings", en: "Request from Settings", ja: "Settings からのリクエスト" },
      { id: "authentication", th: "Authentication และ Session", en: "Authentication and session", ja: "認証とセッション" },
      { id: "ixacs-login-response", th: "ตัวอย่าง Response จาก iXacs", en: "Example response from iXacs", ja: "iXacs からのレスポンス例" },
      { id: "customer", th: "Customer scope", en: "Customer scope", ja: "カスタマースコープ" },
      { id: "discovery", th: "Production group และ line discovery", en: "Production group and line discovery", ja: "プロダクショングループとライン検出" },
      { id: "storage", th: "บันทึก Connection", en: "Persist the connection", ja: "接続の永続化" },
    ],
  },
  {
    slug: "data-explorer",
    group: { th: "สถาปัตยกรรม", en: "Architecture", ja: "アーキテクチャ" },
    th: "Data Explorer",
    en: "Data Explorer",
    ja: "Data Explorer",
    summary: { th: "การโหลดและรวมข้อมูล", en: "Loading and merging data", ja: "生産データの読み込み、統合、フィルタリング、表示方法" },
    sections: [
      { id: "data-overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "page-load", th: "เมื่อเปิดหน้า", en: "Initial load", ja: "初期読み込み" },
      { id: "data-request", th: "API request", en: "API request", ja: "API リクエスト" },
      { id: "server-flow", th: "การทำงานฝั่ง Server", en: "Server flow", ja: "サーバーフロー" },
      { id: "controls", th: "Filters, columns และ refresh", en: "Filters, columns and refresh", ja: "フィルター、列およびリフレッシュ" },
      { id: "ixacs-data-response", th: "ตัวอย่าง Response จาก iXacs", en: "Example responses from iXacs", ja: "iXacs からのレスポンス例" },
      { id: "response", th: "Response model", en: "Response model", ja: "レスポンスモデル" },
      { id: "cache-errors", th: "Cache และ error handling", en: "Cache and error handling", ja: "キャッシュとエラー処理" },
    ],
  },
  {
    slug: "lost-time",
    group: { th: "สถาปัตยกรรม", en: "Architecture", ja: "アーキテクチャ" },
    th: "Lost Time",
    en: "Lost Time",
    ja: "Lost Time",
    summary: { th: "การคำนวณ downtime", en: "Downtime calculation", ja: "ラインとステータストピック別のダウンタイム集計方法" },
    sections: [
      { id: "lost-overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "url-state", th: "URL parameters", en: "URL parameters", ja: "URL パラメータ" },
      { id: "lost-request", th: "API request", en: "API request", ja: "API リクエスト" },
      { id: "lost-server-flow", th: "การทำงานฝั่ง Server", en: "Server flow", ja: "サーバーフロー" },
      { id: "ixacs-lost-response", th: "ตัวอย่าง Response จาก iXacs", en: "Example response from iXacs", ja: "iXacs からのレスポンス例" },
      { id: "aggregation", th: "การคำนวณและแสดงผล", en: "Aggregation and rendering", ja: "集計とレンダリング" },
      { id: "lost-response", th: "Response model", en: "Response model", ja: "レスポンスモデル" },
      { id: "lost-cache", th: "Cache และ error handling", en: "Cache and error handling", ja: "キャッシュとエラー処理" },
    ],
  },
  {
    slug: "push-api",
    group: { th: "สถาปัตยกรรม", en: "Architecture", ja: "アーキテクチャ" },
    th: "Push API",
    en: "Push API",
    ja: "Push API",
    summary: { th: "การตั้งค่าและการรับข้อมูล", en: "Configuration and endpoints", ja: "エンドポイント、API キー、受信イベント、ライブステータス" },
    sections: [
      { id: "push-overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "push-setup", th: "ทุกส่วนในหน้า Setup", en: "Setup page sections", ja: "Setup ページのセクション" },
      { id: "push-keys", th: "การจัดการ API keys", en: "API key lifecycle", ja: "API キーのライフサイクル" },
      { id: "push-request", th: "Request contract", en: "Request contract", ja: "リクエスト仕様" },
      { id: "ixacs-push-payload", th: "ตัวอย่าง Payload จาก iXacs", en: "Example payload from iXacs", ja: "iXacs ペイロード例" },
      { id: "push-processing", th: "Validation และ processing", en: "Validation and processing", ja: "バリデーションと処理" },
      { id: "push-responses", th: "Responses และ errors", en: "Responses and errors", ja: "レスポンスとエラー" },
      { id: "push-events", th: "ทุกส่วนในหน้า Events", en: "Events page sections", ja: "Events ページのセクション" },
      { id: "push-actions", th: "การเปลี่ยนสถานะและการแจ้งเตือน", en: "Status changes and notifications", ja: "ステータス変更と通知" },
      { id: "push-storage", th: "Storage และ security", en: "Storage and security", ja: "ストレージとセキュリティ" },
    ],
  },
  {
    slug: "excel-exports",
    group: { th: "การส่งออกข้อมูล", en: "Data exports", ja: "データエクスポート" },
    th: "Excel",
    en: "Excel",
    ja: "Excel",
    summary: { th: "การส่งออก .xlsx", en: ".xlsx export", ja: "iXacs データ用の .xlsx ファイルと Power Query" },
    sections: [
      { id: "excel-overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "excel-setup", th: "การตั้งค่าใน Settings", en: "Configuration in Settings", ja: "Settings での設定" },
      { id: "excel-flow", th: "Data flow", en: "Data flow", ja: "データフロー" },
      { id: "excel-api", th: "Excel API", en: "Excel API", ja: "Excel API" },
      { id: "excel-response", th: "ตัวอย่าง Response", en: "Response example", ja: "レスポンス例" },
      { id: "excel-workbook", th: "Workbook และ Refresh", en: "Workbook and refresh", ja: "Workbook とリフレッシュ" },
      { id: "excel-errors", th: "Errors และ security", en: "Errors and security", ja: "エラーとセキュリティ" },
    ],
  },
  {
    slug: "sap-integration",
    group: { th: "การส่งออกข้อมูล", en: "Data exports", ja: "データエクスポート" },
    th: "SAP",
    en: "SAP",
    ja: "SAP",
    summary: { th: "การเชื่อมต่อ SAP", en: "SAP integration", ja: "生産指図、マッピング、確認シミュレーション" },
    sections: [
      { id: "sap-overview", th: "ภาพรวม", en: "Overview", ja: "概要" },
      { id: "sap-connection", th: "Connection และ Test", en: "Connection and test", ja: "接続とテスト" },
      { id: "sap-orders", th: "Production Orders", en: "Production Orders", ja: "生産指図" },
      { id: "sap-response", th: "ตัวอย่าง SAP Response", en: "SAP response handling", ja: "SAP レスポンスの処理" },
      { id: "sap-mapping", th: "Mapping", en: "Mapping", ja: "マッピング" },
      { id: "sap-confirmation", th: "Confirmation simulation", en: "Confirmation simulation", ja: "確認シミュレーション" },
      { id: "sap-security", th: "Errors และ security", en: "Errors and security", ja: "エラーとセキュリティ" },
    ],
  },
];

const REQUEST_EXAMPLE = `{
  "name": "Factory A",
  "baseUrl": "https://monitor.example.com",
  "loginUrl": "https://monitor.example.com/gateway/web/login",
  "customerId": "customer-a",
  "loginId": "operator@example.com",
  "password": "••••••••",
  "probe": true
}`;
const DATA_REQUEST_EXAMPLE = `{
  "mode": "range",
  "from": "2026-08-01",
  "to": "2026-08-31",
  "customerIds": ["customer-a", "customer-b"],
  "fresh": false
}`;
const LOST_TIME_REQUEST_EXAMPLE = `{
  "mode": "day",
  "date": "2026-09-01",
  "customerIds": ["i1625962667"]
}`;
const IXACS_LOGIN_RESPONSE_EXAMPLE = `HTTP/1.1 200 OK
Set-Cookie: SESSION=8f2c…; Path=/; HttpOnly
Content-Type: text/plain;charset=UTF-8

true`;
const IXACS_MONITOR_RESPONSE_EXAMPLE = `{
  "8d39e68e-…": {
    "s": "status-running-…",
    "p": "PRODUCT-A",
    "pu": "product-uuid-…",
    "ct": "42.8",
    "bt": "09:15:00"
  }
}`;
const IXACS_DETAIL_RESPONSE_EXAMPLE = `{
  "8d39e68e-…": {
    "pn": 480,
    "n": 312,
    "act": 44.1,
    "bct": 40.0,
    "nph": 81,
    "vr": 92.5,
    "oa": 98.2,
    "t": 14400,
    "ot": 1800
  }
}`;
const IXACS_LOST_TIME_RESPONSE_EXAMPLE = `{
  "ok": true,
  "shutOffHoursGraphData": {
    "seriesList": [
      {
        "style": {
          "status": "STOP_MACHINE",
          "dispStringJa": "設備停止",
          "dispStringEn": "Machine stop",
          "dispString3rd": "เครื่องจักรหยุด",
          "bgColor": "#e53e3e"
        },
        "timeSeconds": 1800,
        "cnt": 3
      }
    ]
  }
}`;
const IXACS_PUSH_PAYLOAD_EXAMPLE = `{
  "productionGroup": {
    "uuid": "group-uuid-…",
    "name3rd": "กลุ่มผลิต A",
    "nameEn": "Group A",
    "nameJa": "グループA",
    "dispOrd": 1
  },
  "productionLine": {
    "uuid": "8d39e68e-…",
    "groupUuid": "group-uuid-…",
    "name3rd": "ไลน์ผลิต 1",
    "nameEn": "Line 1",
    "nameJa": "ライン1"
  },
  "product": {
    "uuid": "product-uuid-…",
    "name3rd": "PRODUCT-A"
  },
  "andonStatusStyle": {
    "uuid": "status-uuid-…",
    "status": "RUNNING",
    "name3rd": "เดินเครื่อง",
    "nameEn": "Running",
    "nameJa": "運転中",
    "bgColor": "#22c55e",
    "blinkingFlg": false
  },
  "status": {
    "productionLineUuid": "8d39e68e-…",
    "andonStatusStyleUuid": "status-uuid-…",
    "productUuid": "product-uuid-…"
  }
}`;
const PUSH_CURL_EXAMPLE = `POST /api/push HTTP/1.1
Host: bridge.example.com
x-api-key: push_key_uuid_…
Content-Type: application/json

{
  "productionLine": { "uuid": "8d39e68e-…" },
  "andonStatusStyle": { "status": "RUNNING", "name3rd": "เดินเครื่อง" }
}`;
const PUSH_SUCCESS_RESPONSE_EXAMPLE = `HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "processed": 1,
  "events": [{ "id": "evt_...", "accepted": true }]
}`;
const EXCEL_REQUEST_EXAMPLE = `GET /api/excel/exports/export-uuid-… HTTP/1.1
Host: bridge.example.com
Authorization: Bearer export-api-key-uuid-…`;
const EXCEL_RESPONSE_EXAMPLE = `{
  "value": [
    {
      "วันที่": "2026-09-01",
      "ไลน์ผลิต": "Line 1",
      "สินค้า": "PRODUCT-A",
      "แผน": 480,
      "ผลิตจริง": 312,
      "Current CT": 42.8,
      "Lost Time รวม": 30
    }
  ]
}`;
const EXCEL_POWER_QUERY_EXAMPLE = `let
  Source = Json.Document(
    Web.Contents(
      "https://bridge.example.com/api/excel/exports/export-uuid-…?table=current",
      [Headers=[Authorization="Bearer <export-specific-api-key>"]]
    )
  ),
  Rows = Source[value],
  Table = Table.FromRecords(Rows)
in
  Table`;
const SAP_ORDER_RESPONSE_EXAMPLE = `{
  "value": [
    {
      "ProductionOrder": "10001234",
      "Product": "PRODUCT-A",
      "ProductionPlant": "TH01",
      "PlannedTotalQty": "480",
      "ProductionUnit": "PC"
    }
  ]
}`;
const SAP_MAPPED_ORDER_EXAMPLE = `{
  "ok": true,
  "orders": [
    {
      "id": "10001234",
      "product": "PRODUCT-A",
      "plant": "TH01",
      "plannedQty": "480",
      "unit": "PC"
    }
  ]
}`;
const SAP_CONFIRMATION_EXAMPLE = `POST /api/exports/sap/sap-connection-uuid-…/confirm
Content-Type: application/json

{
  "orderId": "10001234",
  "yieldQuantity": "312",
  "unit": "PC",
  "previewOnly": false
}`;
const SAP_CONFIRMATION_RESPONSE_EXAMPLE = `{
  "ok": true,
  "mode": "simulation",
  "executed": false,
  "transactionId": "SIM-…",
  "validation": "passed",
  "payload": {
    "OrderID": "10001234",
    "ConfirmationUnit": "PC",
    "ConfirmationUnitISOCode": "PCE",
    "ConfirmationYieldQuantity": "312",
    "APIConfHasNoGoodsMovements": true
  }
}`;

function text(value: Localized, locale: Locale) {
  return locale === "th" ? value.th : locale === "ja" ? value.ja : value.en;
}

function t3(locale: Locale, th: string, en: string, ja: string) {
  return locale === "th" ? th : locale === "ja" ? ja : en;
}

function t3x(locale: Locale, th: ReactNode, en: ReactNode, ja: ReactNode) {
  return locale === "th" ? th : locale === "ja" ? ja : en;
}

function CodeBlock({ code, locale }: { code: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="docs-code-container">
      <pre className="docs-code-block">
        <button
          type="button"
          className="docs-code-copy-btn"
          onClick={() => void copyCode()}
          aria-label={copied ? t3(locale, "คัดลอกแล้ว", "Copied", "コピー済み") : t3(locale, "คัดลอกโค้ด", "Copy code", "コードをコピー")}
        >
          {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
        </button>
        <code>
          {code.split("\n").map((line, index) => (
            <span className="docs-code-line" key={`${index}-${line}`}>
              <i>{index + 1}</i>
              <b>{line || " "}</b>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="docs-heading">
      <a href={`#${id}`} aria-label={`Link to ${id}`}>
        #
      </a>
      {children}
    </h2>
  );
}

function Callout({ title, children, tone = "note" }: { title: string; children: ReactNode; tone?: "note" | "warning" }) {
  return (
    <blockquote className={`docs-callout is-${tone}`}>
      <strong>{title}</strong>
      <div>{children}</div>
    </blockquote>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                <td key={index}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsMenu({ active, locale }: { active: DocsSlug; locale: Locale }) {
  const groups = useMemo(() => {
    const result = new Map<string, DocsEntry[]>();
    for (const doc of DOCS) {
      const key = text(doc.group, locale);
      result.set(key, [...(result.get(key) ?? []), doc]);
    }
    return [...result.entries()];
  }, [locale]);

  return (
    <aside className="docs-nav-col">
      <Link href="/how-it-works" className="docs-nav-brand">
        SAM Bridge <span>/ {t3(locale, "ศูนย์เอกสาร", "Docs", "ドキュメント")}</span>
      </Link>
      {groups.map(([group, docs]) => (
        <nav key={group} aria-label={group} className="docs-nav-group">
          <p className="docs-nav-group-title">{group}</p>
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={doc.slug === "ixacs-connection" ? "/how-it-works" : `/how-it-works/${doc.slug}`}
              className={active === doc.slug ? "is-active" : undefined}
            >
              {text(doc, locale)}
            </Link>
          ))}
        </nav>
      ))}
      <div className="docs-nav-rule" />
    </aside>
  );
}

function SetupArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="overview">
        <Heading id="overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings</code> ไม่ได้เชื่อม Database ของ iXacs โดยตรง แต่ส่ง Credential ให้ SAM Bridge Server ทำ HTTP login แบบเดียวกับ Browser แล้วใช้ Session นั้นอ่าน CT Monitor</>,
            <>The <code>/settings</code> page does not connect to an iXacs database. It sends credentials to the SAM Bridge server, which performs a browser-like HTTP login and uses that session to read CT Monitor.</>,
            <><code>/settings</code> ページは iXacs データベースに直接接続しません。認証情報を SAM Bridge サーバーに送信し、ブラウザのような HTTP ログインを実行し、そのセッションを使用して CT Monitor を読み取ります。</>
          )}
        </p>
        <div className="docs-flow">
          <code>Settings UI</code><i>→</i><code>Login API</code><i>→</i><code>iXacs Gateway</code><i>→</i><code>CT Monitor</code><i>→</i><code>Connection store</code>
        </div>
        <Callout title={t3(locale, "ขอบเขต", "Scope", "スコープ")}>
          {t3(locale, "บทความนี้อธิบายพฤติกรรมตามโค้ดปัจจุบันเท่านั้น และไม่ได้เปลี่ยน API หรือ business logic ของ Settings", "This documents the current implementation and does not change Settings APIs or business logic.", "これは現在の実装を文書化したものであり、Settings API やビジネスロジックを変更するものではありません。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="request">
        <Heading id="request">{t3(locale, "Request จาก Settings", "Request from Settings", "Settings からのリクエスト")}</Heading>
        <p>
          {t3x(
            locale,
            <>ปุ่ม Test connection และ Save เรียก <code>POST /api/connections/login</code> เหมือนกัน ต่างกันที่ค่า <code>probe</code></>,
            <>Test connection and Save both call <code>POST /api/connections/login</code>; <code>probe</code> selects the behavior.</>,
            <>Test connection と Save はどちらも <code>POST /api/connections/login</code> を呼び出します。<code>probe</code> によって動作が選択されます。</>
          )}
        </p>
        <Table
          headers={[t3(locale, "Field", "Field", "フィールド"), t3(locale, "Mode", "Mode", "モード"), t3(locale, "คำอธิบาย", "Description", "説明")]}
          rows={[
            [<code key="name">name</code>, "optional", t3(locale, "ชื่อที่แสดงในระบบ", "Display name", "表示名")],
            [<code key="base">baseUrl</code>, "required", t3(locale, "Origin ของ iXacs", "iXacs origin", "iXacs のオリジン")],
            [<code key="login">loginUrl</code>, "derived", <code key="value">baseUrl + /gateway/web/login</code>],
            [<code key="customer">customerId</code>, "optional", t3(locale, "Tenant หลัก; เลือกหลัง login ได้", "Primary tenant; may be selected after login", "プライマリテナント。ログイン後に選択可能")],
            [<code key="id">loginId</code>, "required", t3(locale, "บัญชี iXacs", "iXacs account", "iXacs アカウント")],
            [<code key="password">password</code>, "required", t3(locale, "รหัสผ่านหรือค่าที่บันทึกไว้", "Password or stored value", "パスワードまたは保存された値")],
            [<code key="probe">probe</code>, "derived", "true = Test, false = Save"],
          ]}
        />
        <CodeBlock code={REQUEST_EXAMPLE} locale={locale} />
      </section>

      <section className="docs-section" aria-labelledby="authentication">
        <Heading id="authentication">{t3(locale, "Authentication และ Session", "Authentication and session", "認証とセッション")}</Heading>
        <p>{t3(locale, "Server เก็บ Cookie Jar ระหว่างหลาย request ขั้นตอนจึงไม่ใช่การส่ง Credential ครั้งเดียว", "The server maintains a cookie jar across several requests; authentication is not a single credential POST.", "サーバーは複数のリクエストにわたって Cookie Jar を維持します。認証は単一の認証情報の POST ではありません。")}</p>
        <ol>
          <li>{t3x(locale, <>เปิด <code>/gateway/web/login</code> และเก็บ <code>Set-Cookie</code></>, <>Open <code>/gateway/web/login</code> and retain <code>Set-Cookie</code>.</>, <><code>/gateway/web/login</code> を開き、<code>Set-Cookie</code> を保持します。</>)}</li>
          <li>{t3x(locale, <>เรียก <code>getVersion</code> และ <code>getSessionId</code> เพื่อ bootstrap Gateway</>, <>Call <code>getVersion</code> and <code>getSessionId</code> to bootstrap Gateway.</>, <><code>getVersion</code> と <code>getSessionId</code> を呼び出して Gateway をブートストラップします。</>)}</li>
          <li>{t3(locale, "ส่ง customerId, loginId และ password แล้วตาม redirect เฉพาะ origin เดียวกัน", "Submit customerId, loginId, and password, following same-origin redirects only.", "customerId、loginId、password を送信し、同一オリジンのリダイレクトのみに従います。")}</li>
          <li>{t3x(locale, <>ตรวจว่ามี <code>SESSION</code> และ <code>checkLogin</code> ตอบ true</>, <>Require a <code>SESSION</code> cookie and a true <code>checkLogin</code> response.</>, <><code>SESSION</code> Cookie と <code>checkLogin</code> の true レスポンスを要求します。</>)}</li>
          <li>{t3x(locale, <>เปิด <code>/ct-monitor</code> เพื่อยืนยันสิทธิ์ Monitor</>, <>Open <code>/ct-monitor</code> to verify Monitor access.</>, <><code>/ct-monitor</code> を開いて Monitor へのアクセスを検証します。</>)}</li>
        </ol>
      </section>

      <section className="docs-section" aria-labelledby="ixacs-login-response">
        <Heading id="ixacs-login-response">{t3(locale, "ตัวอย่าง Response จาก iXacs", "Example response from iXacs", "iXacs からのレスポンス例")}</Heading>
        <p>
          {t3x(
            locale,
            <>หลังส่ง Credential สำเร็จ iXacs Gateway จะตั้งค่า <code>SESSION</code> cookie จากนั้น endpoint <code>/gateway/api/checkLogin</code> ต้องตอบข้อความ <code>true</code></>,
            <>After accepting the credentials, iXacs Gateway sets a <code>SESSION</code> cookie. The <code>/gateway/api/checkLogin</code> endpoint must then return the text <code>true</code>.</>,
            <>認証情報を受け入れると、iXacs Gateway は <code>SESSION</code> Cookie を設定します。その後、<code>/gateway/api/checkLogin</code> エンドポイントはテキスト <code>true</code> を返す必要があります。</>
          )}
        </p>
        <CodeBlock code={IXACS_LOGIN_RESPONSE_EXAMPLE} locale={locale} />
        <Callout title={t3(locale, "ตัวอย่างถูกปิดบังข้อมูล", "Sanitized example", "サニタイズされた例")}>
          {t3(locale, "ค่า SESSION ด้านบนเป็นเพียงตัวอย่างและห้ามนำ Session จริงมาใส่ในเอกสารหรือ log", "The SESSION value is illustrative. Never place a real session token in documentation or logs.", "SESSION 値は説明のためのものです。実際のセッショントークンをドキュメントやログに配置しないでください。")}
        </Callout>
        <p>
          {t3x(
            locale,
            <>SAM Bridge ไม่ส่ง raw cookie นี้กลับ Browser แต่ตรวจ <code>{'checkLoginResponse === "true"'}</code> และเก็บ Session ไว้สำหรับ server-side CT Monitor requests</>,
            <>SAM Bridge does not return this raw cookie to the browser. It verifies <code>{'checkLoginResponse === "true"'}</code> and keeps the session for server-side CT Monitor requests.</>,
            <>SAM Bridge はこの生の Cookie をブラウザに返しません。<code>{'checkLoginResponse === "true"'}</code> を検証し、サーバー側の CT Monitor リクエストのためにセッションを保持します。</>
          )}
        </p>
      </section>

      <section className="docs-section" aria-labelledby="customer">
        <Heading id="customer">{t3(locale, "Customer scope", "Customer scope", "カスタマースコープ")}</Heading>
        <p>
          {t3x(
            locale,
            <>ถ้า iXacs redirect ไป <code>/gateway/web/selectCustomer</code> ระบบจะ parse รายการ Customer จาก HTML และตอบ <code>409 LOGIN_CUSTOMER_SELECTION_REQUIRED</code> ให้ UI แสดงตัวเลือก</>,
            <>If iXacs redirects to <code>/gateway/web/selectCustomer</code>, the server parses customer options from HTML and returns <code>409 LOGIN_CUSTOMER_SELECTION_REQUIRED</code>.</>,
            <>iXacs が <code>/gateway/web/selectCustomer</code> にリダイレクトした場合、サーバーは HTML からカスタマーのオプションを解析し、<code>409 LOGIN_CUSTOMER_SELECTION_REQUIRED</code> を返します。</>
          )}
        </p>
        <Callout title="409 · LOGIN_CUSTOMER_SELECTION_REQUIRED">
          {t3(locale, "ผู้ใช้ต้องเลือกอย่างน้อยหนึ่ง Customer แล้วส่ง request ใหม่ โดยรายการทั้งหมดจะกลายเป็น scope ของ connection", "Select at least one customer and retry. Every selection becomes part of the connection scope.", "少なくとも 1 つのカスタマーを選択して再試行します。選択したものはすべて接続スコープの一部になります。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="discovery">
        <Heading id="discovery">{t3(locale, "Production group และ line discovery", "Production group and line discovery", "プロダクショングループとライン検出")}</Heading>
        <p>{t3(locale, "หลัง Session พร้อมใช้งาน Server อ่าน CT Monitor เพื่อหา UUID จริง ไม่สร้าง UUID เอง และไม่ต้องกรอก Line ทีละรายการ", "After authentication, the server reads CT Monitor for real UUIDs. It neither generates IDs nor requires manual line entry.", "認証後、サーバーは CT Monitor を読み取って実際の UUID を取得します。ID の生成や手動でのライン入力は必要ありません。")}</p>
        <Table
          headers={[t3(locale, "ลำดับ", "Order", "順序"), "Endpoint", t3(locale, "ผลลัพธ์", "Result", "結果")]}
          rows={[
            ["1", <code key="groups">GET /ct-monitor/web/ctMonitor/summary/selectGroup</code>, "Production Group UUIDs"],
            ["2", <code key="lines">GET /ct-monitor/web/ctMonitor/monitor/realtime?groupUuids=…</code>, "Groups, Lines, Status metadata"],
          ]}
        />
      </section>

      <section className="docs-section" aria-labelledby="storage">
        <Heading id="storage">{t3(locale, "บันทึก Connection", "Persist the connection", "接続の永続化")}</Heading>
        <p>
          {t3x(
            locale,
            <>เมื่อ Save สำเร็จ ระบบสร้างหรืออัปเดต Connection, ตั้ง Active, บันทึก <code>lastOkAt</code> และคืน <code>connectionId</code> ให้ Browser</>,
            <>On Save, the server creates or updates the connection, marks it active, records <code>lastOkAt</code>, and returns <code>connectionId</code>.</>,
            <>保存時、サーバーは接続を作成または更新し、アクティブとしてマークし、<code>lastOkAt</code> を記録して <code>connectionId</code> を返します。</>
          )}
        </p>
        <ul>
          <li><code>baseUrl</code>, <code>loginUrl</code>, Customer scope</li>
          <li>{t3(locale, "Credential, Basic Auth และ SESSION สำหรับ server-side requests", "Credentials, Basic Auth, and SESSION for server-side requests", "サーバー側リクエスト用の認証情報、Basic Auth、および SESSION")}</li>
          <li>{t3(locale, "Production Line UUIDs และสถานะการเชื่อมต่อล่าสุด", "Production Line UUIDs and latest connection state", "Production Line UUIDs と最新の接続状態")}</li>
        </ul>
        <Callout title={t3(locale, "ข้อมูลลับ", "Secrets", "シークレット")} tone="warning">
          {t3x(locale, <>Public response ไม่ส่ง <code>password</code> กลับไป แต่ส่งเพียง <code>hasPassword</code></>, <>Public responses omit <code>password</code> and expose only <code>hasPassword</code>.</>, <>パブリックレスポンスは <code>password</code> を省略し、<code>hasPassword</code> のみを公開します。</>)}
        </Callout>
      </section>
    </>
  );
}

function DataExplorerArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="data-overview">
        <Heading id="data-overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings/[connectionId]/data</code> อ่าน Production data จากหนึ่งหรือหลาย Connection แล้วรวมเป็นตารางเดียว โดย Browser ติดต่อเฉพาะ API ของ SAM Bridge</>,
            <>The <code>/settings/[connectionId]/data</code> page reads production data from one or more connections and combines it into one table. The browser talks only to SAM Bridge APIs.</>,
            <><code>/settings/[connectionId]/data</code> ページは 1 つ以上の接続から生産データを読み取り、1 つのテーブルに結合します。ブラウザは SAM Bridge API とのみ通信します。</>
          )}
        </p>
        <div className="docs-flow">
          <code>Data Explorer</code><i>→</i><code>/api/connections/:id/data</code><i>→</i><code>iXacs CT APIs</code><i>→</i><code>Normalized rows</code>
        </div>
        <Callout title="Route parameter">
          {t3x(locale, <>ค่า <code>connectionId</code> ใน URL คือเครื่องเริ่มต้น หน้าเดียวกันเลือกหลาย Connection และหลาย Customer ได้</>, <>The URL <code>connectionId</code> is the initial machine. The page can select multiple connections and customers.</>, <>URL の <code>connectionId</code> は初期マシンです。ページは複数の接続とカスタマーを選択できます。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="page-load">
        <Heading id="page-load">{t3(locale, "เมื่อเปิดหน้า", "Initial load", "初期読み込み")}</Heading>
        <ol>
          <li>{t3x(locale, <>โหลดรายการที่เข้าถึงได้จาก <code>GET /api/connections</code></>, <>Load accessible connections from <code>GET /api/connections</code>.</>, <><code>GET /api/connections</code> からアクセス可能な接続を読み込みます。</>)}</li>
          <li>{t3(locale, "หา Connection ตาม URL และเลือก Customer ทั้งหมดของเครื่องเป็นค่าเริ่มต้น", "Resolve the URL connection and initially select all of its customers.", "URL の接続を解決し、初期状態でそのすべてのカスタマーを選択します。")}</li>
          <li>{t3x(locale, <>กำหนดช่วงข้อมูลเป็นวันนี้ในโหมด <code>day</code></>, <>Set the data period to today in <code>day</code> mode.</>, <><code>day</code> モードでデータ期間を今日に設定します。</>)}</li>
          <li>{t3x(locale, <>ส่ง <code>POST /api/connections/[id]/data</code> แยกต่อ Connection แบบขนาน</>, <>POST to <code>/api/connections/[id]/data</code> for each connection in parallel.</>, <>各接続に対して並列に <code>/api/connections/[id]/data</code> へ POST します。</>)}</li>
          <li>{t3(locale, "รวม rows ที่สำเร็จและเพิ่ม machineName เพื่อแสดงผล", "Merge successful rows and attach machineName for presentation.", "成功した行を結合し、表示用に machineName を添付します。")}</li>
        </ol>
      </section>

      <section className="docs-section" aria-labelledby="data-request">
        <Heading id="data-request">{t3(locale, "API request", "API request", "API リクエスト")}</Heading>
        <p>{t3(locale, "Body กำหนดช่วงวันที่, Customer scope และการข้าม cache โดยแต่ละ Connection ได้รับเฉพาะ Customer ที่อยู่ในเครื่องนั้น", "The body defines the date period, customer scope, and cache behavior. Each connection receives only its own customers.", "本文では、日付期間、カスタマースコープ、およびキャッシュの動作を定義します。各接続は独自のカスタマーのみを受け取ります。")}</p>
        <CodeBlock code={DATA_REQUEST_EXAMPLE} locale={locale} />
        <h3>{t3(locale, "รูปแบบช่วงวันที่", "Date modes", "日付モード")}</h3>
        <Table
          headers={["mode", t3(locale, "Fields", "Fields", "フィールド"), t3(locale, "ความหมาย", "Meaning", "意味")]}
          rows={[
            [<code key="day">day</code>, <code key="date">date</code>, t3(locale, "หนึ่งวัน; ค่าเริ่มต้นคือวันนี้", "One day; defaults to today", "1 日。デフォルトは今日")],
            [<code key="range">range</code>, <code key="from">from, to</code>, t3(locale, "ช่วงวันที่ต่อเนื่อง", "Inclusive date range", "連続する日付範囲")],
            [<code key="month">month</code>, <code key="month-f">month</code>, <code key="month-v">YYYY-MM</code>],
            [<code key="year">year</code>, <code key="year-f">year</code>, <code key="year-v">YYYY</code>],
          ]}
        />
        <p className="docs-footnote">{t3(locale, "Server ไม่รับวันในอนาคตและจำกัด request สูงสุด 3,660 วัน", "The server excludes future dates and limits one request to 3,660 days.", "サーバーは未来の日付を除外し、1 回のリクエストを 3,660 日に制限します。")}</p>
      </section>

      <section className="docs-section" aria-labelledby="server-flow">
        <Heading id="server-flow">{t3(locale, "การทำงานฝั่ง Server", "Server flow", "サーバーフロー")}</Heading>
        <ol>
          <li>{t3(locale, "ตรวจ Session ของผู้ใช้และสิทธิ์เข้าถึง Connection", "Verify the user session and connection access.", "ユーザーセッションと接続アクセスを検証します。")}</li>
          <li>{t3(locale, "แปลง date mode เป็นรายการวันที่ และเป็น DD/MM/YYYY สำหรับ iXacs", "Resolve date mode and convert dates to DD/MM/YYYY for iXacs.", "日付モードを解決し、iXacs 用に日付を DD/MM/YYYY に変換します。")}</li>
          <li>{t3(locale, "ล็อกต่อ Connection เพื่อไม่ให้หลาย request แก้ Session พร้อมกัน", "Acquire a per-connection lock so requests do not mutate one session concurrently.", "リクエストが 1 つのセッションを同時に変更しないように、接続ごとのロックを取得します。")}</li>
          <li>{t3(locale, "สลับ Customer session ทีละรายการและค้นหา Group/Line เมื่อจำเป็น", "Activate each customer session and discover groups/lines when needed.", "各カスタマーセッションをアクティブにし、必要に応じて Group/Line を検出します。")}</li>
          <li>{t3x(locale, <>เรียก <code>getCtMonitorData</code> และ <code>getCtMonitorDetailData</code> พร้อมกัน</>, <>Call <code>getCtMonitorData</code> and <code>getCtMonitorDetailData</code> concurrently.</>, <><code>getCtMonitorData</code> と <code>getCtMonitorDetailData</code> を同時に呼び出します。</>)}</li>
          <li>{t3(locale, "รวม monitor + detail + line/status metadata เป็นหนึ่ง row ต่อ Line", "Merge monitor, detail, line, and status metadata into one row per line.", "monitor、detail、line、および status メタデータをラインごとに 1 行に結合します。")}</li>
        </ol>
        <Callout title={t3(locale, "Realtime กับ Historical", "Realtime vs historical", "リアルタイムと履歴")}>
          {t3(locale, "วันนี้ใช้ realtime mode ส่วนวันอื่นหรือหลายวันจะเปิด historical monitor ก่อน แล้วใช้ referer ที่ได้กับ request ข้อมูล", "Today uses realtime mode. Other dates prepare the historical monitor and reuse its referer.", "今日は realtime モードを使用します。他の日付は historical モードを準備し、そのリファラーを再利用します。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="controls">
        <Heading id="controls">{t3(locale, "Filters, columns และ refresh", "Filters, columns and refresh", "フィルター、列およびリフレッシュ")}</Heading>
        <Table
          headers={[t3(locale, "ตัวควบคุม", "Control", "コントロール"), t3(locale, "ทำงานที่", "Runs in", "実行場所"), t3(locale, "พฤติกรรม", "Behavior", "動作")]}
          rows={[
            [t3(locale, "เลือกเครื่อง", "Machine selection", "マシンの選択"), "Server request", t3(locale, "ยิง API ต่อเครื่องแบบขนานแล้วรวม rows", "Fetch each machine in parallel and merge rows", "並列に各マシンの API を呼び出し、行を結合")],
            [t3(locale, "เลือก Customer", "Customer selection", "カスタマーの選択"), "Server request", t3(locale, "ล้างข้อมูลเดิมและส่ง fresh: 1", "Clear rows and send fresh: 1", "行をクリアして fresh: 1 を送信")],
            [t3(locale, "ช่วงวันที่", "Data period", "データ期間"), "Server request", t3(locale, "โหลดใหม่เมื่อกดแสดงข้อมูล", "Reload when Show data is pressed", "データ表示時に再読み込み")],
            ["Search / Group / Product / Status / CT", "Browser", t3(locale, "กรอง rows เดิม ไม่เรียก API ใหม่", "Filter loaded rows without a new API call", "新しい API 呼び出しなしで読み込み済みの行をフィルタリング")],
            [t3(locale, "เลือก Columns / Sort", "Columns / sort", "列の選択とソート"), "Browser", t3(locale, "เปลี่ยนเฉพาะการแสดงผล", "Presentation only", "表示のみの変更")],
            ["Auto refresh", "Server request", t3(locale, "ใช้เฉพาะวันนี้; ไม่ซ้อน request ที่ยังทำงาน", "Today only; never overlaps an in-flight request", "今日のみ。実行中のリクエストと重複しない")],
          ]}
        />
      </section>

      <section className="docs-section" aria-labelledby="ixacs-data-response">
        <Heading id="ixacs-data-response">{t3(locale, "ตัวอย่าง Response จาก iXacs", "Example responses from iXacs", "iXacs からのレスポンス例")}</Heading>
        <p>
          {t3x(
            locale,
            <>Data Explorer อ่าน JSON สองชุดพร้อมกัน ชุดแรกจาก <code>getCtMonitorData</code> มีสถานะและ Cycle Time ปัจจุบัน โดย key ชั้นนอกคือ Production Line UUID</>,
            <>Data Explorer reads two JSON payloads concurrently. <code>getCtMonitorData</code> contains current status and cycle-time values; each top-level key is a production-line UUID.</>,
            <>Data Explorer は 2 つの JSON ペイロードを同時に読み取ります。<code>getCtMonitorData</code> には現在のステータスとサイクルタイムの値が含まれ、トップレベルのキーは Production Line UUID です。</>
          )}
        </p>
        <CodeBlock code={IXACS_MONITOR_RESPONSE_EXAMPLE} locale={locale} />
        <p>
          {t3x(
            locale,
            <>ชุดที่สองจาก <code>getCtMonitorDetailData</code> มีค่ารายละเอียดของแผน ผลผลิต และเวลา ระบบใช้ UUID เดียวกันเพื่อ merge สอง response</>,
            <><code>getCtMonitorDetailData</code> contains plan, output, and timing details. The shared UUID is used to merge both responses.</>,
            <><code>getCtMonitorDetailData</code> には計画、生産量、時間の詳細が含まれます。共有 UUID を使用して両方のレスポンスをマージします。</>
          )}
        </p>
        <CodeBlock code={IXACS_DETAIL_RESPONSE_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Field", "Field", "フィールド"), t3(locale, "ความหมายหลัง Normalize", "Normalized meaning", "正規化後の意味")]}
          rows={[
            [<code key="s">s</code>, "statusUuid"], [<code key="p">p</code>, "product"], [<code key="pu">pu</code>, "productUuid"],
            [<code key="bt">bt</code>, "bizTime"], [<code key="pn">pn</code>, "planNum"], [<code key="n">n</code>, "actualNum"],
            [<code key="ct">ct</code>, "currentCt"], [<code key="act">act</code>, "averageCt"], [<code key="bct">bct</code>, "baseCt"],
            [<code key="nph">nph</code>, "pcsPerHour"], [<code key="vr">vr</code>, "volumeRate"], [<code key="oa">oa</code>, "operationalAvailability"],
            [<code key="t">t</code>, "operatingTime"], [<code key="ot">ot</code>, "stopTime"],
          ]}
        />
        <Callout title={t3(locale, "หมายเหตุ", "Note", "注意")}>
          {t3(locale, "UUID และค่าตัวเลขในตัวอย่างเป็นข้อมูลสมมติที่คงชื่อ field ตาม response ที่ parser รองรับจริง", "UUIDs and values are illustrative; field names match the response shape supported by the parser.", "UUID と値は説明のためのものです。フィールド名はパーサーがサポートするレスポンスの形式と一致します。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="response">
        <Heading id="response">{t3(locale, "Response model", "Response model", "レスポンスモデル")}</Heading>
        <p>{t3x(locale, <>API ตอบ metadata ระดับ request และ <code>rows[]</code> ระดับ Production Line</>, <>The API returns request metadata and one <code>rows[]</code> item per production line.</>, <>API はリクエストレベルのメタデータと、Production Line ごとに 1 つの <code>rows[]</code> アイテムを返します。</>)}</p>
        <div className="docs-schema-grid">
          <article>
            <h3>{t3(locale, "Request metadata", "Request metadata", "リクエスト メタデータ")}</h3>
            {["mode", "dateFrom / dateTo", "customerIds", "lineCount", "roundId / receivedAt", "coverage", "cached"].map((item) => (
              <code key={item}>{item}</code>
            ))}
          </article>
          <article>
            <h3>{t3(locale, "Row fields", "Row fields", "行フィールド")}</h3>
            {["uuid", "productionGroupName", "productionLineName", "product", "planNum / actualNum", "currentCt / averageCt / baseCt", "statusUuid / statusName"].map((item) => (
              <code key={item}>{item}</code>
            ))}
          </article>
        </div>
        <Callout title="coverage">
          {t3x(
            locale,
            <>ใช้ <code>coverage.monitor</code> และ <code>coverage.detail</code> ตรวจว่าข้อมูลครบทุก Line หรือไม่ โดยมี <code>missingLineUuids</code> สำหรับ debug</>,
            <>Use <code>coverage.monitor</code> and <code>coverage.detail</code> to verify complete line coverage; <code>missingLineUuids</code> supports debugging.</>,
            <><code>coverage.monitor</code> と <code>coverage.detail</code> を使用して、ラインのカバレッジが完全であることを検証します。<code>missingLineUuids</code> はデバッグをサポートします。</>
          )}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="cache-errors">
        <Heading id="cache-errors">{t3(locale, "Cache และ error handling", "Cache and error handling", "キャッシュとエラー処理")}</Heading>
        <ul>
          <li>{t3x(locale, <>Discovery cache แยกตาม Connection + Customer เป็นเวลา <strong>5 นาที</strong></>, <>Discovery cache is scoped by connection + customer for <strong>5 minutes</strong>.</>, <>検出キャッシュのスコープは Connection + Customer で <strong>5 分間</strong> です。</>)}</li>
          <li>{t3x(locale, <>Production cache แยกตาม Connection + Customer + วันที่: realtime <strong>5 วินาที</strong>, historical <strong>5 นาที</strong></>, <>Production cache is scoped by connection + customer + dates: <strong>5 seconds</strong> realtime, <strong>5 minutes</strong> historical.</>, <>Production キャッシュのスコープは Connection + Customer + 日付で、リアルタイムは <strong>5 秒間</strong>、履歴は <strong>5 分間</strong> です。</>)}</li>
          <li>{t3x(locale, <>เลือก Customer ใหม่ส่ง <code>fresh: 1</code> เพื่อข้าม cache</>, <>Changing customers sends <code>fresh: 1</code> to bypass cache.</>, <>Customer を変更すると、キャッシュをバイパスするために <code>fresh: 1</code> を送信します。</>)}</li>
          <li>{t3(locale, "ถ้าบาง Connection ล้มเหลว หน้ายังแสดง rows จากเครื่องที่สำเร็จได้", "If some connections fail, rows from successful machines remain available.", "一部の接続が失敗しても、成功したマシンの行は引き続き利用可能です。")}</li>
        </ul>
        <Table
          headers={[t3(locale, "HTTP / code", "HTTP / code", "HTTP / コード"), t3(locale, "สาเหตุ", "Cause", "原因")]}
          rows={[
            [<code key="403">403 Forbidden</code>, t3(locale, "ไม่มีสิทธิ์เข้าถึง Connection", "Connection access denied", "接続アクセスが拒否されました")],
            [<code key="404">404 Not found</code>, t3(locale, "ไม่พบ Connection", "Connection not found", "接続が見つかりません")],
            [<code key="customer">400 CUSTOMER_REQUIRED</code>, t3(locale, "มีหลาย Customer แต่ request ไม่ระบุ scope", "Multi-customer connection without a scope", "スコープなしの複数カスタマー接続")],
            [<code key="lines">400 NEED_LINES</code>, t3(locale, "ไม่พบ Production Line", "No production lines found", "Production Line が見つかりません")],
            [<code key="502">502 upstream error</code>, t3(locale, "อ่าน historical monitor หรือ CT APIs ไม่สำเร็จ", "Historical monitor or CT API request failed", "履歴モニターまたは CT API リクエストが失敗しました")],
          ]}
        />
      </section>
    </>
  );
}

function LostTimeArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="lost-overview">
        <Heading id="lost-overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings/[connectionId]/data/lost-time</code> แสดงเวลาหยุดของแต่ละ Production Line โดยแยกคอลัมน์ตาม Status topic ที่ iXacs ส่งกลับมา หน่วยที่แสดงคือ <strong>นาที</strong></>,
            <>The <code>/settings/[connectionId]/data/lost-time</code> page shows downtime per production line, split into iXacs status-topic columns. Displayed values are in <strong>minutes</strong>.</>,
            <><code>/settings/[connectionId]/data/lost-time</code> ページは、Production Line ごとのダウンタイムを iXacs のステータストピックの列に分割して表示します。表示される値は <strong>分</strong> 単位です。</>
          )}
        </p>
        <div className="docs-flow">
          <code>Lost Time page</code><i>→</i><code>/api/connections/:id/lost-time</code><i>→</i><code>getShutOffHoursGraphData</code><i>→</i><code>Minutes by topic</code>
        </div>
        <Callout title={t3(locale, "แหล่งข้อมูล", "Data source", "データソース")}>
          {t3x(
            locale,
            <>หน้านี้ไม่ได้คำนวณ Lost Time จากตาราง Production data แต่ใช้ endpoint <code>getShutOffHoursGraphData</code> ของ iXacs โดยตรง</>,
            <>This page does not derive lost time from the production table. It reads iXacs <code>getShutOffHoursGraphData</code> directly.</>,
            <>このページは Production テーブルから Lost Time を計算しません。iXacs の <code>getShutOffHoursGraphData</code> を直接読み取ります。</>
          )}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="url-state">
        <Heading id="url-state">{t3(locale, "URL parameters", "URL parameters", "URL パラメータ")}</Heading>
        <p>{t3(locale, "Server Component อ่าน query string ครั้งแรก จากนั้น Client จะอัปเดต URL ด้วย replaceState ทุกครั้งที่ค่าที่เลือกถูก apply ทำให้ reload หรือแชร์ URL แล้วได้ scope เดิม", "The Server Component parses the initial query string. The client then keeps the applied state in sync with replaceState, so reloads and shared URLs preserve the same scope.", "Server Component は初期のクエリ文字列を解析します。その後、Client は適用された状態を replaceState と同期させるため、再読み込みや共有 URL でも同じスコープが維持されます。")}</p>
        <Table
          headers={[t3(locale, "Parameter", "Parameter", "パラメータ"), t3(locale, "หน้าที่", "Purpose", "用途"), t3(locale, "กติกา", "Rule", "ルール")]}
          rows={[
            [<code key="companies">companies</code>, t3(locale, "Connection IDs ที่ต้องการรวม", "Connection IDs to combine", "結合する Connection IDs"), t3(locale, "คั่นด้วย comma; ถ้าไม่มีใช้ ID จาก path", "Comma-separated; defaults to the path ID", "カンマ区切り。デフォルトはパスの ID")],
            [<code key="customers">customers</code>, t3(locale, "Customer IDs ที่ต้องการอ่าน", "Customer scope", "カスタマースコープ"), t3(locale, "คั่นด้วย comma และตัดค่าซ้ำ", "Comma-separated and deduplicated", "カンマ区切りで重複を削除")],
            [<code key="mode">mode</code>, t3(locale, "รูปแบบช่วงข้อมูล", "Period type", "期間のタイプ"), <code key="modes">day | range | month | year</code>],
            [<code key="date">date</code>, t3(locale, "วันที่สำหรับ day mode", "Date for day mode", "day モードの日付"), <code key="date-value">YYYY-MM-DD</code>],
            [<code key="from-to">from / to</code>, t3(locale, "ขอบเขตของ range mode", "Range boundaries", "range モードの境界"), <code key="range-value">YYYY-MM-DD</code>],
            [<code key="month-year">month / year</code>, t3(locale, "ค่าสำหรับ month หรือ year", "Month or year value", "month または year の値"), <code key="month-year-value">YYYY-MM / YYYY</code>],
          ]}
        />
        <Callout title={t3(locale, "การตรวจ ID", "ID validation", "ID 検証")}>
          {t3(locale, "ค่า companies และ customers รับเฉพาะตัวอักษร ตัวเลข และ hyphen ความยาวไม่เกิน 80 ตัวอักษร", "companies and customers accept only letters, numbers, and hyphens, up to 80 characters per ID.", "companies と customers は文字、数字、ハイフンのみを受け入れ、ID ごとに最大 80 文字です。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="lost-request">
        <Heading id="lost-request">{t3(locale, "API request", "API request", "API リクエスト")}</Heading>
        <p>
          {t3x(
            locale,
            <>ตารางส่ง <code>POST /api/connections/[id]/lost-time</code> แยกทุก Connection พร้อมกัน แล้วรวม <code>topics</code> และ <code>rows</code> ของ response ที่ได้</>,
            <>The table POSTs to <code>/api/connections/[id]/lost-time</code> for every connection in parallel, then merges response <code>topics</code> and <code>rows</code>.</>,
            <>テーブルはすべての Connection に対して並列に <code>POST /api/connections/[id]/lost-time</code> を送信し、レスポンスの <code>topics</code> と <code>rows</code> をマージします。</>
          )}
        </p>
        <CodeBlock code={LOST_TIME_REQUEST_EXAMPLE} locale={locale} />
        <ul>
          <li>{t3(locale, "หน้าโหลดข้อมูลอัตโนมัติเมื่อเปิด และโหลดใหม่เมื่อ Connection, Customer หรือช่วงวันที่ที่ apply เปลี่ยน", "Data auto-loads on entry and reloads when applied connections, customers, or dates change.", "データはアクセス時に自動ロードされ、適用された Connection、Customer、または日付が変更されると再ロードされます。")}</li>
          <li>{t3(locale, "การเลือก Connection และ Customer มี debounce 180 ms ก่อนนำค่าไปใช้", "Connection and customer changes use a 180 ms debounce before applying.", "Connection と Customer の変更は、適用前に 180 ms のデバウンスを使用します。")}</li>
          <li>{t3(locale, "วันอ้างอิงและการห้ามเลือกอนาคตใช้เขตเวลา Asia/Bangkok", "Today and future-date validation use the Asia/Bangkok time zone.", "今日と未来の日付の検証は Asia/Bangkok タイムゾーンを使用します。")}</li>
          <li>{t3(locale, "API จำกัดช่วงข้อมูลไม่เกิน 366 วัน", "The API accepts at most 366 dates per request.", "API は 1 回のリクエストで最大 366 日まで受け入れます。")}</li>
        </ul>
      </section>

      <section className="docs-section" aria-labelledby="lost-server-flow">
        <Heading id="lost-server-flow">{t3(locale, "การทำงานฝั่ง Server", "Server flow", "サーバーフロー")}</Heading>
        <ol>
          <li>{t3(locale, "ตรวจ Session และสิทธิ์เข้าถึง Connection", "Verify the session and connection access.", "セッションと接続アクセスを検証します。")}</li>
          <li>{t3(locale, "แปลง date mode เป็นรายการวันที่ และแปลงเป็น DD/MM/YYYY สำหรับ iXacs", "Resolve the period into dates and convert them to DD/MM/YYYY for iXacs.", "期間を日付に解決し、iXacs 用に DD/MM/YYYY に変換します。")}</li>
          <li>{t3(locale, "ตรวจ result cache แล้วล็อก Connection เพื่อป้องกันการสลับ Session พร้อมกัน", "Check the result cache, then lock the connection to prevent concurrent session changes.", "結果キャッシュを確認し、接続をロックして同時セッション変更を防止します。")}</li>
          <li>{t3(locale, "สลับ Customer session ทีละ Customer และทำ Line discovery", "Activate each customer session and discover its production lines.", "各 Customer セッションをアクティブにし、Production Line を検出します。")}</li>
          <li>{t3(locale, "เลือกเฉพาะ Line UUID ที่ Connection อนุญาต", "Keep only line UUIDs allowed by the connection.", "接続で許可された Line UUID のみを保持します。")}</li>
          <li>{t3x(locale, <>เรียก <code>getShutOffHoursGraphData</code> ทีละ Line ด้วย Group UUID, Line UUID, วันที่ และ realtime flag</>, <>Call <code>getShutOffHoursGraphData</code> per line with group UUID, line UUID, dates, and realtime flag.</>, <>Group UUID、Line UUID、日付、および realtime フラグを使用して、ラインごとに <code>getShutOffHoursGraphData</code> を呼び出します。</>)}</li>
          <li>{t3(locale, "รวมผลทุก Customer เป็น payload เดียว แล้วเรียงตามบริษัทและ Production Line", "Merge all customer results and sort by company and production line.", "すべての Customer の結果をマージし、会社と Production Line でソートします。")}</li>
        </ol>
        <Callout title={t3(locale, "ลำดับการทำงาน", "Concurrency model", "並行処理モデル")}>
          {t3(locale, "หลาย Connection ถูกเรียกพร้อมกันจาก Browser แต่ภายในหนึ่ง Connection จะประมวลผล Customer และ Line ตามลำดับเพื่อรักษา iXacs session เดียวกัน", "The browser fetches connections in parallel, while each connection processes customers and lines sequentially to preserve its iXacs session.", "ブラウザは接続を並列に取得しますが、各接続は iXacs セッションを維持するために Customer と Line を順番に処理します。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="ixacs-lost-response">
        <Heading id="ixacs-lost-response">{t3(locale, "ตัวอย่าง Response จาก iXacs", "Example response from iXacs", "iXacs からのレスポンス例")}</Heading>
        <p>
          {t3x(
            locale,
            <>endpoint <code>getShutOffHoursGraphData</code> ส่ง series ของ Status topic ภายใต้ <code>shutOffHoursGraphData.seriesList</code> แต่ละรายการมี style, เวลารวมเป็นวินาที และจำนวนครั้ง</>,
            <><code>getShutOffHoursGraphData</code> returns status-topic series under <code>shutOffHoursGraphData.seriesList</code>. Each item includes style metadata, total seconds, and occurrence count.</>,
            <><code>getShutOffHoursGraphData</code> は <code>shutOffHoursGraphData.seriesList</code> の下にステータストピックシリーズを返します。各アイテムにはスタイルメタデータ、合計秒数、発生回数が含まれます。</>
          )}
        </p>
        <CodeBlock code={IXACS_LOST_TIME_RESPONSE_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Field", "Field", "フィールド"), t3(locale, "ระบบนำไปใช้", "Usage", "システムでの利用")]}
          rows={[
            [<code key="status">style.status</code>, t3(locale, "รหัสสถานะสำหรับสร้าง topic key", "Status component of the topic key", "トピックキーのステータスコンポーネント")],
            [<code key="names">dispStringJa / En / 3rd</code>, t3(locale, "ชื่อหัวข้อหลายภาษา", "Localized topic names", "ローカライズされたトピック名")],
            [<code key="color">bgColor</code>, t3(locale, "สีของหัวตาราง", "Topic marker color", "トピックマーカーの色")],
            [<code key="seconds">timeSeconds</code>, t3(locale, "หาร 60 เป็น minutesByTopic", "Divided by 60 into minutesByTopic", "60 で割って minutesByTopic に変換")],
            [<code key="cnt">cnt</code>, t3(locale, "เก็บเป็น countByTopic", "Stored as countByTopic", "countByTopic として保存")],
          ]}
        />
        <Callout title={t3(locale, "หัวข้อที่ไม่นับ", "Excluded topics", "除外トピック")}>
          {t3x(locale, <>ระบบตัด topic ที่ตรงกับ <code>power off</code>, <code>หยุดตามแผน</code> และ <code>ช่วงพัก</code> ก่อนสร้างตาราง Lost Time</>, <>Topics matching <code>power off</code>, <code>หยุดตามแผน</code>, or <code>ช่วงพัก</code> are removed before the Lost Time table is built.</>, <><code>power off</code>、<code>หยุดตามแผน</code>、または <code>ช่วงพัก</code> に一致するトピックは、Lost Time テーブルが作成される前に削除されます。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="aggregation">
        <Heading id="aggregation">{t3(locale, "การคำนวณและแสดงผล", "Aggregation and rendering", "集計とレンダリング")}</Heading>
        <p>{t3(locale, "Server อ่าน topic definition และค่ารวมจาก response ของ iXacs โดยตรง แล้วแปลงระยะเวลาจากวินาทีเป็นนาที", "The server reads topic definitions and aggregates directly from the iXacs response, converting duration from seconds to minutes.", "サーバーは iXacs のレスポンスから直接トピック定義と集計を読み取り、期間を秒から分に変換します。")}</p>
        <Table
          headers={[t3(locale, "ระดับ", "Level", "レベル"), t3(locale, "การคำนวณ", "Calculation", "計算")]}
          rows={[
            [t3(locale, "ต่อ Line / Topic", "Line / topic", "Line / Topic ごと"), <><code key="minutes">minutesByTopic[topicKey]</code> · <code key="count">countByTopic[topicKey]</code></>],
            [t3(locale, "Lost Time รวมต่อ Line", "Total per line", "Line ごとの合計"), t3(locale, "ผลรวม minutesByTopic ทุก topic ของแถวนั้น", "Sum of every minutesByTopic value in the row", "行のすべての minutesByTopic 値の合計")],
            [t3(locale, "รวมทุกสายการผลิต", "All production lines", "すべての Production Line"), t3(locale, "ผลรวมต่อตารางและต่อ topic คำนวณใน Browser", "Grand and per-topic totals calculated in the browser", "ブラウザで計算される全体の合計とトピックごとの合計")],
            [t3(locale, "ชื่อ Topic", "Topic label", "Topic 名"), t3(locale, "ไทยใช้ name3rd ก่อน แล้ว fallback เป็นอังกฤษ/ญี่ปุ่น", "Thai prefers name3rd, then English and Japanese", "タイ語は name3rd を優先し、その後英語と日本語にフォールバック")],
          ]}
        />
        <p>{t3(locale, "ผู้ใช้ sort ได้ตาม Group, Line, Lost Time รวม หรือ topic ใดก็ได้ ค่าเริ่มต้นคือ Lost Time รวมจากมากไปน้อย", "Users can sort by group, line, total lost time, or any topic. The default is total lost time descending.", "ユーザーは Group、Line、合計 Lost Time、または任意のトピックでソートできます。デフォルトは合計 Lost Time の降順です。")}</p>
      </section>

      <section className="docs-section" aria-labelledby="lost-response">
        <Heading id="lost-response">{t3(locale, "Response model", "Response model", "レスポンスモデル")}</Heading>
        <div className="docs-schema-grid">
          <article>
            <h3>{t3(locale, "Request metadata", "Request metadata", "リクエスト メタデータ")}</h3>
            {["source", "customerIds", "dateFrom / dateTo", "dateCount", "lineCount", "failedRequestCount", "cachedLineCount / fetchedLineCount", "elapsedMs / cached"].map((item) => (
              <code key={item}>{item}</code>
            ))}
          </article>
          <article>
            <h3>{t3(locale, "Row fields", "Row fields", "行フィールド")}</h3>
            {["companyId / companyName", "customerId", "productionGroupUuid / Name", "productionLineUuid / Name", "minutesByTopic", "countByTopic"].map((item) => (
              <code key={item}>{item}</code>
            ))}
          </article>
        </div>
        <Callout title="topics[]">
          {t3x(
            locale,
            <>แต่ละ topic มี <code>key</code>, ชื่อหลายภาษา และ <code>backgroundColor</code> ตารางใช้ key เชื่อมกับ <code>minutesByTopic</code> ของแต่ละ Line</>,
            <>Each topic contains a <code>key</code>, localized names, and <code>backgroundColor</code>. The table uses the key to read each line&apos;s <code>minutesByTopic</code>.</>,
            <>各トピックには <code>key</code>、ローカライズされた名前、および <code>backgroundColor</code> が含まれます。テーブルはこのキーを使用して各ラインの <code>minutesByTopic</code> を読み取ります。</>
          )}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="lost-cache">
        <Heading id="lost-cache">{t3(locale, "Cache และ error handling", "Cache and error handling", "キャッシュとエラー処理")}</Heading>
        <Table
          headers={[t3(locale, "Cache", "Cache", "キャッシュ"), "Key", "TTL"]}
          rows={[
            [t3(locale, "ผลรวมทั้ง request", "Whole result", "リクエスト全体 Results"), "Connection + base URL + Customers + Dates", t3(locale, "Realtime 15 วินาที · อื่น ๆ 15 นาที", "15 seconds realtime · 15 minutes otherwise", "リアルタイム 15 秒 · その他 15 分")],
            [t3(locale, "ผลต่อ Line", "Per-line result", "Line ごとの結果"), "Connection + base URL + Customer + Group + Line + Dates", t3(locale, "วันที่มีวันนี้ 15 นาที · Historical 365 วัน", "15 minutes when including today · 365 days historical", "今日を含む日付は 15 分 · 履歴は 365 日")],
            [t3(locale, "ไฟล์เสริม", "Optional disk cache", "オプションのディスクキャッシュ"), <code key="file">data/ixacs-lost-time-cache.json</code>, t3(locale, "ใช้ TTL ของ per-line cache", "Uses the per-line TTL", "Per-line の TTL を使用")],
          ]}
        />
        <Callout title={t3(locale, "Disk cache เป็น optional", "Disk cache is optional", "ディスクキャッシュはオプションです")}>
          {t3(locale, "ถ้าไฟล์เสียหรือเขียนไม่ได้ ระบบยังอ่านข้อมูลสดจาก iXacs ต่อได้", "A corrupt or unwritable cache file never blocks live iXacs reads.", "キャッシュファイルが破損しているか書き込みできない場合でも、iXacs のライブ読み取りはブロックされません。")}
        </Callout>
        <ul>
          <li><code>403 Forbidden</code> — {t3(locale, "ไม่มีสิทธิ์เข้าถึง Connection", "connection access denied", "接続アクセスが拒否されました")}</li>
          <li><code>404 Company not found</code> — {t3(locale, "ไม่พบ Connection", "connection not found", "接続が見つかりません")}</li>
          <li><code>400 Invalid date range</code> — {t3(locale, "วันที่ไม่ถูกต้อง เป็นอนาคตทั้งหมด หรือเกิน 366 วัน", "invalid, future-only, or over 366 dates", "無効、未来のみ、または 366 日を超えています")}</li>
          <li><code>502</code> — {t3(locale, "ค้นหา Group ไม่สำเร็จ, Session ถูกปฏิเสธ หรือบาง Line โหลดไม่ครบ", "group discovery failed, session rejected, or incomplete line results", "Group の検出に失敗、セッションが拒否された、または Line の結果が不完全です")}</li>
        </ul>
        <p className="docs-footnote">{t3(locale, "เมื่อบาง Line ล้มเหลว API ยังคืน rows และ errors ที่มีอยู่ แต่ตอบ HTTP 502 เพื่อให้ Client แสดงข้อความว่าข้อมูลไม่ครบ", "When some lines fail, the API still returns available rows and errors but responds with HTTP 502 to signal incomplete data.", "一部の Line が失敗した場合、API は引き続き利用可能な行とエラーを返しますが、HTTP 502 で応答してデータが不完全であることを通知します。")}</p>
      </section>
    </>
  );
}

function PushApiArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="push-overview">
        <Heading id="push-overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings/push</code> ใช้กำหนด public endpoint และ API key ให้ iXacs ส่งสถานะเข้ามาแบบ event-driven ส่วนหน้า <code>/settings/push/events</code> ใช้ดูสถานะล่าสุดของ Line ที่ตั้งค่าไว้</>,
            <><code>/settings/push</code> configures the public endpoint and API keys used by iXacs to send event-driven status updates. <code>/settings/push/events</code> shows the latest state for configured lines.</>,
            <><code>/settings/push</code> は iXacs がイベント駆動でステータス更新を送信するために使用するパブリックエンドポイントと API キーを設定します。<code>/settings/push/events</code> は設定されたラインの最新状態を表示します。</>
          )}
        </p>
        <div className="docs-flow">
          <code>iXacs</code><i>→</i><code>POST /api/push</code><i>→</i><code>Validate key + assignment</code><i>→</i><code>Store event</code><i>→</i><code>LINE / Slack</code>
        </div>
        <Callout title={t3(locale, "Push กับ Polling", "Push vs polling", "Push と Polling")}>
          {t3(locale, "Push เป็นทางหลักสำหรับแจ้งเตือนทันทีแม้ไม่มีผู้ใช้เปิดหน้า Events ส่วนหน้า Events ยัง poll live status ทุก 5 วินาทีเพื่อเติมสถานะล่าสุดและช่วยตรวจสอบ payload ที่ไม่มี Status", "Push is the primary path for immediate notifications, even when no Events page is open. The Events page also polls live status every five seconds to refresh state and cover payloads without status data.", "Push は Events ページが開かれていない場合でも、即時通知のための主要な経路です。Events ページは 5 秒ごとにライブステータスをポーリングして状態を更新し、ステータスデータのないペイロードを補完します。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="push-setup">
        <Heading id="push-setup">{t3(locale, "ทุกส่วนในหน้า Setup", "Setup page sections", "Setup ページのセクション")}</Heading>
        <Table
          headers={[t3(locale, "ส่วน", "Section", "セクション"), t3(locale, "การทำงาน", "Behavior", "動作")]}
          rows={[
            [t3(locale, "Company selector", "Company selector", "Company セレクター"), t3(locale, "กรอง API keys ตาม Connection ที่เลือก", "Filters API keys by the selected connection", "選択した接続で API キーをフィルタリング")],
            ["Endpoint", t3x(locale, <>สร้างจาก <code>window.location.origin + /api/push</code> และมีปุ่ม Copy</>, <>Built from <code>window.location.origin + /api/push</code> with a copy action</>, <><code>window.location.origin + /api/push</code> から構築され、コピーボタンがあります</>)],
            [t3(locale, "Setup / Events tabs", "Setup / Events tabs", "Setup / Events タブ"), t3(locale, "สลับระหว่างจัดการ key และดูสถานะ Line", "Switches between key management and line status", "キー管理と Line ステータスの切り替え")],
            [t3(locale, "Search", "Search", "検索"), t3(locale, "ค้นหาจากชื่อ key หรือชื่อ Line ใน Browser", "Client-side search by key name or line name", "ブラウザでのキー名または Line 名による検索")],
            [t3(locale, "Status filter", "Status filter", "ステータスフィルター"), t3(locale, "Active หรือ Disabled; key หมดอายุแสดงเป็น Expired", "Active or Disabled; expired keys display as Expired", "Active または Disabled。期限切れのキーは Expired として表示")],
            [t3(locale, "Line filter", "Line filter", "Line フィルター"), t3(locale, "กรองรายการ key ตาม Production Line", "Filters keys by production line", "Production Line によるキーのフィルタリング")],
          ]}
        />
        <p>{t3x(locale, <>หน้าโหลดข้อมูลจาก <code>GET /api/settings</code> ซึ่งคืนรายการ key, companies, groups และชนิด storage ที่กำลังใช้</>, <>The page loads <code>GET /api/settings</code>, which returns keys, companies, groups, and the active storage type.</>, <>ページは <code>GET /api/settings</code> からデータを読み込み、キー、companies、groups、およびアクティブなストレージタイプを返します。</>)}</p>
      </section>

      <section className="docs-section" aria-labelledby="push-keys">
        <Heading id="push-keys">{t3(locale, "การจัดการ API keys", "API key lifecycle", "API キーのライフサイクル")}</Heading>
        <h3>{t3(locale, "สร้าง key", "Create a key", "キーの作成")}</h3>
        <ol>
          <li>{t3x(locale, <>โหลด Group/Line จริงจาก <code>GET /api/connections/[connectionId]/catalog</code></>, <>Load real groups and lines from <code>GET /api/connections/[connectionId]/catalog</code>.</>, <><code>GET /api/connections/[connectionId]/catalog</code> から実際の Group/Line を読み込みます。</>)}</li>
          <li>{t3(locale, "เลือกหนึ่ง Production Line, ตั้งชื่อ, environment และอายุ 30/90/365 วันหรือไม่หมดอายุ", "Select one production line, name, environment, and a 30/90/365-day or no-expiry lifetime.", "1 つの Production Line、名前、環境、および 30/90/365 日または無期限の有効期間を選択します。")}</li>
          <li>{t3x(locale, <>ส่ง <code>POST /api/keys</code>; Server ตรวจสิทธิ์และตรวจว่า Line อยู่ใน Connection ก่อนสร้าง UUID key</>, <>POST to <code>/api/keys</code>; the server checks access and verifies that the line belongs to the connection before issuing a UUID key.</>, <><code>POST /api/keys</code> を送信します。サーバーはアクセスをチェックし、Line が Connection に属していることを検証してから UUID キーを発行します。</>)}</li>
        </ol>
        <Table
          headers={[t3(locale, "คำสั่ง", "Action", "アクション"), "API", t3(locale, "ผล", "Effect", "効果")]}
          rows={[
            [t3(locale, "Disable / Enable", "Disable / enable", "無効化 / 有効化"), <code key="patch">PATCH /api/keys/[key]</code>, t3(locale, "เปลี่ยน active/disabled; key หมดอายุเปิดกลับไม่ได้จาก UI", "Toggles active/disabled; expired keys cannot be re-enabled in the UI", "active/disabled を切り替えます。期限切れのキーは UI から再有効化できません")],
            [t3(locale, "Rotate", "Rotate", "ローテーション"), <code key="rotate">POST /api/keys/[key]/rotate</code>, t3(locale, "ลบ key เดิม สร้าง UUID ใหม่ และล้าง lastUsedAt", "Replaces the old key with a new UUID and clears lastUsedAt", "古いキーを新しい UUID に置き換え、lastUsedAt をクリアします")],
            [t3(locale, "Delete", "Delete", "削除"), <code key="delete">DELETE /api/keys/[key]</code>, t3(locale, "เพิกถอน key และลบจาก storage", "Revokes and removes the key from storage", "キーを取り消し、ストレージから削除します")],
          ]}
        />
        <Callout title={t3(locale, "Environment", "Environment", "環境")}>
          {t3x(locale, <>ค่า <code>live</code> และ <code>test</code> เป็น metadata ของ key ใน implementation ปัจจุบัน การตรวจ authorization ใช้กติกาเดียวกันทั้งสองค่า</>, <><code>live</code> and <code>test</code> are key metadata in the current implementation. Authorization applies the same rules to both.</>, <><code>live</code> と <code>test</code> は現在の実装におけるキーメタデータです。承認は両方に同じルールを適用します。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="push-request">
        <Heading id="push-request">{t3(locale, "Request contract", "Request contract", "リクエスト仕様")}</Heading>
        <CodeBlock code={PUSH_CURL_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Item", "Item", "項目"), t3(locale, "กติกา", "Rule", "ルール")]}
          rows={[
            ["URL", <code key="url">/api/push</code>],
            ["Methods", <code key="methods">GET, POST, PUT, PATCH, OPTIONS</code>],
            ["Authentication", <code key="auth">x-api-key</code>],
            ["Content-Type", t3x(locale, <><code key="json">application/json</code> สำหรับ payload ที่ต้องบันทึก</>, <><code key="json">application/json</code> for stored payloads</>, <><code key="json">application/json</code> (保存されるペイロード用)</>)],
            [t3(locale, "ขนาดสูงสุด", "Maximum size", "最大サイズ"), "10 MB"],
            [t3(locale, "จำนวน records", "Record count", "レコード数"), t3(locale, "สูงสุด 5,000 รายการต่อ request", "Up to 5,000 items per request", "リクエストあたり最大 5,000 件")],
          ]}
        />
        <p>
          {t3x(
            locale,
            <>รองรับ JSON object เดี่ยว, array ตรง ๆ หรือ array ภายใต้ <code>events</code>, <code>records</code>, <code>items</code> หรือ <code>data</code> ถ้าเป็น GET หรือ body ไม่ใช่ JSON ระบบจะตอบ handshake แต่ไม่สร้าง event</>,
            <>The endpoint accepts one JSON object, a direct array, or arrays under <code>events</code>, <code>records</code>, <code>items</code>, or <code>data</code>. GET and non-JSON bodies return a handshake response without creating events.</>,
            <>エンドポイントは 1 つの JSON オブジェクト、直接の配列、または <code>events</code>、<code>records</code>、<code>items</code>、<code>data</code> の下の配列を受け入れます。GET および非 JSON 本文はイベントを作成せずにハンドシェイク応答を返します。</>
          )}
        </p>
        <Callout title="CORS">
          {t3x(locale, <>ตอบ <code>Access-Control-Allow-Origin: *</code> และอนุญาต header <code>Content-Type, x-api-key</code></>, <>Responses include <code>Access-Control-Allow-Origin: *</code> and allow <code>Content-Type, x-api-key</code> headers.</>, <>レスポンスには <code>Access-Control-Allow-Origin: *</code> が含まれ、<code>Content-Type, x-api-key</code> ヘッダーを許可します。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="ixacs-push-payload">
        <Heading id="ixacs-push-payload">{t3(locale, "ตัวอย่าง Payload จาก iXacs", "Example payload from iXacs", "iXacs ペイロード例")}</Heading>
        <p>{t3(locale, "ตัวอย่างด้านล่างลด field ที่ไม่เกี่ยวข้องออก แต่คง object และชื่อ field ที่ parser ใช้จริง", "This sanitized example omits unrelated fields while preserving the objects and field names read by the parser.", "以下のサニタイズされた例では無関係なフィールドを省略していますが、パーサーが読み取るオブジェクトとフィールド名は保持しています。")}</p>
        <CodeBlock code={IXACS_PUSH_PAYLOAD_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Object", "Object", "オブジェクト"), t3(locale, "ข้อมูลที่นำไปใช้", "Consumed data", "使用されるデータ")]}
          rows={[
            [<code key="group">productionGroup</code>, "uuid, name3rd/nameEn/nameJa, dispOrd"],
            [<code key="line">productionLine</code>, "uuid, groupUuid, localized names"],
            [<code key="product">product</code>, "uuid, localized names"],
            [<code key="style">andonStatusStyle</code>, "uuid, localized labels, colors, blinkingFlg, status"],
            [<code key="status">status</code>, "productionLineUuid, andonStatusStyleUuid, productUuid"],
            [<code key="catalog">andonStatusStyles / statusStyles</code>, t3(locale, "optional catalog ของสถานะทั้งหมดสำหรับ Line", "Optional complete status catalog for the line", "Line のためのオプションの完全なステータスカタログ")],
          ]}
        />
        <p className="docs-footnote">
          {t3x(
            locale,
            <>ระบบรับ Session เพิ่มได้จาก Cookie <code>SESSION</code> หรือ root field <code>session</code>, <code>SESSION</code>, <code>sessionId</code></>,
            <>A session may also arrive through the <code>SESSION</code> cookie or root fields <code>session</code>, <code>SESSION</code>, or <code>sessionId</code>.</>,
            <>セッションは <code>SESSION</code> Cookie またはルートフィールド <code>session</code>、<code>SESSION</code>、<code>sessionId</code> を通じて到達することもあります。</>
          )}
        </p>
      </section>

      <section className="docs-section" aria-labelledby="push-processing">
        <Heading id="push-processing">{t3(locale, "Validation และ processing", "Validation and processing", "バリデーションと処理")}</Heading>
        <ol>
          <li>{t3(locale, "ตรวจขนาด request และตรวจว่า x-api-key มีอยู่, active และยังไม่หมดอายุ", "Check request size and require an existing, active, unexpired x-api-key.", "リクエストサイズをチェックし、既存でアクティブな、期限切れでない x-api-key を要求します。")}</li>
          <li>{t3(locale, "แยก payload เป็นรายการแล้วประมวลผลทีละรายการ", "Expand the payload into items and process them sequentially.", "ペイロードをアイテムに展開し、順番に処理します。")}</li>
          <li>{t3x(locale, <>หา Line UUID จาก <code>productionLine.uuid</code> หรือ <code>status.productionLineUuid</code></>, <>Resolve the line UUID from <code>productionLine.uuid</code> or <code>status.productionLineUuid</code>.</>, <><code>productionLine.uuid</code> または <code>status.productionLineUuid</code> から Line UUID を解決します。</>)}</li>
          <li>{t3(locale, "ตรวจว่า Company, Group และ Line ตรงกับ assignment ของ key", "Verify company, group, and line against the key assignment.", "キーの割り当てに対して Company、Group、および Line を検証します。")}</li>
          <li>{t3(locale, "อัปเดต Group, Line, status catalog, current status, product และ status history", "Update group, line, status catalog, current status, product, and status history.", "Group、Line、ステータスカタログ、現在のステータス、製品、およびステータス履歴を更新します。")}</li>
          <li>{t3x(locale, <>บันทึก event preview สูงสุด 12,000 ตัวอักษร และอัปเดต <code>lastUsedAt</code> ของ key</>, <>Store up to 12,000 characters of event preview and update key <code>lastUsedAt</code>.</>, <>最大 12,000 文字のイベントプレビューを保存し、キーの <code>lastUsedAt</code> を更新します。</>)}</li>
          <li>{t3(locale, "ส่ง event ที่รับสำเร็จไปยัง LINE และ Slack notification rules", "Dispatch accepted events to matching LINE and Slack notification rules.", "受け入れたイベントを一致する LINE および Slack の通知ルールにディスパッチします。")}</li>
        </ol>
      </section>

      <section className="docs-section" aria-labelledby="push-responses">
        <Heading id="push-responses">{t3(locale, "Responses และ errors", "Responses and errors", "レスポンスとエラー")}</Heading>
        <CodeBlock code={PUSH_SUCCESS_RESPONSE_EXAMPLE} locale={locale} />
        <Table
          headers={["HTTP", t3(locale, "เงื่อนไข", "Condition", "条件")]}
          rows={[
            ["200", t3(locale, "รับครบทุก record หรือ handshake สำเร็จ", "All records accepted or handshake succeeded", "すべてのレコードが受け入れられたか、ハンドシェイクが成功しました")],
            ["207", t3(locale, "รับได้บาง record; partial = true", "Some records accepted; partial = true", "一部のレコードが受け入れられました。partial = true")],
            ["401", <code key="401">Invalid x-api-key</code>],
            ["403", t3(locale, "Key ผูกกับ Company, Group หรือ Line อื่น", "Key is assigned to another company, group, or line", "キーは別の Company、Group、または Line に割り当てられています")],
            ["413", t3(locale, "เกิน 10 MB หรือมากกว่า 5,000 records", "Over 10 MB or more than 5,000 records", "10 MB を超えているか、5,000 レコードを超えています")],
            ["422", t3(locale, "ไม่มี record ที่รับได้ เช่น MISSING_LINE_UUID", "No record accepted, such as MISSING_LINE_UUID", "受け入れ可能なレコードがありません (MISSING_LINE_UUID など)")],
            ["503", t3(locale, "บันทึกข้อมูลแล้ว แต่ส่ง LINE หรือ Slack ไม่สำเร็จ; retryable = true", "Data received but LINE or Slack dispatch failed; retryable = true", "データは受信されましたが、LINE または Slack へのディスパッチに失敗しました。retryable = true")],
          ]}
        />
        <Callout title={t3(locale, "ระวังการ Retry", "Retry semantics", "リトライのセマンティクス")} tone="warning">
          {t3(locale, "HTTP 503 ระบุ received: true หมายถึง event ถูกบันทึกแล้ว การ retry อาจทำให้เกิด event ซ้ำได้ ผู้ส่งควรใช้ response นี้ประกอบนโยบาย deduplication", "HTTP 503 includes received: true, meaning the event was stored. Retrying can create a duplicate event, so senders should apply a deduplication policy.", "HTTP 503 には received: true が含まれ、イベントが保存されたことを意味します。リトライすると重複イベントが発生する可能性があるため、送信者は重複排除ポリシーを適用する必要があります。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="push-events">
        <Heading id="push-events">{t3(locale, "ทุกส่วนในหน้า Events", "Events page sections", "Events ページのセクション")}</Heading>
        <p>{t3x(locale, <>หน้าเรียก <code>GET /api/push/events</code> ด้วย <code>latestPerLine=1</code>, แสดง 50 Line ต่อหน้า และ refresh แบบเงียบทุก 5 วินาที</>, <>The page calls <code>GET /api/push/events</code> with <code>latestPerLine=1</code>, shows 50 lines per page, and quietly refreshes every five seconds.</>, <>ページは <code>latestPerLine=1</code> で <code>GET /api/push/events</code> を呼び出し、1 ページあたり 50 ラインを表示し、5 秒ごとに静かに更新します。</>)}</p>
        <Table
          headers={[t3(locale, "ส่วน", "Section", "セクション"), t3(locale, "การทำงาน", "Behavior", "動作")]}
          rows={[
            ["Search", t3(locale, "ค้นหา Event ID, Company, Group, Line, Status, Product และ error", "Searches event ID, company, group, line, status, product, and error", "Event ID、Company、Group、Line、Status、Product、エラーを検索")],
            ["Company / Status / Line", t3(locale, "ส่ง filter ไป Server และกลับหน้าแรก", "Server-side filters that reset pagination", "ページネーションをリセットするサーバー側のフィルター")],
            [t3(locale, "ตาราง", "Table", "テーブル"), t3(locale, "แสดง Group, Line, สถานะล่าสุด และเวลาอัปเดต", "Shows group, line, latest status, and update time", "Group、Line、最新のステータス、更新時間を表示")],
            [t3(locale, "รายละเอียด", "Detail drawer", "詳細ドロワー"), t3(locale, "แสดง Status, Received, UUID และ raw payload preview", "Shows status, received time, UUID, and raw payload preview", "Status、Received、UUID、raw payload のプレビューを表示")],
            [t3(locale, "Pagination", "Pagination", "ページネーション"), t3(locale, "offset/limit; API จำกัด limit สูงสุด 200", "offset/limit; API caps limit at 200", "offset/limit; API の limit の上限は 200")],
            [t3(locale, "Delete", "Delete", "削除"), t3(locale, "Line ที่ผูก Connection จะลบ event history ทั้ง Line; event เดี่ยวใช้ ID", "Assigned lines delete their line event history; standalone events delete by ID", "割り当てられた Line はその Line のイベント履歴を削除します。単独のイベントは ID で削除します")],
          ]}
        />
        <Callout title={t3(locale, "Configured lines", "Configured lines", "設定されたライン")}>
          {t3(locale, "หน้า Events เริ่มจาก Line ที่มี API key ไม่ใช่เฉพาะ Line ที่เคยมี Push event แล้วจึง merge event ล่าสุดกับ live status จาก iXacs", "The Events page starts from lines with API keys, not only lines with prior events, then merges each latest event with live status from iXacs.", "Events ページは以前のイベントを持つラインだけでなく、API キーを持つラインから始まり、各最新イベントを iXacs のライブステータスとマージします。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="push-actions">
        <Heading id="push-actions">{t3(locale, "การเปลี่ยนสถานะและการแจ้งเตือน", "Status changes and notifications", "ステータス変更と通知")}</Heading>
        <h3>{t3(locale, "เปลี่ยนสถานะจากหน้า Events", "Change status from Events", "Events からステータスを変更")}</h3>
        <ol>
          <li>{t3x(locale, <>โหลด status catalog จาก <code>POST /api/connections/[id]/statuses</code>; ถ้าไม่มีใช้ <code>GET /api/lines/[uuid]</code> เป็น fallback</>, <>Load the status catalog from <code>POST /api/connections/[id]/statuses</code>, falling back to <code>GET /api/lines/[uuid]</code>.</>, <><code>POST /api/connections/[id]/statuses</code> からステータスカタログを読み込み、フォールバックとして <code>GET /api/lines/[uuid]</code> を使用します。</>)}</li>
          <li>{t3(locale, "ผู้ใช้เลือกสถานะที่ไม่ใช่ค่าปัจจุบัน", "The user selects a status other than the current value.", "ユーザーが現在の値以外のステータスを選択します。")}</li>
          <li>{t3x(locale, <>ส่ง Connection, Line, Status และ Product ไป <code>POST /api/regist</code> ซึ่งเรียก iXacs CT Monitor</>, <>POST connection, line, status, and product to <code>/api/regist</code>, which calls iXacs CT Monitor.</>, <>Connection、Line、Status、Product を <code>/api/regist</code> に POST し、それが iXacs CT Monitor を呼び出します。</>)}</li>
        </ol>
        <h3>{t3(locale, "การแจ้งเตือน", "Notifications", "通知")}</h3>
        <p>{t3(locale, "Push ที่รับสำเร็จจะ dispatch LINE ก่อนแล้วจึง Slack ส่วน live polling ของหน้า Events ส่ง status snapshots หลัง response ผ่าน Next.js after() เพื่อไม่บล็อก UI", "Accepted pushes dispatch LINE and then Slack. Events-page live polling dispatches status snapshots after the response through Next.js after(), keeping the UI request unblocked.", "受け入れられたプッシュは LINE をディスパッチしてから Slack にディスパッチします。Events ページのライブポーリングは Next.js after() を通じてレスポンス後にステータススナップショットをディスパッチし、UI リクエストをブロックしないようにします。")}</p>
      </section>

      <section className="docs-section" aria-labelledby="push-storage">
        <Heading id="push-storage">{t3(locale, "Storage และ security", "Storage and security", "ストレージとセキュリティ")}</Heading>
        <ul>
          <li>{t3x(locale, <>API keys เก็บใน Supabase เมื่อ configured มิฉะนั้นใช้ <code>data/push-api-keys.json</code></>, <>API keys use Supabase when configured, otherwise <code>data/push-api-keys.json</code>.</>, <>設定されている場合は Supabase、そうでない場合は <code>data/push-api-keys.json</code> を使用します。</>)}</li>
          <li>{t3x(locale, <>Group, Line, Status history และ Push events เก็บใน memory และพยายาม persist ที่ <code>data/andon-state.json</code></>, <>Groups, lines, status history, and push events live in memory with best-effort persistence to <code>data/andon-state.json</code>.</>, <>Groups、Lines、ステータス履歴、およびプッシュイベントはメモリ上に存在し、<code>data/andon-state.json</code> にベストエフォートで永続化されます。</>)}</li>
          <li>{t3(locale, "เก็บ status history สูงสุด 20,000 รายการต่อ Line และ Push events ล่าสุดสูงสุด 2,000 รายการรวม", "Up to 20,000 status-history entries per line and 2,000 recent push events overall are retained.", "Line ごとに最大 20,000 件のステータス履歴、全体で最大 2,000 件の最近のプッシュイベントが保持されます。")}</li>
          <li>{t3(locale, "ถ้า filesystem เขียนไม่ได้ ระบบรับ Push และส่ง notification ต่อใน memory", "If filesystem writes fail, push processing and notifications continue in memory.", "ファイルシステムの書き込みが失敗した場合でも、プッシュ処理と通知はメモリ上で継続されます。")}</li>
          <li>{t3(locale, "Log ปิดบัง x-api-key เหลือ 8 ตัวแรกและ 4 ตัวท้าย และปิดบัง Cookie", "Logs mask x-api-key to its first eight and last four characters and redact Cookie.", "ログでは x-api-key が最初の 8 文字と最後の 4 文字にマスクされ、Cookie は墨塗りされます。")}</li>
        </ul>
        <Callout title={t3(locale, "Public endpoint", "Public endpoint", "パブリックエンドポイント")} tone="warning">
          {t3x(locale, <>Route <code>/api/push</code> ไม่ใช้หน้า Login ของ SAM Bridge การป้องกันหลักคือ <code>x-api-key</code> จึงต้องใช้ HTTPS, rotate เมื่อสงสัยว่ารั่ว และ disable/delete key ที่ไม่ใช้งาน</>, <><code>/api/push</code> does not use the SAM Bridge login page. Its primary protection is <code>x-api-key</code>; use HTTPS, rotate suspected leaks, and disable or delete unused keys.</>, <><code>/api/push</code> は SAM Bridge のログインページを使用しません。主な保護手段は <code>x-api-key</code> です。HTTPS を使用し、漏洩が疑われる場合はローテーションし、未使用のキーを無効化または削除してください。</>)}
        </Callout>
      </section>
    </>
  );
}

function ExcelExportsArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="excel-overview">
        <Heading id="excel-overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings/exports</code> สร้าง Export config ที่ดึงข้อมูล Production จาก iXacs แล้วส่งออกเป็น <strong>ไฟล์ .xlsx</strong> หรือ <strong>JSON API</strong> สำหรับ Power Query ใน Excel — Browser ไม่เรียก iXacs โดยตรง</>,
            <><code>/settings/exports</code> creates export configs that read iXacs production data and deliver it as a <strong>.xlsx download</strong> or a <strong>JSON API</strong> for Excel Power Query. The browser never calls iXacs directly.</>,
            <><code>/settings/exports</code> は、iXacs の生産データを読み取り、それを <strong>.xlsx ファイル</strong> または Excel Power Query 用の <strong>JSON API</strong> として配信するエクスポート設定を作成します。ブラウザが iXacs を直接呼び出すことはありません。</>
          )}
        </p>
        <div className="docs-flow">
          <code>Export wizard</code><i>→</i><code>Export config</code><i>→</i><code>/api/excel/exports/:id</code><i>→</i><code>iXacs CT Monitor</code><i>→</i><code>Excel / Power Query</code>
        </div>
        <Callout title={t3(locale, "ขอบเขต", "Scope", "スコープ")}>
          {t3(locale, "บทความนี้อธิบาย destination ประเภท Excel เท่านั้น (ไม่รวม Power BI, REST หรือ Webhook)", "This article covers the Excel destination only (not Power BI, REST, or webhook exports).", "この記事は Excel の出力先のみを対象としています (Power BI、REST、または Webhook のエクスポートは含まれません)。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="excel-setup">
        <Heading id="excel-setup">{t3(locale, "การตั้งค่าใน Settings", "Configuration in Settings", "Settings での設定")}</Heading>
        <p>{t3(locale, "Wizard มี 4 ขั้นหลัก: เลือกเครื่อง iXacs → กำหนด Group/Line → เลือก Excel → ตั้งตารางและช่วงข้อมูล", "The wizard has four main steps: pick an iXacs connection, define group/line scope, choose Excel, then configure tables and history.", "ウィザードには 4 つの主なステップがあります: iXacs 接続の選択、Group/Line スコープの定義、Excel の選択、テーブルと履歴の設定。")}</p>
        <Table
          headers={[t3(locale, "ขั้น", "Step", "ステップ"), t3(locale, "การทำงาน", "Behavior", "動作")]}
          rows={[
            [t3(locale, "Source", "Source", "ソース"), t3x(locale, <>เลือก Connection จาก <code>GET /api/connections</code></>, <>Select a connection from <code>GET /api/connections</code></>, <><code>GET /api/connections</code> から接続を選択します</>)],
            [t3(locale, "Scope", "Scope", "スコープ"), t3(locale, "เลือก Production Group/Line หรือ All groups / All lines", "Choose production groups/lines or all groups/lines", "Production Group/Line またはすべての Group/Line を選択")],
            [t3(locale, "Destination", "Destination", "出力先"), t3(locale, "เลือก Microsoft Excel เป็น destination", "Select Microsoft Excel as the destination", "Microsoft Excel を出力先に選択")],
            [t3(locale, "Excel model", "Excel model", "Excel モデル"), t3(locale, "เลือกตาราง, ช่วงย้อนหลัง (30/90/365 วัน), รอบ AutoRefresh และเปิด/ปิด auto refresh", "Choose tables, history window (30/90/365 days), AutoRefresh interval, and whether auto refresh is enabled", "テーブル、履歴ウィンドウ (30/90/365 日)、AutoRefresh 間隔、および自動更新の有効/無効を選択")],
            [t3(locale, "Review", "Review", "レビュー"), t3x(locale, <>บันทึกผ่าน <code>POST /api/exports</code>; ระบบออก Bearer API key เฉพาะ export นี้</>, <>Save through <code>POST /api/exports</code>; the server issues a dedicated Bearer API key</>, <><code>POST /api/exports</code> で保存します。サーバーは専用の Bearer API キーを発行します</>)],
          ]}
        />
        <h3>{t3(locale, "ตารางที่เลือกได้", "Available tables", "利用可能なテーブル")}</h3>
        <Table
          headers={[t3(locale, "Table", "Table", "テーブル"), "API ?table=", t3(locale, "ความหมาย", "Meaning", "意味")]}
          rows={[
            [<code key="hist">tblSAMProduction</code>, <code key="hist-p">production</code>, t3(locale, "ข้อมูลรายวันตามช่วง historyDays ที่เลือก รวมคอลัมน์ Lost Time", "Daily rows for the configured history window, including Lost Time columns", "選択した historyDays ウィンドウの毎日の行 (Lost Time 列を含む)")],
            [<code key="cur">tblSAMCurrent</code>, <code key="cur-p">current</code>, t3(locale, "Snapshot ล่าสุดของวันนี้ (realtime) พร้อม Lost Time ของวันนี้", "Today's latest realtime snapshot with today's Lost Time", "今日の Lost Time を含む今日の最新のリアルタイムスナップショット")],
          ]}
        />
        <Callout title={t3(locale, "Trigger mode", "Trigger mode", "トリガーモード")}>
          {t3x(locale, <>Excel export ใช้ <code>triggerMode: manual</code> — ไม่มี schedule อัตโนมัติจาก SAM Bridge; ผู้ใช้ดาวน์โหลดไฟล์หรือ Refresh Power Query เอง</>, <>Excel exports use <code>triggerMode: manual</code> — SAM Bridge does not schedule them; users download the workbook or refresh Power Query themselves.</>, <>Excel エクスポートは <code>triggerMode: manual</code> を使用します。SAM Bridge は自動スケジュールを行わず、ユーザーが手動でブックをダウンロードするか、Power Query を更新します。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="excel-flow">
        <Heading id="excel-flow">{t3(locale, "Data flow", "Data flow", "データフロー")}</Heading>
        <ol>
          <li>{t3(locale, "ตรวจ Bearer API key ของ export (timing-safe compare)", "Verify the export Bearer API key (timing-safe compare).", "エクスポートの Bearer API キーを検証します (タイミングセーフ比較)。")}</li>
          <li>{t3(locale, "อ่าน scope (groupUuids, lineUuids, allGroups, allLines) จาก export config", "Read scope (groupUuids, lineUuids, allGroups, allLines) from the export config.", "エクスポート設定からスコープ (groupUuids、lineUuids、allGroups、allLines) を読み取ります。")}</li>
          <li>{t3x(locale, <>ตาราง <code>production</code>: อ่าน iXacs ทีละวัน (historical) พร้อม daily cache; วันนี้ใช้ realtime</>, <>For <code>production</code>: read iXacs day-by-day (historical) with a daily cache; today uses realtime.</>, <><code>production</code> テーブル: iXacs を日次 (履歴) で読み取り、日次キャッシュを使用します。今日はリアルタイムを使用します。</>)}</li>
          <li>{t3x(locale, <>ตาราง <code>current</code>: อ่าน production ของวันนี้แบบ realtime (<code>fresh</code>)</>, <>For <code>current</code>: read today's production in realtime (<code>fresh</code>).</>, <><code>current</code> テーブル: 今日の生産をリアルタイム (<code>fresh</code>) で読み取ります。</>)}</li>
          <li>{t3(locale, "รวม Lost Time เป็นคอลัมน์แยกตาม topic (เช่น เครื่องจักรหยุด) และ Lost Time รวม", "Merge Lost Time into dynamic topic columns plus a total Lost Time column.", "Lost Time を動的なトピック列 (設備停止など) と合計 Lost Time 列に結合します。")}</li>
          <li>{t3(locale, "กรองแถวให้อยู่ใน scope ที่ wizard กำหนด", "Filter rows to the wizard-defined scope.", "ウィザードで定義されたスコープに行をフィルタリングします。")}</li>
          <li>{t3(locale, "ตอบ JSON { value: [...] } หรือสร้าง .xlsx ผ่าน download endpoint", "Return JSON { value: [...] } or build a .xlsx through the download endpoint.", "JSON { value: [...] } を返すか、ダウンロードエンドポイント経由で .xlsx を構築します。")}</li>
        </ol>
        <Callout title={t3(locale, "Cache", "Cache", "キャッシュ")}>
          {t3x(
            locale,
            <>Production รายวัน cache ใน memory และ <code>data/ixacs-excel-production-cache.json</code> — วันนี้ TTL 60 วินาที, historical 365 วัน; Lost Time วันนี้อ่านแบบ priority, วันอื่น warm ใน background</>,
            <>Daily production is cached in memory and <code>data/ixacs-excel-production-cache.json</code> — today TTL 60s, historical 365 days; today's Lost Time reads with priority, other dates warm in the background.</>,
            <>日次 Production はメモリおよび <code>data/ixacs-excel-production-cache.json</code> にキャッシュされます。今日の TTL は 60 秒、履歴は 365 日です。今日の Lost Time は優先的に読み取られ、他の日付はバックグラウンドでウォームアップされます。</>
          )}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="excel-api">
        <Heading id="excel-api">{t3(locale, "Excel API", "Excel API", "Excel API")}</Heading>
        <p>{t3x(locale, <>Endpoint หลัก: <code>GET /api/excel/exports/[exportId]</code> — ไม่ต้อง login SAM Bridge แต่ต้องมี Bearer key</>, <>Primary endpoint: <code>GET /api/excel/exports/[exportId]</code> — no SAM Bridge login, but a Bearer key is required.</>, <>主要なエンドポイント: <code>GET /api/excel/exports/[exportId]</code> — SAM Bridge へのログインは不要ですが、Bearer キーが必要です。</>)}</p>
        <CodeBlock code={EXCEL_REQUEST_EXAMPLE} locale={locale} />
        <Table
          headers={["Query", t3(locale, "ค่าเริ่มต้น", "Default", "デフォルト"), t3(locale, "ผลลัพธ์", "Result", "結果")]}
          rows={[
            [<em key="none">(none)</em>, "—", t3(locale, "metadata: รายชื่อ table, defaultDateFrom/To", "metadata: table list, defaultDateFrom/To", "メタデータ: テーブルリスト、defaultDateFrom/To")],
            [<code key="t-prod">table=production</code>, t3(locale, "ช่วง historyDays", "historyDays window", "historyDays ウィンドウ"), t3(locale, "tblSAMProduction rows", "tblSAMProduction rows", "tblSAMProduction 行")],
            [<code key="t-cur">table=current</code>, t3(locale, "วันนี้", "today", "今日"), t3(locale, "tblSAMCurrent rows (no-store cache)", "tblSAMCurrent rows (no-store cache)", "tblSAMCurrent 行 (no-store キャッシュ)")],
            [<code key="from">from / to</code>, <code key="iso">YYYY-MM-DD</code>, t3(locale, "override ช่วงวันที่ (สูงสุด 366 วัน)", "override date range (max 366 days)", "日付範囲のオーバーライド (最大 366 日)")],
          ]}
        />
        <h3>{t3(locale, "ดาวน์โหลด Workbook", "Workbook download", "ワークブックのダウンロード")}</h3>
        <p>{t3x(locale, <>หลัง login admin: <code>GET /api/exports/[exportId]/excel</code> สร้าง .xlsx จากตารางที่เปิดใช้ แล้วบันทึก <code>lastRunAt</code></>, <>After admin login: <code>GET /api/exports/[exportId]/excel</code> builds a .xlsx from enabled tables and records <code>lastRunAt</code>.</>, <>管理者ログイン後: <code>GET /api/exports/[exportId]/excel</code> は有効なテーブルから .xlsx を構築し、<code>lastRunAt</code> を記録します。</>)}</p>
      </section>

      <section className="docs-section" aria-labelledby="excel-response">
        <Heading id="excel-response">{t3(locale, "ตัวอย่าง Response", "Response example", "レスポンス例")}</Heading>
        <CodeBlock code={EXCEL_RESPONSE_EXAMPLE} locale={locale} />
        <p className="docs-footnote">
          {t3x(
            locale,
            <>ฟิลด์หลัก: วันที่, ไลน์ผลิต, สินค้า, แผน, ผลิตจริง, CT, Volume rate, Availability, เวลาทำงาน/หยุด และคอลัมน์ Lost Time ตาม topic</>,
            <>Core fields: date, line, product, plan, actual, CT, volume rate, availability, operating/stop time, and per-topic Lost Time columns.</>,
            <>主要フィールド: 日付、ライン、製品、計画、実績、CT、Volume rate、Availability、稼働時間/停止時間、およびトピックごとの Lost Time 列。</>
          )}
        </p>
      </section>

      <section className="docs-section" aria-labelledby="excel-workbook">
        <Heading id="excel-workbook">{t3(locale, "Workbook และ Refresh", "Workbook and refresh", "Workbook とリフレッシュ")}</Heading>
        <p>{t3(locale, "หลังบันทึก export หน้า Settings แสดง Power Query (M), VBA AutoRefresh และปุ่มดาวน์โหลด", "After saving, Settings shows Power Query (M), VBA AutoRefresh, and a download button.", "保存後、Settings には Power Query (M)、VBA AutoRefresh、およびダウンロードボタンが表示されます。")}</p>
        <CodeBlock code={EXCEL_POWER_QUERY_EXAMPLE} locale={locale} />
        <ul>
          <li>{t3(locale, "Power Query เรียก API ด้วย Bearer key ใน Header Authorization", "Power Query calls the API with the Bearer key in the Authorization header.", "Power Query は Authorization ヘッダーの Bearer キーを使用して API を呼び出します。")}</li>
          <li>{t3(locale, "AutoRefresh VBA ใช้รอบ 5/10/15 นาที — Excel ต้องเปิดอยู่", "AutoRefresh VBA uses 5/10/15-minute intervals — Excel must stay open.", "AutoRefresh VBA は 5/10/15 分の間隔を使用します。Excel を開いたままにする必要があります。")}</li>
          <li>{t3x(locale, <>ตาราง <code>current</code> ได้ cache-control no-store เพื่อ snapshot สดทุกครั้ง</>, <><code>current</code> responses use cache-control no-store for a fresh snapshot each time.</>, <><code>current</code> のレスポンスは cache-control no-store を使用して、常に最新のスナップショットを取得します。</>)}</li>
        </ul>
      </section>

      <section className="docs-section" aria-labelledby="excel-errors">
        <Heading id="excel-errors">{t3(locale, "Errors และ security", "Errors and security", "エラーとセキュリティ")}</Heading>
        <Table
          headers={[t3(locale, "HTTP / code", "HTTP / code", "HTTP / コード"), t3(locale, "สาเหตุ", "Cause", "原因")]}
          rows={[
            [<code key="401">401 INVALID_EXCEL_API_KEY</code>, t3(locale, "Bearer key ไม่ตรงหรือไม่มี", "Missing or wrong Bearer key", "Bearer キーがないか間違っています")],
            [<code key="404">404 EXCEL_EXPORT_NOT_FOUND</code>, t3(locale, "ไม่พบ export หรือ destination ไม่ใช่ excel", "Export missing or not an Excel destination", "エクスポートが見つからないか、Excel の出力先ではありません")],
            [<code key="400">400 INVALID_DATE_RANGE</code>, t3(locale, "from/to ไม่ถูกต้องหรือเกิน 366 วัน", "Invalid from/to or over 366 days", "from/to が無効か 366 日を超えています")],
            [<code key="404t">404 TABLE_NOT_ENABLED</code>, t3(locale, "table ไม่ได้เปิดใน excelSettings.tables", "Table not enabled in excelSettings.tables", "excelSettings.tables でテーブルが有効になっていません")],
            [<code key="502">502 IXACS_READ_FAILED</code>, t3(locale, "อ่าน iXacs ไม่สำเร็จ; response อาจมี partial: true และ warnings[]", "iXacs read failed; response may include partial: true and warnings[]", "iXacs の読み取りに失敗しました。レスポンスには partial: true と warnings[] が含まれる場合があります")],
          ]}
        />
        <Callout title={t3(locale, "API key", "API key", "API キー")} tone="warning">
          {t3(
            locale,
            "Excel API key ออกแยกต่อ export และเก็บเข้ารหัสใน Supabase (หรือ local file) — หมุน key ได้จากหน้า export editor",
            "Each export gets its own encrypted Excel API key in Supabase (or local storage). Rotate it from the export editor.",
            "各エクスポートには Supabase (またはローカルストレージ) に暗号化された固有の Excel API キーがあります。エクスポートエディタからローテーションできます。"
          )}
        </Callout>
      </section>
    </>
  );
}

function SapIntegrationArticle({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="docs-section" aria-labelledby="sap-overview">
        <Heading id="sap-overview">{t3(locale, "ภาพรวม", "Overview", "概要")}</Heading>
        <p className="docs-lead">
          {t3x(
            locale,
            <>หน้า <code>/settings/exports</code> รองรับ destination <strong>SAP OData</strong> สำหรับดึง Production Order, map กับข้อมูล iXacs และจำลอง Production Order Confirmation — ใน implementation ปัจจุบัน <strong>ยังไม่ POST ไป SAP จริง</strong></>,
            <><code>/settings/exports</code> supports an <strong>SAP OData</strong> destination to load Production Orders, map them to iXacs data, and simulate Production Order Confirmation. The current implementation <strong>does not POST to SAP</strong>.</>,
            <><code>/settings/exports</code> は <strong>SAP OData</strong> 出力先をサポートし、Production Order のロード、iXacs データとのマッピング、および Production Order Confirmation のシミュレーションを行います。現在の実装では <strong>SAP への実際の POST は行いません</strong>。</>
          )}
        </p>
        <div className="docs-flow">
          <code>Export wizard</code><i>→</i><code>SAP connection</code><i>→</i><code>Production Orders</code><i>→</i><code>Mapping</code><i>→</i><code>Simulation</code>
        </div>
        <Callout title={t3(locale, "Simulation only", "Simulation only", "シミュレーションのみ")} tone="warning">
          {t3x(
            locale,
            <>Route <code>POST /api/exports/sap/[id]/confirm</code> ใช้ SimulationTransport เท่านั้น — สร้าง payload ตาม SAP ProdnOrdConf2 แล้วบันทึก activity โดยไม่เรียก SAP production</>,
            <><code>POST /api/exports/sap/[id]/confirm</code> uses SimulationTransport only — it builds a ProdnOrdConf2 payload and records activity without calling SAP production.</>,
            <><code>POST /api/exports/sap/[id]/confirm</code> ルートは SimulationTransport のみを使用します。SAP ProdnOrdConf2 に基づいてペイロードを構築し、SAP プロダクションを呼び出さずにアクティビティを記録します。</>
          )}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="sap-connection">
        <Heading id="sap-connection">{t3(locale, "Connection และ Test", "Connection and test", "接続とテスト")}</Heading>
        <p>{t3(locale, "Wizard ขั้น Destination ให้กรอก SAP Service URL และ API Key แล้วทดสอบก่อนบันทึก", "The destination step collects the SAP Service URL and API key, then tests before saving.", "出力先のステップでは、SAP Service URL と API キーを収集し、保存する前にテストを行います。")}</p>
        <Table
          headers={[t3(locale, "Field", "Field", "フィールド"), t3(locale, "กติกา", "Rule", "ルール")]}
          rows={[
            [<code key="url">serviceUrl</code>, t3(locale, "URL ของ SAP API (Production Order)", "SAP API URL (Production Order)", "SAP API URL (Production Order)")],
            [<code key="key">apiKey</code>, t3(locale, "ส่งใน header APIKey", "Sent in the APIKey header", "APIKey ヘッダーで送信")],
            [<code key="name">name / environment</code>, t3(locale, "metadata สำหรับแสดงใน UI", "Metadata for UI display", "UI 表示用のメタデータ")],
          ]}
        />
        <ol>
          <li>{t3x(locale, <>Client ส่ง <code>POST /api/exports/sap</code> พร้อม serviceUrl และ apiKey</>, <>The client POSTs to <code>POST /api/exports/sap</code> with serviceUrl and apiKey.</>, <>クライアントは serviceUrl と apiKey を使用して <code>POST /api/exports/sap</code> に送信します。</>)}</li>
          <li>{t3x(locale, <>Server เรียก <code>GET /ProductionOrder</code> ผ่าน SAP client (timeout 20s)</>, <>The server calls <code>GET /ProductionOrder</code> through the SAP client (20s timeout).</>, <>サーバーは SAP クライアントを通じて <code>GET /ProductionOrder</code> を呼び出します (タイムアウト 20 秒)。</>)}</li>
          <li>{t3(locale, "ถ้าสำเร็จ บันทึก connection เข้ารหัสและคืน public connection (keyLast4, connected)", "On success, persist an encrypted connection and return a public connection (keyLast4, connected).", "成功した場合、暗号化された接続を保存し、パブリックな接続 (keyLast4, connected) を返します。")}</li>
          <li>{t3(locale, "Export config เก็บ sapConnectionId อ้างอิง connection นี้", "The export config stores sapConnectionId referencing this connection.", "エクスポート設定はこの接続を参照する sapConnectionId を保存します。")}</li>
        </ol>
      </section>

      <section className="docs-section" aria-labelledby="sap-orders">
        <Heading id="sap-orders">{t3(locale, "Production Orders", "Production Orders", "生産指図")}</Heading>
        <p>{t3x(locale, <>หลังเชื่อมต่อแล้ว Mapping step โหลดรายการ order จาก <code>GET /api/exports/sap/[connectionId]/orders?q=</code></>, <>After connecting, the mapping step loads orders from <code>GET /api/exports/sap/[connectionId]/orders?q=</code>.</>, <>接続後、マッピングステップは <code>GET /api/exports/sap/[connectionId]/orders?q=</code> からオーダーのリストを読み込みます。</>)}</p>
        <CodeBlock code={SAP_ORDER_RESPONSE_EXAMPLE} locale={locale} />
        <p>{t3(locale, "SAP client แปลง OData response เป็นรูปแบบมาตรฐาน:", "The SAP client normalizes OData into:", "SAP クライアントは OData レスポンスを標準形式に変換します:")}</p>
        <CodeBlock code={SAP_MAPPED_ORDER_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Field", "Field", "フィールド"), t3(locale, "แหล่ง SAP (typical)", "Typical SAP source", "一般的な SAP ソース")]}
          rows={[
            [<code key="id">id</code>, "ProductionOrder"],
            [<code key="prod">product</code>, "Product / Material"],
            [<code key="plant">plant</code>, "ProductionPlant"],
            [<code key="qty">plannedQty</code>, "PlannedTotalQty"],
            [<code key="unit">unit</code>, "ProductionUnit"],
          ]}
        />
        <Callout title={t3(locale, "การค้นหา", "Search", "検索")}>
          {t3(locale, "พารามิเตอร์ q กรอง order id หรือ product ใน client-side search ของ wizard", "The q parameter filters order id or product in the wizard client-side search.", "q パラメータはウィザードのクライアント側検索で order id または product をフィルタリングします。")}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="sap-response">
        <Heading id="sap-response">{t3(locale, "ตัวอย่าง SAP Response", "SAP response handling", "SAP レスポンスの処理")}</Heading>
        <p>{t3(locale, "ถ้า SAP ตอบ HTML หรือ JSON error ระบบ parse ข้อความจาก error.message, details หรือ message แล้วแสดงใน UI", "When SAP returns HTML or JSON errors, the server parses error.message, details, or message for the UI.", "SAP が HTML または JSON エラーを返した場合、システムは error.message、details、または message からテキストを解析して UI に表示します。")}</p>
        <ul>
          <li>{t3(locale, "HTTP 4xx/5xx จาก SAP ส่งต่อพร้อม httpStatus และ error message", "SAP HTTP 4xx/5xx responses include httpStatus and an error message.", "SAP からの HTTP 4xx/5xx レスポンスには httpStatus とエラーメッセージが含まれます。")}</li>
          <li>{t3(locale, "API key ถูก redact จาก error text ใน log", "API keys are redacted from error text in logs.", "ログのエラーテキストから API キーは墨塗りされます。")}</li>
          <li>{t3(locale, "lastTestedAt, lastHttpStatus, lastResponseTimeMs บันทึกหลังทุกครั้งที่ test", "lastTestedAt, lastHttpStatus, and lastResponseTimeMs are recorded after every test.", "lastTestedAt、lastHttpStatus、および lastResponseTimeMs はすべてのテストの後に記録されます。")}</li>
        </ul>
      </section>

      <section className="docs-section" aria-labelledby="sap-mapping">
        <Heading id="sap-mapping">{t3(locale, "Mapping", "Mapping", "マッピング")}</Heading>
        <p>{t3(locale, "Wizard โหลด sample production row จาก iXacs connection ที่เลือก แล้วให้เลือก Production Order และหน่วย (Confirmation unit)", "The wizard loads a sample iXacs production row from the selected connection, then lets you pick a Production Order and confirmation unit.", "ウィザードは選択した接続からサンプルの iXacs 生産行を読み込み、Production Order と単位 (Confirmation unit) を選択させます。")}</p>
        <Table
          headers={["iXacs sample", t3(locale, "ใช้สำหรับ", "Used for", "用途")]}
          rows={[
            [<code key="line">productionLineName</code>, t3(locale, "แสดงบริบทไลน์", "Line context display", "ラインコンテキストの表示")],
            [<code key="product">product</code>, t3(locale, "เปรียบเทียบกับ SAP Product", "Compare with SAP Product", "SAP Product と比較")],
            [<code key="actual">actualNum</code>, t3(locale, "Yield quantity ใน confirmation simulation", "Yield quantity in confirmation simulation", "確認シミュレーションでの Yield quantity")],
            [<code key="time">bizTime / collectedAt</code>, t3(locale, "Timestamp ตัวอย่าง", "Sample timestamp", "サンプルのタイムスタンプ")],
          ]}
        />
        <p>{t3(locale, "ก่อนบันทึก export ต้อง validate mapping สำเร็จ (sapMappingValidated: true) — ตรวจ order id, actual > 0, unit และ payload ที่ build ได้", "Before saving, mapping validation must succeed (sapMappingValidated: true) — checking order id, actual > 0, unit, and buildable payload.", "保存する前に、マッピングの検証を成功させる必要があります (sapMappingValidated: true)。order id、actual > 0、unit、および構築可能なペイロードをチェックします。")}</p>
        <Callout title={t3(locale, "Action ที่รองรับ", "Supported action", "サポートされるアクション")}>
          {t3x(locale, <>ปัจจุบน wizard เปิดใช้เฉพาะ <code>production-result</code> (custom-mapping ยังไม่พร้อมใน flow)</>, <>The wizard currently enables only <code>production-result</code> (custom-mapping is not ready in the flow).</>, <>現在のウィザードでは <code>production-result</code> のみが有効です (custom-mapping はフロー内でまだ準備されていません)。</>)}
        </Callout>
      </section>

      <section className="docs-section" aria-labelledby="sap-confirmation">
        <Heading id="sap-confirmation">{t3(locale, "Confirmation simulation", "Confirmation simulation", "確認シミュレーション")}</Heading>
        <p>{t3(locale, "Send dialog เรียก confirm endpoint เพื่อ preview หรือ simulate:", "The send dialog calls the confirm endpoint to preview or simulate:", "Send ダイアログは confirm エンドポイントを呼び出してプレビューまたはシミュレーションを行います:")}</p>
        <CodeBlock code={SAP_CONFIRMATION_EXAMPLE} locale={locale} />
        <CodeBlock code={SAP_CONFIRMATION_RESPONSE_EXAMPLE} locale={locale} />
        <Table
          headers={[t3(locale, "Payload field", "Payload field", "ペイロードフィールド"), t3(locale, "ที่มา", "Source", "ソース")]}
          rows={[
            [<code key="oid">OrderID</code>, t3(locale, "Production Order ที่เลือก", "Selected Production Order", "選択した Production Order")],
            [<code key="yield">ConfirmationYieldQuantity</code>, t3(locale, "actualNum จาก iXacs sample", "actualNum from iXacs sample", "iXacs サンプルからの actualNum")],
            [<code key="unit">ConfirmationUnit / ISO</code>, t3(locale, "หน่วยที่เลือก (map เป็น ISO เช่น PC → PCE)", "Selected unit (mapped to ISO, e.g. PC → PCE)", "選択した単位 (ISO にマップ、例: PC → PCE)")],
            [<code key="gm">APIConfHasNoGoodsMovements</code>, t3(locale, "คงที่ true", "Always true", "常に true")],
          ]}
        />
        <ul>
          <li>{t3x(locale, <><code>previewOnly: true</code> — คืน payload โดยไม่บันทึก activity</>, <><code>previewOnly: true</code> — returns the payload without recording activity</>, <><code>previewOnly: true</code> — アクティビティを記録せずにペイロードを返します</>)}</li>
          <li>{t3(locale, "Simulation บันทึก export activity พร้อม transactionId และ mode: simulation", "Simulation records export activity with transactionId and mode: simulation", "シミュレーションは transactionId と mode: simulation とともにエクスポートアクティビティを記録します")}</li>
          <li>{t3(locale, "เปลี่ยน source connection ใน wizard จะลบ SAP connection ชั่วคราวที่ผูกไว้", "Changing the source connection in the wizard clears the linked SAP connection draft.", "ウィザードでソース接続を変更すると、リンクされた SAP 接続のドラフトがクリアされます。")}</li>
        </ul>
      </section>

      <section className="docs-section" aria-labelledby="sap-security">
        <Heading id="sap-security">{t3(locale, "Errors และ security", "Errors and security", "エラーとセキュリティ")}</Heading>
        <Table
          headers={[t3(locale, "HTTP / code", "HTTP / code", "HTTP / コード"), t3(locale, "สาเหตุ", "Cause", "原因")]}
          rows={[
            [<code key="400url">400 SERVICE_URL_REQUIRED</code>, t3(locale, "ไม่ได้ใส่ SAP URL", "Missing SAP URL", "SAP URL がありません")],
            [<code key="400key">400 API_KEY_REQUIRED</code>, t3(locale, "ไม่ได้ใส่ API key", "Missing API key", "API キーがありません")],
            [<code key="404">404 NOT_FOUND</code>, t3(locale, "ไม่พบ SAP connection", "SAP connection not found", "SAP 接続が見つかりません")],
            [<code key="400o">400 ORDER_ID_REQUIRED</code>, t3(locale, "Payload confirmation ไม่ครบ", "Incomplete confirmation payload", "不完全な確認ペイロード")],
            [<code key="502">502</code>, t3(locale, "SAP Production Order API ล้มเหลว", "SAP Production Order API failed", "SAP Production Order API が失敗しました")],
          ]}
        />
        <Callout title={t3(locale, "Secrets", "Secrets", "シークレット")} tone="warning">
          {t3(
            locale,
            "SAP API key เก็บเข้ารหัส (Supabase หรือ data/sap-connections.json) — public API ส่งเฉพาะ keyLast4",
            "SAP API keys are stored encrypted (Supabase or data/sap-connections.json) — public APIs expose only keyLast4.",
            "SAP API キーは暗号化されて保存されます (Supabase または data/sap-connections.json)。パブリック API は keyLast4 のみを公開します。"
          )}
        </Callout>
      </section>
    </>
  );
}

export function IxacsSetupFlow({ docSlug = "ixacs-connection" }: { docSlug?: DocsSlug }) {
  const { locale } = useLocale();
  const doc = DOCS.find((item) => item.slug === docSlug) ?? DOCS[0];
  const [activeSection, setActiveSection] = useState(doc.sections[0].id);
  const visibleSection = doc.sections.some((item) => item.id === activeSection) ? activeSection : doc.sections[0].id;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-14% 0px -70%", threshold: [0, 0.2, 0.5] }
    );
    for (const item of doc.sections) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [doc]);

  const actionHref =
    doc.slug === "push-api"
      ? PUSH_API_URL
      : doc.slug === "lost-time"
        ? LOST_TIME_URL
        : doc.slug === "data-explorer"
          ? DATA_EXPLORER_URL
          : doc.slug === "excel-exports" || doc.slug === "sap-integration"
            ? EXPORTS_URL
            : "/settings";

  const actionLabel =
    doc.slug === "push-api"
      ? t3(locale, "เปิด Push API", "Open Push API", "Push API を開く")
      : doc.slug === "lost-time"
        ? t3(locale, "เปิด Lost Time", "Open Lost Time", "Lost Time を開く")
        : doc.slug === "data-explorer"
          ? t3(locale, "เปิด Data Explorer", "Open Data Explorer", "Data Explorer を開く")
          : doc.slug === "excel-exports" || doc.slug === "sap-integration"
            ? t3(locale, "เปิด Exports", "Open Exports", "エクスポートを開く")
            : t3(locale, "เปิด Settings", "Open Settings", "設定を開く");

  const article =
    doc.slug === "push-api" ? (
      <PushApiArticle locale={locale} />
    ) : doc.slug === "lost-time" ? (
      <LostTimeArticle locale={locale} />
    ) : doc.slug === "data-explorer" ? (
      <DataExplorerArticle locale={locale} />
    ) : doc.slug === "excel-exports" ? (
      <ExcelExportsArticle locale={locale} />
    ) : doc.slug === "sap-integration" ? (
      <SapIntegrationArticle locale={locale} />
    ) : (
      <SetupArticle locale={locale} />
    );

  return (
    <div className="docs-page-shell">
      <div className="docs-mobile-nav">
        {DOCS.map((item) => (
          <Link
            key={item.slug}
            href={item.slug === "ixacs-connection" ? "/how-it-works" : `/how-it-works/${item.slug}`}
            className={item.slug === doc.slug ? "is-active" : undefined}
          >
            {text(item, locale)}
          </Link>
        ))}
      </div>
      <div className="docs-layout-grid">
        <DocsMenu active={doc.slug} locale={locale} />
        <main className="docs-main">
          <header className="docs-header-banner">
            <h1>{text(doc, locale)}</h1>
            <Link href={actionHref} className="docs-open-link">
              {actionLabel}
              <FiArrowUpRight size={15} />
            </Link>
          </header>
          <article className="docs-article">{article}</article>
        </main>
        <aside className="docs-toc-col">
          <nav aria-label={t3(locale, "สารบัญ", "Table of contents", "目次")}>
            {doc.sections.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={visibleSection === item.id ? "is-active" : undefined}
                onClick={() => setActiveSection(item.id)}
              >
                {text(item, locale)}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
