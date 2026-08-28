"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronRight } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { SAP_COPY } from "./copy";
import type { PublicSapConnection } from "./types";

type TestView =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success"; httpStatus: number | null; responseTimeMs: number }
  | { kind: "failure"; httpStatus: number | null };

function maskKey(last4: string) {
  return last4 ? `••••••••••••${last4}` : "";
}

function lastTestedLabel(
  iso: string | null,
  justNow: string,
  locale: "th" | "en" | "ja",
  now: number,
) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.valueOf())) return iso;
  if (now - date.valueOf() < 45_000) return justNow;
  return date.toLocaleString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SapDestinationPanel({
  connection,
  onConnected,
  onDisconnected,
}: {
  connection: PublicSapConnection | null;
  onConnected: (connection: PublicSapConnection) => void;
  onDisconnected: () => void;
}) {
  const { locale } = useLocale();
  const copy = SAP_COPY[locale];
  const [editing, setEditing] = useState(!connection?.connected);
  const [name, setName] = useState(connection?.name || copy.namePlaceholder);
  const [environment] = useState<"sandbox">("sandbox");
  const [api] = useState<"production-order">("production-order");
  const [serviceUrl, setServiceUrl] = useState(connection?.serviceUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [replacingKey, setReplacingKey] = useState(!connection?.keyLast4);
  const [openMenu, setOpenMenu] = useState<"environment" | "api" | null>(null);
  const [test, setTest] = useState<TestView>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!connection) {
      setEditing(true);
      setReplacingKey(true);
      return;
    }
    setName(connection.name);
    setServiceUrl(connection.serviceUrl);
    setApiKey("");
    setReplacingKey(false);
    if (connection.connected) setEditing(false);
  }, [connection?.id, connection?.connected, connection?.name, connection?.serviceUrl, connection?.keyLast4]);

  const canTest = useMemo(() => {
    if (!serviceUrl.trim()) return false;
    if (replacingKey || !connection?.keyLast4) return Boolean(apiKey.trim());
    return true;
  }, [apiKey, connection?.keyLast4, replacingKey, serviceUrl]);

  async function runTest() {
    if (!canTest || busy) return;
    setBusy(true);
    setTest({ kind: "testing" });
    const payload = {
      name: name.trim() || copy.namePlaceholder,
      environment,
      api,
      serviceUrl: serviceUrl.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    };
    const path = connection?.id ? `/api/exports/sap/${connection.id}` : "/api/exports/sap";
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      httpStatus?: number | null;
      responseTimeMs?: number;
      connection?: PublicSapConnection;
      error?: string;
    };
    setBusy(false);
    if (data.ok && data.connection) {
      setApiKey("");
      setReplacingKey(false);
      setEditing(false);
      setTest({
        kind: "success",
        httpStatus: data.httpStatus ?? 200,
        responseTimeMs: data.responseTimeMs ?? 0,
      });
      onConnected(data.connection);
      return;
    }
    setTest({ kind: "failure", httpStatus: data.httpStatus ?? null });
    if (data.connection) onConnected({ ...data.connection, connected: false });
  }

  async function disconnect() {
    if (!connection?.id || busy) return;
    setBusy(true);
    await fetch(`/api/exports/sap/${connection.id}`, { method: "DELETE" });
    setBusy(false);
    setApiKey("");
    setReplacingKey(true);
    setEditing(true);
    setTest({ kind: "idle" });
    onDisconnected();
  }

  if (!editing && connection?.connected) {
    return (
      <div className="ew-sap">
        <div className="ew-sap-connected-head">
          <div>
            <h3>{connection.name}</h3>
            <p>{copy.productionOrderApi}</p>
          </div>
          <span className="ew-sap-status is-on">
            <i />
            {copy.connected}
          </span>
        </div>
        <dl className="ew-sap-meta">
          <div>
            <dt>{copy.testOperation}</dt>
            <dd>
              <code>{copy.operation}</code>
            </dd>
          </div>
          <div>
            <dt>{copy.lastTested}</dt>
            <dd>{lastTestedLabel(connection.lastTestedAt, copy.justNow, locale, now)}</dd>
          </div>
        </dl>
        {test.kind === "testing" ? <p className="ew-sap-result is-testing">{copy.testing}</p> : null}
        {test.kind === "success" ? (
          <div className="ew-sap-result is-ok">
            <strong>✓ {copy.connectedTo}</strong>
            <span>HTTP {test.httpStatus ?? 200}</span>
            <span>{copy.productionOrderApi}</span>
            <span>Response time: {test.responseTimeMs} ms</span>
          </div>
        ) : null}
        {test.kind === "failure" ? (
          <div className="ew-sap-result is-bad">
            <strong>{copy.failed}</strong>
            {test.httpStatus ? <span>HTTP {test.httpStatus}</span> : null}
            <small>{copy.failedHint}</small>
          </div>
        ) : null}
        <div className="ew-sap-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void runTest()}>
            {test.kind === "testing" ? copy.testing : copy.testAgain}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setEditing(true);
              setTest({ kind: "idle" });
            }}
          >
            {copy.edit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ew-sap">
      <h3 className="ew-sap-heading">{copy.heading}</h3>
      <div className="ew-fields">
        <label className="ew-field">
          <span className="ew-label">{copy.connectionName}</span>
          <input
            className="machine-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.namePlaceholder}
            autoComplete="off"
          />
        </label>

        <SelectRow
          label={copy.environment}
          value={copy.sandbox}
          open={openMenu === "environment"}
          onToggle={() => setOpenMenu(openMenu === "environment" ? null : "environment")}
          options={[{ id: "sandbox", label: copy.sandbox }]}
          selected={environment}
          onSelect={() => setOpenMenu(null)}
        />

        <SelectRow
          label={copy.api}
          value={copy.productionOrder}
          open={openMenu === "api"}
          onToggle={() => setOpenMenu(openMenu === "api" ? null : "api")}
          options={[{ id: "production-order", label: copy.productionOrder }]}
          selected={api}
          onSelect={() => setOpenMenu(null)}
        />

        <label className="ew-field">
          <span className="ew-label">{copy.serviceUrl}</span>
          <input
            className="machine-input"
            value={serviceUrl}
            onChange={(event) => setServiceUrl(event.target.value)}
            placeholder={copy.serviceUrlPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <small className="machine-help">{copy.serviceUrlHelp}</small>
        </label>

        <div className="ew-field">
          <span className="ew-label">{copy.authentication}</span>
          <p className="ew-sap-auth">{copy.authType}</p>
        </div>

        <div className="ew-field">
          <span className="ew-label">{copy.apiKey}</span>
          {connection?.keyLast4 && !replacingKey ? (
            <div className="ew-sap-secret">
              <code>{maskKey(connection.keyLast4)}</code>
              <button type="button" className="ew-text-btn" onClick={() => setReplacingKey(true)}>
                {copy.replace}
              </button>
            </div>
          ) : (
            <input
              className="machine-input"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {test.kind === "testing" ? <p className="ew-sap-result is-testing">{copy.testing}</p> : null}
      {test.kind === "success" ? (
        <div className="ew-sap-result is-ok">
          <strong>✓ {copy.connectedTo}</strong>
          <span>HTTP {test.httpStatus ?? 200}</span>
          <span>{copy.productionOrderApi}</span>
          <span>Response time: {test.responseTimeMs} ms</span>
        </div>
      ) : null}
      {test.kind === "failure" ? (
        <div className="ew-sap-result is-bad">
          <strong>{copy.failed}</strong>
          {test.httpStatus ? <span>HTTP {test.httpStatus}</span> : null}
          <small>{copy.failedHint}</small>
        </div>
      ) : null}

      <div className="ew-sap-actions">
        <button type="button" className="btn btn-primary" disabled={!canTest || busy} onClick={() => void runTest()}>
          {test.kind === "testing" ? copy.testing : copy.test}
        </button>
        {connection?.id ? (
          <button type="button" className="ew-text-btn" disabled={busy} onClick={() => void disconnect()}>
            {copy.disconnect}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  open,
  options,
  selected,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  open: boolean;
  options: { id: string; label: string }[];
  selected: string;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ew-field">
      <span className="ew-label">{label}</span>
      <button type="button" className="ew-select-row is-compact" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{value}</strong>
        </span>
        <FiChevronRight size={16} className={open ? "is-open" : ""} />
      </button>
      {open ? (
        <ul className="ew-picker-list">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={option.id === selected ? "is-selected" : ""}
                onClick={() => onSelect(option.id)}
              >
                <span>
                  <strong>{option.label}</strong>
                </span>
                {option.id === selected ? <FiCheck size={15} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
