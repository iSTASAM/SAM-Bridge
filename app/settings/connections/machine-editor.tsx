"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiExternalLink, FiEye, FiEyeOff, FiX } from "react-icons/fi";
import type { Copy } from "./copy";
import { OverlayFrame } from "./overlay-frame";
import {
  DEFAULT_LOGIN_PATH,
  fullLoginUrl,
  normalizeBaseUrl,
  type Flash,
  type FormState,
} from "./types";
import type { IxacsCustomerOption } from "@/lib/ixacs-login";

export function MachineEditor({
  open,
  copy,
  form,
  editingId,
  busy,
  flash,
  customerOptions,
  selectedCustomerIds,
  onChange,
  onClose,
  onSave,
  onLogin,
  onToggleCustomer,
}: {
  open: boolean;
  copy: Copy;
  form: FormState;
  editingId: string | "new" | null;
  busy: boolean;
  flash: Flash | null;
  customerOptions: IxacsCustomerOption[];
  selectedCustomerIds: string[];
  onChange: (next: FormState) => void;
  onClose: () => void;
  onSave: () => void;
  onLogin: (credentials: {
    customerId: string;
    loginId: string;
    password: string;
  }) => void;
  onToggleCustomer: (customerId: string) => void;
}) {
  const titleId = useId();
  const isEdit = Boolean(editingId && editingId !== "new");
  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(!isEdit || !form.hasSavedPassword);
  const customerIdRef = useRef<HTMLInputElement>(null);
  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setShowPassword(false);
    setChangePassword(!isEdit || !form.hasSavedPassword);
  }, [open, editingId, isEdit, form.hasSavedPassword]);

  function patch(partial: Partial<FormState>) {
    onChange({ ...form, ...partial });
  }

  function setBaseUrl(value: string, finalize = false) {
    const trimmed = value.trim();
    let next = value;
    if (finalize) {
      next = normalizeBaseUrl(trimmed) || trimmed;
    } else {
      try {
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const url = new URL(withProtocol);
        if (url.pathname && url.pathname !== "/") {
          next = url.origin;
        }
      } catch {
        next = value;
      }
    }
    patch({ baseUrl: next, loginPath: DEFAULT_LOGIN_PATH });
  }

  const previewLoginUrl = fullLoginUrl(form.baseUrl, DEFAULT_LOGIN_PATH);
  const canOpenUrl = Boolean(normalizeBaseUrl(form.baseUrl));

  return (
    <OverlayFrame
      open={open}
      labelledBy={titleId}
      onClose={onClose}
      closeOnBackdrop={false}
      className="machine-sheet"
    >
      <header className="machine-sheet-head">
        <div>
          <h2 id={titleId}>{isEdit ? copy.editTitle : copy.addTitle}</h2>
          {isEdit && form.name ? <p className="machine-sheet-sub">{form.name}</p> : null}
        </div>
        <button
          type="button"
          className="btn-icon"
          aria-label={copy.cancel}
          onClick={onClose}
          disabled={busy}
        >
          <FiX size={18} />
        </button>
      </header>

      <div className="machine-sheet-body">
        <section className="machine-section">
          <h3 className="machine-section-title">{copy.connection}</h3>
          <label className="machine-field">
            <span className="machine-label">{copy.name}</span>
            <input
              className="machine-input"
              data-dialog-initial-focus
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>
          <div className="machine-grid machine-url-row">
            <label className="machine-field">
              <span className="machine-label">{copy.baseUrl}</span>
              <span className="machine-url-wrap">
                <input
                  className="machine-input"
                  type="url"
                  autoComplete="url"
                  value={form.baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  onBlur={() => setBaseUrl(form.baseUrl, true)}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData("text");
                    if (!text.trim()) return;
                    event.preventDefault();
                    setBaseUrl(text, true);
                  }}
                />
                <button
                  type="button"
                  className="btn-icon machine-open-url"
                  disabled={!canOpenUrl}
                  aria-label={copy.openUrl}
                  title={copy.openUrl}
                  onClick={() => window.open(previewLoginUrl, "_blank", "noopener,noreferrer")}
                >
                  <FiExternalLink size={16} />
                </button>
              </span>
            </label>
            <label className="machine-field">
              <span className="machine-label">{copy.loginPath}</span>
              <input
                className="machine-input is-readonly"
                value={DEFAULT_LOGIN_PATH}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
              />
            </label>
          </div>
        </section>

        <section className="machine-section">
          <h3 className="machine-section-title">{copy.auth}</h3>
          <div className="machine-grid">
            {customerOptions.length === 0 ? (
              <label className="machine-field">
                <span className="machine-label">{copy.customerId}</span>
                <input
                  ref={customerIdRef}
                  className="machine-input"
                  autoComplete="organization"
                  value={form.customerId}
                  onChange={(event) => patch({ customerId: event.target.value })}
                />
              </label>
            ) : null}
            <label className={`machine-field ${customerOptions.length > 0 ? "machine-field-span" : ""}`}>
              <span className="machine-label">{copy.loginId}</span>
              <input
                ref={loginIdRef}
                className="machine-input"
                autoComplete="username"
                value={form.loginId}
                onChange={(event) => patch({ loginId: event.target.value })}
              />
            </label>
          </div>
          {isEdit && !changePassword ? (
            <div className="machine-field">
              <span className="machine-label">{copy.password}</span>
              <button
                type="button"
                className="btn btn-ghost machine-inline-btn"
                onClick={() => setChangePassword(true)}
              >
                {copy.changePassword}
              </button>
            </div>
          ) : (
            <label className="machine-field">
              <span className="machine-label">{copy.password}</span>
              <span className="machine-secret-wrap">
                <input
                  ref={passwordRef}
                  className="machine-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isEdit ? "new-password" : "current-password"}
                  value={form.password}
                  onChange={(event) => patch({ password: event.target.value })}
                />
                <button
                  type="button"
                  className="machine-secret-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </span>
            </label>
          )}
          <button
            type="button"
            className="btn btn-secondary machine-test-btn"
            disabled={busy}
            onClick={() =>
              onLogin({
                customerId: customerOptions.length > 0
                  ? ""
                  : (customerIdRef.current?.value ?? form.customerId),
                loginId: loginIdRef.current?.value ?? form.loginId,
                password: passwordRef.current?.value ?? form.password,
              })
            }
          >
            {copy.testLogin}
          </button>
          {customerOptions.length > 0 ? (
            <div className="machine-field machine-customer-pick">
              <span className="machine-label">{copy.selectCustomers}</span>
              <div className="machine-customer-list">
                {customerOptions.map((customer) => {
                  const checked = selectedCustomerIds.includes(customer.id);
                  return (
                    <label key={customer.id} className={`machine-customer-option ${checked ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCustomer(customer.id)}
                      />
                      <span className="machine-customer-copy">
                        <strong>{customer.name || customer.id}</strong>
                        {customer.name && customer.name !== customer.id ? (
                          <small>{customer.id}</small>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          {flash ? (
            <div className={`machine-feedback is-${flash.kind}`} role="status">
              <p className="machine-feedback-title">
                {flash.kind === "ok" ? <FiCheck size={16} /> : null}
                {flash.title ?? flash.text}
              </p>
              {flash.title ? <p className="machine-feedback-body">{flash.text}</p> : null}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="machine-sheet-foot">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          {copy.cancel}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={busy || (customerOptions.length > 0 && selectedCustomerIds.length === 0)}
        >
          {isEdit ? copy.saveChanges : copy.save}
        </button>
      </footer>
    </OverlayFrame>
  );
}
