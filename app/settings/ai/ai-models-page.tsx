"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { OverlayFrame } from "../connections/overlay-frame";
import { ClaudeIcon, GeminiIcon, OpenAIIcon, OpenRouterIcon } from "../../flow/ai-icons";
import { useLocale, type Locale } from "../../locale-context";
import { SYSTEMS_COPY } from "../systems/copy";
import { SystemsStage } from "../systems/systems-channel-nav";
import { AiUsageHeatmap } from "./ai-usage-heatmap";

type ProviderKind = "openai" | "anthropic" | "gemini" | "openrouter" | "custom";
type UsageId = "maintenance" | "production" | "events" | "enrichment";
type Drawer =
  | { mode: "configure"; providerId: string }
  | { mode: "manage"; providerId: string }
  | { mode: "add" }
  | null;
type ModelRef = { providerId: string; model: string };
type Provider = {
  id: string;
  kind: ProviderKind;
  name: string;
  hint: string;
  connected: boolean;
  keyLast4: string;
  baseUrl: string;
  model: string;
  lastTestedAt: string | null;
  models: string[];
};

const USAGES: UsageId[] = ["maintenance", "production", "events", "enrichment"];
const SHOW_MODEL_USAGE = false;
const CATALOG: Record<Exclude<ProviderKind, "custom">, string[]> = {
  openai: ["gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"],
};
const BUILTINS: Array<Pick<Provider, "id" | "kind" | "name" | "hint">> = [
  { id: "openai", kind: "openai", name: "OpenAI", hint: "GPT models and OpenAI API" },
  { id: "anthropic", kind: "anthropic", name: "Anthropic", hint: "Claude models" },
  { id: "gemini", kind: "gemini", name: "Google Gemini", hint: "Gemini models" },
  { id: "openrouter", kind: "openrouter", name: "OpenRouter", hint: "OpenRouter models" },
];

function emptyProvider(item: (typeof BUILTINS)[number]): Provider {
  return { ...item, connected: false, keyLast4: "", baseUrl: "", model: "", lastTestedAt: null, models: [] };
}

function copy(locale: Locale) {
  if (locale === "th") {
    return {
      title: "AI Models",
      lead: "เชื่อมต่อ AI API และกำหนดว่า SAM จะใช้โมเดลใดในแต่ละงาน",
      demo: "API Key ถูกจัดเก็บฝั่ง Server และจะไม่ถูกส่งกลับมาแสดงบน Browser",
      providers: "Providers",
      providersLead: "Connect and manage AI APIs",
      heatmap: "การใช้งาน",
      usage: "Model Usage",
      usageLead: "Choose which connected model SAM uses for each task",
      defaultTitle: "Default Model",
      defaultLead: "ใช้เมื่อ Feature ไม่ได้กำหนด Model เฉพาะ",
      notConnected: "Not connected",
      connected: "Connected",
      configure: "Configure",
      manage: "Manage",
      add: "Add Provider",
      model: "Model",
      lastTested: "Last tested",
      justNow: "เมื่อกี้",
      emptyTitle: "No AI models available",
      emptyLead: "Connect an AI Provider before assigning models.",
      emptyAction: "Configure Provider",
      configureTitle: (name: string) => `Configure ${name}`,
      addTitle: "Custom Provider",
      apiKey: "API Key",
      replace: "Replace",
      baseUrl: "Base URL",
      baseOptional: "Optional",
      selectModel: "Select model",
      searchModels: "ค้นหาโมเดล",
      customModel: "Custom model ID",
      or: "or",
      name: "Name",
      namePlaceholder: "Local LLM",
      basePlaceholder: "https://api.openai.com/v1",
      customBasePlaceholder: "http://127.0.0.1:11434/v1",
      modelPlaceholder: "llama-3.1-8b",
      test: "Test connection",
      testing: "กำลังทดสอบ…",
      testOk: "Connection successful",
      testFail: "Connection failed",
      testNeedKey: "กรอก API Key ก่อนทดสอบ",
      status: "Connection status",
      cancel: "Cancel",
      save: "Save",
      saved: "บันทึกแล้ว",
      none: "ยังไม่ได้เลือก",
      available: "Available Models",
      defaultModel: "Default model",
      lastTest: "Last connection test",
      never: "ยังไม่เคยทดสอบ",
      disconnect: "Remove API key",
      usedBy: "API นี้ถูกใช้โดย",
      reassign: "เลือกโมเดลอื่นก่อนลบ API key",
      default: "Default",
      usages: {
        maintenance: { title: "Maintenance Assistant", hint: "ค้นประวัติการซ่อมและช่วยสรุปเคสที่เกี่ยวข้อง" },
        production: { title: "Production Summary", hint: "สรุปสถานะ Production จากข้อมูล iXacs" },
        events: { title: "Event Explanation", hint: "อธิบาย Event และ Downtime" },
        enrichment: { title: "Data Enrichment", hint: "จัดหมวดหมู่และเติม Context ให้ข้อมูล" },
      },
    };
  }
  if (locale === "ja") {
    return {
      title: "AI Models",
      lead: "AI API を接続し、SAM が各機能で使うモデルを設定します",
      demo: "APIキーはサーバー側に保存され、ブラウザには再表示されません",
      providers: "Providers",
      providersLead: "Connect and manage AI APIs",
      heatmap: "利用状況",
      usage: "Model Usage",
      usageLead: "Choose which connected model SAM uses for each task",
      defaultTitle: "Default Model",
      defaultLead: "機能でモデルが指定されていないときに使います",
      notConnected: "Not connected",
      connected: "Connected",
      configure: "Configure",
      manage: "Manage",
      add: "Add Provider",
      model: "Model",
      lastTested: "Last tested",
      justNow: "たった今",
      emptyTitle: "No AI models available",
      emptyLead: "Connect an AI Provider before assigning models.",
      emptyAction: "Configure Provider",
      configureTitle: (name: string) => `Configure ${name}`,
      addTitle: "Custom Provider",
      apiKey: "API Key",
      replace: "Replace",
      baseUrl: "Base URL",
      baseOptional: "Optional",
      selectModel: "Select model",
      searchModels: "モデルを検索",
      customModel: "Custom model ID",
      or: "or",
      name: "Name",
      namePlaceholder: "Local LLM",
      basePlaceholder: "https://api.openai.com/v1",
      customBasePlaceholder: "http://127.0.0.1:11434/v1",
      modelPlaceholder: "llama-3.1-8b",
      test: "Test connection",
      testing: "テスト中…",
      testOk: "Connection successful",
      testFail: "Connection failed",
      testNeedKey: "先に API Key を入力してください",
      status: "Connection status",
      cancel: "Cancel",
      save: "Save",
      saved: "保存しました",
      none: "未選択",
      available: "Available Models",
      defaultModel: "Default model",
      lastTest: "Last connection test",
      never: "未テスト",
      disconnect: "Remove API key",
      usedBy: "この API は次で使われています",
      reassign: "削除する前に別のモデルを割り当ててください",
      default: "Default",
      usages: {
        maintenance: { title: "Maintenance Assistant", hint: "保全履歴から関連案件を要約します" },
        production: { title: "Production Summary", hint: "iXacs の生産状況を要約します" },
        events: { title: "Event Explanation", hint: "イベントとダウンタイムを説明します" },
        enrichment: { title: "Data Enrichment", hint: "データを分類し、文脈を補います" },
      },
    };
  }
  return {
    title: "AI Models",
    lead: "Connect AI APIs and choose which model SAM uses for each task",
    demo: "API keys are stored server-side and are never returned to the browser",
    providers: "Providers",
    providersLead: "Connect and manage AI APIs",
    heatmap: "Usage",
    usage: "Model Usage",
    usageLead: "Choose which connected model SAM uses for each task",
    defaultTitle: "Default Model",
    defaultLead: "Used when a feature does not specify a model",
    notConnected: "Not connected",
    connected: "Connected",
    configure: "Configure",
    manage: "Manage",
    add: "Add Provider",
    model: "Model",
    lastTested: "Last tested",
    justNow: "just now",
    emptyTitle: "No AI models available",
    emptyLead: "Connect an AI Provider before assigning models.",
    emptyAction: "Configure Provider",
    configureTitle: (name: string) => `Configure ${name}`,
    addTitle: "Custom Provider",
    apiKey: "API Key",
    replace: "Replace",
    baseUrl: "Base URL",
    baseOptional: "Optional",
    selectModel: "Select model",
    searchModels: "Search models",
    customModel: "Custom model ID",
    or: "or",
    name: "Name",
    namePlaceholder: "Local LLM",
    basePlaceholder: "https://api.openai.com/v1",
    customBasePlaceholder: "http://127.0.0.1:11434/v1",
    modelPlaceholder: "llama-3.1-8b",
    test: "Test connection",
    testing: "Testing…",
    testOk: "Connection successful",
    testFail: "Connection failed",
    testNeedKey: "Enter an API key before testing",
    status: "Connection status",
    cancel: "Cancel",
    save: "Save",
    saved: "Saved",
    none: "Not set",
    available: "Available Models",
    defaultModel: "Default model",
    lastTest: "Last connection test",
    never: "Never",
    disconnect: "Remove API key",
    usedBy: "This API is used by",
    reassign: "Assign another model before removing the API key",
    default: "Default",
    usages: {
      maintenance: { title: "Maintenance Assistant", hint: "Search repair history and summarize related cases" },
      production: { title: "Production Summary", hint: "Summarize production status from iXacs data" },
      events: { title: "Event Explanation", hint: "Explain events and downtime" },
      enrichment: { title: "Data Enrichment", hint: "Classify records and add context" },
    },
  };
}

function catalogFor(kind: ProviderKind) {
  return kind === "custom" ? [] : CATALOG[kind];
}

function modelsFor(provider: Provider) {
  const listed = provider.models.length ? provider.models : catalogFor(provider.kind);
  if (provider.model && !listed.includes(provider.model)) return [...listed, provider.model];
  return listed.length ? listed : provider.model ? [provider.model] : [];
}

function maskKey(last4: string) {
  return last4 ? `••••••••••••${last4}` : "";
}

function last4(value: string) {
  const trimmed = value.trim();
  return trimmed.slice(-4);
}

function formatTestedAt(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (!Number.isFinite(date.valueOf())) return iso;
  return date.toLocaleString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function optionValue(ref: ModelRef) {
  return `${ref.providerId}::${ref.model}`;
}

function parseOption(value: string): ModelRef | null {
  const index = value.indexOf("::");
  if (index <= 0) return null;
  return { providerId: value.slice(0, index), model: value.slice(index + 2) };
}

function livePath(kind: ProviderKind, id?: string) {
  if (kind === "custom") return id ? `/api/ai/providers/${id}` : null;
  return `/api/ai/providers/${kind}`;
}

function ProviderMark({ kind, size = 22 }: { kind: ProviderKind; size?: number }) {
  if (kind === "openai") return <OpenAIIcon size={size} />;
  if (kind === "anthropic") return <ClaudeIcon size={size} />;
  if (kind === "gemini") return <GeminiIcon size={size} />;
  if (kind === "openrouter") return <OpenRouterIcon size={size} />;
  return <span className="ai-mark-fallback" aria-hidden />;
}

export function AiModelsPage() {
  const { locale } = useLocale();
  const label = copy(locale);
  const systems = SYSTEMS_COPY[locale];
  const [providers, setProviders] = useState<Provider[]>(() => BUILTINS.map(emptyProvider));
  const [usages, setUsages] = useState<Record<UsageId, ModelRef | null>>({
    maintenance: null,
    production: null,
    events: null,
    enrichment: null,
  });
  const [defaultModel, setDefaultModel] = useState<ModelRef | null>(null);
  const [defaultStatus, setDefaultStatus] = useState("");
  const [tab, setTab] = useState<"providers" | "heatmap" | "default">("providers");
  const [drawer, setDrawer] = useState<Drawer>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai/default", { cache: "no-store" }).then(async (response) => {
      const data = (await response.json()) as { default?: ModelRef | null };
      if (!cancelled && data.default?.providerId && data.default.model) setDefaultModel(data.default);
    });
    void fetch("/api/ai/providers", { cache: "no-store" }).then(async (response) => {
      const data = (await response.json()) as {
        providers?: Array<{
          id: string;
          kind?: ProviderKind;
          name?: string;
          connected?: boolean;
          keyLast4?: string;
          model?: string;
          lastTestedAt?: string;
          baseUrl?: string;
        }>;
      };
      if (cancelled) return;
      const saved = new Map((data.providers ?? []).map((item) => [item.id, item]));
      setProviders((current) => {
        const builtins = current.map((provider) => {
          const row = saved.get(provider.id);
          if (!row?.connected) return provider;
          return {
            ...provider,
            connected: true,
            keyLast4: row.keyLast4 ?? "",
            model: row.model ?? "",
            lastTestedAt: row.lastTestedAt ?? null,
            baseUrl: row.baseUrl ?? "",
            models: row.model ? [row.model] : [],
          };
        });
        const extras = [...saved.values()]
          .filter((row) => row.connected && !current.some((item) => item.id === row.id))
          .map((row) => ({
            id: row.id,
            kind: (row.kind ?? "custom") as ProviderKind,
            name: row.name || row.id,
            hint: "OpenAI-compatible API",
            connected: true,
            keyLast4: row.keyLast4 ?? "",
            baseUrl: row.baseUrl ?? "",
            model: row.model ?? "",
            lastTestedAt: row.lastTestedAt ?? null,
            models: row.model ? [row.model] : [],
          }));
        return [...builtins, ...extras];
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connected = useMemo(() => providers.filter((item) => item.connected), [providers]);
  const options = useMemo(
    () =>
      connected.flatMap((provider) =>
        modelsFor(provider).map((model) => ({
          providerId: provider.id,
          model,
          label: `${provider.name} · ${model}`,
        })),
      ),
    [connected],
  );

  function usagesFor(providerId: string) {
    const hits = USAGES.filter((id) => usages[id]?.providerId === providerId).map((id) => label.usages[id].title);
    if (defaultModel?.providerId === providerId) hits.push(label.defaultTitle);
    return hits;
  }

  function assignUsage(id: UsageId, value: string) {
    setUsages((current) => ({ ...current, [id]: parseOption(value) }));
  }

  async function persistDefault(next: ModelRef | null) {
    setDefaultModel(next);
    setDefaultStatus("");
    const response = await fetch("/api/ai/default", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next ?? {}),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setDefaultStatus(data.error || label.testFail);
      return;
    }
    setDefaultStatus(label.saved);
  }

  function saveProvider(next: Provider) {
    setProviders((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next];
    });
    setDrawer({ mode: "manage", providerId: next.id });
  }

  async function disconnect(providerId: string) {
    if (usagesFor(providerId).length) return;
    const target = providers.find((item) => item.id === providerId);
    const endpoint = livePath(target?.kind ?? "custom", target?.id);
    if (endpoint) await fetch(endpoint, { method: "DELETE" });
    setProviders((current) =>
      current.map((item) =>
        item.id === providerId
          ? { ...item, connected: false, keyLast4: "", model: "", lastTestedAt: null, models: [] }
          : item,
      ),
    );
    if (defaultModel?.providerId === providerId) void persistDefault(null);
    setDrawer(null);
  }

  return (
    <SystemsStage
      title={label.title}
      backHref="/settings/systems"
      backLabel={systems.back}
      actions={
        <button
          type="button"
          className="btn btn-primary console-icon-btn"
          aria-label={label.add}
          onClick={() => {
            setTab("providers");
            setDrawer({ mode: "add" });
          }}
        >
          <FiPlus size={16} />
        </button>
      }
    >
      <div className="ai-page">
      <div className="as-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`as-tab${tab === "providers" ? " is-active" : ""}`}
          aria-selected={tab === "providers"}
          onClick={() => setTab("providers")}
        >
          {label.providers}
        </button>
        <button
          type="button"
          role="tab"
          className={`as-tab${tab === "heatmap" ? " is-active" : ""}`}
          aria-selected={tab === "heatmap"}
          onClick={() => setTab("heatmap")}
        >
          {label.heatmap}
        </button>
        <button
          type="button"
          role="tab"
          className={`as-tab${tab === "default" ? " is-active" : ""}`}
          aria-selected={tab === "default"}
          onClick={() => setTab("default")}
        >
          {label.default}
        </button>
      </div>

      {tab === "providers" ? (
      <section className="ai-section">
        <div className="as-console-table-wrap">
          <table className="as-console-table">
            <thead>
              <tr>
                <th>{label.name}</th>
                <th>{label.status}</th>
                <th>{label.model}</th>
                <th className="as-console-actions" />
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>
                    <span className="as-console-item">
                      <span className="as-menu-icon" aria-hidden>
                        <ProviderMark kind={provider.kind} size={16} />
                      </span>
                      <strong>{provider.name}</strong>
                    </span>
                  </td>
                  <td>
                    <span className={`as-badge${provider.connected ? " is-on" : ""}`}>
                      {provider.connected ? label.connected : label.notConnected}
                    </span>
                  </td>
                  <td>{provider.model || "—"}</td>
                  <td className="as-console-actions">
                    <button
                      type="button"
                      className="ai-row-action"
                      onClick={() =>
                        setDrawer({
                          mode: provider.connected ? "manage" : "configure",
                          providerId: provider.id,
                        })
                      }
                    >
                      {provider.connected ? label.manage : label.configure}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : tab === "heatmap" ? (
        <AiUsageHeatmap />
      ) : (
      <section className="ai-section as-default-panel">
        <div className="ai-setting">
          <div>
            <strong>{label.defaultTitle}</strong>
            <p>{label.defaultLead}</p>
          </div>
          {options.length ? (
            <select
              className="ai-select"
              value={defaultModel ? optionValue(defaultModel) : ""}
              onChange={(event) => void persistDefault(parseOption(event.target.value))}
            >
              <option value="">{label.none}</option>
              {options.map((item) => (
                <option key={optionValue(item)} value={optionValue(item)}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="ai-hint">{label.emptyLead}</p>
          )}
        </div>
        {defaultStatus ? <p className="ai-hint">{defaultStatus}</p> : null}
      </section>
      )}

      {SHOW_MODEL_USAGE && options.length > 0 ? (
        <section className="ai-section">
          <div className="ai-setting">
            <div>
              <strong>{label.defaultTitle}</strong>
              <p>{label.defaultLead}</p>
            </div>
            <select
              className="ai-select"
              value={defaultModel ? optionValue(defaultModel) : ""}
              onChange={(event) => setDefaultModel(parseOption(event.target.value))}
            >
              <option value="" disabled>
                {label.selectModel}
              </option>
              {options.map((item) => (
                <option key={optionValue(item)} value={optionValue(item)}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ai-list">
            {USAGES.map((id) => (
              <div key={id} className="ai-setting">
                <div>
                  <strong>{label.usages[id].title}</strong>
                  <p>{label.usages[id].hint}</p>
                </div>
                <select
                  className="ai-select"
                  value={usages[id] ? optionValue(usages[id]!) : ""}
                  onChange={(event) => assignUsage(id, event.target.value)}
                >
                  <option value="" disabled>
                    {label.selectModel}
                  </option>
                  {options.map((item) => (
                    <option key={`${id}-${optionValue(item)}`} value={optionValue(item)}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ProviderSheet
        drawer={drawer}
        providers={providers}
        usedBy={drawer && drawer.mode !== "add" ? usagesFor(drawer.providerId) : []}
        label={label}
        onClose={() => setDrawer(null)}
        onSave={saveProvider}
        onDisconnect={disconnect}
        onReplace={(providerId) => setDrawer({ mode: "configure", providerId })}
      />
      </div>
    </SystemsStage>
  );
}

function ProviderSheet({
  drawer,
  providers,
  usedBy,
  label,
  onClose,
  onSave,
  onDisconnect,
  onReplace,
}: {
  drawer: Drawer;
  providers: Provider[];
  usedBy: string[];
  label: ReturnType<typeof copy>;
  onClose: () => void;
  onSave: (provider: Provider) => void;
  onDisconnect: (id: string) => void;
  onReplace: (id: string) => void;
}) {
  const provider = drawer && drawer.mode !== "add" ? providers.find((item) => item.id === drawer.providerId) : null;
  const isAdd = drawer?.mode === "add";
  const isManage = drawer?.mode === "manage" && provider?.connected;
  const title = isAdd
    ? label.addTitle
    : isManage
      ? provider?.name ?? ""
      : label.configureTitle(provider?.name ?? "");

  return (
    <OverlayFrame
      open={Boolean(drawer)}
      labelledBy="ai-sheet-title"
      onClose={onClose}
      className="machine-sheet ai-sheet"
    >
      <div className="ai-sheet-head">
        <div>
          <h2 id="ai-sheet-title">{title}</h2>
          {isManage ? (
            <p className="ai-status is-connected">
              <i className="is-on" />
              {label.connected}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn-icon" aria-label={label.cancel} onClick={onClose}>
          <FiX size={18} />
        </button>
      </div>
      {drawer ? (
        isManage && provider ? (
          <ManageBody
            provider={provider}
            usedBy={usedBy}
            label={label}
            onTest={(tested) => onSave(tested)}
            onReplace={() => onReplace(provider.id)}
            onDisconnect={() => onDisconnect(provider.id)}
          />
        ) : (
          <ConfigureBody
            key={`${drawer.mode}-${drawer.mode === "add" ? "new" : drawer.providerId}`}
            provider={provider}
            isAdd={isAdd}
            label={label}
            onCancel={onClose}
            onSave={onSave}
          />
        )
      ) : null}
    </OverlayFrame>
  );
}

function ConfigureBody({
  provider,
  isAdd,
  label,
  onCancel,
  onSave,
}: {
  provider: Provider | null | undefined;
  isAdd: boolean;
  label: ReturnType<typeof copy>;
  onCancel: () => void;
  onSave: (provider: Provider) => void;
}) {
  const [name, setName] = useState(isAdd ? "" : provider?.name ?? "");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [model, setModel] = useState(provider?.model ?? "");
  const [customModel, setCustomModel] = useState(
    provider && !catalogFor(provider.kind).includes(provider.model) ? provider.model : "",
  );
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<"idle" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [remoteModels, setRemoteModels] = useState<string[]>(provider?.models ?? []);
  const [modelQuery, setModelQuery] = useState("");
  const [newId] = useState(() => `custom-${Date.now()}`);
  const kind = isAdd ? "custom" : provider?.kind ?? "custom";
  const providerId = isAdd ? newId : provider?.id ?? "custom";
  const endpoint = `/api/ai/providers/${providerId}`;
  const models = remoteModels.length ? remoteModels : catalogFor(kind);
  const visibleModels = modelQuery.trim()
    ? models.filter((item) => item.toLowerCase().includes(modelQuery.trim().toLowerCase()))
    : models;
  const chosen = customModel.trim() || model;
  const canSave = Boolean(
    (isAdd ? name.trim() : true) &&
    apiKey.trim().length >= 8 &&
    chosen &&
    (kind !== "custom" || baseUrl.trim()) &&
    test === "ok",
  );

  async function runTest() {
    if (apiKey.trim().length < 8) {
      setTest("fail");
      setTestMessage(label.testNeedKey);
      return;
    }
    if (kind === "custom" && (!baseUrl.trim() || !chosen)) {
      setTest("fail");
      setTestMessage(label.testFail);
      return;
    }
    setTesting(true);
    setTest("idle");
    if (endpoint) {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey, kind, model: chosen, baseUrl: baseUrl.trim(), testOnly: true }) });
      const data = await response.json().catch(() => ({})) as { error?: string; models?: Array<{ id: string }> };
      setTesting(false);
      if (!response.ok) { setTest("fail"); setTestMessage(data.error || label.testFail); return; }
      const available = (data.models ?? []).map((item) => item.id);
      if (available.length) {
        setRemoteModels(available);
        if (!available.includes(model)) setModel(available[0] ?? "");
        setCustomModel("");
      }
      setTest("ok");
      setTestMessage(available.length ? `${label.testOk} · ${available.length} models` : label.testOk);
      return;
    }
    window.setTimeout(() => { setTesting(false); setTest("ok"); setTestMessage(label.testOk); }, 520);
  }

  async function save() {
    if (!canSave) return;
    if (endpoint) {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey, model: chosen, kind, name: isAdd ? name.trim() : provider?.name, baseUrl: baseUrl.trim() }) });
      const data = await response.json().catch(() => ({})) as { error?: string; keyLast4?: string; model?: string; lastTestedAt?: string; models?: Array<{ id: string }> };
      if (!response.ok) { setTest("fail"); setTestMessage(data.error || label.testFail); return; }
      onSave({
        id: providerId,
        kind,
        name: isAdd ? name.trim() : provider?.name ?? kind,
        hint: provider?.hint ?? "OpenAI-compatible API",
        connected: true,
        keyLast4: data.keyLast4 ?? last4(apiKey),
        baseUrl: baseUrl.trim(),
        model: data.model ?? chosen,
        lastTestedAt: data.lastTestedAt ?? new Date().toISOString(),
        models: (data.models ?? []).map((item) => item.id),
      });
      return;
    }
    onSave({
      id: providerId,
      kind,
      name: isAdd ? name.trim() : provider!.name,
      hint: isAdd ? "OpenAI-compatible API" : provider!.hint,
      connected: true,
      keyLast4: last4(apiKey),
      baseUrl: baseUrl.trim(),
      model: chosen,
      lastTestedAt: new Date().toISOString(),
      models,
    });
  }

  return (
    <>
      <div className="ai-sheet-body">
        {isAdd ? (
          <label className="ai-field">
            <span>{label.name}</span>
            <input
              className="ai-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={label.namePlaceholder}
              data-dialog-initial-focus
            />
          </label>
        ) : null}
        <label className="ai-field">
          <span>{label.apiKey}</span>
          <input
            className="ai-input"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setTest("idle");
              setTestMessage("");
            }}
            placeholder={kind === "gemini" ? "AIza••••••••••••••••••••" : kind === "openrouter" ? "sk-or-••••••••••••••••" : "sk-••••••••••••••••••••••"}
            data-dialog-initial-focus={isAdd ? undefined : true}
          />
        </label>
        {kind === "custom" ? <label className="ai-field">
          <span>{label.baseUrl}</span>
          <input
            className="ai-input"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              setTest("idle");
              setTestMessage("");
            }}
            placeholder={isAdd ? label.customBasePlaceholder : label.basePlaceholder}
          />
          <em>{label.baseOptional}</em>
        </label> : null}
        {models.length ? (
          <label className="ai-field">
            <span>{label.model}</span>
            {models.length > 8 ? (
              <input
                className="ai-input"
                value={modelQuery}
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder={label.searchModels}
              />
            ) : null}
            <select
              className="ai-input"
              value={models.includes(model) ? model : ""}
              onChange={(event) => {
                setModel(event.target.value);
                setCustomModel("");
                setTest("idle");
                setTestMessage("");
              }}
            >
              <option value="">{label.selectModel}</option>
              {(visibleModels.includes(model) || !model ? visibleModels : [model, ...visibleModels]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === "custom" ? <label className="ai-field">
          <span>{models.length ? `${label.or} ${label.customModel}` : label.customModel}</span>
          <input
            className="ai-input"
            value={customModel}
            onChange={(event) => {
              setCustomModel(event.target.value);
              setTest("idle");
              setTestMessage("");
            }}
            placeholder={label.modelPlaceholder}
          />
        </label> : null}
        <div className="ai-test">
          <button type="button" className="btn btn-secondary" disabled={testing} onClick={() => void runTest()}>
            {testing ? label.testing : label.test}
          </button>
          {test !== "idle" ? (
            <p className={`ai-status ${test === "ok" ? "is-connected" : "is-bad"}`}>
              <i className={test === "ok" ? "is-on" : "is-bad"} />
              {testMessage}
            </p>
          ) : (
            <p className="ai-hint">{label.status}</p>
          )}
        </div>
      </div>
      <div className="ai-sheet-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {label.cancel}
        </button>
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>
          {label.save}
        </button>
      </div>
    </>
  );
}

function ManageBody({
  provider,
  usedBy,
  label,
  onTest,
  onReplace,
  onDisconnect,
}: {
  provider: Provider;
  usedBy: string[];
  label: ReturnType<typeof copy>;
  onTest: (provider: Provider) => void;
  onReplace: () => void;
  onDisconnect: () => void;
}) {
  const { locale } = useLocale();
  const [testing, setTesting] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState(provider.model);
  const [modelQuery, setModelQuery] = useState("");
  const [modelMessage, setModelMessage] = useState("");
  const blocked = usedBy.length > 0;
  const endpoint = livePath(provider.kind, provider.id);
  const listed = modelsFor(provider);
  const visibleModels = modelQuery.trim()
    ? listed.filter((item) => item.toLowerCase().includes(modelQuery.trim().toLowerCase()))
    : listed;
  const modelOptions = visibleModels.includes(selectedModel) || !selectedModel
    ? visibleModels
    : [selectedModel, ...visibleModels];

  async function saveModel() {
    if (!endpoint || !selectedModel) return;
    setSavingModel(true);
    setModelMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string; keyLast4?: string; model?: string; lastTestedAt?: string; models?: Array<{ id: string }> };
    setSavingModel(false);
    if (!response.ok) { setModelMessage(data.error || label.testFail); return; }
    onTest({ ...provider, model: data.model ?? selectedModel, keyLast4: data.keyLast4 ?? provider.keyLast4, lastTestedAt: data.lastTestedAt ?? new Date().toISOString(), models: (data.models ?? []).map((item) => item.id) });
    setModelMessage(label.testOk);
  }

  async function runTest() {
    setTesting(true);
    if (endpoint) {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testOnly: true }) });
      const data = await response.json().catch(() => ({})) as { lastTestedAt?: string; models?: Array<{ id: string }>; error?: string };
      setTesting(false);
      if (response.ok) {
        const nextModels = (data.models ?? []).map((item) => item.id);
        if (selectedModel && !nextModels.includes(selectedModel) && nextModels[0]) setSelectedModel(nextModels[0]);
        onTest({ ...provider, lastTestedAt: data.lastTestedAt ?? new Date().toISOString(), models: nextModels });
      } else {
        setModelMessage(data.error || label.testFail);
      }
      return;
    }
    window.setTimeout(() => {
      setTesting(false);
      onTest({ ...provider, lastTestedAt: new Date().toISOString() });
    }, 480);
  }

  return (
    <>
      <div className="ai-sheet-body">
        <dl className="ai-detail">
          <div>
            <dt>{label.apiKey}</dt>
            <dd>
              <code>{maskKey(provider.keyLast4)}</code>
              <span className="ai-secret-actions">
                <button type="button" className="ai-text-btn" onClick={onReplace}>
                  {label.replace}
                </button>
                <button type="button" className="ai-danger" disabled={blocked} onClick={onDisconnect}>
                  {label.disconnect}
                </button>
              </span>
            </dd>
          </div>
          {!endpoint ? <div>
            <dt>{label.baseUrl}</dt>
            <dd>{provider.baseUrl || label.default}</dd>
          </div> : null}
          <div>
            <dt>{label.available}</dt>
            <dd>{listed.length}</dd>
          </div>
          <div>
            <dt>{label.model}</dt>
            <dd>
              {endpoint ? (
                <span className="ai-manage-model">
                  {listed.length > 8 ? (
                    <input
                      className="ai-input"
                      value={modelQuery}
                      onChange={(event) => setModelQuery(event.target.value)}
                      placeholder={label.searchModels}
                    />
                  ) : null}
                  <select
                    className="ai-input"
                    value={selectedModel}
                    onChange={(event) => {
                      setSelectedModel(event.target.value);
                      setModelMessage("");
                    }}
                  >
                    {modelOptions.map((model) => (
                      <option value={model} key={model}>{model}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingModel || !selectedModel || selectedModel === provider.model}
                    onClick={() => void saveModel()}
                  >
                    {savingModel ? label.testing : label.save}
                  </button>
                </span>
              ) : (
                provider.model || "—"
              )}
              {modelMessage ? <small className="machine-help">{modelMessage}</small> : null}
            </dd>
          </div>
          <div>
            <dt>{label.lastTest}</dt>
            <dd>{provider.lastTestedAt ? formatTestedAt(provider.lastTestedAt, locale) : label.never}</dd>
          </div>
        </dl>
        {blocked ? (
          <div className="ai-disconnect">
            <p>{label.usedBy}</p>
            <ul>
              {usedBy.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{label.reassign}</p>
          </div>
        ) : null}
        <div className="ai-manage-actions">
          <button type="button" className="btn btn-secondary" disabled={testing} onClick={() => void runTest()}>
            {testing ? label.testing : label.test}
          </button>
        </div>
      </div>
    </>
  );
}
