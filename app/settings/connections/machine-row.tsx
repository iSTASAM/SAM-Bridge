"use client";

import Link from "next/link";
import { useId } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import type { Copy } from "./copy";
import { connectionStatus, statusLabel, type Connection } from "./types";

export function MachineRow({
  item,
  copy,
  busy,
  testing,
  menuOpen,
  onTest,
  onEdit,
  onDetails,
  onUse,
  onDelete,
  onToggleMenu,
  canActivate,
  canManage,
}: {
  item: Connection;
  copy: Copy;
  busy: boolean;
  testing: boolean;
  menuOpen: boolean;
  canActivate: boolean;
  canManage: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDetails: () => void;
  onUse: () => void;
  onDelete: () => void;
  onToggleMenu: () => void;
}) {
  const menuId = useId();
  const status = connectionStatus(item);

  return (
    <article className={`machine-card ${menuOpen ? "is-open" : ""}`}>
      <div className="machine-card-main">
        <h3 className="machine-card-title">{item.name}</h3>
        <div className="machine-card-meta">
          <p className={`machine-status is-${status} no-dot`}>
            {testing ? copy.testing : statusLabel(status, copy)}
          </p>
        </div>
      </div>
      <div className="machine-card-actions">
        {canManage ? (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onTest}>
            {testing ? copy.testing : copy.test}
          </button>
        ) : null}
        <Link href={`/settings/${item.id}/data`} className="btn btn-secondary">
          {copy.fetch}
        </Link>
        {canManage ? <button type="button" className="btn btn-secondary" disabled={busy} onClick={onEdit}>
          {copy.edit}
        </button> : null}
        {canManage ? <button
          type="button"
          className="btn-icon"
          aria-label={copy.more}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          disabled={busy}
          onClick={onToggleMenu}
        >
          <FiMoreHorizontal size={16} />
        </button> : null}
      </div>
      {canManage && menuOpen ? (
        <div className="menu" role="menu" id={menuId}>
          <button type="button" role="menuitem" onClick={onTest}>
            {copy.testConnection}
          </button>
          <button type="button" role="menuitem" onClick={onEdit}>
            {copy.edit}
          </button>
          <button type="button" role="menuitem" onClick={onDetails}>
            {copy.details}
          </button>
          <Link href={`/settings/${item.id}/data`} role="menuitem" className="menu-link">
            {copy.fetch}
          </Link>
          {canActivate ? (
            <button type="button" role="menuitem" onClick={onUse}>
              {copy.use}
            </button>
          ) : null}
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="is-danger" onClick={onDelete}>
            {copy.remove}
          </button>
        </div>
      ) : null}
    </article>
  );
}
