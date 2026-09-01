"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FiEdit2, FiMoreHorizontal } from "react-icons/fi";
import type { Copy } from "./copy";
import { connectionStatus, statusLabel, type Connection } from "./types";

function useMenuPlacement(open: boolean, buttonRef: RefObject<HTMLButtonElement | null>, panelRef: RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = panel?.offsetWidth || 200;
      const height = panel?.offsetHeight || 132;
      const pad = 8;
      const left = Math.min(Math.max(pad, rect.right - width), window.innerWidth - width - pad);
      const below = rect.bottom + 4;
      const top = below + height + pad <= window.innerHeight ? below : Math.max(pad, rect.top - height - 4);
      setPos({ top, left });
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
  }, [open, buttonRef, panelRef]);

  return pos;
}

export function MachineRow({
  item,
  copy,
  busy,
  testing,
  menuOpen,
  onTest,
  onEdit,
  onDetails,
  onDelete,
  onToggleMenu,
  onCloseMenu,
  canManage,
}: {
  item: Connection;
  copy: Copy;
  busy: boolean;
  testing: boolean;
  menuOpen: boolean;
  canManage: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDetails: () => void;
  onDelete: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuPos = useMenuPlacement(menuOpen, menuButtonRef, menuPanelRef);
  const status = connectionStatus(item);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (menuButtonRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      onCloseMenu();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseMenu();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, onCloseMenu]);

  function runAction(action: () => void) {
    onCloseMenu();
    action();
  }

  return (
    <tr className={menuOpen ? "is-open" : undefined}>
      <td>
        <strong className="machine-table-name">{item.name}</strong>
      </td>
      <td>
        <span className={`machine-pill is-${status}`}>
          {testing ? copy.testing : statusLabel(status, copy)}
        </span>
      </td>
      <td className="machine-table-actions">
        <div className="machine-table-actions-inner">
          <Link href={`/settings/${item.id}/data`} className="btn btn-primary">
            {copy.fetch}
          </Link>
          {canManage ? (
            <>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={onTest}>
                {testing ? copy.testing : copy.test}
              </button>
              <button type="button" className="btn-icon" aria-label={copy.edit} disabled={busy} onClick={onEdit}>
                <FiEdit2 size={16} />
              </button>
              <button
                ref={menuButtonRef}
                type="button"
                className={`btn-icon${menuOpen ? " is-active" : ""}`}
                aria-label={copy.more}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                disabled={busy}
                onClick={onToggleMenu}
              >
                <FiMoreHorizontal size={16} />
              </button>
            </>
          ) : null}
        </div>
        {canManage && menuOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuPanelRef}
                className="menu machine-row-menu"
                role="menu"
                id={menuId}
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <button type="button" role="menuitem" onClick={() => runAction(onDetails)}>
                  {copy.details}
                </button>
                <div className="menu-sep" />
                <button type="button" role="menuitem" className="is-danger" onClick={() => runAction(onDelete)}>
                  {copy.remove}
                </button>
              </div>,
              document.body,
            )
          : null}
      </td>
    </tr>
  );
}
