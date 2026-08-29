"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";
import type { LoginCopy } from "./login-copy";

export function LoginForm({ copy, admin = false }: { copy: LoginCopy; admin?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usernameId = useId();
  const customerId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [username, setUsername] = useState("");
  const [customer, setCustomer] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(admin ? "/api/admin/login" : "/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(admin ? { username, password } : { customerId: customer, loginId: username, password }),
      });

      if (!response.ok) {
        setError(response.status === 401 ? copy.failed : copy.unreachable);
        setPending(false);
        return;
      }

      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");
      router.refresh();
    } catch {
      setError(copy.unreachable);
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="login-form"
      aria-busy={pending}
      aria-describedby={error ? errorId : undefined}
    >
      <h1 className="login-form-title">{copy.signIn}</h1>

      {!admin ? (
        <div className="login-field">
          <label htmlFor={customerId}>{copy.customerId}</label>
          <input
            id={customerId}
            className="login-input"
            name="customerId"
            autoComplete="organization"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
          />
        </div>
      ) : null}

      <div className="login-field">
        <label htmlFor={usernameId}>{admin ? copy.user : copy.loginId}</label>
        <input
          id={usernameId}
          className="login-input"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="login-password-toggle"
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            aria-pressed={showPassword}
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

      <button type="submit" className="btn btn-primary login-submit" disabled={pending}>
        {pending ? (
          <>
            <span className="login-spinner" aria-hidden />
            {copy.submitting}
          </>
        ) : (
          copy.submit
        )}
      </button>
    </form>
  );
}
