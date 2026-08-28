"use client";

import { FiCheck, FiCopy } from "react-icons/fi";
import type { Copy } from "./copy";

export function EndpointSection({
  copy,
  pushUrl,
  copied,
  onCopy,
}: {
  copy: Copy;
  pushUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="pac-endpoint">
      <span className="pac-method">{copy.method}</span>
      <code className="pac-endpoint-url">{pushUrl || "—"}</code>
      <button
        type="button"
        className="btn-icon pac-endpoint-copy"
        onClick={onCopy}
        disabled={!pushUrl}
        aria-label={copied ? copy.copied : copy.copy}
      >
        {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
      </button>
    </div>
  );
}
