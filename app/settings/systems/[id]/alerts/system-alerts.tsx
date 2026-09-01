"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiX } from "react-icons/fi";
import { OverlayFrame } from "../../../connections/overlay-frame";
import { useLocale, type Locale } from "../../../../locale-context";
import { maskUserId, statusName } from "../../shared";
import type { SystemMachine, SystemRule, SystemUser } from "../../types";
import { PersonCell, SystemShell, SYSTEMS_COPY } from "../system-shell";

type AlertRow = SystemRule & {
  lineUserId: string;
  customerId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

type CatalogStatus = {
  uuid: string;
  name?: string | null;
  nameTh?: string | null;
  nameEn?: string | null;
  nameJa?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
};

type DiscoveryGroup = {
  uuid: string;
  name?: string | null;
  lines?: { uuid: string; name?: string | null }[];
};

function currentStatus(row: AlertRow): CatalogStatus {
  return {
    uuid: row.statusUuid,
    nameTh: row.statusNameTh,
    nameEn: row.statusNameEn,
    nameJa: row.statusNameJa,
    backgroundColor: row.statusBackgroundColor,
    textColor: row.statusTextColor,
  };
}

function withCurrent(list: CatalogStatus[], row: AlertRow) {
  if (list.some((item) => item.uuid === row.statusUuid)) return list;
  return [currentStatus(row), ...list];
}

function catalogLabel(item: CatalogStatus, locale: Locale) {
  if (locale === "en") return item.nameEn || item.nameTh || item.nameJa || item.name || item.uuid;
  if (locale === "ja") return item.nameJa || item.nameEn || item.nameTh || item.name || item.uuid;
  return item.nameTh || item.nameEn || item.nameJa || item.name || item.uuid;
}

function flattenAlerts(machine: SystemMachine | null): AlertRow[] {
  return (machine?.users ?? []).flatMap((user) =>
    user.rules.map((rule) => ({
      ...rule,
      lineUserId: user.lineUserId,
      customerId: user.customerId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
    })),
  );
}

export function SystemAlerts({ machineId }: { machineId: string }) {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const [machine, setMachine] = useState<SystemMachine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AlertRow | null>(null);
  const [statusPick, setStatusPick] = useState("");
  const [duration, setDuration] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [catalog, setCatalog] = useState<CatalogStatus[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const editSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/systems/${machineId}`, { cache: "no-store" });
      const data = (await response.json()) as { machine?: SystemMachine; error?: string };
      if (!response.ok) throw new Error(data.error);
      setMachine(data.machine ?? null);
      setError(data.machine ? null : copy.empty);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.empty, copy.loadError, machineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = flattenAlerts(machine);
    if (!needle) return list;
    return list.filter((row) =>
      [
        row.displayName,
        row.lineName,
        row.groupName,
        row.customerId,
        row.statusNameTh,
        row.statusNameEn,
        row.statusNameJa,
      ].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [machine, search]);

  async function openEdit(row: AlertRow) {
    const seq = ++editSeq.current;
    setEditing(row);
    setStatusPick(row.statusUuid);
    setDuration(String(row.durationMinutes));
    setEnabled(row.enabled);
    setFormError(null);
    setCatalog([currentStatus(row)]);
    setCatalogLoading(true);

    try {
      const first = await fetch(`/api/connections/${machineId}/statuses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: row.customerId || undefined, lineUuid: row.lineUuid }),
      });
      const data = (await first.json()) as {
        groups?: DiscoveryGroup[];
        statusesByLine?: Record<string, CatalogStatus[]>;
      };
      if (seq !== editSeq.current) return;

      let next = data.statusesByLine?.[row.lineUuid] ?? [];
      const group =
        data.groups?.find((item) => item.lines?.some((line) => line.uuid === row.lineUuid)) ??
        data.groups?.find((item) => item.name === row.groupName);

      if (group?.uuid) {
        const second = await fetch(`/api/connections/${machineId}/statuses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: row.customerId || undefined,
            lineUuid: row.lineUuid,
            groupUuid: group.uuid,
          }),
        });
        const detail = (await second.json()) as { statuses?: CatalogStatus[] };
        if (seq !== editSeq.current) return;
        if (detail.statuses?.length) next = detail.statuses;
      }

      setCatalog(withCurrent(next, row));
    } catch {
      if (seq === editSeq.current) setCatalog([currentStatus(row)]);
    } finally {
      if (seq === editSeq.current) setCatalogLoading(false);
    }
  }

  async function saveEdit() {
    if (!editing || pending) return;
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      setFormError(copy.saveError);
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/admin/systems/${machineId}/alerts/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          durationMinutes: minutes,
          lineUuid: editing.lineUuid,
          statusUuid: statusPick || editing.statusUuid,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setEditing(null);
      await load();
    } catch {
      setFormError(copy.saveError);
    } finally {
      setPending(false);
    }
  }

  async function removeEdit() {
    if (!editing || pending) return;
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/admin/systems/${machineId}/alerts/${editing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setEditing(null);
      await load();
    } catch {
      setFormError(copy.deleteError);
    } finally {
      setPending(false);
    }
  }

  function userName(user: Pick<SystemUser, "displayName" | "lineUserId">) {
    return user.displayName || maskUserId(user.lineUserId);
  }

  return (
    <SystemShell
      machineId={machineId}
      title={machine?.name ?? ""}
      meta={machine?.companyLabel}
      copy={copy}
      active="alerts"
      loading={loading}
      onRefresh={() => void load()}
    >
      <div className="as-tools">
        {loading && !machine ? (
          <span className="skeleton as-tools-skel" aria-hidden />
        ) : (
          <input
            className="pac-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchUsers}
            aria-label={copy.searchUsers}
          />
        )}
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      {loading && !machine ? (
        <div className="as-data-wrap" aria-busy="true">
          <div className="as-data">
            <div className="as-data-row as-data-head as-data-alerts">
              <span>{copy.colName}</span>
              <span>{copy.colGroup}</span>
              <span>{copy.colLine}</span>
              <span>{copy.colAlertStatus}</span>
              <span>{copy.colDuration}</span>
              <span>{copy.colEnabled}</span>
              <span />
            </div>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="as-data-row as-data-alerts">
                <span className="skeleton skeleton-key" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-action" />
                <span className="skeleton skeleton-action" />
                <span />
              </div>
            ))}
          </div>
        </div>
      ) : !machine ? null : alerts.length === 0 ? (
        <div className="as-empty">{flattenAlerts(machine).length === 0 ? copy.noRules : copy.noAlertMatch}</div>
      ) : (
        <div className="as-data-wrap">
          <div className="as-data">
            <div className="as-data-row as-data-head as-data-alerts">
              <span>{copy.colName}</span>
              <span>{copy.colGroup}</span>
              <span>{copy.colLine}</span>
              <span>{copy.colAlertStatus}</span>
              <span>{copy.colDuration}</span>
              <span>{copy.colEnabled}</span>
              <span />
            </div>
            {alerts.map((row) => (
              <div key={row.id} className="as-data-row as-data-alerts">
                <PersonCell name={userName(row)} pictureUrl={row.pictureUrl} />
                <span>{row.groupName || "—"}</span>
                <span>{row.lineName || "—"}</span>
                <span>
                  <span
                    className="as-status"
                    style={{
                      backgroundColor: row.statusBackgroundColor ?? undefined,
                      color: row.statusTextColor ?? undefined,
                    }}
                  >
                    {statusName(row, locale)}
                  </span>
                </span>
                <span>{copy.duration(row.durationMinutes)}</span>
                <span>
                  <span className={`as-badge ${row.enabled ? "is-on" : ""}`}>
                    {row.enabled ? copy.enabled : copy.paused}
                  </span>
                </span>
                <span className="as-row-action">
                  <button type="button" className="btn-icon" aria-label={copy.edit} onClick={() => void openEdit(row)}>
                    <FiEdit2 size={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <OverlayFrame
        open={Boolean(editing)}
        labelledBy="as-alert-title"
        onClose={() => { if (!pending) setEditing(null); }}
        className="modal as-alert-modal"
        backdropClassName="modal-backdrop"
      >
        {editing ? (
          <>
            <header className="as-alert-head">
              <div>
                <h2 id="as-alert-title">{copy.editAlert}</h2>
                <p className="pac-drawer-sub">
                  {userName(editing)}
                  {[editing.groupName, editing.lineName].filter(Boolean).length
                    ? ` · ${[editing.groupName, editing.lineName].filter(Boolean).join(" · ")}`
                    : ""}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setEditing(null)} aria-label={copy.close} disabled={pending} data-dialog-initial-focus>
                <FiX size={18} />
              </button>
            </header>
            {formError ? <p className="inline-error">{formError}</p> : null}
            <label className="as-field">
              <span>{copy.colAlertStatus}</span>
              {catalogLoading ? (
                <div className="as-field-skel" aria-busy="true" aria-label={copy.loadingStatuses}>
                  <span className="skeleton" />
                  <span className="skeleton" />
                </div>
              ) : (
                <select
                  value={statusPick}
                  onChange={(event) => setStatusPick(event.target.value)}
                >
                  {catalog.map((item) => (
                    <option key={item.uuid} value={item.uuid}>{catalogLabel(item, locale)}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="as-field">
              <span>{copy.durationLabel}</span>
              <input type="number" min={0} max={1440} value={duration} onChange={(event) => setDuration(event.target.value)} />
              <small className="as-field-hint">{copy.durationHint}</small>
            </label>
            <label className="as-check">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              {enabled ? copy.enabled : copy.paused}
            </label>
            <div className="as-alert-actions">
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => void removeEdit()}>{copy.remove}</button>
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setEditing(null)}>{copy.cancel}</button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void saveEdit()}>{copy.save}</button>
            </div>
          </>
        ) : null}
      </OverlayFrame>
    </SystemShell>
  );
}
