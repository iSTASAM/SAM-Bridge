import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type LineWebhookSettings = {
  publicUrl: string;
  channelSecret: string;
  liffId: string;
  lineLoginChannelId: string;
  updatedAt: string;
};

const FILE = path.join(process.cwd(), "data", "line-webhook-settings.json");

export function getLineWebhookSettings(): LineWebhookSettings | null {
  if (!existsSync(FILE)) return null;
  try {
    const value = JSON.parse(readFileSync(FILE, "utf8")) as Partial<LineWebhookSettings>;
    if (!value.publicUrl) return null;
    return {
      publicUrl: value.publicUrl,
      channelSecret: value.channelSecret ?? "",
      liffId: value.liffId ?? "",
      lineLoginChannelId: value.lineLoginChannelId ?? "",
      updatedAt: value.updatedAt ?? "",
    };
  } catch {
    return null;
  }
}

export function normalizePublicUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PUBLIC_HTTPS_URL_REQUIRED");
  }
  return url.origin;
}

export function saveLineWebhookSettings(publicUrl: string, channelSecret: string, liffId = "", lineLoginChannelId = "") {
  const current = getLineWebhookSettings();
  const secret = channelSecret.trim() || current?.channelSecret || "";
  if (!secret) throw new Error("CHANNEL_SECRET_REQUIRED");
  const nextLiffId = liffId.trim() || current?.liffId || "";
  const nextChannelId = lineLoginChannelId.trim() || current?.lineLoginChannelId || "";
  if (nextLiffId && !/^\d+-[A-Za-z0-9_-]+$/.test(nextLiffId)) throw new Error("INVALID_LIFF_ID");
  if (nextChannelId && !/^\d+$/.test(nextChannelId)) throw new Error("INVALID_LINE_LOGIN_CHANNEL_ID");
  const value: LineWebhookSettings = {
    publicUrl: normalizePublicUrl(publicUrl), channelSecret: secret,
    liffId: nextLiffId, lineLoginChannelId: nextChannelId, updatedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  return value;
}
