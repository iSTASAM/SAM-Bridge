"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiMoreHorizontal,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { PushEvent } from "@/lib/ixacs-store";
import { OverlayFrame } from "../../connections/overlay-frame";
import { useLocale, type Locale } from "../../../locale-context";
import { COPY } from "../copy";
import { PushSubnav } from "../push-subnav";

type Company = { id: string; name: string };
type LineOption = { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null };
type StatusOption = { uuid: string; name: string | null; nameTh: string | null; nameEn: string | null; nameJa: string | null; bgColor: string | null };
type LineStatus = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  bgColor: string;
  fontColor: string;
  blinking: boolean;
  blinkingBgColor: string | null;
  blinkingFontColor: string | null;
};
type StatusPanel = { event: PushEvent; currentUuid: string | null; statuses: LineStatus[] };

const PAGE_SIZE = 50;

function pickName(locale: Locale, th?: string | null, en?: string | null, ja?: string | null, fallback?: string | null) {
  if (locale === "en") return en || th || ja || fallback || "—";
  if (locale === "ja") return ja || en || th || fallback || "—";
  return th || en || ja || fallback || "—";
}

function localizedStatus(event: PushEvent, locale: Locale) {
  return pickName(locale, event.statusNameTh, event.statusNameEn, event.statusNameJa, event.statusName || "No status");
}

function localizedCatalogStatus(status: LineStatus, locale: Locale) {
  return pickName(locale, status.nameTh, status.nameEn, status.nameJa);
}

function localizedGroup(event: PushEvent, locale: Locale) {
  return pickName(locale, event.groupNameTh, event.groupNameEn, event.groupNameJa, event.groupName);
}

function localizedLine(event: PushEvent, locale: Locale) {
  return pickName(locale, event.lineNameTh, event.lineNameEn, event.lineNameJa, event.lineName || event.lineUuid);
}

function dateLocale(locale: Locale) {
  return locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB";
}

function formatLastUpdate(iso: string, locale: Locale) {
  const date = new Date(iso);
  const loc = dateLocale(locale);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(loc, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return date.toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatReceived(iso: string, locale: Locale) {
  const date = new Date(iso);
  const loc = dateLocale(locale);
  const day = date.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString(loc, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${day} · ${time}`;
}

function prettyPayload(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value || "—"; }
}

function eventUuid(event: PushEvent) {
  return event.lineUuid || event.statusUuid || event.id;
}

function statusVars(input: {
  bgColor?: string | null;
  fontColor?: string | null;
  blinkingBgColor?: string | null;
  blinkingFontColor?: string | null;
}) {
  return {
    ["--status-bg" as string]: input.bgColor || "var(--bg-subtle)",
    ["--status-fg" as string]: input.fontColor || "var(--text-primary)",
    ["--status-blink-bg" as string]: input.blinkingBgColor || input.bgColor || "var(--bg-hover)",
    ["--status-blink-fg" as string]: input.blinkingFontColor || input.fontColor || "var(--text-primary)",
  };
}

function eventStatusVars(event: PushEvent) {
  return statusVars({
    bgColor: event.statusBgColor,
    fontColor: event.statusFontColor,
    blinkingBgColor: event.statusBlinkingBgColor,
    blinkingFontColor: event.statusBlinkingFontColor,
  });
}

function StatusDot({
  color,
  blinkColor,
  blinking,
}: {
  color?: string | null;
  blinkColor?: string | null;
  blinking?: boolean;
}) {
  return (
    <span
      className={`pe-dot ${blinking ? "is-blinking" : ""}`}
      aria-hidden="true"
      style={{
        ["--status-bg" as string]: color || "var(--text-tertiary)",
        ["--status-blink-bg" as string]: blinkColor || color || "transparent",
      }}
    />
  );
}

export function PushEventViewer() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [events, setEvents] = useState<PushEvent[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [lines, setLines] = useState<LineOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [statusUuid, setStatusUuid] = useState("");
  const [lineUuid, setLineUuid] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PushEvent | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);
  const [statusPanel, setStatusPanel] = useState<StatusPanel | null>(null);
  const [statusQuery, setStatusQuery] = useState("");
  const [statusPick, setStatusPick] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const query = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      latestPerLine: "1",
    });
    if (companyId) query.set("connectionId", companyId);
    if (statusUuid) query.set("statusUuid", statusUuid);
    if (lineUuid) query.set("lineUuid", lineUuid);
    if (search.trim()) query.set("search", search.trim());
    try {
      const response = await fetch(`/api/push/events?${query}`, { cache: "no-store" });
      const data = (await response.json()) as {
        events?: PushEvent[];
        companies?: Company[];
        lines?: LineOption[];
        statuses?: StatusOption[];
        total?: number;
      };
      setEvents(data.events ?? []);
      setCompanies(data.companies ?? []);
      setLines(data.lines ?? []);
      setStatuses(data.statuses ?? []);
      setTotal(data.total ?? 0);
      setSelected((current) => current ? (data.events ?? []).find((event) => event.id === current.id) ?? current : null);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [companyId, lineUuid, page, search, statusUuid]);

  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [page, total]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useLayoutEffect(() => {
    if (!menuId) return;

    function place() {
      const button = menuButtonRef.current;
      const panel = menuPanelRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = panel?.offsetWidth || 200;
      const height = panel?.offsetHeight || 132;
      const pad = 8;
      const left = Math.min(Math.max(pad, rect.right - width), window.innerWidth - width - pad);
      const below = rect.bottom + 4;
      const top = below + height + pad <= window.innerHeight ? below : Math.max(pad, rect.top - height - 4);
      setMenuPos({ top, left });
    }

    place();
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (menuButtonRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      setMenuId(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuId]);

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const menuEvent = events.find((event) => event.id === menuId) ?? null;

  const filteredStatuses = useMemo(() => {
    if (!statusPanel) return [];
    const needle = statusQuery.trim().toLowerCase();
    return statusPanel.statuses.filter((item) => {
      if (item.uuid === statusPanel.currentUuid) return false;
      if (!needle) return true;
      return localizedCatalogStatus(item, locale).toLowerCase().includes(needle);
    });
  }, [locale, statusPanel, statusQuery]);

  const currentStatus = statusPanel?.statuses.find((item) => item.uuid === statusPanel.currentUuid) ?? null;

  async function copyUuid(event: PushEvent) {
    const value = eventUuid(event);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function openStatuses(event: PushEvent) {
    if (!event.lineUuid || !event.connectionId) return;
    setStatusLoading(true);
    setStatusError(null);
    setStatusQuery("");
    setStatusPick(null);
    try {
      const response = await fetch(`/api/lines/${event.lineUuid}`, { cache: "no-store" });
      const data = (await response.json()) as { andonStatusStyleUuid?: string | null; statuses?: LineStatus[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      const currentUuid = data.andonStatusStyleUuid ?? event.statusUuid ?? null;
      setStatusPanel({ event, currentUuid, statuses: data.statuses ?? [] });
      setStatusPick(null);
    } catch {
      setStatusError("ไม่สามารถโหลดรายการสถานะได้");
    } finally {
      setStatusLoading(false);
    }
  }

  async function changeStatus() {
    if (!statusPanel || !statusPick || statusPick === statusPanel.currentUuid || statusPending) return;
    const next = statusPanel.statuses.find((item) => item.uuid === statusPick);
    if (!next) return;
    setStatusPending(true);
    setStatusError(null);
    try {
      const response = await fetch("/api/regist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: statusPanel.event.connectionId,
          productionLineUuid: statusPanel.event.lineUuid,
          andonStatusStyleUuid: next.uuid,
          productUuid: statusPanel.event.productUuid ?? "",
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        responseJson?: { message?: string };
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.responseJson?.message || data.error || "เปลี่ยนสถานะไม่สำเร็จ");
      }
      setStatusPanel(null);
      void load(true);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setStatusPending(false);
    }
  }

  async function removeEvent(event: PushEvent) {
    if (deletingId) return;
    setDeletingId(event.id);
    try {
      const response = event.connectionId && event.lineUuid
        ? await fetch(`/api/push/events?${new URLSearchParams({ connectionId: event.connectionId, lineUuid: event.lineUuid })}`, { method: "DELETE" })
        : await fetch(`/api/push/events/${event.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setEvents((current) => current.filter((item) => event.lineUuid ? item.lineUuid !== event.lineUuid || item.connectionId !== event.connectionId : item.id !== event.id));
      setTotal((current) => Math.max(0, current - 1));
      setSelected((current) => current && (current.id === event.id || (event.lineUuid && current.lineUuid === event.lineUuid && current.connectionId === event.connectionId)) ? null : current);
      setStatusPanel((current) => current && (current.event.id === event.id || (event.lineUuid && current.event.lineUuid === event.lineUuid && current.event.connectionId === event.connectionId)) ? null : current);
      setMenuId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function openRow(event: PushEvent) {
    setSelected(event);
    setMenuId(null);
  }

  return (
    <div className="console-page push-events-page pac-page">
      <header className="pac-head">
        <div className="pac-head-top">
          <h1 className="console-title">{copy.eventsTitle}</h1>
          <button
            type="button"
            className="btn btn-secondary pac-icon-btn"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
          >
            <FiRefreshCw size={16} />
          </button>
        </div>
        <PushSubnav copy={copy} active="events" />
      </header>

      <div className="pac-tools pe-filters">
        <input
          className="pac-search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Search..."
          aria-label="Search events"
        />
        {companies.length > 1 ? (
          <select className="pac-filter" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(0); }} aria-label="Company">
            <option value="">Company</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        ) : null}
        <select className="pac-filter" value={statusUuid} onChange={(event) => { setStatusUuid(event.target.value); setPage(0); }} aria-label="Status">
          <option value="">Status</option>
          {statuses.map((status) => <option key={status.uuid} value={status.uuid}>{pickName(locale, status.nameTh, status.nameEn, status.nameJa, status.name)}</option>)}
        </select>
        <select className="pac-filter" value={lineUuid} onChange={(event) => { setLineUuid(event.target.value); setPage(0); }} aria-label="Line">
          <option value="">Line</option>
          {lines.map((line) => <option key={line.uuid} value={line.uuid}>{pickName(locale, line.nameTh, line.nameEn, line.nameJa, line.name)}</option>)}
        </select>
      </div>

      <section className="pe-table-section">
        {loading ? (
          <div className="pe-table" aria-busy="true">
            <div className="pe-row pe-row-head">
              <span>Group</span>
              <span>Line</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="pe-row">
                <span className="skeleton skeleton-key" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-action" />
                <span />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="pe-empty">ยังไม่มีข้อมูล Push ตามเงื่อนไขนี้</div>
        ) : (
          <>
            <div className="pe-table-wrap">
              <div className="pe-table">
                <div className="pe-row pe-row-head">
                  <span>Group</span>
                  <span>Line</span>
                  <span>Status</span>
                  <span>Updated</span>
                  <span />
                </div>
                {events.map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    className={`pe-row pe-row-btn ${selected?.id === event.id ? "is-selected" : ""}`}
                    onClick={() => openRow(event)}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.target !== keyEvent.currentTarget) return;
                      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                        keyEvent.preventDefault();
                        openRow(event);
                      }
                    }}
                  >
                    <span className="pe-cell">{localizedGroup(event, locale)}</span>
                    <span className="pe-cell">{localizedLine(event, locale)}</span>
                    <button
                      type="button"
                      className={`pe-status pe-status-chip ${event.statusBlinking ? "is-blinking" : ""}`}
                      style={eventStatusVars(event)}
                      disabled={!event.accepted || !event.lineUuid || statusLoading}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        void openStatuses(event);
                      }}
                    >
                      <span className="pe-status-label">{localizedStatus(event, locale)}</span>
                    </button>
                    <time className="pe-cell-muted" dateTime={event.receivedAt}>{formatLastUpdate(event.receivedAt, locale)}</time>
                    <div className="pe-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label="Actions"
                        aria-haspopup="menu"
                        aria-expanded={menuId === event.id}
                        ref={menuId === event.id ? menuButtonRef : undefined}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setMenuId((current) => current === event.id ? null : event.id);
                        }}
                      >
                        <FiMoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pe-pager">
              <span>{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
              <button type="button" className="btn-icon" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><FiChevronLeft size={16} /></button>
              <button type="button" className="btn-icon" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((current) => current + 1)}><FiChevronRight size={16} /></button>
            </div>
          </>
        )}
      </section>

      {menuEvent && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuPanelRef}
          className="menu pe-menu"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button type="button" role="menuitem" disabled={!menuEvent.accepted || !menuEvent.lineUuid || statusLoading} onClick={() => { setMenuId(null); void openStatuses(menuEvent); }}>Change status</button>
          <button type="button" role="menuitem" onClick={() => { setMenuId(null); void copyUuid(menuEvent); }}>{copied ? "Copied" : "Copy UUID"}</button>
          <button type="button" role="menuitem" className="is-danger" disabled={deletingId === menuEvent.id} onClick={() => { void removeEvent(menuEvent); }}>Delete event</button>
        </div>,
        document.body,
      ) : null}

      <OverlayFrame open={Boolean(selected)} labelledBy="pe-drawer-title" onClose={() => { if (!statusPanel) setSelected(null); }} className="pac-drawer pe-drawer">
        {selected ? (
          <>
            <header className="pac-drawer-head">
              <div>
                <h2 id="pe-drawer-title">{localizedLine(selected, locale)}</h2>
                <p className="pac-drawer-sub">{localizedGroup(selected, locale)}</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelected(null)} aria-label="Close" data-dialog-initial-focus>
                <FiX size={18} />
              </button>
            </header>
            <div className="pac-drawer-body">
              <dl className="pac-meta">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`pe-status pe-status-chip ${selected.statusBlinking ? "is-blinking" : ""}`} style={eventStatusVars(selected)}>
                      <span className="pe-status-label">{localizedStatus(selected, locale)}</span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatReceived(selected.receivedAt, locale)}</dd>
                </div>
                <div>
                  <dt>UUID</dt>
                  <dd className="pe-drawer-uuid">{eventUuid(selected)}</dd>
                </div>
              </dl>
              <pre className="pe-drawer-payload">{prettyPayload(selected.payloadPreview)}</pre>
            </div>
            <footer className="pac-drawer-foot">
              <button type="button" className="btn btn-secondary" disabled={!selected.accepted || !selected.lineUuid || statusLoading} onClick={() => void openStatuses(selected)}>Change status</button>
              <button type="button" className="btn-icon" aria-label={copied ? "Copied" : "Copy UUID"} onClick={() => void copyUuid(selected)}>
                {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
              </button>
              <button type="button" className="btn-icon pac-drawer-delete" aria-label="Delete event" disabled={deletingId === selected.id} onClick={() => void removeEvent(selected)}>
                <FiTrash2 size={16} />
              </button>
            </footer>
          </>
        ) : null}
      </OverlayFrame>

      <OverlayFrame
        open={Boolean(statusPanel)}
        labelledBy="pe-status-title"
        onClose={() => { if (!statusPending) setStatusPanel(null); }}
        className="modal pe-status-modal"
        backdropClassName="modal-backdrop"
      >
        {statusPanel ? (
          <>
            <header className="pe-status-head">
              <div>
                <h2 id="pe-status-title">Change status</h2>
                <p className="pac-drawer-sub">{localizedLine(statusPanel.event, locale)}</p>
              </div>
            </header>
            <input
              className="pe-status-search"
              value={statusQuery}
              onChange={(event) => setStatusQuery(event.target.value)}
              placeholder="Search..."
              aria-label="Search status"
              data-dialog-initial-focus
            />
            {statusError ? <p className="inline-error">{statusError}</p> : null}
            {currentStatus ? (
              <div className="pe-status-current">
                <span className="pe-status-mark"><FiCheck size={14} /></span>
                <StatusDot color={currentStatus.bgColor} blinkColor={currentStatus.blinkingBgColor} blinking={currentStatus.blinking} />
                <span>{localizedCatalogStatus(currentStatus, locale)}</span>
              </div>
            ) : null}
            <div className="pe-status-list">
              {filteredStatuses.length === 0 ? (
                <p className="pe-empty pe-empty-compact">No matching status</p>
              ) : filteredStatuses.map((item) => (
                <button
                  key={item.uuid}
                  type="button"
                  className={`pe-status-option ${statusPick === item.uuid ? "is-selected" : ""}`}
                  onClick={() => setStatusPick(item.uuid)}
                >
                  <span className="pe-status-mark">{statusPick === item.uuid ? <FiCheck size={14} /> : null}</span>
                  <StatusDot color={item.bgColor} blinkColor={item.blinkingBgColor} blinking={item.blinking} />
                  <span>{localizedCatalogStatus(item, locale)}</span>
                </button>
              ))}
            </div>
            <div className="pe-status-actions">
              <button type="button" className="btn btn-secondary" disabled={statusPending} onClick={() => setStatusPanel(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!statusPick || statusPending} onClick={() => void changeStatus()}>
                {statusPending ? "Changing..." : "Change status"}
              </button>
            </div>
          </>
        ) : null}
      </OverlayFrame>
    </div>
  );
}
