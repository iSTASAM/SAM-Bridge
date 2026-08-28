"use client";

import { useId } from "react";
import { OverlayFrame } from "../connections/overlay-frame";
import { SAP_COPY } from "./copy";
import type { SapSelectedOrder } from "./types";

type Copy = (typeof SAP_COPY)[keyof typeof SAP_COPY];

export function SapSendDialog({
  open,
  copy,
  order,
  yieldQuantity,
  unit,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  copy: Copy;
  order: SapSelectedOrder | null;
  yieldQuantity: string;
  unit: string;
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
      <h2 id={titleId}>{copy.sendConfirmTitle}</h2>
      <dl id={bodyId} className="ew-sap-confirm">
        <div>
          <dt>{copy.reviewOrder}</dt>
          <dd>{order?.id || "—"}</dd>
        </div>
        <div>
          <dt>{copy.yield}</dt>
          <dd>{yieldQuantity || "—"} {unit}</dd>
        </div>
      </dl>
      <p className="machine-help">{copy.sendConfirmNote}</p>
      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-dialog-initial-focus
          onClick={onClose}
          disabled={busy}
        >
          {copy.sendCancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
          {copy.runSimulation}
        </button>
      </div>
    </OverlayFrame>
  );
}
