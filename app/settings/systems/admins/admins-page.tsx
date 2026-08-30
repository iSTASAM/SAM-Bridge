"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FiEdit2, FiEye, FiEyeOff, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { OverlayFrame } from "../../connections/overlay-frame";
import { useLocale } from "../../../locale-context";
import { SYSTEMS_COPY } from "../copy";
import { formatWhen } from "../shared";
import { SystemsPageShell } from "../systems-channel-nav";

type AdminRow = {
  id: string;
  username: string;
  source: "env" | "app";
  createdAt: string | null;
};

type Drawer = { mode: "add" } | { mode: "edit"; account: AdminRow } | null;

type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

type PasswordChecks = {
  length: boolean;
  long: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
};

function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= 8,
    long: value.length >= 12,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

function passwordStrength(value: string): { score: number; level: StrengthLevel; checks: PasswordChecks } {
  const checks = passwordChecks(value);
  if (!value) return { score: 0, level: "empty", checks };
  const variety = [checks.upper, checks.lower, checks.number, checks.symbol].filter(Boolean).length;
  // Full green only when long enough and all character types are present.
  if (checks.long && variety === 4) return { score: 4, level: "strong", checks };
  if (checks.length && variety === 4) return { score: 3, level: "good", checks };
  if (checks.length && variety >= 2) return { score: 2, level: "fair", checks };
  return { score: 1, level: "weak", checks };
}

export function AdminsPage() {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const titleId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [accounts, setAccounts] = useState<AdminRow[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, session] = await Promise.all([
        fetch("/api/admin/accounts", { cache: "no-store" }),
        fetch("/api/session", { cache: "no-store" }),
      ]);
      const data = (await list.json()) as { accounts?: AdminRow[]; error?: string };
      const current = (await session.json().catch(() => null)) as { username?: string } | null;
      if (!list.ok) throw new Error(data.error);
      setAccounts(data.accounts ?? []);
      setMe(current?.username ?? "");
      setError(null);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setFormError(null);
    setDrawer({ mode: "add" });
  }

  function openEdit(account: AdminRow) {
    setUsername(account.username);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setFormError(null);
    setDrawer({ mode: "edit", account });
  }

  function messageFor(code: string | undefined) {
    if (code === "ADMIN_USERNAME_TAKEN") return copy.usernameTaken;
    if (code === "ADMIN_PASSWORD_SHORT") return copy.passwordShort;
    if (code === "ADMIN_SELF_DELETE") return copy.cannotDeleteSelf;
    if (code === "ADMIN_ENV_LOCKED") return copy.cannotDeleteEnv;
    return copy.saveError;
  }

  async function save() {
    if (!drawer) return;
    if (password !== confirmPassword) {
      setFormError(copy.passwordMismatch);
      return;
    }
    const ready = passwordChecks(password);
    const complete =
      ready.length && ready.upper && ready.lower && ready.number && ready.symbol;
    if (drawer.mode === "add" && !complete) {
      setFormError(copy.passwordShort);
      return;
    }
    if (drawer.mode === "edit" && password && !complete) {
      setFormError(copy.passwordShort);
      return;
    }
    setSaving(true);
    setFormError(null);
    const response = await fetch(drawer.mode === "add" ? "/api/admin/accounts" : `/api/admin/accounts/${drawer.account.id}`, {
      method: drawer.mode === "add" ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setFormError(messageFor(data.error));
      return;
    }
    setDrawer(null);
    await load();
  }

  const strength = passwordStrength(password);
  const { checks } = strength;
  const passwordMismatch = Boolean(drawer) && confirmPassword.length > 0 && password !== confirmPassword;
  const passwordMatched = Boolean(drawer) && confirmPassword.length > 0 && password.length > 0 && password === confirmPassword;
  const strengthLabel =
    strength.level === "weak"
      ? copy.strengthWeak
      : strength.level === "fair"
        ? copy.strengthFair
        : strength.level === "good"
          ? copy.strengthGood
          : strength.level === "strong"
            ? copy.strengthStrong
            : "";
  const passwordReady =
    checks.length && checks.upper && checks.lower && checks.number && checks.symbol;
  const canSave =
    Boolean(username.trim()) &&
    !passwordMismatch &&
    (drawer?.mode === "edit" ? password.length === 0 || passwordReady : passwordReady);

  async function remove(account: AdminRow) {
    if (account.source === "env") return;
    if (me && account.username.toLowerCase() === me.toLowerCase()) {
      setError(copy.cannotDeleteSelf);
      return;
    }
    const response = await fetch(`/api/admin/accounts/${account.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(messageFor(data.error));
      return;
    }
    await load();
  }

  return (
    <SystemsPageShell
      copy={copy}
      title={copy.menuAdmins}
      loading={loading}
      onRefresh={() => void load()}
      backHref="/settings/systems"
      extraActions={
        <button type="button" className="btn btn-primary console-icon-btn" aria-label={copy.addAdmin} onClick={openAdd}>
          <FiPlus size={16} />
        </button>
      }
    >
      {error ? <p className="inline-error">{error}</p> : null}

      {loading ? (
        <div className="as-console-table-wrap" aria-busy="true">
          <div className="as-console-loading">
            {[0, 1, 2].map((row) => (
              <span key={row} className="skeleton" />
            ))}
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <section className="as-empty">{copy.emptyAdmins}</section>
      ) : (
        <div className="as-console-table-wrap">
          <table className="as-console-table">
            <thead>
              <tr>
                <th>{copy.colUsername}</th>
                <th>{copy.colCreated}</th>
                <th className="as-console-actions">{copy.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isMe = Boolean(me) && account.username.toLowerCase() === me.toLowerCase();
                const locked = account.source === "env" || isMe;
                return (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.username}</strong>
                    </td>
                    <td>
                      <time dateTime={account.createdAt ?? undefined}>
                        {formatWhen(account.createdAt, locale, copy.never)}
                      </time>
                    </td>
                    <td className="as-console-actions">
                      <span className="as-row-action">
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={copy.edit}
                          disabled={account.source === "env"}
                          onClick={() => openEdit(account)}
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={copy.remove}
                          disabled={locked}
                          onClick={() => void remove(account)}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OverlayFrame
        open={Boolean(drawer)}
        labelledBy={titleId}
        onClose={() => setDrawer(null)}
        closeOnBackdrop={false}
        className="modal as-admin-modal"
        backdropClassName="modal-backdrop"
      >
        <div className="as-admin-modal-head">
          <h2 id={titleId}>{drawer?.mode === "edit" ? copy.editAdmin : copy.addAdmin}</h2>
          <button type="button" className="btn-icon" aria-label={copy.close} onClick={() => setDrawer(null)}>
            <FiX size={18} />
          </button>
        </div>
        <label className="modal-field" htmlFor={usernameId}>
          <span>{copy.colUsername}</span>
          <input
            id={usernameId}
            className="machine-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={copy.usernamePlaceholder}
            autoComplete="off"
            data-dialog-initial-focus
          />
        </label>
        <label className="modal-field" htmlFor={passwordId}>
          <span>{drawer?.mode === "edit" ? copy.newPassword : copy.password}</span>
          <span className="as-admin-password">
            <input
              id={passwordId}
              className="machine-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFormError(null);
              }}
              autoComplete="new-password"
              placeholder={drawer?.mode === "edit" ? copy.passwordHint : undefined}
            />
            <button
              type="button"
              className="btn-icon"
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </span>
          {password ? (
            <div
              className="as-password-strength"
              data-level={strength.level}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={strength.score}
              aria-label={strengthLabel}
            >
              <span
                className="as-password-strength-fill"
                style={{ width: `${(strength.score / 4) * 100}%` }}
              />
            </div>
          ) : null}
        </label>
        <label className="modal-field" htmlFor={confirmId}>
          <span>{copy.confirmPassword}</span>
          <span className="as-admin-password">
            <input
              id={confirmId}
              className="machine-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFormError(null);
              }}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-icon"
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </span>
          {confirmPassword ? (
            <p
              className={`as-password-match${passwordMatched ? " is-ok" : " is-bad"}`}
              aria-live="polite"
            >
              {passwordMatched ? copy.passwordMatch : copy.passwordMismatch}
            </p>
          ) : null}
        </label>
        {formError ? <p className="inline-error">{formError}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDrawer(null)}>
            {copy.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !username.trim() || !canSave}
            onClick={() => void save()}
          >
            {copy.save}
          </button>
        </div>
      </OverlayFrame>
    </SystemsPageShell>
  );
}
