"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiCopy } from "react-icons/fi";
import type { Copy } from "./copy";
import type { CatalogChoice, KeyEnvironment } from "./types";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogFrame({
  open,
  labelledBy,
  describedBy,
  className = "modal",
  onClose,
  children,
}: {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const root = panelRef.current;
    const preferred =
      root?.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      root?.querySelector<HTMLElement>(FOCUSABLE);
    (preferred ?? root)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.tabIndex !== -1 && !el.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function LinePicker({
  copy,
  choices,
  selectedLineUuid,
  catalogLoading,
  onLineChange,
}: {
  copy: Copy;
  choices: CatalogChoice[];
  selectedLineUuid: string;
  catalogLoading: boolean;
  onLineChange: (uuid: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (catalogLoading) setQuery("");
  }, [catalogLoading]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedLineUuid, catalogLoading, query]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, CatalogChoice[]>();
    for (const choice of choices) {
      const haystack = `${choice.groupName} ${choice.lineName} ${choice.label}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      const key = choice.groupName || copy.line;
      const list = map.get(key) ?? [];
      list.push(choice);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [choices, copy.line, query]);

  return (
    <div className="pac-line-picker">
      <input
        className="pac-line-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.searchLines}
        aria-label={copy.searchLines}
        disabled={catalogLoading}
      />
      <div className="pac-line-list" role="listbox" aria-label={copy.line} aria-busy={catalogLoading}>
        {catalogLoading ? (
          <p className="pac-line-empty">{copy.loadingCatalog}</p>
        ) : groups.length === 0 ? (
          <p className="pac-line-empty">{choices.length === 0 ? copy.noLines : copy.noLineMatch}</p>
        ) : (
          groups.map(([groupName, lines]) => (
            <div key={groupName} className="pac-line-group">
              <p className="pac-line-group-title">{groupName}</p>
              {lines.map((choice) => {
                const selected = choice.lineUuid === selectedLineUuid;
                return (
                  <button
                    type="button"
                    key={choice.lineUuid}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={`pac-line-option${selected ? " is-selected" : ""}`}
                    title={choice.label}
                    ref={selected ? selectedRef : undefined}
                    onClick={() => onLineChange(choice.lineUuid)}
                  >
                    <span className="pac-line-option-name">{choice.lineName}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CreateApiKeyDialog({
  open,
  copy,
  busy,
  error,
  name,
  environment,
  expiration,
  choices,
  selectedLineUuid,
  catalogLoading,
  onNameChange,
  onEnvironmentChange,
  onExpirationChange,
  onLineChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  copy: Copy;
  busy: boolean;
  error: string | null;
  name: string;
  environment: KeyEnvironment;
  expiration: string;
  choices: CatalogChoice[];
  selectedLineUuid: string;
  catalogLoading: boolean;
  onNameChange: (value: string) => void;
  onEnvironmentChange: (value: KeyEnvironment) => void;
  onExpirationChange: (value: string) => void;
  onLineChange: (uuid: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <DialogFrame open={open} labelledBy={titleId} className="modal pac-create-modal" onClose={onClose}>
      <h2 id={titleId}>{copy.createTitle}</h2>
      <div className="pac-create-body">
        <label className="dx-field">
          <span>{copy.name}</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={copy.namePlaceholder}
            data-dialog-initial-focus
          />
        </label>
        <div className="dx-field">
          <span>{copy.line}</span>
          <LinePicker
            copy={copy}
            choices={choices}
            selectedLineUuid={selectedLineUuid}
            catalogLoading={catalogLoading}
            onLineChange={onLineChange}
          />
        </div>
        <div className="pac-create-grid">
          <label className="dx-field">
            <span>{copy.environment}</span>
            <select
              value={environment}
              onChange={(event) => onEnvironmentChange(event.target.value === "test" ? "test" : "live")}
            >
              <option value="live">{copy.envLive}</option>
              <option value="test">{copy.envTest}</option>
            </select>
          </label>
          <label className="dx-field">
            <span>{copy.expiration}</span>
            <select value={expiration} onChange={(event) => onExpirationChange(event.target.value)}>
              <option value="never">{copy.expNever}</option>
              <option value="30">{copy.exp30}</option>
              <option value="90">{copy.exp90}</option>
              <option value="365">{copy.exp365}</option>
            </select>
          </label>
        </div>
        {error ? <p className="inline-error">{error}</p> : null}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          {copy.cancel}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={busy || catalogLoading || !selectedLineUuid}
        >
          {copy.create}
        </button>
      </div>
    </DialogFrame>
  );
}

export function CreatedApiKeyDialog({
  open,
  copy,
  secret,
  copied,
  onCopy,
  onClose,
}: {
  open: boolean;
  copy: Copy;
  secret: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <DialogFrame open={open} labelledBy={titleId} describedBy={bodyId} onClose={onClose}>
      <h2 id={titleId}>{copy.createdTitle}</h2>
      <p id={bodyId} className="modal-copy">
        {copy.createdBody}
      </p>
      <code className="pac-secret">{secret}</code>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCopy}>
          {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
          {copied ? copy.copied : copy.copy}
        </button>
        <button type="button" className="btn btn-primary" data-dialog-initial-focus onClick={onClose}>
          {copy.done}
        </button>
      </div>
    </DialogFrame>
  );
}

export function ConfirmKeyDialog({
  open,
  copy,
  title,
  body,
  action,
  danger,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  copy: Copy;
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <DialogFrame open={open} labelledBy={titleId} describedBy={bodyId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <p id={bodyId} className="modal-copy">
        {body}
      </p>
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-dialog-initial-focus
          onClick={onClose}
          disabled={busy}
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {action}
        </button>
      </div>
    </DialogFrame>
  );
}
