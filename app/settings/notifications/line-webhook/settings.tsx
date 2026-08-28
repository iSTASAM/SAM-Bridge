"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiCheck, FiCopy, FiExternalLink, FiSave } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import { LINE_WEBHOOK_COPY } from "./copy";

type Settings = {
  configured: boolean;
  publicUrl: string;
  callbackUrl: string;
  channelSecretConfigured: boolean;
  liffId: string;
  lineLoginChannelId: string;
  updatedAt: string | null;
};

export function LineWebhookSettings() {
  const { locale } = useLocale();
  const copy = LINE_WEBHOOK_COPY[locale];
  const [settings, setSettings] = useState<Settings | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [liffId, setLiffId] = useState("");
  const [lineLoginChannelId, setLineLoginChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/line/webhook-settings", { cache: "no-store" });
    const data = (await response.json()) as Settings;
    setSettings(data);
    setPublicUrl(data.publicUrl);
    setLiffId(data.liffId);
    setLineLoginChannelId(data.lineLoginChannelId);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const callbackUrl = publicUrl.trim().replace(/\/+$/, "")
    ? `${publicUrl.trim().replace(/\/+$/, "")}/api/line/webhook`
    : "";

  async function copyCallback() {
    if (!callbackUrl) return;
    await navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setMessage(copy.copied);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/line/webhook-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicUrl, channelSecret, liffId, lineLoginChannelId }),
      });
      const data = (await response.json().catch(() => ({}))) as Settings & { error?: string };
      if (!response.ok) {
        setMessage(
          data.error === "PUBLIC_HTTPS_URL_REQUIRED"
            ? copy.errPublicUrl
            : data.error === "CHANNEL_SECRET_REQUIRED"
              ? copy.errSecret
              : data.error || copy.errSave,
        );
        return;
      }
      setSettings(data);
      setPublicUrl(data.publicUrl);
      setLiffId(data.liffId);
      setLineLoginChannelId(data.lineLoginChannelId);
      setChannelSecret("");
      setMessage(copy.saved);
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(settings?.configured && settings.channelSecretConfigured);

  return (
    <div className="console-page lw-page">
      <header className="lw-head">
        <div>
          <Link href="/settings/notifications" className="notify-back">
            <FiArrowLeft size={15} aria-hidden />
            {copy.backToList}
          </Link>
          <div className="lw-title-row">
            <h1 className="console-title">{copy.title}</h1>
            {!loading ? (
              <span className={`lw-badge ${ready ? "is-ready" : ""}`}>
                {ready ? copy.statusReady : copy.statusEmpty}
              </span>
            ) : null}
          </div>
        </div>
        <a
          className="btn btn-secondary"
          href="https://developers.line.biz/console/"
          target="_blank"
          rel="noreferrer"
        >
          <FiExternalLink size={15} />
          {copy.openConsole}
        </a>
      </header>

      {loading ? (
        <div className="lw-panel" aria-busy="true">
          <span className="skeleton lw-skel" />
          <span className="skeleton lw-skel" />
          <span className="skeleton lw-skel is-wide" />
        </div>
      ) : (
        <div className="lw-panel">
          <label className="machine-field">
            <span className="machine-label">{copy.publicUrl}</span>
            <input
              className="machine-input"
              type="url"
              placeholder={copy.publicUrlPlaceholder}
              value={publicUrl}
              onChange={(event) => setPublicUrl(event.target.value)}
            />
          </label>

          <label className="machine-field">
            <span className="machine-label">{copy.channelSecret}</span>
            <input
              className="machine-input"
              type="password"
              autoComplete="off"
              placeholder={
                settings?.channelSecretConfigured ? "••••••••••••••••" : copy.channelSecretPlaceholder
              }
              value={channelSecret}
              onChange={(event) => setChannelSecret(event.target.value)}
            />
          </label>

          <label className="machine-field">
            <span className="machine-label">LIFF ID</span>
            <input className="machine-input" autoComplete="off" placeholder="1234567890-AbCdEfGh" value={liffId} onChange={(event) => setLiffId(event.target.value)} />
          </label>

          <label className="machine-field">
            <span className="machine-label">LINE Login Channel ID</span>
            <input className="machine-input" inputMode="numeric" autoComplete="off" placeholder="1234567890" value={lineLoginChannelId} onChange={(event) => setLineLoginChannelId(event.target.value)} />
          </label>

          <div className="lw-callback">
            <span className="lw-callback-label">{copy.callbackUrl}</span>
            <code className="lw-callback-url">{callbackUrl || copy.callbackEmpty}</code>
            <button
              type="button"
              className="btn-icon"
              disabled={!callbackUrl}
              onClick={() => void copyCallback()}
              aria-label={copied ? copy.copied : copy.copy}
              title={copied ? copy.copied : copy.copy}
            >
              {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
            </button>
          </div>

          {message ? (
            <p className="lw-message" aria-live="polite">
              {message}
            </p>
          ) : null}

          <div className="lw-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void save()}
            >
              <FiSave size={15} />
              {busy ? copy.saving : copy.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
