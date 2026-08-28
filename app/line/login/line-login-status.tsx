import { FiAlertCircle, FiCheckCircle, FiLink2 } from "react-icons/fi";
import { IxacsLogo } from "../ixacs-logo";
import type { LineLoginCopy, LineLoginUiState } from "./line-login-copy";

type LineLoginStatusProps = {
  copy: LineLoginCopy;
  state: Exclude<LineLoginUiState, "ready" | "submitting" | "error">;
  onPrimaryAction?: () => void;
};

export function LineLoginStatus({ copy, state, onPrimaryAction }: LineLoginStatusProps) {
  if (state === "loading") {
    return (
      <section className="line-login-status is-loading-only" aria-live="polite" aria-busy="true" aria-label={copy.loadingTitle}>
        <div className="line-login-status-logo is-loading" aria-hidden>
          <IxacsLogo width={168} className="line-login-ixacs-logo" />
        </div>
      </section>
    );
  }

  if (state === "linked") {
    return (
      <section className="line-login-status" aria-live="polite">
        <div className="line-login-status-icon is-success" aria-hidden>
          <FiCheckCircle size={24} />
        </div>
        <h1 className="line-login-status-title">{copy.linkedTitle}</h1>
        <p className="line-login-status-lead">{copy.linkedLead}</p>
        <button type="button" className="btn btn-primary line-login-status-action" onClick={onPrimaryAction}>
          {copy.linkedAction}
        </button>
      </section>
    );
  }

  if (state === "alreadyLinked") {
    return (
      <section className="line-login-status" aria-live="polite">
        <div className="line-login-status-icon is-line" aria-hidden>
          <FiLink2 size={22} />
        </div>
        <h1 className="line-login-status-title">{copy.alreadyLinkedTitle}</h1>
        <p className="line-login-status-lead">{copy.alreadyLinkedLead}</p>
        <button type="button" className="btn btn-primary line-login-status-action" onClick={onPrimaryAction}>
          {copy.alreadyLinkedAction}
        </button>
      </section>
    );
  }

  return (
    <section className="line-login-status" aria-live="polite">
      <div className="line-login-status-icon is-warning" aria-hidden>
        <FiAlertCircle size={24} />
      </div>
      <h1 className="line-login-status-title">{copy.unavailableTitle}</h1>
      <p className="line-login-status-lead">{copy.unavailableLead}</p>
      <p className="line-login-status-hint">{copy.unavailableHint}</p>
    </section>
  );
}
