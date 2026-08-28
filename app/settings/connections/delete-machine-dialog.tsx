"use client";

import { useId } from "react";
import type { Copy } from "./copy";
import { OverlayFrame } from "./overlay-frame";
import type { Connection } from "./types";

export function DeleteMachineDialog({
  open,
  copy,
  target,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  copy: Copy;
  target: Connection | null;
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
