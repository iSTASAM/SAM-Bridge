"use client";

import { FormEvent, useId, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import type { LineLoginCopy } from "./line-login-copy";

type LineLoginFormProps = {
  copy: LineLoginCopy;
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (customerCompanyId: string, loginId: string, password: string) => void;
};

export function LineLoginForm({ copy, disabled, pending, error, onSubmit }: LineLoginFormProps) {
  const loginIdFieldId = useId();
  const companyId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [loginId, setLoginId] = useState("");
  const [customerCompanyId, setCustomerCompanyId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled || pending) return;
    onSubmit(customerCompanyId, loginId, password);
  }

  return (
    <form
      className="line-login-form login-form"
      onSubmit={handleSubmit}
      aria-busy={pending}
      aria-describedby={error ? errorId : undefined}
      noValidate
    >
      <div className="login-field">
        <label htmlFor={companyId}>{copy.customerCompanyId}</label>
        <input id={companyId} className="login-input" name="customerCompanyId" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" placeholder={copy.customerCompanyIdPlaceholder} value={customerCompanyId} onChange={(event) => setCustomerCompanyId(event.target.value)} disabled={disabled || pending} />
      </div>

      <div className="login-field">
        <label htmlFor={loginIdFieldId}>{copy.loginId}</label>
        <input
          id={loginIdFieldId}
          className="login-input"
          name="loginId"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          placeholder={copy.loginIdPlaceholder}
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          disabled={disabled || pending}
          required
        />
      </div>

      <div className="login-field">
        <label htmlFor={passwordId}>{copy.password}</label>
        <div className="login-password">
          <input
            id={passwordId}
            className="login-input"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="done"
            placeholder={copy.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disabled || pending}
            required
          />
          <button
            type="button"
            className="login-password-toggle"
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            aria-pressed={showPassword}
            disabled={disabled || pending}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <FiEyeOff size={16} aria-hidden /> : <FiEye size={16} aria-hidden />}
          </button>
        </div>
      </div>

      {error ? (
        <p className="login-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary login-submit" disabled={disabled || pending}>
        {pending ? (
          <>
            <span className="login-spinner" aria-hidden />
            {copy.submitting}
          </>
        ) : (
          copy.submit
        )}
      </button>

      <p className="line-login-help">{copy.help}</p>
    </form>
  );
}
