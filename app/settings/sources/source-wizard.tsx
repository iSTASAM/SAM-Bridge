"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FiArrowLeft,
  FiArrowUp,
  FiArrowUpRight,
  FiCheck,
  FiChevronRight,
  FiCircle,
  FiPlus,
  FiServer,
  FiX,
} from "react-icons/fi";
import { OverlayFrame } from "../connections/overlay-frame";
import { useLocale, type Locale } from "../../locale-context";
import { SOURCE_COPY } from "./source-copy";
import {
  SOURCE_CONNECTORS,
  type SourceConfig,
  type SourceConfigInput,
  type SourceType,
} from "./types";

type Step = 0 | 1 | 2;
type LineMode = "all" | "specific";
type Picker = "machine" | "groups" | null;
type Machine = { id: string; name: string };
type IxacsGroup = { uuid: string; name: string; lines: Array<{ uuid: string; name: string }> };
type FileStats = { name: string; rows: number; columns: number; headers: string[] };

const STEPS = ["Scope", "Source", "Review"] as const;
const PRIORITY_SOURCES: Array<{
  id: SourceType;
  name: string;
  hint: string;
  icon: typeof FiArrowUp;
}> = [
  { id: "file-upload", name: "Upload File", hint: "Markdown, CSV, Excel", icon: FiArrowUp },
  { id: "database", name: "Database", hint: "SQL Database", icon: FiServer },
  { id: "webhook", name: "Webhook", hint: "HTTP Push", icon: FiArrowUpRight },
  { id: "mqtt", name: "MQTT", hint: "IoT / Telemetry", icon: FiCircle },
];
const CHIP_LIMIT = 3;

function initialDraft(type: SourceType = "file-upload"): SourceConfigInput {
  const connector = SOURCE_CONNECTORS.find((item) => item.id === type) ?? SOURCE_CONNECTORS.find((item) => item.id === "file-upload")!;
  return {
    name: "",
    description: "",
    type: connector.id,
    site: "",
    owner: "",
    endpoint: "",
    resource: "",
    authMode: "none",
    ingestionMode: connector.modes[0],
    intervalMinutes: 15,
    format: connector.formats[0],
    domains: ["maintenance"],
    connectionId: "",
    groupUuids: [],
    lineUuids: [],
    uploadFileName: "",
  };
}

function copy(locale: Locale) {
  if (locale === "th") {
    return {
      lead: "กำหนดว่าข้อมูลนี้จะใช้กับส่วนใดของ iXacs",
      machine: "เครื่อง iXacs",
      selectMachine: "เลือกเครื่อง iXacs",
      loadingMachines: "กำลังโหลดเครื่อง…",
      emptyMachines: "ยังไม่มีเครื่อง iXacs",
      groups: "Production Groups",
      groupsHint: "เลือกได้มากกว่า 1 กลุ่ม",
      addGroup: "เลือก Production Group",
      pickGroup: "เลือก Production Group",
      searchGroups: "ค้นหากลุ่ม...",
      done: "Done",
      selected: "selected",
      lines: "Production Lines",
      linesHint: "เลือก Line ที่ Data Source นี้จะใช้งาน",
      allLines: "ใช้ทุก Line",
      someLines: "เลือกบาง Line",
      allLinesSummary: (lines: number, groups: number) =>
        `${lines} ${lines === 1 ? "Line" : "Lines"} จาก ${groups} ${groups === 1 ? "Group" : "Groups"}`,
      searchLines: "Search lines...",
      selectAll: "Select all",
      selectedLines: "Selected Lines",
      more: (count: number) => `+${count} more`,
      loadingGroups: "กำลังโหลดกลุ่ม…",
      emptyGroups: "ไม่พบ Production Group",
      sourceTitle: "เลือก Data Source",
      sourceLead: "ข้อมูลเพิ่มเติมที่จะนำมาเชื่อมกับขอบเขต iXacs ที่เลือก",
      dropTitle: "ลากไฟล์มาวางที่นี่",
      dropHint: "หรือคลิกเพื่อเลือกไฟล์",
      dropTypes: "MD · CSV · XLS · XLSX",
      replace: "Replace",
      preview: "Preview",
      rows: "rows",
      columns: "columns",
      dataTitle: "จับคู่ฟิลด์",
      dataLead: "ฟิลด์จากแหล่งข้อมูลจะถูกจับคู่กับ SAM",
      sourceField: "Source",
      samField: "SAM",
      auto: "Auto",
      reviewMachine: "เครื่อง iXacs",
      reviewGroups: "Production Groups",
      reviewLines: "Production Lines",
      reviewSource: "Source",
      reviewFile: "File",
      reviewFields: "Mapped fields",
      scopeAll: "ใช้ทุก Line",
      create: "สร้าง Data Source",
      saving: "กำลังบันทึก…",
      required: "เลือกเครื่อง iXacs อย่างน้อย 1 Production Group และ Line",
    };
  }
  if (locale === "ja") {
    return {
      lead: "このデータを iXacs のどの範囲で使うかを指定します",
      machine: "iXacsホスト",
      selectMachine: "iXacsホストを選択",
      loadingMachines: "読み込み中…",
      emptyMachines: "iXacsホストがありません",
      groups: "Production Groups",
      groupsHint: "複数のグループを選択できます",
      addGroup: "Production Groupを選択",
      pickGroup: "Production Groupを選択",
      searchGroups: "グループを検索...",
      done: "Done",
      selected: "selected",
      lines: "Production Lines",
      linesHint: "この Data Source を使うラインを選びます",
      allLines: "すべての Line",
      someLines: "Line を指定",
      allLinesSummary: (lines: number, groups: number) =>
        `${groups}グループの${lines} ${lines === 1 ? "Line" : "Lines"}`,
      searchLines: "Search lines...",
      selectAll: "Select all",
      selectedLines: "Selected Lines",
      more: (count: number) => `+${count} more`,
      loadingGroups: "グループを読み込み中…",
      emptyGroups: "Production Groupがありません",
      sourceTitle: "Data Sourceを選択",
      sourceLead: "選択した iXacs 範囲に接続する追加データ",
      dropTitle: "ファイルをドロップ",
      dropHint: "またはクリックして選択",
      dropTypes: "MD · CSV · XLS · XLSX",
      replace: "Replace",
      preview: "Preview",
      rows: "rows",
      columns: "columns",
      dataTitle: "フィールド対応",
      dataLead: "ソースのフィールドを SAM に対応付けます",
      sourceField: "Source",
      samField: "SAM",
      auto: "Auto",
      reviewMachine: "iXacsホスト",
      reviewGroups: "Production Groups",
      reviewLines: "Production Lines",
      reviewSource: "Source",
      reviewFile: "File",
      reviewFields: "Mapped fields",
      scopeAll: "すべての Line",
      create: "Data Sourceを作成",
      saving: "保存中…",
      required: "iXacsホスト、1つ以上の Group、Line を選択してください",
    };
  }
  return {
    lead: "Choose where this data will be used in iXacs",
    machine: "iXacs machine",
    selectMachine: "Select an iXacs machine",
    loadingMachines: "Loading machines…",
    emptyMachines: "No iXacs machines yet",
    groups: "Production Groups",
    groupsHint: "You can select more than one group",
    addGroup: "Select Production Group",
    pickGroup: "Select Production Group",
    searchGroups: "Search groups...",
    done: "Done",
    selected: "selected",
    lines: "Production Lines",
    linesHint: "Choose the lines this data source will use",
    allLines: "All lines",
    someLines: "Select lines",
    allLinesSummary: (lines: number, groups: number) =>
      `${lines} ${lines === 1 ? "line" : "lines"} from ${groups} ${groups === 1 ? "group" : "groups"}`,
    searchLines: "Search lines...",
    selectAll: "Select all",
    selectedLines: "Selected Lines",
    more: (count: number) => `+${count} more`,
    loadingGroups: "Loading groups…",
    emptyGroups: "No production groups found",
    sourceTitle: "Choose a data source",
    sourceLead: "Additional data to connect with the selected iXacs scope",
    dropTitle: "Drop a file here",
    dropHint: "or click to choose a file",
    dropTypes: "MD · CSV · XLS · XLSX",
    replace: "Replace",
    preview: "Preview",
    rows: "rows",
    columns: "columns",
    dataTitle: "Map fields",
    dataLead: "Source fields will be matched to SAM",
    sourceField: "Source",
    samField: "SAM",
    auto: "Auto",
    reviewMachine: "iXacs machine",
    reviewGroups: "Production Groups",
    reviewLines: "Production Lines",
    reviewSource: "Source",
    reviewFile: "File",
    reviewFields: "Mapped fields",
    scopeAll: "All lines",
    create: "Create data source",
    saving: "Saving…",
    required: "Select an iXacs machine, at least one group, and the lines to use",
  };
}

function lineCount(count: number) {
  return `${count} ${count === 1 ? "Line" : "Lines"}`;
}

async function inspectFile(file: File): Promise<FileStats> {
  if (/\.(md|markdown)$/i.test(file.name)) {
    const text = await file.text();
    const headings = text.split(/\r?\n/).filter((line) => /^#{1,6}\s+/.test(line)).map((line) => line.replace(/^#{1,6}\s+/, "").trim());
    return { name: file.name, rows: text.split(/\r?\n/).length, columns: 1, headers: headings.slice(0, 20) };
  }
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const headers = (lines[0] ?? "").split(/,|;|\t/).map((item) => item.trim().replace(/^"|"$/g, ""));
    return { name: file.name, rows: Math.max(0, lines.length - 1), columns: headers.filter(Boolean).length, headers };
  }
  return {
    name: file.name,
    rows: Math.max(120, Math.round(file.size / 36)),
    columns: 0,
    headers: [],
  };
}

function Check({ on }: { on: boolean }) {
  return (
    <span className={`sw-check${on ? " is-on" : ""}`} aria-hidden>
      {on ? <FiCheck size={12} /> : null}
    </span>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="sw-chip" onClick={onRemove}>
      {label}
      <FiX size={13} />
    </button>
  );
}

function Block({
  title,
  meta,
  hint,
  children,
}: {
  title: string;
  meta?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="sw-block">
      <div className="sw-block-head">
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {hint ? <p className="sw-hint">{hint}</p> : null}
      {children}
    </section>
  );
}

export function SourceWizard({
  configId,
  initialType,
}: {
  configId?: string;
  initialType?: SourceType;
}) {
  const { locale } = useLocale();
  const page = SOURCE_COPY[locale];
  const label = copy(locale);
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<SourceConfigInput>(() => initialDraft(initialType ?? "file-upload"));
  const [lineMode, setLineMode] = useState<LineMode>("all");
  const [picker, setPicker] = useState<Picker>(null);
  const [groupQuery, setGroupQuery] = useState("");
  const [lineQuery, setLineQuery] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showAllChips, setShowAllChips] = useState(false);
  const [loading, setLoading] = useState(Boolean(configId));
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [groups, setGroups] = useState<IxacsGroup[]>([]);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const groupSearchRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/connections", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { connections?: Machine[] }) => {
        if (cancelled) return;
        setMachines(Array.isArray(data.connections) ? data.connections : []);
      })
      .catch(() => {
        if (!cancelled) setScopeError(locale === "th" ? "โหลดรายการเครื่อง iXacs ไม่สำเร็จ" : "Could not load iXacs machines");
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!form.connectionId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setCatalogLoading(true);
      setScopeError(null);
      try {
        const response = await fetch(`/api/connections/${form.connectionId}/catalog`, { cache: "no-store" });
        const data = (await response.json()) as { groups?: IxacsGroup[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load groups and lines");
        if (!cancelled) setGroups(data.groups ?? []);
      } catch (error: unknown) {
        if (!cancelled) setScopeError(error instanceof Error ? error.message : "Could not load groups and lines");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.connectionId]);

  useEffect(() => {
    if (!configId) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/sources/${configId}`, { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }
      const config = (await response.json()) as SourceConfig;
      if (cancelled) return;
      const { id: _id, status: _status, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = config;
      void _id;
      void _status;
      void _createdAt;
      void _updatedAt;
      setForm({
        ...draft,
        connectionId: draft.connectionId ?? "",
        groupUuids: draft.groupUuids ?? [],
        lineUuids: draft.lineUuids ?? [],
        uploadFileName: draft.uploadFileName ?? "",
      });
      if (draft.uploadFileName) {
        setFileStats({
          name: draft.uploadFileName,
          rows: 0,
          columns: 0,
          headers: [],
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [configId]);

  const selectedGroups = useMemo(
    () => groups.filter((group) => form.groupUuids.includes(group.uuid)),
    [form.groupUuids, groups],
  );
  const availableLineIds = useMemo(
    () => selectedGroups.flatMap((group) => group.lines.map((line) => line.uuid)),
    [selectedGroups],
  );
  const selectedLines = useMemo(
    () => selectedGroups.flatMap((group) => group.lines.filter((line) => form.lineUuids.includes(line.uuid))),
    [form.lineUuids, selectedGroups],
  );
  const machine = machines.find((item) => item.id === form.connectionId);
  const connector = SOURCE_CONNECTORS.find((item) => item.id === form.type) ?? SOURCE_CONNECTORS[0];

  useEffect(() => {
    if (hydratedRef.current || catalogLoading || !form.connectionId) return;
    if (configId && loading) return;
    const allOn =
      availableLineIds.length > 0 &&
      availableLineIds.length === form.lineUuids.length &&
      availableLineIds.every((id) => form.lineUuids.includes(id));
    if (form.lineUuids.length > 0) setLineMode(allOn ? "all" : "specific");
    hydratedRef.current = true;
  }, [availableLineIds, catalogLoading, configId, form.connectionId, form.lineUuids, loading]);

  useEffect(() => {
    if (lineMode !== "all" || availableLineIds.length === 0) return;
    const same =
      availableLineIds.length === form.lineUuids.length &&
      availableLineIds.every((id) => form.lineUuids.includes(id));
    if (!same) setForm((current) => ({ ...current, lineUuids: availableLineIds }));
  }, [availableLineIds, form.lineUuids, lineMode]);

  useEffect(() => {
    if (!picker) return;
    function onPointer(event: PointerEvent) {
      if ((event.target as HTMLElement).closest("[data-sw-picker]")) return;
      setPicker(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPicker(null);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [picker]);

  useEffect(() => {
    if (picker === "groups") groupSearchRef.current?.focus();
  }, [picker]);

  useEffect(() => {
    setPicker(null);
    setNotice(null);
    canvasRef.current?.closest(".app-content")?.scrollTo({ top: 0 });
  }, [step]);

  const scopeReady = Boolean(
    form.connectionId &&
      form.groupUuids.length &&
      (lineMode === "all" || form.lineUuids.length > 0),
  );
  const sourceReady = form.type !== "file-upload" || Boolean(form.uploadFileName);
  const canContinue = step === 0 ? scopeReady : step === 1 ? sourceReady : true;

  function patch(values: Partial<SourceConfigInput>) {
    setForm((current) => ({ ...current, ...values }));
    setNotice(null);
  }

  function chooseMachine(connectionId: string) {
    hydratedRef.current = true;
    setLineMode("all");
    setPicker(null);
    setGroupQuery("");
    setLineQuery("");
    setExpandedGroup(null);
    setShowAllChips(false);
    patch({ connectionId, groupUuids: [], lineUuids: [] });
  }

  function toggleGroup(uuid: string) {
    const selected = form.groupUuids.includes(uuid);
    const groupUuids = selected ? form.groupUuids.filter((id) => id !== uuid) : [...form.groupUuids, uuid];
    const allowed = new Set(
      groups.filter((group) => groupUuids.includes(group.uuid)).flatMap((group) => group.lines.map((line) => line.uuid)),
    );
    if (groupUuids.length === 0) {
      setLineMode("all");
      setExpandedGroup(null);
      setLineQuery("");
      setShowAllChips(false);
    }
    patch({ groupUuids, lineUuids: form.lineUuids.filter((id) => allowed.has(id)) });
  }

  function toggleLine(uuid: string) {
    patch({
      lineUuids: form.lineUuids.includes(uuid)
        ? form.lineUuids.filter((id) => id !== uuid)
        : [...form.lineUuids, uuid],
    });
  }

  function toggleGroupLines(group: IxacsGroup) {
    const ids = group.lines.map((line) => line.uuid);
    const allOn = ids.length > 0 && ids.every((id) => form.lineUuids.includes(id));
    patch({
      lineUuids: allOn
        ? form.lineUuids.filter((id) => !ids.includes(id))
        : [...new Set([...form.lineUuids, ...ids])],
    });
  }

  function chooseSource(type: SourceType) {
    const next = SOURCE_CONNECTORS.find((item) => item.id === type)!;
    patch({
      type,
      ingestionMode: next.modes[0],
      format: next.formats[0],
      authMode: "none",
      domains: type === "file-upload" ? ["maintenance"] : ["machine-event"],
    });
  }

  async function takeFile(file: File | null) {
    if (!file) {
      setUploadFile(null);
      setFileStats(null);
      patch({ uploadFileName: "" });
      return;
    }
    const stats = await inspectFile(file);
    setUploadFile(file);
    setFileStats(stats);
    patch({
      uploadFileName: file.name,
      name: form.name.trim() || file.name.replace(/\.[^.]+$/, ""),
      format: /\.(md|markdown)$/i.test(file.name) ? "markdown" : file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel",
    });
  }

  function next() {
    if (!canContinue) {
      setNotice(label.required);
      return;
    }
    setStep((current) => (current < 2 ? ((current + 1) as Step) : current));
  }

  async function save() {
    if (!scopeReady) {
      setNotice(label.required);
      return;
    }
    setSaving(true);
    const payload: SourceConfigInput = {
      ...form,
      name: form.name.trim() || [machine?.name, connector.name].filter(Boolean).join(" · ") || "Data Source",
      lineUuids: lineMode === "all" ? availableLineIds : form.lineUuids,
      domains: form.domains.length ? form.domains : ["maintenance"],
    };
    const response = await fetch(configId ? `/api/sources/${configId}` : "/api/sources", {
      method: configId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setNotice(page.saveError);
      setSaving(false);
      return;
    }
    const saved = (await response.json()) as SourceConfig;
    if (form.type === "file-upload" && uploadFile) {
      const upload = new FormData();
      upload.set("file", uploadFile);
      const uploadResponse = await fetch(`/api/sources/${saved.id}/upload`, { method: "POST", body: upload });
      if (!uploadResponse.ok) {
        const result = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
        setNotice(result.error || "Could not upload file");
        setSaving(false);
        return;
      }
    }
    router.push("/settings/sources");
  }

  if (notFound) {
    return (
      <div className="source-wizard">
        <div className="source-wizard-canvas" ref={canvasRef}>
          <h1 className="sw-title">{page.notFound}</h1>
          <Link href="/settings/sources" className="sw-back">
            <FiArrowLeft size={16} />
            {page.back}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="source-wizard">
        <div className="source-wizard-canvas" ref={canvasRef}>
          <div className="sw-loading skeleton" />
        </div>
      </div>
    );
  }

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(groupQuery.trim().toLowerCase()),
  );
  const visibleLineGroups = selectedGroups
    .map((group) => ({
      ...group,
      lines: group.lines.filter((line) =>
        line.name.toLowerCase().includes(lineQuery.trim().toLowerCase()),
      ),
    }))
    .filter((group) => lineQuery.trim() === "" || group.lines.length > 0);
  const visibleChips = showAllChips ? selectedLines : selectedLines.slice(0, CHIP_LIMIT);
  const hiddenChipCount = Math.max(0, selectedLines.length - visibleChips.length);
  const machineValue = scopeLoading && machines.length === 0
    ? label.loadingMachines
    : machine?.name || label.selectMachine;

  return (
    <div className="source-wizard">
      <div className="source-wizard-canvas" ref={canvasRef}>
        <header className="sw-head">
          <Link href="/settings/sources" className="sw-back">
            <FiArrowLeft size={16} />
            {page.back}
          </Link>
          <h1 className="sw-title">{configId ? page.editTitle : page.newTitle}</h1>
          <p className="sw-lead">{label.lead}</p>
          <nav className="sw-steps" aria-label="Wizard steps">
            {STEPS.map((name, index) => (
              <span key={name} className="sw-step-wrap">
                {index > 0 ? <i className="sw-step-rule" /> : null}
                <button
                  type="button"
                  className={`sw-step${step === index ? " is-current" : ""}${step > index ? " is-done" : ""}`}
                  disabled={index > step}
                  onClick={() => setStep(index as Step)}
                >
                  {name}
                </button>
              </span>
            ))}
          </nav>
        </header>

        <main className="sw-body">
          {step === 0 ? (
            <>
              <Block title={label.machine}>
                <div className="sw-picker" data-sw-picker>
                  <button
                    type="button"
                    className="sw-row"
                    aria-expanded={picker === "machine"}
                    aria-haspopup="listbox"
                    disabled={scopeLoading && machines.length === 0}
                    onClick={() => setPicker((current) => (current === "machine" ? null : "machine"))}
                  >
                    <span className={machine ? "" : "is-placeholder"}>{machineValue}</span>
                    <FiChevronRight size={18} />
                  </button>
                  {picker === "machine" ? (
                    <div className="sw-pop" role="listbox" aria-label={label.machine}>
                      {machines.length === 0 ? (
                        <p className="sw-pop-empty">{label.emptyMachines}</p>
                      ) : (
                        machines.map((item) => {
                          const on = item.id === form.connectionId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="option"
                              aria-selected={on}
                              className={`sw-pop-row${on ? " is-on" : ""}`}
                              onClick={() => chooseMachine(item.id)}
                            >
                              <span>{item.name}</span>
                              {on ? <FiCheck size={16} /> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
                {scopeError ? <p className="sw-notice">{scopeError}</p> : null}
              </Block>

              {form.connectionId ? (
                <Block
                  title={label.groups}
                  meta={form.groupUuids.length ? `${form.groupUuids.length} ${label.selected}` : undefined}
                  hint={label.groupsHint}
                >
                  {catalogLoading ? <p className="sw-quiet">{label.loadingGroups}</p> : null}
                  {selectedGroups.length ? (
                    <div className="sw-chips">
                      {selectedGroups.map((group) => (
                        <Chip
                          key={group.uuid}
                          label={group.name || group.uuid}
                          onRemove={() => toggleGroup(group.uuid)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {!catalogLoading ? (
                    <div className="sw-picker" data-sw-picker>
                      <button
                        type="button"
                        className="sw-add"
                        aria-expanded={picker === "groups"}
                        onClick={() => {
                          setGroupQuery("");
                          setPicker((current) => (current === "groups" ? null : "groups"));
                        }}
                      >
                        <FiPlus size={15} />
                        {label.addGroup}
                      </button>
                      {picker === "groups" ? (
                        <div className="sw-pop sw-pop-menu" role="dialog" aria-label={label.pickGroup}>
                          <strong className="sw-pop-title">{label.pickGroup}</strong>
                          <input
                            ref={groupSearchRef}
                            className="sw-search"
                            value={groupQuery}
                            onChange={(event) => setGroupQuery(event.target.value)}
                            placeholder={label.searchGroups}
                          />
                          <div className="sw-pop-list">
                            {filteredGroups.length === 0 ? (
                              <p className="sw-pop-empty">{label.emptyGroups}</p>
                            ) : (
                              filteredGroups.map((group) => {
                                const on = form.groupUuids.includes(group.uuid);
                                return (
                                  <button
                                    key={group.uuid}
                                    type="button"
                                    className={`sw-pop-row${on ? " is-on" : ""}`}
                                    onClick={() => toggleGroup(group.uuid)}
                                  >
                                    <Check on={on} />
                                    <span>{group.name || group.uuid}</span>
                                    <small>{lineCount(group.lines.length)}</small>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          <div className="sw-pop-foot">
                            <button type="button" className="sw-text-btn" onClick={() => setPicker(null)}>
                              {label.done}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Block>
              ) : null}

              {form.groupUuids.length > 0 ? (
                <Block
                  title={label.lines}
                  meta={lineMode === "specific" && form.lineUuids.length ? `${form.lineUuids.length} ${label.selected}` : undefined}
                  hint={label.linesHint}
                >
                  <div className="sw-seg" role="radiogroup" aria-label={label.lines}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={lineMode === "all"}
                      className={lineMode === "all" ? "is-on" : ""}
                      onClick={() => {
                        setLineMode("all");
                        setExpandedGroup(null);
                        setLineQuery("");
                        setShowAllChips(false);
                      }}
                    >
                      {label.allLines}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={lineMode === "specific"}
                      className={lineMode === "specific" ? "is-on" : ""}
                      onClick={() => setLineMode("specific")}
                    >
                      {label.someLines}
                    </button>
                  </div>

                  {lineMode === "all" ? (
                    <p className="sw-quiet">{label.allLinesSummary(availableLineIds.length, selectedGroups.length)}</p>
                  ) : (
                    <>
                      <input
                        className="sw-search sw-search-page"
                        value={lineQuery}
                        onChange={(event) => setLineQuery(event.target.value)}
                        placeholder={label.searchLines}
                      />
                      <div className="sw-disclose">
                        {visibleLineGroups.map((group) => {
                          const open = expandedGroup === group.uuid || Boolean(lineQuery.trim());
                          const selectedCount = group.lines.filter((line) => form.lineUuids.includes(line.uuid)).length;
                          return (
                            <div key={group.uuid} className="sw-disclose-item">
                              <button
                                type="button"
                                className="sw-row sw-row-quiet"
                                aria-expanded={open}
                                onClick={() => setExpandedGroup(open && !lineQuery.trim() ? null : group.uuid)}
                              >
                                <span>{group.name || group.uuid}</span>
                                <em>{selectedCount} {label.selected}</em>
                                <FiChevronRight size={18} className={open ? "is-open" : ""} />
                              </button>
                              {open ? (
                                <div className="sw-disclose-body">
                                  <div className="sw-disclose-tools">
                                    <button type="button" className="sw-text-btn" onClick={() => toggleGroupLines(group)}>
                                      {label.selectAll}
                                    </button>
                                  </div>
                                  {group.lines.map((line) => {
                                    const on = form.lineUuids.includes(line.uuid);
                                    return (
                                      <button
                                        key={line.uuid}
                                        type="button"
                                        className={`sw-line${on ? " is-on" : ""}`}
                                        onClick={() => toggleLine(line.uuid)}
                                      >
                                        <Check on={on} />
                                        <span>{line.name || line.uuid}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {selectedLines.length > 0 ? (
                        <div className="sw-summary">
                          <h3>{label.selectedLines}</h3>
                          <div className="sw-chips">
                            {visibleChips.map((line) => (
                              <Chip
                                key={line.uuid}
                                label={line.name || line.uuid}
                                onRemove={() => toggleLine(line.uuid)}
                              />
                            ))}
                            {hiddenChipCount > 0 ? (
                              <button type="button" className="sw-more" onClick={() => setShowAllChips(true)}>
                                {label.more(hiddenChipCount)}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </Block>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <section className="sw-block">
              <h2 className="sw-page-title">{label.sourceTitle}</h2>
              <p className="sw-hint">{label.sourceLead}</p>
              <div className="sw-source-list">
                {PRIORITY_SOURCES.map((item) => {
                  const Icon = item.icon;
                  const on = form.type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sw-row sw-source-row${on ? " is-on" : ""}`}
                      onClick={() => chooseSource(item.id)}
                    >
                      <Icon size={18} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.hint}</small>
                      </span>
                      <FiChevronRight size={18} />
                    </button>
                  );
                })}
              </div>
              {form.type === "file-upload" ? (
                fileStats ? (
                  <div className="sw-file">
                    <div>
                      <strong>{fileStats.name}</strong>
                      <p>
                        {fileStats.rows.toLocaleString()} {label.rows}
                        {fileStats.columns ? ` · ${fileStats.columns.toLocaleString()} ${label.columns}` : ""}
                      </p>
                    </div>
                    <div className="sw-file-actions">
                      <label className="sw-text-btn">
                        {label.replace}
                        <input
                          type="file"
                          accept=".md,.markdown,.csv,.xls,.xlsx,text/markdown"
                          onChange={(event) => void takeFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <button type="button" className="sw-text-btn" onClick={() => setPreviewOpen(true)}>
                        {label.preview}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`sw-drop${dragging ? " is-dragging" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      void takeFile(event.dataTransfer.files[0] ?? null);
                    }}
                  >
                    <FiArrowUp size={22} />
                    <strong>{label.dropTitle}</strong>
                    <span>{label.dropHint}</span>
                    <em>{label.dropTypes}</em>
                    <input
                      type="file"
                      accept=".md,.markdown,.csv,.xls,.xlsx,text/markdown"
                      onChange={(event) => void takeFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                )
              ) : null}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="sw-block">
              <dl className="sw-review">
                <div>
                  <dt>{label.reviewMachine}</dt>
                  <dd>{machine?.name || "—"}</dd>
                </div>
                <div>
                  <dt>{label.reviewGroups}</dt>
                  <dd>{selectedGroups.map((group) => group.name || group.uuid).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>{label.reviewLines}</dt>
                  <dd>
                    {lineMode === "all"
                      ? `${label.scopeAll} · ${label.allLinesSummary(availableLineIds.length, selectedGroups.length)}`
                      : `${form.lineUuids.length} ${label.selected}`}
                  </dd>
                </div>
                <div>
                  <dt>{label.reviewSource}</dt>
                  <dd>{PRIORITY_SOURCES.find((item) => item.id === form.type)?.name || connector.name}</dd>
                </div>
                <div>
                  <dt>{label.reviewFile}</dt>
                  <dd>{form.uploadFileName || "—"}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {notice ? <p className="sw-notice">{notice}</p> : null}
        </main>
      </div>

      <footer className="source-wizard-bar">
        <div className="source-wizard-bar-inner">
          <Link href="/settings/sources" className="sw-cancel">
            {page.cancel}
          </Link>
          {step < 2 ? (
            <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={next}>
              {page.continue}
              <FiChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !scopeReady}
              onClick={() => void save()}
            >
              {saving ? label.saving : configId ? page.save : label.create}
            </button>
          )}
        </div>
      </footer>

      <OverlayFrame
        open={previewOpen}
        labelledBy="source-preview-title"
        onClose={() => setPreviewOpen(false)}
        className="modal sw-preview"
        backdropClassName="modal-backdrop"
      >
        <h2 id="source-preview-title">{fileStats?.name ?? label.preview}</h2>
        <p className="modal-copy">
          {fileStats ? `${fileStats.rows.toLocaleString()} ${label.rows} · ${fileStats.columns.toLocaleString()} ${label.columns}` : ""}
        </p>
        <div className="sw-file-preview">
          <strong>{fileStats?.headers.length ? "Detected headings / columns" : "Raw file"}</strong>
          {fileStats?.headers.length ? <ul>{fileStats.headers.map((header) => <li key={header}>{header}</li>)}</ul> : <p className="sw-hint">AI will read the file as-is. Field mapping is not required.</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={() => setPreviewOpen(false)}>
            OK
          </button>
        </div>
      </OverlayFrame>
    </div>
  );
}
