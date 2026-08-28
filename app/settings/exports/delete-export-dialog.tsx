"use client";

import { useId } from "react";
import { OverlayFrame } from "../connections/overlay-frame";
import { EXPORT_COPY } from "./copy";
import type { ExportConfig } from "./types";

type Copy = (typeof EXPORT_COPY)[keyof typeof EXPORT_COPY];

export function DeleteExportDialog({
  open,
  copy,
  target,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  copy: Copy;
  target: ExportConfig | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <OverlayFrame
      open={open}
      labelledBy={titleId}
      describedBy={bodyId}
      onClose={onClose}
      className="modal"
      backdropClassName="modal-backdrop"
    >
      <h2 id={titleId}>{copy.confirmTitle}</h2>
      {target ? <p className="machine-delete-name">{target.name}</p> : null}
      <p id={bodyId} className="modal-copy">
        {copy.confirmBody}
      </p>
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
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {copy.remove}
        </button>
      </div>
    </OverlayFrame>
  );
}
