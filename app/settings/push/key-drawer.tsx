"use client";

import { FiCheck, FiCheckCircle, FiCopy, FiRefreshCw, FiSlash, FiTrash2, FiX } from "react-icons/fi";
import { OverlayFrame } from "../connections/overlay-frame";
import type { Locale } from "../../locale-context";
import { formatDate, keyName, lineLabel, maskKey, relativeUsed, type Copy } from "./copy";
import type { IssuedKey } from "./types";

function isExpired(item: IssuedKey) {
  return Boolean(item.expiresAt && Date.parse(item.expiresAt) <= Date.now());
}

export function KeyDrawer({
  open,
  copy,
  locale,
  target,
  copied,
  busy,
  error,
  onClose,
  onCopy,
  onRotate,
  onToggle,
  onDelete,
}: {
  open: boolean;
  copy: Copy;
  locale: Locale;
  target: IssuedKey | null;
  copied: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCopy: () => void;
  onRotate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const titleId = "pac-drawer-title";
  const expired = target ? isExpired(target) : false;
  const disabled = target?.status === "disabled";

  return (
    <OverlayFrame open={open && Boolean(target)} labelledBy={titleId} onClose={onClose} className="pac-drawer">
      {target ? (
        <>
          <header className="pac-drawer-head">
            <div>
              <h2 id={titleId}>{keyName(target, locale)}</h2>
              <p className="pac-drawer-sub">{lineLabel(target, locale, copy.unused)}</p>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label={copy.close} data-dialog-initial-focus>
              <FiX size={18} />
            </button>
          </header>
          <div className="pac-drawer-body">
            <dl className="pac-meta">
              <div>
                <dt>{copy.name}</dt>
                <dd>{keyName(target, locale)}</dd>
              </div>
              <div>
                <dt>{copy.line}</dt>
                <dd>{lineLabel(target, locale, copy.unused)}</dd>
              </div>
              <div>
                <dt>{copy.maskedKey}</dt>
                <dd className="pac-meta-key">
                  <code>{maskKey(target.key)}</code>
                </dd>
              </div>
              <div>
                <dt>{copy.status}</dt>
                <dd>
                  <span className={`pac-status is-${expired ? "expired" : disabled ? "disabled" : "active"}`}>
                    <span className="pac-status-dot" aria-hidden="true" />
                    {expired ? copy.expired : disabled ? copy.statusDisabled : copy.statusActive}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{copy.createdAt}</dt>
                <dd>{formatDate(target.createdAt, locale)}</dd>
              </div>
              <div>
                <dt>{copy.lastUsed}</dt>
                <dd>{relativeUsed(target.lastUsedAt, locale, copy)}</dd>
              </div>
            </dl>
            {error ? <p className="inline-error">{error}</p> : null}
          </div>
          <footer className="pac-drawer-foot">
            <button
              type="button"
              className="btn-icon"
              onClick={onCopy}
              disabled={busy}
              aria-label={copied ? copy.copied : copy.copy}
            >
              {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
            </button>
            <button type="button" className="btn-icon" onClick={onRotate} disabled={busy} aria-label={copy.rotate}>
              <FiRefreshCw size={16} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onToggle}
              disabled={busy || expired}
              aria-label={disabled ? copy.enable : copy.disable}
            >
              {disabled ? <FiCheckCircle size={16} /> : <FiSlash size={16} />}
            </button>
            <button
              type="button"
              className="btn-icon pac-drawer-delete"
              onClick={onDelete}
              disabled={busy}
              aria-label={copy.deleteAction}
            >
              <FiTrash2 size={16} />
            </button>
          </footer>
        </>
      ) : null}
    </OverlayFrame>
  );
}
