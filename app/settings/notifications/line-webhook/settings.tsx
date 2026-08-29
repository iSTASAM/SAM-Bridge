"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiCheck, FiCopy, FiSave } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import { LINE_WEBHOOK_COPY } from "./copy";

type Settings = {
  configured: boolean;
  publicUrl: string;
  callbackUrl: string;
  channelSecretConfigured: boolean;
  channelAccessTokenConfigured: boolean;
  liffId: string;
  lineLoginChannelId: string;
  updatedAt: string | null;
  storage?: "env" | "supabase" | "file" | "mixed";
  supabaseConfigured?: boolean;
};

function mapSaveError(
  error: string | undefined,
  copy: (typeof LINE_WEBHOOK_COPY)[keyof typeof LINE_WEBHOOK_COPY],
) {
  switch (error) {
    case "PUBLIC_HTTPS_URL_REQUIRED":
      return copy.errPublicUrl;
    case "CHANNEL_SECRET_REQUIRED":
      return copy.errSecret;
    case "CHANNEL_ACCESS_TOKEN_REQUIRED":
      return copy.errAccessToken;
    case "LIFF_ID_REQUIRED":
    case "INVALID_LIFF_ID":
      return copy.errLiff;
    case "LINE_LOGIN_CHANNEL_ID_REQUIRED":
    case "INVALID_LINE_LOGIN_CHANNEL_ID":
      return copy.errLoginChannel;
    case "SUPABASE_NOT_CONFIGURED":
      return copy.errSupabase;
    case "CONNECTIONS_ENCRYPTION_KEY_MISSING":
      return copy.errEncrypt;
    default:
      return error || copy.errSave;
  }
}

export function LineWebhookSettings() {
  const { locale } = useLocale();
  const copy = LINE_WEBHOOK_COPY[locale];
  const [settings, setSettings] = useState<Settings | null>(null);
  const [publicUrl, setPublicUrl] = useState("https://sam-bridge.vercel.app");
  const [channelSecret, setChannelSecret] = useState("");
  const [channelAccessToken, setChannelAccessToken] = useState("");
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
    setPublicUrl(data.publicUrl || "https://sam-bridge.vercel.app");
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
        body: JSON.stringify({ publicUrl, channelSecret, channelAccessToken, liffId, lineLoginChannelId }),
      });
      const data = (await response.json().catch(() => ({}))) as Settings & { error?: string };
      if (!response.ok) {
        setMessage(mapSaveError(data.error, copy));
        return;
      }
      setSettings(data);
      setPublicUrl(data.publicUrl);
      setLiffId(data.liffId);
      setLineLoginChannelId(data.lineLoginChannelId);
      setChannelSecret("");
      setChannelAccessToken("");
      setMessage(copy.saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="console-page lw-page">
      <header className="lw-head">
        <div>
          <Link href="/settings/notifications" className="notify-back">
            <FiArrowLeft size={15} aria-hidden />
            {copy.backToList}
          </Link>
          <h1 className="console-title">{copy.title}</h1>
        </div>
      </header>

      {loading ? (
        <div className="lw-panel" aria-busy="true">
          <span className="skeleton lw-skel" />
          <span className="skeleton lw-skel" />
          <span className="skeleton lw-skel is-wide" />
        </div>
      ) : (
        <div className="lw-panel">
          {!settings?.supabaseConfigured ? (
            <p className="lw-message" role="alert">
              {copy.needSupabase}
            </p>
          ) : null}

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
            <span className="machine-label">{copy.channelAccessToken}</span>
            <input
              className="machine-input"
              type="password"
              autoComplete="off"
              placeholder={
                settings?.channelAccessTokenConfigured
                  ? "••••••••••••••••"
                  : copy.channelAccessTokenPlaceholder
              }
              value={channelAccessToken}
              onChange={(event) => setChannelAccessToken(event.target.value)}
            />
          </label>

          <label className="machine-field">
            <span className="machine-label">{copy.liffId}</span>
            <input
              className="machine-input"
              autoComplete="off"
              placeholder={copy.liffIdPlaceholder}
              value={liffId}
              onChange={(event) => setLiffId(event.target.value)}
            />
          </label>

          <label className="machine-field">
            <span className="machine-label">{copy.loginChannelId}</span>
            <input
              className="machine-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder={copy.loginChannelIdPlaceholder}
              value={lineLoginChannelId}
              onChange={(event) => setLineLoginChannelId(event.target.value)}
            />
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
              disabled={busy || settings?.supabaseConfigured === false}
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
