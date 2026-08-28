"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { useLocale } from "../../locale-context";
import type { Connection } from "../connections/types";
import { DEST_ICONS } from "./destination-icons";
import { EXPORT_COPY, SAP_COPY, WIZARD_COPY } from "./copy";
import { SapDestinationPanel } from "./sap-destination";
import { buildProductionConfirmationPayload } from "@/lib/sap-confirmation";
import { mappingIssues, sampleFrom, SapMappingStep } from "./sap-mapping";
import { SapSendDialog } from "./sap-send-dialog";
import {
  DESTINATION_GROUPS,
  DESTINATIONS,
  FIELD_PRESETS,
  FIELD_SECTIONS,
  WIZARD_DESTINATIONS,
  WIZARD_SECTION_META,
  DEFAULT_POWER_BI_SETTINGS,
  DEFAULT_EXCEL_SETTINGS,
  type AlertRule,
  type DataPreset,
  type DestinationType,
  type ExportConfig,
  type ExportFormat,
  type PublicSapConnection,
  type PowerBiDataset,
  type PowerBiSettings,
  type ExcelSettings,
  type ExcelTable,
  type ScopeMode,
  type SourceGroup,
  type WizardStep,
} from "./types";

type DraftForm = Omit<
  ExportConfig,
  | "id"
  | "status"
  | "endpointConfigured"
  | "lastRunAt"
  | "lastRunStatus"
  | "lastRunError"
  | "createdAt"
  | "updatedAt"
  | "sapConnection"
>;
type WizardCopy = (typeof WIZARD_COPY)[keyof typeof WIZARD_COPY];
type AuthMode = "none" | "api-key" | "bearer";
type HttpMethod = "POST" | "GET" | "PUT";
type OpenMenu = "auth" | "method" | null;

const STEPS: WizardStep[] = [2, 0, 1, 3, 4];
const BASIC_STEPS: WizardStep[] = [2, 0, 1, 4];

const POWER_BI_COPY = {
  th: { modelTitle: "เลือกข้อมูลสำหรับ Power BI", modelHelp: "เลือกตารางและช่วงข้อมูลที่ต้องการนำไปสร้างรายงาน", production: "Production daily", productionHelp: "แผน ผลผลิตจริง Cycle Time และ Availability แยกตามวันและไลน์", lostTime: "Lost Time daily", lostTimeHelp: "เวลาสูญเสียและจำนวนครั้ง แยกตามวัน ไลน์ และสาเหตุ", tables: "ตารางข้อมูล", dimensions: "มิติข้อมูล", line: "Production Line", lineHelp: "ชื่อ กลุ่ม และรหัสของสายการผลิต", date: "Date", dateHelp: "วันที่ เดือน ไตรมาส และปี สำหรับ Time intelligence", history: "ช่วงข้อมูลย้อนหลัง", days: "วัน", recommended: "แนะนำ", grain: "ระดับรายละเอียด", grainValue: "รายวัน · แยกตาม Production Line", setupTitle: "รูปแบบการเชื่อมต่อ Power BI", setupHelp: "Power BI ดึงตารางที่เลือกผ่าน Power Query และ Refresh ผ่าน Gateway ได้", method: "วิธีรับข้อมูล", methodValue: "Power Query (Web API)", refresh: "การ Refresh", refreshValue: "Power BI Desktop หรือ On-premises data gateway", credentials: "การยืนยันตัวตน", credentialsValue: "Bearer API key แยกสำหรับ Export นี้", chooseDataset: "เลือกตาราง Power BI อย่างน้อย 1 ตาราง", model: "Power BI data model" },
  en: { modelTitle: "Choose data for Power BI", modelHelp: "Select the tables and history window for your report model.", production: "Production daily", productionHelp: "Plan, actual, cycle time, and availability by date and production line.", lostTime: "Lost Time daily", lostTimeHelp: "Lost minutes and occurrences by date, line, and cause.", tables: "Data tables", dimensions: "Dimensions", line: "Production Line", lineHelp: "Line identifiers, names, and production groups.", date: "Date", dateHelp: "Date, month, quarter, and year for time intelligence.", history: "History window", days: "days", recommended: "Recommended", grain: "Data grain", grainValue: "Daily · by production line", setupTitle: "Power BI connection", setupHelp: "Power BI pulls the selected tables through Power Query and can refresh through a gateway.", method: "Data access", methodValue: "Power Query (Web API)", refresh: "Refresh", refreshValue: "Power BI Desktop or on-premises data gateway", credentials: "Authentication", credentialsValue: "A dedicated Bearer API key for this export", chooseDataset: "Choose at least one Power BI table", model: "Power BI data model" },
  ja: { modelTitle: "Power BI用データを選択", modelHelp: "レポートモデルで使用するテーブルと履歴期間を選択します。", production: "Production daily", productionHelp: "日付・ライン別の計画、実績、Cycle Time、Availability。", lostTime: "Lost Time daily", lostTimeHelp: "日付・ライン・原因別のLost Timeと発生回数。", tables: "データテーブル", dimensions: "ディメンション", line: "Production Line", lineHelp: "ラインID、名称、Production Group。", date: "Date", dateHelp: "Time intelligence用の日付、月、四半期、年。", history: "履歴期間", days: "日", recommended: "推奨", grain: "粒度", grainValue: "日次・Production Line別", setupTitle: "Power BI接続", setupHelp: "Power Queryで選択したテーブルを取得し、Gateway経由で更新できます。", method: "データ取得", methodValue: "Power Query (Web API)", refresh: "更新", refreshValue: "Power BI Desktopまたはオンプレミスデータゲートウェイ", credentials: "認証", credentialsValue: "Export専用Bearer API key", chooseDataset: "Power BIテーブルを1つ以上選択してください", model: "Power BI data model" },
} as const;

const POWER_BI_SAVE_COPY = {
  th: { save: "บันทึกและเปิดใช้งาน Power BI", saving: "กำลังเปิดใช้งาน…" },
  en: { save: "Save and enable Power BI", saving: "Enabling…" },
  ja: { save: "保存してPower BIを有効化", saving: "有効化中…" },
} as const;

const EXCEL_COPY = {
  th: { modelTitle: "เลือกข้อมูลสำหรับ Excel", modelHelp: "ข้อมูลจะถูกโหลดเข้า Excel Table ผ่าน Power Query โดยไม่แก้ Form หรือ Macro เดิม", setupTitle: "การเชื่อมต่อ Microsoft Excel", setupHelp: "ใช้ได้กับไฟล์ .xlsx และ .xlsm ผ่าน Power Query", method: "วิธีรับข้อมูล", methodValue: "Power Query (Web API)", refresh: "Refresh อัตโนมัติ", credentials: "การยืนยันตัวตน", credentialsValue: "Bearer API key แยกสำหรับ Export นี้", refreshTitle: "รอบการอัปเดตใน Excel", minutes: "นาที", workbookNote: "Excel ต้องเปิดอยู่จึงจะ Refresh ตามรอบได้", chooseDataset: "เลือกตาราง Excel อย่างน้อย 1 ตาราง", save: "บันทึกและเปิดใช้งาน Excel", saving: "กำลังเปิดใช้งาน…", api: "Excel API", query: "Power Query (M)", copyQuery: "คัดลอก Power Query", copyVba: "คัดลอก VBA AutoRefresh", install: "วางโค้ดใน Excel → Data → Get Data → Blank Query → Advanced Editor แล้วเลือก Close & Load To… เพื่อโหลดลงชีตข้อมูล", tableName: "ชื่อตารางใน Excel", model: "Excel Power Query tables", selectTables: "เลือกตารางที่จะใช้", historyTable: "ข้อมูลย้อนหลังถึงปัจจุบัน", historyHelp: "ข้อมูลรายวันตามช่วงย้อนหลังที่เลือก", currentTable: "ข้อมูลปัจจุบัน", currentHelp: "Snapshot ล่าสุดเหมือนหน้า Realtime ทุกครั้งที่ Refresh", autoRefresh: "เปิด AutoRefresh ขณะ Excel เปิดอยู่" },
  en: { modelTitle: "Choose data for Excel", modelHelp: "Data loads into Excel tables through Power Query without changing existing forms or macros.", setupTitle: "Microsoft Excel connection", setupHelp: "Works with .xlsx and .xlsm workbooks through Power Query.", method: "Data access", methodValue: "Power Query (Web API)", refresh: "Automatic refresh", credentials: "Authentication", credentialsValue: "A dedicated Bearer API key for this export", refreshTitle: "Excel refresh interval", minutes: "minutes", workbookNote: "The workbook must be open for interval refresh.", chooseDataset: "Choose at least one Excel table", save: "Save and enable Excel", saving: "Enabling…", api: "Excel API", query: "Power Query (M)", copyQuery: "Copy Power Query", copyVba: "Copy AutoRefresh VBA", install: "In Excel, open Data → Get Data → Blank Query → Advanced Editor, paste the code, then use Close & Load To…", tableName: "Excel table name", model: "Excel Power Query tables", selectTables: "Choose Excel tables", historyTable: "History through today", historyHelp: "Daily records for the selected history window.", currentTable: "Current production", currentHelp: "Latest snapshot matching the Realtime page on every refresh.", autoRefresh: "Enable AutoRefresh while Excel is open" },
  ja: { modelTitle: "Excel用データを選択", modelHelp: "既存のフォームやマクロを変更せず、Power QueryでExcel Tableに読み込みます。", setupTitle: "Microsoft Excel接続", setupHelp: ".xlsxと.xlsmをPower Queryで接続できます。", method: "データ取得", methodValue: "Power Query (Web API)", refresh: "自動更新", credentials: "認証", credentialsValue: "Export専用Bearer API key", refreshTitle: "Excel更新間隔", minutes: "分", workbookNote: "定期更新にはExcelを開いておく必要があります。", chooseDataset: "Excelテーブルを1つ以上選択してください", save: "保存してExcelを有効化", saving: "有効化中…", api: "Excel API", query: "Power Query (M)", copyQuery: "Power Queryをコピー", copyVba: "AutoRefresh VBAをコピー", install: "Excelの Data → Get Data → Blank Query → Advanced Editor に貼り付け、Close & Load To…を選択します。", tableName: "Excelテーブル名", model: "Excel Power Query tables", selectTables: "Excelテーブルを選択", historyTable: "履歴から現在まで", historyHelp: "選択した期間の日次データ。", currentTable: "現在の生産データ", currentHelp: "更新時にRealtime画面と同じ最新Snapshotを取得。", autoRefresh: "Excelを開いている間AutoRefreshを有効化" },
} as const;

const SLACK_COPY = {
  th: {
    ready: "พร้อมส่ง",
    save: "บันทึกการเชื่อมต่อ Slack",
    saving: "กำลังบันทึก…",
    createTitle: "ตั้งค่าการส่งข้อมูล",
    editTitle: "แก้ไขการส่งข้อมูล",
    layout: "Slack KPI Message",
    layoutHelp: "จัดข้อความให้อ่านง่ายอัตโนมัติด้วย Block Kit พร้อมชื่อ Line, ค่า KPI และหน่วย",
    stored: "บันทึก Webhook URL แล้ว — เว้นว่างไว้เพื่อใช้ URL เดิม",
    help: "Slack Incoming Webhook เป็นความลับ ระบบจะเก็บไว้ฝั่ง Server และไม่แสดงอีกหลังบันทึก",
    invalid: "กรอก Slack Incoming Webhook URL ที่ขึ้นต้นด้วย https://hooks.slack.com/services/",
  },
  en: {
    ready: "Ready",
    save: "Save Slack connection",
    saving: "Saving…",
    createTitle: "Configure data export",
    editTitle: "Edit data export",
    layout: "Slack KPI Message",
    layoutHelp: "Automatically formats line names and selected KPIs with readable labels and units.",
    stored: "Webhook URL saved — leave blank to keep the current URL",
    help: "The Incoming Webhook is stored server-side and is hidden after saving.",
    invalid: "Enter a Slack Incoming Webhook URL beginning with https://hooks.slack.com/services/",
  },
  ja: {
    ready: "送信可能",
    save: "Slack接続を保存",
    saving: "保存中…",
    createTitle: "データ出力を設定",
    editTitle: "データ出力を編集",
    layout: "Slack KPI Message",
    layoutHelp: "Line名、選択したKPI、単位をBlock Kitで読みやすく表示します。",
    stored: "Webhook URLは保存済みです。空欄のままで現在のURLを使用します",
    help: "Incoming Webhookはサーバー側に保存され、保存後は表示されません。",
    invalid: "https://hooks.slack.com/services/ で始まるSlack Incoming Webhook URLを入力してください",
  },
} as const;

const DATA_STEP_COPY = {
  th: {
    presetTitle: "1. เลือกชุดข้อมูล",
    presetHelp: "เริ่มจากชุดที่เตรียมไว้ หรือเลือก Custom หากต้องการกำหนดฟิลด์เอง",
    recommended: "แนะนำสำหรับเริ่มต้น",
    selected: (count: number) => `ระบบจะส่ง ${count} ฟิลด์`,
    alertTitle: "2. ต้องการส่งเมื่อ KPI ผิดปกติหรือไม่?",
    alertHelp: "ไม่บังคับ — หากไม่เลือก ระบบจะส่งตาม Trigger ที่ตั้งไว้ในขั้นถัดไป",
    noAlert: "ยังไม่ตั้งเงื่อนไข",
    noAlertHelp: "ข้อมูลจะไม่ถูกกรองด้วย KPI",
    chooseEvent: "เพิ่มเหตุการณ์ที่ต้องการเฝ้าระวัง",
    currentCt: "รอบการผลิตช้ากว่ามาตรฐาน",
    currentCtHelp: "เมื่อ Current CT สูงกว่า Base CT",
    volume: "ยอดผลิตต่ำหรือสูงกว่าเกณฑ์",
    volumeHelp: "ตรวจจาก Volume Rate (%)",
    availability: "เวลาพร้อมผลิตต่ำหรือสูงกว่าเกณฑ์",
    availabilityHelp: "ตรวจจาก Availability (%)",
    threshold: "ค่าเกณฑ์ (%)",
    occurrences: "เกิดติดต่อกัน",
    times: "ครั้ง",
    remove: "ลบเงื่อนไข",
    operator: "เงื่อนไข",
    below: "ต่ำกว่า",
    above: "สูงกว่า",
  },
  en: {
    presetTitle: "1. Choose a data set",
    presetHelp: "Start with a prepared set, or choose Custom to select individual fields.",
    recommended: "Recommended to start",
    selected: (count: number) => `${count} fields will be sent`,
    alertTitle: "2. Send only when a KPI needs attention?",
    alertHelp: "Optional — without a condition, data follows the trigger configured in the next step.",
    noAlert: "No conditions yet",
    noAlertHelp: "Data will not be filtered by KPI.",
    chooseEvent: "Add an event to monitor",
    currentCt: "Production cycle is slower than standard",
    currentCtHelp: "Current CT is above Base CT",
    volume: "Production volume crosses a threshold",
    volumeHelp: "Based on Volume Rate (%)",
    availability: "Availability crosses a threshold",
    availabilityHelp: "Based on Availability (%)",
    threshold: "Threshold (%)",
    occurrences: "Consecutive",
    times: "times",
    remove: "Remove condition",
    operator: "Condition",
    below: "Below",
    above: "Above",
  },
  ja: {
    presetTitle: "1. データセットを選択",
    presetHelp: "用意されたセットから始めるか、Customで個別のフィールドを選択します。",
    recommended: "最初におすすめ",
    selected: (count: number) => `${count}フィールドを送信`,
    alertTitle: "2. KPI異常時のみ送信しますか？",
    alertHelp: "任意 — 条件がない場合は次のステップで設定するTriggerに従います。",
    noAlert: "条件は未設定です",
    noAlertHelp: "KPIによるデータの絞り込みは行いません。",
    chooseEvent: "監視するイベントを追加",
    currentCt: "生産サイクルが基準より遅い",
    currentCtHelp: "Current CTがBase CTを超えた場合",
    volume: "生産量がしきい値を超えた場合",
    volumeHelp: "Volume Rate (%)で判定",
    availability: "稼働率がしきい値を超えた場合",
    availabilityHelp: "Availability (%)で判定",
    threshold: "しきい値 (%)",
    occurrences: "連続回数",
    times: "回",
    remove: "条件を削除",
    operator: "条件",
    below: "未満",
    above: "超過",
  },
} as const;

const VALIDATION_COPY = {
  th: {
    name: "กรอกชื่อ Data Export",
    connection: "เลือก iXacs Connection",
    scope: "เลือก Production Group อย่างน้อย 1 กลุ่ม",
    fields: "เลือกข้อมูลที่จะส่งอย่างน้อย 1 ฟิลด์",
    destination: "เลือกปลายทางที่จะส่งข้อมูล",
    endpoint: "กรอกข้อมูลการเชื่อมต่อของปลายทาง",
    slackRule: "เพิ่มเงื่อนไข KPI อย่างน้อย 1 เงื่อนไขสำหรับ Slack",
  },
  en: {
    name: "Enter a data export name",
    connection: "Choose an iXacs connection",
    scope: "Choose at least one production group",
    fields: "Choose at least one field to send",
    destination: "Choose a destination",
    endpoint: "Enter the destination connection details",
    slackRule: "Add at least one KPI condition for Slack",
  },
  ja: {
    name: "Data Export名を入力してください",
    connection: "iXacs Connectionを選択してください",
    scope: "Production Groupを1つ以上選択してください",
    fields: "送信するフィールドを1つ以上選択してください",
    destination: "出力先を選択してください",
    endpoint: "出力先の接続情報を入力してください",
    slackRule: "Slack用のKPI条件を1つ以上追加してください",
  },
} as const;

const INITIAL_DRAFT: DraftForm = {
  name: "",
  description: "",
  sourceConnectionId: "",
  groupUuids: [],
  lineUuids: [],
  allGroups: true,
  allLines: true,
  fields: [...FIELD_PRESETS.summary],
  destinationType: "rest",
  destinationName: "",
  endpoint: "",
  sapConnectionId: "",
  sapAction: "production-result",
  sapOrder: null,
  sapMappingValidated: false,
  sapConfirmationUnit: "PC",
  format: "canonical-json",
  triggerMode: "manual",
  intervalMinutes: 15,
  changesOnly: true,
  includeNulls: false,
  alertRules: [],
  powerBiSettings: { ...DEFAULT_POWER_BI_SETTINGS, datasets: [...DEFAULT_POWER_BI_SETTINGS.datasets] },
  powerBiApiKey: "",
  excelSettings: { ...DEFAULT_EXCEL_SETTINGS, datasets: [...DEFAULT_EXCEL_SETTINGS.datasets], tables: [...DEFAULT_EXCEL_SETTINGS.tables] },
  excelApiKey: "",
};

function hostOf(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function presetFields(preset: Exclude<DataPreset, "custom">) {
  return [...FIELD_PRESETS[preset]];
}

function sameFields(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const ids = new Set(left);
  return right.every((id) => ids.has(id));
}

function inferPreset(fields: string[]): DataPreset {
  if (sameFields(fields, FIELD_PRESETS.summary)) return "summary";
  if (sameFields(fields, FIELD_PRESETS.performance)) return "performance";
  if (sameFields(fields, FIELD_PRESETS.full)) return "full";
  return "custom";
}

export function ExportWizard({ configId }: { configId?: string } = {}) {
  const { locale } = useLocale();
  const copy = EXPORT_COPY[locale];
  const wizard = WIZARD_COPY[locale];
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(2);
  const [form, setForm] = useState<DraftForm>(INITIAL_DRAFT);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [preset, setPreset] = useState<DataPreset>("summary");
  const [destinationChosen, setDestinationChosen] = useState(false);
  const [browsingDestinations, setBrowsingDestinations] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [fieldQuery, setFieldQuery] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [httpMethod, setHttpMethod] = useState<HttpMethod>("POST");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [endpointConfigured, setEndpointConfigured] = useState(false);
  const [sapConnection, setSapConnection] = useState<PublicSapConnection | null>(null);
  const [sampleRows, setSampleRows] = useState<Array<Record<string, unknown>>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    transactionId: string | null;
    error?: string | null;
    payload?: unknown;
  } | null>(null);
  const [payloadPreview, setPayloadPreview] = useState<string | null>(null);

  function patch(values: Partial<DraftForm>) {
    setForm((current) => ({ ...current, ...values }));
    setNotice(null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const connectionsResponse = await fetch("/api/connections", { cache: "no-store" });
      const connectionsData = (await connectionsResponse.json()) as {
        activeId?: string | null;
        connections?: Connection[];
      };
      if (cancelled) return;
      const available = connectionsData.connections ?? [];
      setConnections(available);

      if (!configId) {
        setForm((current) => ({
          ...current,
          sourceConnectionId: connectionsData.activeId ?? available[0]?.id ?? "",
        }));
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/exports/${configId}`, { cache: "no-store" });
      if (!response.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const config = (await response.json()) as ExportConfig;
      if (cancelled) return;
      const {
        id: _id,
        status: _status,
        endpointConfigured: savedEndpoint,
        lastRunAt: _lastRunAt,
        lastRunStatus: _lastRunStatus,
        lastRunError: _lastRunError,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        sapConnection: savedSap,
        ...draft
      } = config;
      void _id;
      void _status;
      void _createdAt;
      void _updatedAt;
      void _lastRunAt;
      void _lastRunStatus;
      void _lastRunError;
      setForm({
        ...draft,
        sapConnectionId: draft.sapConnectionId ?? "",
        sapAction: draft.sapAction === "custom-mapping" ? "custom-mapping" : "production-result",
        sapOrder: draft.sapOrder ?? null,
        sapMappingValidated: draft.sapMappingValidated === true,
        sapConfirmationUnit: draft.sapConfirmationUnit || "PC",
        alertRules: draft.alertRules ?? [],
        powerBiSettings: draft.powerBiSettings ?? { ...DEFAULT_POWER_BI_SETTINGS, datasets: [...DEFAULT_POWER_BI_SETTINGS.datasets] },
        excelSettings: draft.excelSettings ?? { ...DEFAULT_EXCEL_SETTINGS, datasets: [...DEFAULT_EXCEL_SETTINGS.datasets], tables: [...DEFAULT_EXCEL_SETTINGS.tables] },
      });
      setEndpointConfigured(savedEndpoint);
      setSapConnection(savedSap ?? null);
      setScopeMode(draft.allGroups ? "all" : "custom");
      setPreset(inferPreset(draft.fields));
      setDestinationChosen(true);
      setBrowsingDestinations(false);
      if (draft.destinationType === "power-bi" || draft.destinationType === "excel") setStep(4);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [configId]);

  const loadScope = useCallback(async (connectionId: string) => {
    if (!connectionId) {
      setGroups([]);
      return;
    }
    setScopeLoading(true);
    setScopeError(false);
    try {
      const response = await fetch(`/api/connections/${connectionId}/data`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; groups?: SourceGroup[]; rows?: Array<Record<string, unknown>> };
      if (!response.ok || !data.ok) throw new Error("scope");
      setGroups(data.groups ?? []);
      setSampleRows(data.rows ?? []);
    } catch {
      setGroups([]);
      setScopeError(true);
    } finally {
      setScopeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading || !form.sourceConnectionId) return;
    const sapMapping = form.destinationType === "sap-odata" && (step === 3 || step === 4);
    if (scopeMode !== "custom" && step !== 1 && !sapMapping) return;
    const timer = window.setTimeout(() => void loadScope(form.sourceConnectionId), 0);
    return () => window.clearTimeout(timer);
  }, [form.destinationType, form.sourceConnectionId, loadScope, loading, scopeMode, step]);

  const selectedConnection = connections.find((item) => item.id === form.sourceConnectionId);
  const destinationMeta = WIZARD_DESTINATIONS[form.destinationType];
  const destination = DESTINATIONS.find((item) => item.id === form.destinationType) ?? DESTINATIONS[0];
  const visibleGroups = form.groupUuids.length
    ? groups.filter((group) => form.groupUuids.includes(group.uuid))
    : [];
  const availableLines = visibleGroups.flatMap((group) => group.lines);
  const sapFlow = form.destinationType === "sap-odata";
  const powerBiFlow = form.destinationType === "power-bi";
  const excelFlow = form.destinationType === "excel";
  const tabularFlow = powerBiFlow || excelFlow;
  const steps = sapFlow ? STEPS : BASIC_STEPS;
  const stepLabels: Record<WizardStep, string> = {
    0: wizard.stepSource,
    1: wizard.stepData,
    2: wizard.stepDestination,
    3: wizard.stepMapping,
    4: wizard.stepReview,
  };
  const sapReady =
    !sapFlow || Boolean(sapConnection?.connected && form.sapConnectionId);
  const sapActionReady = !sapFlow || form.sapAction === "production-result";

  const sourceValidation = !form.name.trim()
    ? VALIDATION_COPY[locale].name
    : !form.sourceConnectionId
      ? VALIDATION_COPY[locale].connection
      : scopeMode === "custom" && form.groupUuids.length === 0
        ? VALIDATION_COPY[locale].scope
        : null;
  const dataValidation = tabularFlow
    ? (powerBiFlow ? form.powerBiSettings.datasets.length : form.excelSettings.tables.length) === 0
      ? powerBiFlow ? POWER_BI_COPY[locale].chooseDataset : EXCEL_COPY[locale].chooseDataset
      : null
    : form.fields.length === 0 ? VALIDATION_COPY[locale].fields : null;
  const destinationValidation = !destinationChosen
    ? VALIDATION_COPY[locale].destination
    : sapFlow && !sapReady
      ? SAP_COPY[locale].missing
      : sapFlow && !sapActionReady
        ? SAP_COPY[locale].validateNeedAction
        : !sapFlow && !tabularFlow && !form.endpoint.trim() && !endpointConfigured
          ? form.destinationType === "slack" ? SLACK_COPY[locale].invalid : VALIDATION_COPY[locale].endpoint
          : form.destinationType === "slack" && form.alertRules.length === 0
            ? VALIDATION_COPY[locale].slackRule
          : null;
  const mappingValidation = !form.sapOrder?.id
    ? SAP_COPY[locale].validateNeedOrder
    : !form.sapMappingValidated
      ? SAP_COPY[locale].needValidate
      : null;
  const validationMessage = step === 0
    ? sourceValidation
    : step === 1
      ? dataValidation
      : step === 2
        ? destinationValidation
        : step === 3
          ? mappingValidation
          : sourceValidation ?? dataValidation ?? destinationValidation ?? (sapFlow ? mappingValidation : null);

  const canContinue = validationMessage === null;

  function chooseConnection(id: string) {
    patch({
      sourceConnectionId: id,
      groupUuids: [],
      lineUuids: [],
      allGroups: scopeMode === "all",
      allLines: scopeMode === "all",
    });
    setPickerOpen(false);
    setGroups([]);
  }

  function chooseScope(mode: ScopeMode) {
    setScopeMode(mode);
    patch({
      allGroups: mode === "all",
      allLines: mode === "all",
      groupUuids: mode === "all" ? [] : form.groupUuids,
      lineUuids: mode === "all" ? [] : form.lineUuids,
    });
  }

  function toggleGroup(uuid: string) {
    const selected = form.groupUuids.includes(uuid);
    const nextGroups = selected
      ? form.groupUuids.filter((id) => id !== uuid)
      : [...form.groupUuids, uuid];
    const groupLineUuids = groups.find((group) => group.uuid === uuid)?.lines.map((line) => line.uuid) ?? [];
    patch({
      groupUuids: nextGroups,
      lineUuids: selected
        ? form.lineUuids.filter((id) => !groupLineUuids.includes(id))
        : form.lineUuids,
    });
  }

  function toggleLine(uuid: string) {
    patch({
      lineUuids: form.lineUuids.includes(uuid)
        ? form.lineUuids.filter((id) => id !== uuid)
        : [...form.lineUuids, uuid],
    });
  }

  function toggleClusterLines(groupUuid: string) {
    const group = groups.find((item) => item.uuid === groupUuid);
    if (!group) return;
    const lineIds = group.lines.map((line) => line.uuid);
    const allSelected = lineIds.length > 0 && lineIds.every((id) => form.lineUuids.includes(id));
    patch({
      lineUuids: allSelected
        ? form.lineUuids.filter((id) => !lineIds.includes(id))
        : [...new Set([...form.lineUuids, ...lineIds])],
    });
  }

  function choosePreset(next: DataPreset) {
    setPreset(next);
    if (next !== "custom") {
      patch({ fields: presetFields(next) });
      setExpanded([]);
      setFieldQuery("");
    }
  }

  function toggleField(id: string) {
    setPreset("custom");
    patch({
      fields: form.fields.includes(id)
        ? form.fields.filter((field) => field !== id)
        : [...form.fields, id],
    });
  }

  function toggleSection(sectionId: string) {
    const section = FIELD_SECTIONS.find((item) => item.id === sectionId);
    if (!section) return;
    const ids = section.fields.map(([id]) => id);
    const sectionIds = new Set<string>(ids);
    const allSelected = ids.every((id) => form.fields.includes(id));
    setPreset("custom");
    patch({
      fields: allSelected
        ? form.fields.filter((id) => !sectionIds.has(id))
        : [...new Set([...form.fields, ...ids])],
    });
  }

  function chooseDestination(id: DestinationType) {
    const changed = id !== form.destinationType;
    if (changed && form.destinationType === "sap-odata" && form.sapConnectionId) {
      void fetch(`/api/exports/sap/${form.sapConnectionId}`, { method: "DELETE" });
      setSapConnection(null);
    }
    patch({
      destinationType: id,
      destinationName: changed ? WIZARD_DESTINATIONS[id].name : form.destinationName || WIZARD_DESTINATIONS[id].name,
      endpoint: changed ? "" : form.endpoint,
      sapConnectionId: changed ? "" : form.sapConnectionId,
      sapAction: changed ? "production-result" : form.sapAction,
      sapOrder: changed ? null : form.sapOrder,
      sapMappingValidated: changed ? false : form.sapMappingValidated,
      sapConfirmationUnit: changed ? "PC" : form.sapConfirmationUnit,
      triggerMode: id === "slack" ? "data-change" : id === "power-bi" || id === "excel" ? "manual" : form.triggerMode,
      changesOnly: id === "slack" ? true : form.changesOnly,
      alertRules: id === "power-bi" || id === "excel" ? [] : form.alertRules,
    });
    if (changed) setEndpointConfigured(false);
    setDestinationChosen(true);
    setBrowsingDestinations(false);
    setOpenMenu(null);
  }

  function goNext() {
    if (!canContinue) {
      setNotice(validationMessage ?? copy.required);
      return;
    }
    setNotice(null);
    setStep((current) => steps[Math.min(steps.indexOf(current) + 1, steps.length - 1)]);
  }

  function goBack() {
    setNotice(null);
    setStep((current) => steps[Math.max(steps.indexOf(current) - 1, 0)]);
  }

  async function saveDraft() {
    if (!form.name.trim() || !form.sourceConnectionId || form.fields.length === 0) {
      setNotice(copy.required);
      return;
    }
    if (form.destinationType === "slack" && !form.endpoint.trim() && !endpointConfigured) {
      setNotice(SLACK_COPY[locale].invalid);
      return;
    }
    if (form.destinationType === "sap-odata" && !sapReady) {
      setNotice(SAP_COPY[locale].missing);
      return;
    }
    if (form.destinationType === "sap-odata" && !form.sapOrder?.id) {
      setNotice(SAP_COPY[locale].validateNeedOrder);
      return;
    }
    if (form.destinationType === "sap-odata" && !form.sapMappingValidated) {
      setNotice(SAP_COPY[locale].needValidate);
      return;
    }
    setSaving(true);
    setNotice(null);
    const response = await fetch(configId ? `/api/exports/${configId}` : "/api/exports", {
      method: configId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(
        body.error === "INVALID_SLACK_WEBHOOK_URL"
          ? SLACK_COPY[locale].invalid
          : body.error === "SAP_CONNECTION_REQUIRED"
            ? SAP_COPY[locale].missing
            : copy.saveError,
      );
      setSaving(false);
      return;
    }
    const saved = (await response.json()) as ExportConfig;
    setSaving(false);
    router.push(form.destinationType === "power-bi" || form.destinationType === "excel" ? `/settings/exports/${saved.id}` : "/settings/exports");
  }

  const sapSample = sampleFrom(sampleRows);
  const sapCopy = SAP_COPY[locale];

  async function previewPayload() {
    if (!form.sapOrder?.id) {
      setNotice(sapCopy.validateNeedOrder);
      return;
    }
    try {
      const payload = buildProductionConfirmationPayload({
        orderId: form.sapOrder.id,
        yieldQuantity: sapSample.actual,
        unit: form.sapConfirmationUnit || "PC",
      });
      setPayloadPreview(JSON.stringify(payload, null, 2));
    } catch {
      setNotice(sapCopy.validateNeedPayload);
    }
  }

  async function runSimulation() {
    if (!sapConnection?.id || !form.sapOrder?.id) return;
    setSendBusy(true);
    setSendResult(null);
    const response = await fetch(`/api/exports/sap/${sapConnection.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: form.sapOrder.id,
        yieldQuantity: sapSample.actual,
        unit: form.sapConfirmationUnit || form.sapOrder.unit || "PC",
        product: form.sapOrder.product,
        plant: form.sapOrder.plant,
        exportId: configId ?? null,
        exportName: form.name.trim() || "SAP Data Export",
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      transactionId?: string;
      error?: string | null;
      payload?: unknown;
    };
    setSendBusy(false);
    setConfirmOpen(false);
    setSendResult({
      ok: data.ok === true,
      transactionId: data.transactionId ?? null,
      error: data.error,
      payload: data.payload ?? null,
    });
    if (data.ok && data.payload) setPayloadPreview(JSON.stringify(data.payload, null, 2));
  }

  function requestSendTest() {
    const issues = mappingIssues(sapCopy, form.sapOrder, sapSample, form.sapConfirmationUnit || "PC");
    if (issues.length || !form.sapMappingValidated) {
      setNotice(issues[0] || sapCopy.needValidate);
      return;
    }
    setConfirmOpen(true);
  }

  if (notFound) {
    return (
      <div className="export-wizard">
        <div className="export-wizard-canvas">
          <h1 className="ew-title">{copy.notFound}</h1>
          <Link href="/settings/exports" className="export-back">
            <FiArrowLeft size={15} />
            {copy.back}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="export-wizard">
        <div className="export-wizard-canvas">
          <div className="ew-loading skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="export-wizard">
      <div className="export-wizard-canvas">
        <header className="ew-head">
          <div className="ew-head-copy">
            <Link href="/settings/exports" className="export-back">
              <FiArrowLeft size={15} />
              {copy.back}
            </Link>
            <h1 className="ew-title">
              {form.destinationType === "slack"
                ? configId ? SLACK_COPY[locale].editTitle : SLACK_COPY[locale].createTitle
                : configId ? copy.editTitle : wizard.createTitle}
            </h1>
          </div>
        </header>

        <ol className="ew-stepper" aria-label="Export setup">
          {steps.map((item) => {
            const done = steps.indexOf(item) < steps.indexOf(step);
            const current = item === step;
            return (
              <li key={item} className={current ? "is-current" : done ? "is-done" : ""}>
                <button
                  type="button"
                  disabled={steps.indexOf(item) > steps.indexOf(step)}
                  aria-current={current ? "step" : undefined}
                  onClick={() => {
                    if (steps.indexOf(item) <= steps.indexOf(step)) setStep(item);
                  }}
                >
                  <span className="ew-stepper-label">{stepLabels[item]}</span>
                  <span className="ew-stepper-mark">
                    {done ? <FiCheck size={14} /> : <span className="ew-stepper-dot" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="ew-stepper-mobile">
          {steps.indexOf(step) + 1} / {steps.length} {stepLabels[step]}
        </p>

        <div className="ew-body">
          {step === 0 ? (
            <SourceStep
              copy={copy}
              wizard={wizard}
              form={form}
              connections={connections}
              groups={groups}
              scopeMode={scopeMode}
              selectedConnection={selectedConnection}
              pickerOpen={pickerOpen}
              scopeLoading={scopeLoading}
              scopeError={scopeError}
              visibleGroups={visibleGroups}
              availableLines={availableLines}
              onPatch={patch}
              onPicker={() => setPickerOpen((open) => !open)}
              onChooseConnection={chooseConnection}
              onScope={chooseScope}
              onToggleGroup={toggleGroup}
              onToggleLine={toggleLine}
              onToggleClusterLines={toggleClusterLines}
              onRetryScope={() => void loadScope(form.sourceConnectionId)}
            />
          ) : null}

          {step === 1 ? (
            <DataStep
              copy={copy}
              wizard={wizard}
              locale={locale}
              form={form}
              preset={preset}
              expanded={expanded}
              fieldQuery={fieldQuery}
              sampleRows={sampleRows}
              onAlertRules={(alertRules) => patch({
                alertRules,
                ...(alertRules.length > 0 ? { triggerMode: "data-change" as const } : {}),
              })}
              onPowerBiSettings={(powerBiSettings) => patch({ powerBiSettings })}
              onExcelSettings={(excelSettings) => patch({ excelSettings })}
              onPreset={choosePreset}
              onToggleField={toggleField}
              onToggleSection={toggleSection}
              onExpand={(id) =>
                setExpanded((current) =>
                  current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                )
              }
              onQuery={setFieldQuery}
            />
          ) : null}

          {step === 2 ? (
            <DestinationStep
              copy={copy}
              locale={locale}
              wizard={wizard}
              form={form}
              destination={destination}
              destinationMeta={destinationMeta}
              browsing={browsingDestinations}
              destinationChosen={destinationChosen}
              authMode={authMode}
              httpMethod={httpMethod}
              openMenu={openMenu}
              onBrowse={() => setBrowsingDestinations(true)}
              onChoose={chooseDestination}
              onPatch={patch}
              slackCopy={SLACK_COPY[locale]}
              sapCopy={SAP_COPY[locale]}
              sapConnection={sapConnection}
              onSapConnected={(next) => {
                setSapConnection(next);
                patch({ sapConnectionId: next.id, destinationName: next.name });
              }}
              onSapDisconnected={() => {
                setSapConnection(null);
                patch({ sapConnectionId: "" });
              }}
              endpointConfigured={endpointConfigured}
              onEndpoint={(endpoint) => {
                setEndpointConfigured(false);
                patch({ endpoint });
              }}
              onAuth={setAuthMode}
              onMethod={setHttpMethod}
              onMenu={setOpenMenu}
            />
          ) : null}

          {step === 3 && sapFlow && sapConnection ? (
            <SapMappingStep
              connection={sapConnection}
              order={form.sapOrder}
              unit={form.sapConfirmationUnit || "PC"}
              sampleRows={sampleRows}
              validated={form.sapMappingValidated}
              onOrder={(sapOrder) =>
                patch({
                  sapOrder,
                  sapMappingValidated: false,
                  sapConfirmationUnit: sapOrder?.unit || form.sapConfirmationUnit || "PC",
                })
              }
              onUnit={(sapConfirmationUnit) => patch({ sapConfirmationUnit, sapMappingValidated: false })}
              onValidated={(ok) => patch({ sapMappingValidated: ok })}
            />
          ) : null}

          {step === 4 ? (
            <ReviewStep
              copy={copy}
              locale={locale}
              configId={configId}
              wizard={wizard}
              form={form}
              preset={preset}
              scopeMode={scopeMode}
              selectedConnection={selectedConnection}
              destinationMeta={destinationMeta}
              groups={groups}
              slackCopy={SLACK_COPY[locale]}
              sapCopy={SAP_COPY[locale]}
              sapConnection={sapConnection}
              sample={sapSample}
              payloadPreview={payloadPreview}
              sendResult={sendResult}
              sendBusy={sendBusy}
              onPreview={() => void previewPayload()}
              onSend={requestSendTest}
            />
          ) : null}

          {notice ? <p className="ew-notice">{notice}</p> : null}
        </div>
      </div>

      <footer className="ew-bar">
        <div className="ew-bar-inner">
          <Link href="/settings/exports" className="btn btn-ghost">
            {wizard.cancel}
          </Link>
          <div className="ew-bar-actions">
            {steps.indexOf(step) > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={goBack}>
                {wizard.back}
              </button>
            ) : null}
            {step !== 4 ? (
              <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={goNext}>
                {wizard.continue}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !canContinue}
                onClick={() => void saveDraft()}
              >
                {form.destinationType === "slack"
                  ? saving ? SLACK_COPY[locale].saving : SLACK_COPY[locale].save
                  : form.destinationType === "sap-odata"
                    ? saving ? SAP_COPY[locale].saving : SAP_COPY[locale].save
                  : form.destinationType === "power-bi"
                    ? saving ? POWER_BI_SAVE_COPY[locale].saving : POWER_BI_SAVE_COPY[locale].save
                  : form.destinationType === "excel"
                    ? saving ? EXCEL_COPY[locale].saving : EXCEL_COPY[locale].save
                  : saving ? copy.saving : copy.save}
              </button>
            )}
          </div>
        </div>
      </footer>
      <SapSendDialog
        open={confirmOpen}
        copy={sapCopy}
        order={form.sapOrder}
        yieldQuantity={sapSample.actual}
        unit={form.sapConfirmationUnit || form.sapOrder?.unit || "PC"}
        busy={sendBusy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void runSimulation()}
      />
    </div>
  );
}

function SourceStep({
  copy,
  wizard,
  form,
  connections,
  groups,
  scopeMode,
  selectedConnection,
  pickerOpen,
  scopeLoading,
  scopeError,
  visibleGroups,
  availableLines,
  onPatch,
  onPicker,
  onChooseConnection,
  onScope,
  onToggleGroup,
  onToggleLine,
  onToggleClusterLines,
  onRetryScope,
}: {
  copy: (typeof EXPORT_COPY)[keyof typeof EXPORT_COPY];
  wizard: WizardCopy;
  form: DraftForm;
  connections: Connection[];
  groups: SourceGroup[];
  scopeMode: ScopeMode;
  selectedConnection?: Connection;
  pickerOpen: boolean;
  scopeLoading: boolean;
  scopeError: boolean;
  visibleGroups: SourceGroup[];
  availableLines: SourceGroup["lines"];
  onPatch: (values: Partial<DraftForm>) => void;
  onPicker: () => void;
  onChooseConnection: (id: string) => void;
  onScope: (mode: ScopeMode) => void;
  onToggleGroup: (uuid: string) => void;
  onToggleLine: (uuid: string) => void;
  onToggleClusterLines: (groupUuid: string) => void;
  onRetryScope: () => void;
}) {
  return (
    <section className="ew-step">
      <StepIntro title={wizard.sourceHeading} />

      <div className="ew-fields">
        <label className="ew-field">
          <span className="ew-label">{copy.name}</span>
          <input
            className="machine-input"
            value={form.name}
            onChange={(event) => onPatch({ name: event.target.value })}
            placeholder=""
          />
        </label>
      </div>

      <div className="ew-block">
        <p className="ew-label">{copy.connection}</p>
        {connections.length === 0 ? (
          <div className="ew-empty-row">
            <span>{copy.noConnection}</span>
            <Link href="/settings">{wizard.addConnection}</Link>
          </div>
        ) : (
          <div className="ew-picker">
            <button type="button" className="ew-select-row" onClick={onPicker} aria-expanded={pickerOpen}>
              <span>
                <strong>{selectedConnection?.name ?? copy.noConnection}</strong>
                <small>{selectedConnection ? hostOf(selectedConnection.baseUrl) : ""}</small>
              </span>
              <FiChevronRight size={16} className={pickerOpen ? "is-open" : ""} />
            </button>
            {pickerOpen ? (
              <ul className="ew-picker-list">
                {connections.map((connection) => (
                  <li key={connection.id}>
                    <button
                      type="button"
                      className={connection.id === form.sourceConnectionId ? "is-selected" : ""}
                      onClick={() => onChooseConnection(connection.id)}
                    >
                      <span>
                        <strong>{connection.name}</strong>
                        <small>{hostOf(connection.baseUrl)}</small>
                      </span>
                      {connection.id === form.sourceConnectionId ? <FiCheck size={15} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <fieldset className="ew-block">
        <legend className="ew-label">{wizard.scope}</legend>
        <ChoiceRow
          selected={scopeMode === "all"}
          title={wizard.scopeAll}
          radio
          onSelect={() => onScope("all")}
        />
        <ChoiceRow
          selected={scopeMode === "custom"}
          title={wizard.scopeCustom}
          radio
          onSelect={() => onScope("custom")}
        />
      </fieldset>

      {scopeMode === "custom" ? (
        <div className="ew-disclose">
          {scopeLoading ? <p className="ew-muted">{copy.loadingScope}</p> : null}
          {scopeError ? (
            <button type="button" className="btn btn-secondary" onClick={onRetryScope}>
              {copy.retryScope}
            </button>
          ) : null}
          {!scopeLoading && groups.length > 0 ? (
            <div className="ew-checklist">
              <p className="ew-label">{wizard.groups}</p>
              {groups.map((group) => (
                <label key={group.uuid} className="ew-check-row">
                  <input
                    type="checkbox"
                    checked={form.groupUuids.includes(group.uuid)}
                    onChange={() => onToggleGroup(group.uuid)}
                  />
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.lines.length} Lines</small>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {!scopeLoading && availableLines.length > 0 ? (
            <div className="ew-checklist">
              <p className="ew-label">{wizard.lines}</p>
              {visibleGroups.map((group) => {
                const lineIds = group.lines.map((line) => line.uuid);
                const allLinesSelected = lineIds.length > 0 && lineIds.every((id) => form.lineUuids.includes(id));
                return (
                <div key={group.uuid} className="ew-line-cluster">
                  <div className="ew-line-cluster-head">
                    <p className="ew-line-cluster-title">{group.name}</p>
                    <button
                      type="button"
                      className="ew-select-all"
                      onClick={() => onToggleClusterLines(group.uuid)}
                    >
                      {allLinesSelected ? copy.clearAll : copy.selectAll}
                    </button>
                  </div>
                  {group.lines.map((line) => (
                    <label key={line.uuid} className="ew-check-row">
                      <input
                        type="checkbox"
                        checked={form.lineUuids.includes(line.uuid)}
                        onChange={() => onToggleLine(line.uuid)}
                      />
                      <span>{line.name}</span>
                    </label>
                  ))}
                </div>
              );
              })}
            </div>
          ) : null}
          {!scopeLoading && !scopeError && form.groupUuids.length === 0 && groups.length > 0 ? (
            <p className="ew-muted">{wizard.pickGroupFirst}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DataStep({
  copy,
  wizard,
  locale,
  form,
  preset,
  expanded,
  fieldQuery,
  sampleRows,
  onAlertRules,
  onPowerBiSettings,
  onExcelSettings,
  onPreset,
  onToggleField,
  onToggleSection,
  onExpand,
  onQuery,
}: {
  copy: (typeof EXPORT_COPY)[keyof typeof EXPORT_COPY];
  wizard: WizardCopy;
  locale: keyof typeof DATA_STEP_COPY;
  form: DraftForm;
  preset: DataPreset;
  expanded: string[];
  fieldQuery: string;
  sampleRows: Array<Record<string, unknown>>;
  onAlertRules: (rules: AlertRule[]) => void;
  onPowerBiSettings: (settings: PowerBiSettings) => void;
  onExcelSettings: (settings: ExcelSettings) => void;
  onPreset: (preset: DataPreset) => void;
  onToggleField: (id: string) => void;
  onToggleSection: (id: string) => void;
  onExpand: (id: string) => void;
  onQuery: (value: string) => void;
}) {
  const ux = DATA_STEP_COPY[locale];
  if (form.destinationType === "power-bi") {
    return (
      <PowerBiDataStep
        locale={locale}
        settings={form.powerBiSettings}
        onChange={onPowerBiSettings}
      />
    );
  }
  if (form.destinationType === "excel") {
    return <ExcelDataStep locale={locale} settings={form.excelSettings} onChange={onExcelSettings} />;
  }
  const query = fieldQuery.trim().toLowerCase();
  const presets: { id: DataPreset; title: string; description: string }[] = [
    { id: "summary", title: wizard.presetSummary, description: wizard.presetSummaryDesc },
    { id: "performance", title: wizard.presetPerformance, description: wizard.presetPerformanceDesc },
    { id: "full", title: wizard.presetFull, description: wizard.presetFullDesc },
    { id: "custom", title: wizard.presetCustom, description: wizard.presetCustomDesc },
  ];
  const addRule = (metric: AlertRule["metric"]) => {
    if (form.alertRules.some((rule) => rule.metric === metric)) return;
    onAlertRules([...form.alertRules, { metric, operator: metric === "currentCtOverBase" ? "above" : "below", threshold: metric === "currentCtOverBase" ? 0 : 80, occurrences: 1 }]);
  };
  const patchRule = (index: number, values: Partial<AlertRule>) => onAlertRules(form.alertRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...values } : rule));

  return (
    <section className="ew-step">
      <StepIntro title={wizard.dataHeading} />
      <div className="ew-data-section-head">
        <div><strong>{ux.presetTitle}</strong><span>{ux.presetHelp}</span></div>
      </div>
      <div className="ew-choice-list">
        {presets.map((item) => (
          <ChoiceRow
            key={item.id}
            selected={preset === item.id}
            title={item.title}
            description={item.description}
            badge={item.id === "summary" ? ux.recommended : undefined}
            onSelect={() => onPreset(item.id)}
          />
        ))}
      </div>

      {preset === "custom" ? (
        <div className="ew-custom">
          <div className="ew-custom-toolbar">
            <input
              className="machine-input ew-search"
              value={fieldQuery}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={wizard.searchFields}
            />
            <p className="ew-count">
              {form.fields.length} {wizard.fieldsSelected}
            </p>
          </div>
          <div className="ew-groups">
            {FIELD_SECTIONS.map((section) => {
              const meta = WIZARD_SECTION_META[section.id];
              const fields = query
                ? section.fields.filter(
                    ([id, label]) =>
                      id.toLowerCase().includes(query) || label.toLowerCase().includes(query),
                  )
                : section.fields;
              if (query && fields.length === 0) return null;
              const selected = section.fields.filter(([id]) => form.fields.includes(id)).length;
              const open = query ? true : expanded.includes(section.id);
              return (
                <div key={section.id} className="ew-group">
                  <button
                    type="button"
                    className="ew-group-head"
                    aria-expanded={open}
                    onClick={() => onExpand(section.id)}
                  >
                    <span>
                      <strong>
                        {meta.title}
                        <em>
                          {selected} / {section.fields.length}
                        </em>
                      </strong>
                      <small>{meta.description}</small>
                    </span>
                    <FiChevronDown size={16} className={open ? "is-open" : ""} />
                  </button>
                  {open ? (
                    <div className="ew-group-body">
                      <button type="button" className="ew-select-all" onClick={() => onToggleSection(section.id)}>
                        {copy.selectAll}
                      </button>
                      {fields.map(([id, label]) => (
                        <label key={id} className="ew-field-row">
                          <input
                            type="checkbox"
                            checked={form.fields.includes(id)}
                            onChange={() => onToggleField(id)}
                          />
                          <span>
                            <strong>{label}</strong>
                            <code>{id}</code>
                            <small className="ew-field-sample">{fieldSample(sampleRows, id)}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="ew-count ew-count-preset">
          {form.fields.length} {wizard.fieldsSelected}
        </p>
      )}
      <div className="ew-alert-builder">
        <div className="ew-alert-intro"><strong>{ux.alertTitle}</strong></div>
        {form.alertRules.length === 0 ? <div className="ew-alert-empty"><i /><div><strong>{ux.noAlert}</strong><span>{ux.noAlertHelp}</span></div></div> : null}
        <div className="ew-alert-options">
          <button type="button" disabled={form.alertRules.some((rule) => rule.metric === "currentCtOverBase")} onClick={() => addRule("currentCtOverBase")}><strong>{ux.currentCt}</strong><span>{ux.currentCtHelp}</span></button>
          <button type="button" disabled={form.alertRules.some((rule) => rule.metric === "volumeRate")} onClick={() => addRule("volumeRate")}><strong>{ux.volume}</strong><span>{ux.volumeHelp}</span></button>
          <button type="button" disabled={form.alertRules.some((rule) => rule.metric === "operationalAvailability")} onClick={() => addRule("operationalAvailability")}><strong>{ux.availability}</strong><span>{ux.availabilityHelp}</span></button>
        </div>
        {form.alertRules.map((rule, index) => {
          const title =
            rule.metric === "currentCtOverBase"
              ? ux.currentCt
              : rule.metric === "volumeRate"
                ? ux.volume
                : ux.availability;
          const help =
            rule.metric === "currentCtOverBase"
              ? ux.currentCtHelp
              : rule.metric === "volumeRate"
                ? ux.volumeHelp
                : ux.availabilityHelp;
          const isCtRule = rule.metric === "currentCtOverBase";

          return (
            <div className="ew-alert-rule" key={`${rule.metric}-${index}`}>
              <div className="ew-alert-rule-title">
                <span>{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{help}</small>
                </div>
              </div>
              <div className="ew-alert-rule-controls">
                {isCtRule ? (
                  <span className="ew-alert-condition">Current CT &gt; Base CT</span>
                ) : (
                  <>
                    <label className="ew-alert-field">
                      <span>{ux.operator}</span>
                      <select
                        aria-label={ux.operator}
                        value={rule.operator}
                        onChange={(event) =>
                          patchRule(index, { operator: event.target.value as AlertRule["operator"] })
                        }
                      >
                        <option value="below">{ux.below}</option>
                        <option value="above">{ux.above}</option>
                      </select>
                    </label>
                    <label className="ew-alert-field">
                      <span>{ux.threshold}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={rule.threshold}
                        onChange={(event) =>
                          patchRule(index, { threshold: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                  </>
                )}
                <label className="ew-alert-field">
                  <span>{ux.occurrences}</span>
                  <span className="ew-alert-occurrences">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={rule.occurrences}
                      onChange={(event) =>
                        patchRule(index, {
                          occurrences: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                    <em>{ux.times}</em>
                  </span>
                </label>
                <button
                  type="button"
                  className="ew-alert-remove"
                  onClick={() =>
                    onAlertRules(form.alertRules.filter((_, ruleIndex) => ruleIndex !== index))
                  }
                >
                  {ux.remove}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PowerBiDataStep({
  locale,
  settings,
  onChange,
}: {
  locale: keyof typeof POWER_BI_COPY;
  settings: PowerBiSettings;
  onChange: (settings: PowerBiSettings) => void;
}) {
  const text = POWER_BI_COPY[locale];
  const toggleDataset = (dataset: PowerBiDataset) => {
    onChange({
      ...settings,
      datasets: settings.datasets.includes(dataset)
        ? settings.datasets.filter((item) => item !== dataset)
        : [...settings.datasets, dataset],
    });
  };

  return (
    <section className="ew-step">
      <StepIntro title={text.modelTitle} description={text.modelHelp} />
      <div className="ew-bi-section">
        <p className="ew-label">1. {text.tables}</p>
        <div className="ew-bi-grid">
          {([
            ["production", text.production, text.productionHelp, "FactProduction"],
            ["lost-time", text.lostTime, text.lostTimeHelp, "FactLostTime"],
          ] as const).map(([id, title, help, table]) => (
            <label key={id} className={`ew-bi-card ${settings.datasets.includes(id) ? "is-selected" : ""}`}>
              <input type="checkbox" checked={settings.datasets.includes(id)} onChange={() => toggleDataset(id)} />
              <span><strong>{title}</strong><small>{help}</small><code>{table}</code></span>
            </label>
          ))}
        </div>
      </div>

      <div className="ew-bi-section">
        <p className="ew-label">2. {text.dimensions}</p>
        <div className="ew-bi-grid">
          <label className={`ew-bi-card ${settings.includeLineDimension ? "is-selected" : ""}`}>
            <input type="checkbox" checked={settings.includeLineDimension} onChange={(event) => onChange({ ...settings, includeLineDimension: event.target.checked })} />
            <span><strong>{text.line}</strong><small>{text.lineHelp}</small><code>DimProductionLine</code></span>
          </label>
          <label className={`ew-bi-card ${settings.includeDateDimension ? "is-selected" : ""}`}>
            <input type="checkbox" checked={settings.includeDateDimension} onChange={(event) => onChange({ ...settings, includeDateDimension: event.target.checked })} />
            <span><strong>{text.date}</strong><small>{text.dateHelp}</small><code>DimDate</code></span>
          </label>
        </div>
      </div>

      <div className="ew-bi-section">
        <p className="ew-label">3. {text.history}</p>
        <div className="ew-bi-history">
          {([30, 90, 365] as const).map((days) => (
            <button key={days} type="button" className={settings.historyDays === days ? "is-selected" : ""} onClick={() => onChange({ ...settings, historyDays: days })}>
              <strong>{days} {text.days}</strong>{days === 90 ? <small>{text.recommended}</small> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="ew-bi-grain"><span>{text.grain}</span><strong>{text.grainValue}</strong></div>
    </section>
  );
}

function ExcelDataStep({ locale, settings, onChange }: {
  locale: keyof typeof EXCEL_COPY;
  settings: ExcelSettings;
  onChange: (settings: ExcelSettings) => void;
}) {
  const text = EXCEL_COPY[locale];
  const biText = POWER_BI_COPY[locale];
  const columns = ["Date", "productionLineName", "product", "planNum", "actualNum", "averageCt", "baseCt", "pcsPerHour", "volumeRate", "operationalAvailability", "operatingTime", "stopTime", "Lost Time รวม"];
  const toggleTable = (table: ExcelTable) => {
    const removing = settings.tables.includes(table);
    onChange({
      ...settings,
      tables: removing
        ? settings.tables.filter((item) => item !== table)
        : [...settings.tables, table],
      autoRefresh: table === "current" && removing ? false : settings.autoRefresh,
    });
  };
  return (
    <section className="ew-step">
      <StepIntro title={text.modelTitle} description={text.modelHelp} />
      <div className="ew-bi-section">
        <p className="ew-label">1. {text.selectTables}</p>
        <div className="ew-bi-grid">
          <label className={`ew-bi-card ${settings.tables.includes("history") ? "is-selected" : ""}`}>
            <input type="checkbox" checked={settings.tables.includes("history")} onChange={() => toggleTable("history")} />
            <span><strong>{text.historyTable}</strong><small>{text.historyHelp}</small><code>tblSAMProduction</code></span>
          </label>
          <label className={`ew-bi-card ${settings.tables.includes("current") ? "is-selected" : ""}`}>
            <input type="checkbox" checked={settings.tables.includes("current")} onChange={() => toggleTable("current")} />
            <span><strong>{text.currentTable}</strong><small>{text.currentHelp}</small><code>tblSAMCurrent</code></span>
          </label>
        </div>
      </div>
      <div className="ew-bi-section">
        <p className="ew-label">{text.tableName}</p>
        <div className="ew-excel-columns">
          {columns.map((column, index) => <span key={column}><em>{String.fromCharCode(65 + index)}</em><code>{column}</code></span>)}
        </div>
      </div>
      {settings.tables.includes("history") ? <div className="ew-bi-section">
        <p className="ew-label">2. {biText.history}</p>
        <div className="ew-bi-history">
          {([30, 90, 365] as const).map((days) => (
            <button key={days} type="button" className={settings.historyDays === days ? "is-selected" : ""} onClick={() => onChange({ ...settings, historyDays: days })}>
              <strong>{days} {biText.days}</strong>{days === 90 ? <small>{biText.recommended}</small> : null}
            </button>
          ))}
        </div>
        <p className="ew-muted">{text.historyTable}</p>
      </div> : null}
      <div className="ew-bi-section">
        <p className="ew-label">3. {text.refreshTitle}</p>
        <label className={`ew-bi-card ew-excel-auto ${settings.autoRefresh ? "is-selected" : ""}`}>
          <input type="checkbox" checked={settings.autoRefresh} onChange={(event) => onChange({
            ...settings,
            autoRefresh: event.target.checked,
            tables: event.target.checked && !settings.tables.includes("current")
              ? [...settings.tables, "current"]
              : settings.tables,
          })} />
          <span><strong>{text.autoRefresh}</strong><small>{text.currentHelp}</small></span>
        </label>
        {settings.autoRefresh ? <div className="ew-bi-history">
          {([5, 10, 15] as const).map((minutes) => (
            <button key={minutes} type="button" className={settings.refreshMinutes === minutes ? "is-selected" : ""} onClick={() => onChange({ ...settings, refreshMinutes: minutes })}>
              <strong>{minutes} {text.minutes}</strong>{minutes === 15 ? <small>{biText.recommended}</small> : null}
            </button>
          ))}
        </div> : null}
        <p className="ew-muted">{text.workbookNote}</p>
      </div>
    </section>
  );
}

function fieldSample(rows: Array<Record<string, unknown>>, id: string) {
  const keyByField: Record<string, string> = {
    "connection.name": "machineName", "productionGroup.uuid": "productionGroupUuid", "productionGroup.name": "productionGroupName", "productionLine.uuid": "uuid", "productionLine.name": "productionLineName", "product.code": "product", "product.uuid": "productUuid", "production.planNum": "planNum", "production.actualNum": "actualNum", "performance.currentCt": "currentCt", "performance.averageCt": "averageCt", "performance.baseCt": "baseCt", "performance.pcsPerHour": "pcsPerHour", "performance.volumeRate": "volumeRate", "performance.operationalAvailability": "operationalAvailability", "performance.operatingTime": "operatingTime", "performance.stopTime": "stopTime", "status.uuid": "statusUuid", "status.name": "statusName",
  };
  const key = keyByField[id];
  if (!key) return rows.length ? "พร้อมใช้งาน" : "ไม่มีตัวอย่าง";
  const values = [...new Set(rows.map((row) => row[key]).filter((value) => value != null && String(value).trim()).map(String))];
  if (!values.length) return "ยังไม่มีค่าจาก iXacs";
  return `ตัวอย่าง: ${values.slice(0, 3).join(" · ")}${values.length > 3 ? ` +${values.length - 3}` : ""}`;
}

function DestinationStep({
  copy,
  locale,
  wizard,
  form,
  destination,
  destinationMeta,
  browsing,
  destinationChosen,
  authMode,
  httpMethod,
  openMenu,
  onBrowse,
  onChoose,
  onPatch,
  slackCopy,
  sapCopy,
  sapConnection,
  onSapConnected,
  onSapDisconnected,
  endpointConfigured,
  onEndpoint,
  onAuth,
  onMethod,
  onMenu,
}: {
  copy: (typeof EXPORT_COPY)[keyof typeof EXPORT_COPY];
  locale: keyof typeof POWER_BI_COPY;
  wizard: WizardCopy;
  form: DraftForm;
  destination: (typeof DESTINATIONS)[number];
  destinationMeta: (typeof WIZARD_DESTINATIONS)[DestinationType];
  browsing: boolean;
  destinationChosen: boolean;
  authMode: AuthMode;
  httpMethod: HttpMethod;
  openMenu: OpenMenu;
  onBrowse: () => void;
  onChoose: (id: DestinationType) => void;
  onPatch: (values: Partial<DraftForm>) => void;
  slackCopy: (typeof SLACK_COPY)[keyof typeof SLACK_COPY];
  sapCopy: (typeof SAP_COPY)[keyof typeof SAP_COPY];
  sapConnection: PublicSapConnection | null;
  onSapConnected: (connection: PublicSapConnection) => void;
  onSapDisconnected: () => void;
  endpointConfigured: boolean;
  onEndpoint: (endpoint: string) => void;
  onAuth: (value: AuthMode) => void;
  onMethod: (value: HttpMethod) => void;
  onMenu: (menu: OpenMenu) => void;
}) {
  const showHttp = form.destinationType === "rest" || form.destinationType === "webhook";
  const isSlack = form.destinationType === "slack";
  const isSap = form.destinationType === "sap-odata";
  const isPowerBi = form.destinationType === "power-bi";
  const isExcel = form.destinationType === "excel";
  const isTabular = isPowerBi || isExcel;
  const powerBiCopy = POWER_BI_COPY[locale];
  const excelCopy = EXCEL_COPY[locale];
  const ChosenIcon = DEST_ICONS[form.destinationType];
  const authLabel =
    authMode === "api-key" ? wizard.authKey : authMode === "bearer" ? wizard.authBearer : wizard.authNone;

  return (
    <section className="ew-step">
      <StepIntro title={wizard.destHeading} />

      {browsing ? (
        <div className="ew-dest-groups">
          {DESTINATION_GROUPS.map((group) => (
            <div key={group.id} className="ew-dest-group">
              <p className="ew-kicker">{wizard.categories[group.id]}</p>
              {group.items.map((id) => {
                const item = WIZARD_DESTINATIONS[id];
                const Icon = DEST_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={`ew-dest-row ${destinationChosen && form.destinationType === id ? "is-selected" : ""}`}
                    onClick={() => onChoose(id)}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{item.name}</strong>
                    </span>
                    <FiChevronRight size={16} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="ew-dest-config">
          <div className="ew-dest-chosen">
            <div className="ew-dest-chosen-copy">
              <ChosenIcon size={22} />
              <div>
                <h3>{destinationMeta.name}</h3>
              </div>
            </div>
            <button type="button" className="ew-text-btn" onClick={onBrowse}>
              {wizard.change}
            </button>
          </div>

          {isSap ? (
            <>
            <SapDestinationPanel
              connection={sapConnection}
              onConnected={onSapConnected}
              onDisconnected={onSapDisconnected}
            />
            {sapConnection?.connected ? (
              <fieldset className="ew-block">
                <legend className="ew-label">{sapCopy.actionHeading}</legend>
                <ChoiceRow
                  selected={form.sapAction === "production-result"}
                  title={sapCopy.productionResult}
                  description={sapCopy.productionResultHint}
                  radio
                  onSelect={() => onPatch({ sapAction: "production-result" })}
                />
                <ChoiceRow
                  selected={form.sapAction === "custom-mapping"}
                  title={sapCopy.customMapping}
                  description={sapCopy.customMappingHint}
                  radio
                  disabled
                  onSelect={() => undefined}
                />
                <p className="ew-muted">{sapCopy.customLater}</p>
              </fieldset>
            ) : null}
            </>
          ) : isTabular ? (
            <fieldset className="ew-block ew-tabular-meta">
              <legend className="ew-label">{isExcel ? excelCopy.setupTitle : powerBiCopy.setupTitle}</legend>
              <div className="ew-tabular-meta-row">
                <span className="ew-label">{isExcel ? excelCopy.method : powerBiCopy.method}</span>
                <span>{isExcel ? excelCopy.methodValue : powerBiCopy.methodValue}</span>
              </div>
              <div className="ew-tabular-meta-row">
                <span className="ew-label">{isExcel ? excelCopy.refresh : powerBiCopy.refresh}</span>
                <span>{isExcel ? `${form.excelSettings.refreshMinutes} ${excelCopy.minutes}` : powerBiCopy.refreshValue}</span>
              </div>
              <div className="ew-tabular-meta-row">
                <span className="ew-label">{isExcel ? excelCopy.credentials : powerBiCopy.credentials}</span>
                <span>{isExcel ? excelCopy.credentialsValue : powerBiCopy.credentialsValue}</span>
              </div>
            </fieldset>
          ) : (
            <>
          <div className="ew-fields">
            <label className="ew-field">
              <span className="ew-label">{destination.endpointLabel}</span>
              <input
                className="machine-input"
                value={form.endpoint}
                onChange={(event) => onEndpoint(event.target.value)}
                placeholder={
                  isSlack && endpointConfigured
                    ? slackCopy.stored
                    : destination.placeholder
                }
                type={isSlack ? "password" : "text"}
                autoComplete="off"
              />
              {isSlack && endpointConfigured && !form.endpoint ? (
                <small className="machine-help">
                  {slackCopy.stored}
                </small>
              ) : null}
            </label>

            {!isSlack ? <MockMenu
              label={wizard.authentication}
              value={authLabel}
              open={openMenu === "auth"}
              onToggle={() => onMenu(openMenu === "auth" ? null : "auth")}
              options={[
                { id: "none", label: wizard.authNone },
                { id: "api-key", label: wizard.authKey },
                { id: "bearer", label: wizard.authBearer },
              ]}
              selected={authMode}
              onSelect={(id) => {
                onAuth(id as AuthMode);
                onMenu(null);
              }}
            /> : null}

            {showHttp ? (
              <MockMenu
                label={wizard.method}
                value={httpMethod}
                open={openMenu === "method"}
                onToggle={() => onMenu(openMenu === "method" ? null : "method")}
                options={[
                  { id: "POST", label: "POST" },
                  { id: "GET", label: "GET" },
                  { id: "PUT", label: "PUT" },
                ]}
                selected={httpMethod}
                onSelect={(id) => {
                  onMethod(id as HttpMethod);
                  onMenu(null);
                }}
              />
            ) : null}
          </div>
          <p className="ew-muted">
            {isSlack
              ? slackCopy.help
              : copy.credentialsLater}
          </p>

          {isSlack ? (
            <div className="ew-notice">
              <strong>{slackCopy.layout}</strong>
              <br />
              {slackCopy.layoutHelp}
            </div>
          ) : (
            <fieldset className="ew-block">
              <legend className="ew-label">{copy.format}</legend>
              {(
                [
                  ["canonical-json", wizard.formatCanonical, wizard.formatCanonicalHint],
                  ["flat-json", wizard.formatFlat, ""],
                  ["csv", wizard.formatCsv, ""],
                ] as const
              ).map(([id, title, hint]) => (
                <ChoiceRow
                  key={id}
                  selected={form.format === id}
                  title={title}
                  description={hint}
                  radio
                  onSelect={() => onPatch({ format: id as ExportFormat })}
                />
              ))}
            </fieldset>
          )}
            </>
          )}

          {!isTabular ? <fieldset className="ew-block">
            <legend className="ew-label">{wizard.triggerWhen}</legend>
            {isSlack ? (
              <div className={`ew-condition-trigger ${form.alertRules.length ? "is-ready" : ""}`}>
                <span className="ew-condition-trigger-mark">{form.alertRules.length ? <FiCheck size={13} /> : null}</span>
                <div>
                  <strong>ตามเงื่อนไขที่กำหนด</strong>
                  <small>{form.alertRules.length ? `Slack จะส่งเฉพาะ Production Line ที่ตรงกับ ${form.alertRules.length} เงื่อนไข` : "กลับไปเพิ่มเงื่อนไข KPI ในขั้นเลือกข้อมูล"}</small>
                </div>
              </div>
            ) : <>
              <ChoiceRow selected={form.triggerMode === "manual"} title={isSap ? sapCopy.triggerManual : copy.manual} description={isSap ? undefined : "ส่งเมื่อผู้ใช้กด Run เท่านั้น"} radio onSelect={() => onPatch({ triggerMode: "manual" })} />
              <ChoiceRow selected={form.triggerMode === "schedule"} title={isSap ? sapCopy.triggerScheduled : "ส่งข้อมูลทุกช่วงเวลา"} description={isSap ? undefined : "ส่งข้อมูลของไลน์ที่เลือกทุกครั้งตามรอบเวลา"} radio onSelect={() => onPatch({ triggerMode: "schedule" })} />
              <ChoiceRow selected={form.triggerMode === "data-change"} title={isSap ? sapCopy.triggerConditional : "ตรวจและส่งเมื่อเข้าเงื่อนไขแจ้งเตือน"} description={isSap ? undefined : form.alertRules.length ? `ใช้ ${form.alertRules.length} เงื่อนไขจากขั้นเลือกข้อมูล` : "กรุณาเพิ่มเงื่อนไขแจ้งเตือนในขั้นเลือกข้อมูลก่อน"} radio disabled={!form.alertRules.length} onSelect={() => onPatch({ triggerMode: "data-change" })} />
            </>}
            {!isSlack && form.triggerMode !== "manual" ? (
              <label className="ew-trigger-interval">
                <span>{form.triggerMode === "data-change" ? "ตรวจข้อมูล iXacs ทุก" : "ส่งข้อมูลทุก"}</span>
                <input type="number" min="1" step="1" value={form.intervalMinutes} onChange={(event) => onPatch({ intervalMinutes: Math.max(1, Number(event.target.value) || 1) })} />
                <strong>นาที</strong>
              </label>
            ) : null}
            {form.triggerMode === "data-change" ? <p className="ew-trigger-note">ระบบจะตรวจค่าจริงจาก iXacs แยกตาม Production Line และส่งเฉพาะไลน์ที่เข้าเงื่อนไขครบจำนวนครั้ง</p> : null}
          </fieldset> : null}
        </div>
      )}
    </section>
  );
}

function ReviewStep({
  copy,
  locale,
  configId,
  wizard,
  form,
  preset,
  scopeMode,
  selectedConnection,
  destinationMeta,
  groups,
  slackCopy,
  sapCopy,
  sapConnection,
  sample,
  payloadPreview,
  sendResult,
  sendBusy,
  onPreview,
  onSend,
}: {
  copy: (typeof EXPORT_COPY)[keyof typeof EXPORT_COPY];
  locale: keyof typeof POWER_BI_COPY;
  configId?: string;
  wizard: WizardCopy;
  form: DraftForm;
  preset: DataPreset;
  scopeMode: ScopeMode;
  selectedConnection?: Connection;
  destinationMeta: (typeof WIZARD_DESTINATIONS)[DestinationType];
  groups: SourceGroup[];
  slackCopy: (typeof SLACK_COPY)[keyof typeof SLACK_COPY];
  sapCopy: (typeof SAP_COPY)[keyof typeof SAP_COPY];
  sapConnection: PublicSapConnection | null;
  sample: { line: string; product: string; actual: string; timestamp: string };
  payloadPreview: string | null;
  sendResult: { ok: boolean; transactionId: string | null; error?: string | null; payload?: unknown } | null;
  sendBusy: boolean;
  onPreview: () => void;
  onSend: () => void;
}) {
  const isSap = form.destinationType === "sap-odata";
  const isPowerBi = form.destinationType === "power-bi";
  const isExcel = form.destinationType === "excel";
  const isTabular = isPowerBi || isExcel;
  const powerBiCopy = POWER_BI_COPY[locale];
  const excelCopy = EXCEL_COPY[locale];
  const powerBiPath = configId ? `/api/power-bi/exports/${configId}` : "";
  const excelPath = configId ? `/api/excel/exports/${configId}` : "";
  const powerQuery = configId ? `let
  BaseUrl = "https://YOUR-SAM-HOST",
  ApiPath = "api/power-bi/exports/${configId}",
  ApiKey = "${form.powerBiApiKey}",
  TableName = "production",
  HistoryDays = ${form.powerBiSettings.historyDays},
  EndDate = Date.From(DateTimeZone.SwitchZone(DateTimeZone.FixedUtcNow(), 7)),
  StartDate = Date.AddDays(EndDate, 1 - HistoryDays),
  Windows = List.Generate(
    () => [From = StartDate],
    each [From] <= EndDate,
    each [From = Date.AddDays([From], 7)],
    each [From = [From], To = List.Min({Date.AddDays([From], 6), EndDate})]
  ),
  GetWindow = (Window as record) =>
    Json.Document(Web.Contents(BaseUrl, [
      RelativePath = ApiPath,
      Query = [table = TableName, #"from" = Date.ToText(Window[From], "yyyy-MM-dd"), to = Date.ToText(Window[To], "yyyy-MM-dd")],
      Headers = [Authorization = "Bearer " & ApiKey],
      Timeout = #duration(0, 0, 10, 0)
    ]))[value],
  Rows = List.Combine(List.Transform(Windows, each GetWindow(_))),
  Data = Table.FromRecords(Rows)
in
  Data` : "";
  const excelCurrentQuery = configId ? `let
  BaseUrl = "https://YOUR-SAM-HOST",
  RefreshToken = DateTimeZone.ToText(DateTimeZone.FixedUtcNow(), "yyyyMMddHHmmssfff"),
  Source = Json.Document(Web.Contents(BaseUrl, [
    RelativePath = "api/excel/exports/${configId}",
    Query = [table = "current", refresh = RefreshToken],
    Headers = [Authorization = "Bearer ${form.excelApiKey}"],
    IsRetry = true,
    Timeout = #duration(0, 0, 10, 0)
  ])),
  Data = Table.FromRecords(Source[value], null, MissingField.UseNull)
in
  Data` : "";
  const excelVba = `Option Explicit

Public SAMNextRefresh As Date

Public Sub StartSAMAutoRefresh()
    RefreshSAMData
End Sub

Public Sub RefreshSAMData()
    ThisWorkbook.RefreshAll
    SAMNextRefresh = Now + TimeSerial(0, ${form.excelSettings.refreshMinutes}, 0)
    Application.OnTime SAMNextRefresh, "RefreshSAMData"
End Sub

Public Sub StopSAMAutoRefresh()
    On Error Resume Next
    Application.OnTime SAMNextRefresh, "RefreshSAMData", , False
End Sub`;
  const excelQuery = configId ? `let
  BaseUrl = "https://YOUR-SAM-HOST",
  ApiPath = "api/excel/exports/${configId}",
  ApiKey = "${form.excelApiKey}",
  TableName = "production",
  HistoryDays = ${form.excelSettings.historyDays},
  EndDate = Date.From(DateTimeZone.SwitchZone(DateTimeZone.FixedUtcNow(), 7)),
  StartDate = Date.AddDays(EndDate, 1 - HistoryDays),
  Windows = List.Generate(
    () => [From = StartDate],
    each [From] <= EndDate,
    each [From = Date.AddDays([From], 1)],
    each [From = [From], To = [From]]
  ),
  GetWindow = (Window as record) =>
    Json.Document(Web.Contents(BaseUrl, [
      RelativePath = ApiPath,
      Query = [table = TableName, #"from" = Date.ToText(Window[From], "yyyy-MM-dd"), to = Date.ToText(Window[To], "yyyy-MM-dd")],
      Headers = [Authorization = "Bearer " & ApiKey],
      Timeout = #duration(0, 0, 10, 0)
    ]))[value],
  Rows = List.Combine(List.Transform(Windows, each GetWindow(_))),
  Data = Table.FromRecords(Rows, null, MissingField.UseNull)
in
  Data` : "";
  const presetLabel =
    preset === "summary"
      ? wizard.presetSummary
      : preset === "performance"
        ? wizard.presetPerformance
        : preset === "full"
          ? wizard.presetFull
          : wizard.presetCustom;
  const triggerLabel =
    form.triggerMode === "schedule"
      ? sapCopy.triggerScheduled
      : form.triggerMode === "data-change"
        ? sapCopy.triggerConditional
        : sapCopy.triggerManual;
  const selectedGroupNames = groups
    .filter((group) => form.groupUuids.includes(group.uuid))
    .map((group) => group.name);
  const scopeLabel = scopeMode === "all"
    ? `${wizard.allGroups}`
    : selectedGroupNames.join(", ") || "—";
  const unit = form.sapConfirmationUnit || form.sapOrder?.unit || "PC";
  const yieldLabel = sample.actual ? `${sample.actual} ${unit}` : "—";

  return (
    <section className="ew-step">
      <StepIntro title={wizard.reviewHeading} />
      <div className="ew-review-title">
        <h3>{form.name.trim() || wizard.untitled}</h3>
        <span className="ew-draft-status">
          {form.destinationType === "slack"
            ? slackCopy.ready
            : isSap
              ? sapCopy.simulationBadge
              : copy.draft}
        </span>
      </div>
      {form.description.trim() ? <p className="ew-review-desc">{form.description}</p> : null}

      {isSap ? (
        <>
          <div className="ew-review-stack">
            <section>
              <p className="ew-label">{copy.source}</p>
              <strong>iXacs</strong>
              <small>{sapCopy.sourceCompany}</small>
            </section>
            <section>
              <p className="ew-label">{wizard.stepData}</p>
              <strong>{presetLabel}</strong>
            </section>
            <section>
              <p className="ew-label">{sapCopy.reviewPoHeading}</p>
              <p className="ew-sap-status is-on">
                <i />
                {sapCopy.connected}
              </p>
              <small>{sapConnection?.name || sapCopy.reviewSandbox}</small>
              <dl className="ew-sap-preview">
                <div>
                  <dt>{sapCopy.order}</dt>
                  <dd>{form.sapOrder?.id || "—"}</dd>
                </div>
                <div>
                  <dt>{sapCopy.product}</dt>
                  <dd>{form.sapOrder?.product || "—"}</dd>
                </div>
                <div>
                  <dt>{sapCopy.plant}</dt>
                  <dd>{form.sapOrder?.plant || "—"}</dd>
                </div>
              </dl>
            </section>
            <section>
              <p className="ew-label">{sapCopy.confirmation}</p>
              <p className="ew-sap-status is-sim">
                <i />
                {sapCopy.simulationMode}
              </p>
              <dl className="ew-sap-preview">
                <div>
                  <dt>{sapCopy.actualNum}</dt>
                  <dd>{sample.actual || "—"}</dd>
                </div>
                <div>
                  <dt>{sapCopy.yieldQty}</dt>
                  <dd>{yieldLabel}</dd>
                </div>
              </dl>
              <small>{sapCopy.noWrite}</small>
            </section>
            <section>
              <p className="ew-label">{copy.trigger}</p>
              <strong>{triggerLabel}</strong>
            </section>
          </div>
          {payloadPreview ? (
            <div className="ew-sap-map-block">
              <div className="ew-sap-sim-head">
                <p className="ew-label">{sapCopy.payloadHeading}</p>
                <span className="ew-sap-badge">{sapCopy.payloadSub}</span>
              </div>
              <pre className="ew-sap-payload">{payloadPreview}</pre>
            </div>
          ) : null}
          {sendResult?.ok ? (
            <div className="ew-sap-result is-ok">
              <strong>✓ {sapCopy.simOk}</strong>
              <span>{sapCopy.reviewOrder} {form.sapOrder?.id}</span>
              <span>{sapCopy.yield} {yieldLabel}</span>
              <span>{sapCopy.simValidation} {sapCopy.simPassed}</span>
              <span>{sapCopy.simPayload} {sapCopy.simValid}</span>
              <span>{sapCopy.simWrite} {sapCopy.simNotExecuted}</span>
              <span>{sapCopy.simMode} {sapCopy.simModeValue}</span>
              {sendResult.transactionId ? <span>{sendResult.transactionId}</span> : null}
            </div>
          ) : null}
          {sendResult && !sendResult.ok ? (
            <div className="ew-sap-result is-bad">
              <strong>{sapCopy.sendFail}</strong>
              <small>{sendResult.error || sapCopy.failedHint}</small>
            </div>
          ) : null}
          <div className="ew-sap-actions">
            <button type="button" className="btn btn-secondary" onClick={onPreview}>
              {sapCopy.previewPayload}
            </button>
            <button type="button" className="btn btn-primary" disabled={sendBusy} onClick={onSend}>
              {sapCopy.runSimulation}
            </button>
          </div>
          <ol className="ew-flow-stack" aria-hidden="true">
            <li><span>iXacs</span></li>
            <li className="ew-flow-arrow">↓</li>
            <li><span className="is-bridge">SAM Bridge</span></li>
            <li className="ew-flow-arrow">↓</li>
            <li><span>{sapCopy.flowRead}</span></li>
            <li className="ew-flow-arrow">↓</li>
            <li>
              <span>{sapCopy.reviewSandbox}</span>
              <small className="is-real">{sapCopy.flowReal}</small>
            </li>
            <li className="ew-flow-arrow">↓</li>
            <li><span>{sapCopy.flowMap}</span></li>
            <li className="ew-flow-arrow">↓</li>
            <li><span>{sapCopy.flowPayload}</span></li>
            <li className="ew-flow-arrow">↓</li>
            <li>
              <span>{sapCopy.simModeValue}</span>
              <small className="is-sim">{sapCopy.flowNotSent}</small>
            </li>
          </ol>
        </>
      ) : (
        <>
      <dl className="ew-review">
        <div>
          <dt>{copy.source}</dt>
          <dd>
            <strong>{selectedConnection?.name ?? "—"}</strong>
            {selectedConnection ? <small>{hostOf(selectedConnection.baseUrl)}</small> : null}
          </dd>
        </div>
        <div>
          <dt>{copy.selectedScope}</dt>
          <dd>
            {scopeMode === "all" ? (
              <>
                {wizard.allGroups}
                <small>{wizard.allLines}</small>
              </>
            ) : (
              <>
                {scopeLabel}
                <small>
                  {form.lineUuids.length} Lines
                </small>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>{wizard.stepData}</dt>
          <dd>
            {isTabular
              ? isExcel ? form.excelSettings.tables.map((table) => table === "history" ? "tblSAMProduction" : "tblSAMCurrent").join(" · ") : form.powerBiSettings.datasets.map((item) => item === "production" ? "FactProduction" : "FactLostTime").join(" · ")
              : `${presetLabel} · ${form.fields.length} ${copy.fields}`}
          </dd>
        </div>
        <div>
          <dt>{copy.destination}</dt>
          <dd>{destinationMeta.name}</dd>
        </div>
        <div>
          <dt>{copy.format}</dt>
          <dd>{isPowerBi ? powerBiCopy.model : isExcel ? excelCopy.model : form.destinationType === "slack" ? slackCopy.layout : form.format}</dd>
        </div>
        <div>
          <dt>{copy.trigger}</dt>
          <dd>{isPowerBi ? powerBiCopy.refreshValue : isExcel ? form.excelSettings.autoRefresh ? `AutoRefresh · ${form.excelSettings.refreshMinutes} ${excelCopy.minutes}` : copy.manual : copy.manual}</dd>
        </div>
        {isPowerBi ? <div><dt>{powerBiCopy.history}</dt><dd>{form.powerBiSettings.historyDays} {powerBiCopy.days}</dd></div> : null}
        {isExcel && form.excelSettings.tables.includes("history") ? <div><dt>{powerBiCopy.history}</dt><dd>{form.excelSettings.historyDays} {powerBiCopy.days} · {excelCopy.historyTable}</dd></div> : null}
      </dl>
      <div className="ew-flow" aria-hidden="true">
        <span>iXacs</span>
        <i />
        <span className="is-bridge">SAM Bridge</span>
        <i />
        <span>{destinationMeta.name}</span>
      </div>
      {isPowerBi && configId ? (
        <section className="ew-bi-connect">
          <div><p className="ew-label">Power BI API</p><code>{powerBiPath}</code></div>
          <div><p className="ew-label">Bearer API key</p><code>{form.powerBiApiKey}</code></div>
          <div>
            <p className="ew-label">Power Query (M)</p>
            <pre>{powerQuery}</pre>
          </div>
          <p className="ew-muted">เปลี่ยน YOUR-SAM-HOST เป็น Domain ของระบบ แล้ววางโค้ดใน Power BI Desktop → Get data → Blank query → Advanced Editor หากต้องการ Lost Time ให้เปลี่ยน table=production เป็น table=lost-time</p>
          <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(powerQuery)}>คัดลอก Power Query</button>
        </section>
      ) : null}
      {isExcel && configId ? (
        <section className="ew-bi-connect">
          <div><p className="ew-label">{excelCopy.api}</p><code>{excelPath}</code></div>
          <div><p className="ew-label">Bearer API key</p><code>{form.excelApiKey}</code></div>
          <div><p className="ew-label">{excelCopy.tableName}</p><code>{form.excelSettings.tables.map((table) => table === "history" ? "tblSAMProduction" : "tblSAMCurrent").join(" · ")}</code></div>
          {form.excelSettings.tables.includes("history") ? <div><p className="ew-label">{excelCopy.query} · tblSAMProduction</p><pre>{excelQuery}</pre></div> : null}
          {form.excelSettings.tables.includes("current") ? <div><p className="ew-label">{excelCopy.query} · tblSAMCurrent</p><pre>{excelCurrentQuery}</pre></div> : null}
          <p className="ew-muted">{excelCopy.install}</p>
          {form.excelSettings.autoRefresh ? <p className="ew-muted">สำหรับ .xlsm ให้วาง VBA ใน Standard Module แล้วเรียก StartSAMAutoRefresh หนึ่งครั้ง ระบบจะ RefreshAll ทุก {form.excelSettings.refreshMinutes} นาทีขณะเปิด Excel และดึง tblSAMCurrent ใหม่เหมือนหน้า Realtime</p> : null}
          <div className="ew-bar-actions">
            {form.excelSettings.tables.includes("history") ? <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(excelQuery.replace("https://YOUR-SAM-HOST", window.location.origin))}>{excelCopy.copyQuery} · History</button> : null}
            {form.excelSettings.tables.includes("current") ? <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(excelCurrentQuery.replace("https://YOUR-SAM-HOST", window.location.origin))}>{excelCopy.copyQuery} · Current</button> : null}
            {form.excelSettings.autoRefresh ? <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(excelVba)}>{excelCopy.copyVba}</button> : null}
          </div>
        </section>
      ) : null}
        </>
      )}
    </section>
  );
}

function StepIntro({ title, description }: { title: string; description?: string }) {
  return (
    <div className="ew-intro">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function ChoiceRow({
  selected = false,
  title,
  description,
  badge,
  radio,
  disabled,
  onSelect,
}: {
  selected?: boolean;
  title: string;
  description?: string;
  badge?: string;
  radio?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={`ew-choice ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      {radio ? (
        <span className={`ew-choice-mark is-radio ${selected ? "is-on" : ""}`}>
          {selected ? <span /> : null}
        </span>
      ) : null}
      <span className="ew-choice-copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      {badge ? <em className="ew-badge">{badge}</em> : null}
      {!radio && selected ? <FiCheck size={16} className="ew-choice-check" /> : null}
    </button>
  );
}

function MockMenu({
  label,
  value,
  open,
  options,
  selected,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  open: boolean;
  options: { id: string; label: string }[];
  selected: string;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ew-field">
      <span className="ew-label">{label}</span>
      <button type="button" className="ew-select-row is-compact" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{value}</strong>
        </span>
        <FiChevronRight size={16} className={open ? "is-open" : ""} />
      </button>
      {open ? (
        <ul className="ew-picker-list">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={option.id === selected ? "is-selected" : ""}
                onClick={() => onSelect(option.id)}
              >
                <span>
                  <strong>{option.label}</strong>
                </span>
                {option.id === selected ? <FiCheck size={15} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
