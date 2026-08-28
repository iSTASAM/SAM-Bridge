"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiLock,
  FiSave,
} from "react-icons/fi";
import { useLocale } from "../../locale-context";
import type { Connection } from "../connections/types";
import { EXPORT_COPY } from "./copy";
import {
  ALL_FIELD_IDS,
  DESTINATIONS,
  FIELD_SECTIONS,
  type DestinationType,
  type ExportConfig,
  type ExportFormat,
  type SourceGroup,
  type TriggerMode,
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

const EMPTY_DRAFT: DraftForm = {
  name: "",
  description: "",
  sourceConnectionId: "",
  groupUuids: [],
  lineUuids: [],
  allGroups: true,
  allLines: true,
  fields: [...ALL_FIELD_IDS],
  destinationType: "rest",
  destinationName: "",
  endpoint: "",
  sapConnectionId: "",
  sapAction: "production-result" as const,
  sapOrder: null,
  sapMappingValidated: false,
  sapConfirmationUnit: "PC",
  format: "canonical-json",
  triggerMode: "manual",
  intervalMinutes: 15,
  changesOnly: true,
  includeNulls: false,
  alertRules: [],
  powerBiSettings: { datasets: ["production", "lost-time"], historyDays: 90, includeLineDimension: true, includeDateDimension: true },
  powerBiApiKey: "",
  excelSettings: { datasets: ["production"], tables: ["history", "current"], historyDays: 30, includeLineDimension: false, includeDateDimension: false, refreshMinutes: 15, autoRefresh: true },
  excelApiKey: "",
};

export function ExportEditor({ configId }: { configId?: string }) {
  const { locale } = useLocale();
  const copy = EXPORT_COPY[locale];
  const router = useRouter();
  const [form, setForm] = useState<DraftForm>(EMPTY_DRAFT);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(Boolean(configId));
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  function patch(values: Partial<DraftForm>) {
    setForm((current) => ({ ...current, ...values }));
    setFlash(null);
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
        endpointConfigured: _endpointConfigured,
        lastRunAt: _lastRunAt,
        lastRunStatus: _lastRunStatus,
        lastRunError: _lastRunError,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...draft
      } = config;
      void _id;
      void _status;
      void _endpointConfigured;
      void _lastRunAt;
      void _lastRunStatus;
      void _lastRunError;
      void _createdAt;
      void _updatedAt;
      setForm({ ...draft, alertRules: draft.alertRules ?? [] });
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
      const data = (await response.json()) as { ok?: boolean; groups?: SourceGroup[] };
      if (!response.ok || !data.ok) throw new Error("scope");
      setGroups(data.groups ?? []);
    } catch {
      setGroups([]);
      setScopeError(true);
    } finally {
      setScopeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading || !form.sourceConnectionId) return;
    const timer = window.setTimeout(() => void loadScope(form.sourceConnectionId), 0);
    return () => window.clearTimeout(timer);
  }, [form.sourceConnectionId, loadScope, loading]);

  const destination =
    DESTINATIONS.find((item) => item.id === form.destinationType) ?? DESTINATIONS[0];
  const selectedConnection = connections.find((item) => item.id === form.sourceConnectionId);
  const visibleGroups = form.allGroups
    ? groups
    : groups.filter((group) => form.groupUuids.includes(group.uuid));
  const availableLines = visibleGroups.flatMap((group) => group.lines);
  const scopeLabel = form.allGroups
    ? form.allLines
      ? `${copy.allGroups} · ${copy.allLines}`
      : `${copy.allGroups} · ${form.lineUuids.length} Lines`
    : `${form.groupUuids.length} Groups · ${form.allLines ? copy.allLines : `${form.lineUuids.length} Lines`}`;

  const sectionCounts = useMemo(
    () =>
      FIELD_SECTIONS.map((section) => ({
        id: section.id,
        selected: section.fields.filter(([id]) => form.fields.includes(id)).length,
        total: section.fields.length,
      })),
    [form.fields],
  );

  function toggleField(id: string) {
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
    patch({
      fields: allSelected
        ? form.fields.filter((id) => !sectionIds.has(id))
        : [...new Set([...form.fields, ...ids])],
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

  async function save() {
    if (!form.name.trim() || !form.sourceConnectionId || form.fields.length === 0) {
      setFlash({ kind: "error", text: copy.required });
      return;
    }
    setSaving(true);
    setFlash(null);
    const response = await fetch(configId ? `/api/exports/${configId}` : "/api/exports", {
      method: configId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      setFlash({ kind: "error", text: copy.saveError });
      setSaving(false);
      return;
    }
    const saved = (await response.json()) as ExportConfig;
    setFlash({ kind: "ok", text: copy.saved });
    setSaving(false);
    if (!configId) router.replace(`/settings/exports/${saved.id}`);
  }

  if (notFound) {
    return (
      <div className="console-page export-page">
        <section className="export-empty"><h1>{copy.notFound}</h1><Link href="/settings/exports" className="btn btn-secondary">{copy.back}</Link></section>
      </div>
    );
  }

  if (loading) {
    return <div className="console-page export-page"><div className="export-editor-loading skeleton" /></div>;
  }

  return (
    <div className="console-page export-page export-editor-page">
      <header className="export-editor-head">
        <div>
          <Link href="/settings/exports" className="export-back"><FiArrowLeft size={15} />{copy.back}</Link>
          <h1 className="console-title">{configId ? copy.editTitle : copy.newTitle}</h1>
        </div>
        <div className="export-editor-head-actions">
          <span className="export-disabled-badge"><FiLock size={13} />{copy.disabled}</span>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            <FiSave size={15} />{saving ? copy.saving : copy.save}
          </button>
        </div>
      </header>

      {flash ? (
        <div className={`export-flash is-${flash.kind}`}>
          {flash.kind === "ok" ? <FiCheck size={16} /> : <FiAlertCircle size={16} />}{flash.text}
        </div>
      ) : null}

      <div className="export-editor-layout">
        <main className="export-editor-main">
          <section className="export-section">
            <SectionHead number="01" title={copy.overview} />
            <div className="export-form-grid">
              <label className="machine-field"><span className="machine-label">{copy.name}</span><input className="machine-input" value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="SAP production confirmation" /></label>
              <label className="machine-field is-wide"><span className="machine-label">{copy.description}</span><textarea className="machine-input export-textarea" value={form.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Describe what this export will be used for" /></label>
            </div>
          </section>

          <section className="export-section">
            <SectionHead number="02" title={copy.sourceScope} />
            <label className="machine-field"><span className="machine-label">{copy.connection}</span><select className="machine-input" value={form.sourceConnectionId} onChange={(event) => patch({ sourceConnectionId: event.target.value, groupUuids: [], lineUuids: [], allGroups: true, allLines: true })}><option value="">{copy.noConnection}</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.baseUrl.replace(/^https?:\/\//, "")}</option>)}</select></label>

            <div className="export-scope-toggles">
              <Toggle checked={form.allGroups} label={copy.allGroups} onChange={(checked) => patch({ allGroups: checked, groupUuids: checked ? [] : form.groupUuids })} />
              <Toggle checked={form.allLines} label={copy.allLines} onChange={(checked) => patch({ allLines: checked, lineUuids: checked ? [] : form.lineUuids })} />
            </div>

            {scopeLoading ? <p className="export-muted">{copy.loadingScope}</p> : null}
            {scopeError ? <button type="button" className="btn btn-secondary" onClick={() => void loadScope(form.sourceConnectionId)}>{copy.retryScope}</button> : null}

            {!scopeLoading && groups.length > 0 && !form.allGroups ? (
              <div className="export-scope-grid">
                {groups.map((group) => <label key={group.uuid} className="export-scope-item"><input type="checkbox" checked={form.groupUuids.includes(group.uuid)} onChange={() => toggleGroup(group.uuid)} /><span><strong>{group.name}</strong><small>{group.lines.length} Lines</small></span></label>)}
              </div>
            ) : null}

            {!scopeLoading && availableLines.length > 0 && !form.allLines ? (
              <div className="export-line-groups">
                {visibleGroups.map((group) => (
                  <div key={group.uuid} className="export-line-group"><h3>{group.name}</h3><div className="export-line-list">{group.lines.map((line) => <label key={line.uuid} className="export-line-item"><input type="checkbox" checked={form.lineUuids.includes(line.uuid)} onChange={() => toggleLine(line.uuid)} /><span>{line.name}</span></label>)}</div></div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="export-section">
            <div className="export-section-head-row"><SectionHead number="03" title={copy.dataFields} subtitle={copy.dataFieldsHelp} /><div className="export-inline-actions"><button type="button" onClick={() => patch({ fields: [...ALL_FIELD_IDS] })}>{copy.selectAll}</button><button type="button" onClick={() => patch({ fields: [] })}>{copy.clearAll}</button></div></div>
            <div className="export-field-sections">
              {FIELD_SECTIONS.map((section) => {
                const count = sectionCounts.find((item) => item.id === section.id);
                const allSelected = count?.selected === count?.total;
                return <div key={section.id} className="export-field-section"><div className="export-field-section-head"><label><input type="checkbox" checked={allSelected} onChange={() => toggleSection(section.id)} /><span><strong>{section.title}</strong><small>{section.description}</small></span></label><span>{count?.selected}/{count?.total}</span></div><div className="export-field-grid">{section.fields.map(([id, label]) => <label key={id} className="export-field"><input type="checkbox" checked={form.fields.includes(id)} onChange={() => toggleField(id)} /><span><strong>{label}</strong><code>{id}</code></span></label>)}</div></div>;
              })}
            </div>
          </section>

          <section className="export-section">
            <SectionHead number="04" title={copy.destinationSettings} />
            <div className="export-destination-grid">{DESTINATIONS.map((item) => <button key={item.id} type="button" className={`export-destination ${form.destinationType === item.id ? "is-selected" : ""}`} onClick={() => patch({ destinationType: item.id as DestinationType })}><span className="export-destination-radio">{form.destinationType === item.id ? <FiCheck size={12} /> : null}</span><strong>{item.name}</strong><small>{item.description}</small></button>)}</div>
            <div className="export-form-grid export-destination-form"><label className="machine-field"><span className="machine-label">{copy.destinationName}</span><input className="machine-input" value={form.destinationName} onChange={(event) => patch({ destinationName: event.target.value })} placeholder={destination.name} /></label><label className="machine-field"><span className="machine-label">{destination.endpointLabel}</span><input className="machine-input" value={form.endpoint} onChange={(event) => patch({ endpoint: event.target.value })} placeholder={destination.placeholder} /></label></div>
            <p className="export-credential-note"><FiLock size={13} />{copy.credentialsLater}</p>
          </section>

          <section className="export-section">
            <SectionHead number="05" title={copy.delivery} />
            <div className="export-delivery-grid"><div><span className="machine-label">{copy.format}</span><div className="export-segmented">{(["canonical-json", "flat-json", "csv"] as ExportFormat[]).map((format) => <button key={format} type="button" className={form.format === format ? "is-active" : ""} onClick={() => patch({ format })}>{format === "canonical-json" ? "Canonical JSON" : format === "flat-json" ? "Flat JSON" : "CSV"}</button>)}</div></div><div><span className="machine-label">{copy.trigger}</span><div className="export-segmented">{(["manual", "schedule", "data-change"] as TriggerMode[]).map((mode) => <button key={mode} type="button" className={form.triggerMode === mode ? "is-active" : ""} onClick={() => patch({ triggerMode: mode })}>{mode === "manual" ? copy.manual : mode === "schedule" ? copy.schedule : copy.dataChange}</button>)}</div></div></div>
            {form.triggerMode === "schedule" ? <label className="machine-field export-interval"><span className="machine-label">{copy.interval}</span><input className="machine-input" type="number" min="1" value={form.intervalMinutes} onChange={(event) => patch({ intervalMinutes: Number(event.target.value) || 1 })} /></label> : null}
            <div className="export-scope-toggles"><Toggle checked={form.changesOnly} label={copy.changesOnly} onChange={(changesOnly) => patch({ changesOnly })} /><Toggle checked={form.includeNulls} label={copy.includeNulls} onChange={(includeNulls) => patch({ includeNulls })} /></div>
          </section>
        </main>

        <aside className="export-summary">
          <p className="export-summary-kicker">{copy.summary}</p>
          <h2>{form.name || copy.newTitle}</h2>
          <span className="export-draft-badge">{copy.draft}</span>
          <dl><div><dt>{copy.source}</dt><dd>{selectedConnection?.name || "—"}</dd></div><div><dt>{copy.selectedScope}</dt><dd>{scopeLabel}</dd></div><div><dt>{copy.selectedFields}</dt><dd>{form.fields.length} / {ALL_FIELD_IDS.length}</dd></div><div><dt>{copy.destination}</dt><dd>{destination.name}</dd></div><div><dt>{copy.format}</dt><dd>{form.format}</dd></div><div><dt>{copy.trigger}</dt><dd>{form.triggerMode}</dd></div></dl>
          <div className="export-summary-flow"><span>iXacs</span><FiChevronRight /><span>SAM</span><FiChevronRight /><span>{destination.name}</span></div>
          <p className="export-summary-note"><FiLock size={13} />{copy.disabled}</p>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return <div className="export-section-heading"><span>{number}</span><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div></div>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="export-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="export-toggle-track"><span /></span><strong>{label}</strong></label>;
}
