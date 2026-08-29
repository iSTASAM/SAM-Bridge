import { getLineChannelAccessToken as getStoredChannelAccessToken } from "@/lib/line-webhook-settings";

/**
 * LINE Messaging API helpers (per-user rich menu).
 * Logged-out users keep the OA default rich menu (login).
 * After iXacs login we link the logged-in rich menu; logout unlinks it.
 */

const LOGGED_IN_RICH_MENU_ID =
  process.env.LINE_RICHMENU_LOGGED_IN?.trim() || "richmenu-ab29249ac133a6fa9f2b9393f9a82d95";
const LOGGED_OUT_RICH_MENU_ID = process.env.LINE_RICHMENU_LOGGED_OUT?.trim() || "";

function strip(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

/** Messaging API channel id (not LINE Login id). Optional if a long-lived access token is set. */
function messagingChannelId() {
  return strip(process.env.LINE_MESSAGING_CHANNEL_ID) || strip(process.env.LINE_CHANNEL_ID);
}

function messagingChannelSecret() {
  return strip(process.env.LINE_CHANNEL_SECRET);
}

let issuedToken: { value: string; expiresAt: number } | null = null;

async function issueChannelAccessToken(): Promise<string | null> {
  const clientId = messagingChannelId();
  const clientSecret = messagingChannelSecret();
  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://api.line.me/v2/oauth/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !data.access_token) {
    console.warn("LINE channel access token issue failed:", response.status, data);
    return null;
  }
  const ttlMs = Math.max(60_000, ((data.expires_in ?? 2_592_000) - 60) * 1000);
  issuedToken = { value: data.access_token, expiresAt: Date.now() + ttlMs };
  return data.access_token;
}

export async function getLineChannelAccessToken(): Promise<string | null> {
  // Prefer value from /settings/notifications/line-webhook (Supabase), then env, then issued token.
  try {
    const stored = await getStoredChannelAccessToken();
    if (stored) return stored;
  } catch (error) {
    console.warn("LINE channel access token load failed:", error);
  }
  if (issuedToken && issuedToken.expiresAt > Date.now()) return issuedToken.value;
  try {
    return await issueChannelAccessToken();
  } catch (error) {
    console.warn("LINE channel access token issue error:", error);
    return null;
  }
}

export function lineLoggedInRichMenuId() {
  return LOGGED_IN_RICH_MENU_ID;
}

export function lineLoggedOutRichMenuId() {
  return LOGGED_OUT_RICH_MENU_ID;
}

function isRealLineUserId(userId: string) {
  // Web preview uses synthetic ids like "web-preview:…".
  return Boolean(userId) && !userId.startsWith("web-preview:");
}

async function lineBotFetch(token: string, url: string, method: "POST" | "DELETE") {
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

export async function linkLoggedInRichMenu(lineUserId: string) {
  if (!isRealLineUserId(lineUserId)) return { ok: false as const, skipped: true as const };
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("linkLoggedInRichMenu: no LINE channel access token configured");
    return { ok: false as const, error: "NO_CHANNEL_ACCESS_TOKEN" as const };
  }
  const richMenuId = lineLoggedInRichMenuId();
  const response = await lineBotFetch(
    token,
    `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    "POST",
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("linkLoggedInRichMenu failed:", response.status, body.slice(0, 500));
    return { ok: false as const, error: "LINK_FAILED" as const, status: response.status };
  }
  return { ok: true as const, richMenuId };
}

/** Remove per-user rich menu so the OA default (login) menu shows again. */
export async function unlinkUserRichMenu(lineUserId: string) {
  if (!isRealLineUserId(lineUserId)) return { ok: false as const, skipped: true as const };
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("unlinkUserRichMenu: no LINE channel access token configured");
    return { ok: false as const, error: "NO_CHANNEL_ACCESS_TOKEN" as const };
  }
  const response = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  // 404 = already unlinked — treat as success.
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    console.warn("unlinkUserRichMenu failed:", response.status, body.slice(0, 500));
    return { ok: false as const, error: "UNLINK_FAILED" as const, status: response.status };
  }

  // Restore the OA default (login) menu when configured — needed if Rich Menu 2
  // was created with selected:true and became the channel default.
  const loggedOutId = lineLoggedOutRichMenuId();
  if (loggedOutId) {
    const restore = await lineBotFetch(
      token,
      `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(loggedOutId)}`,
      "POST",
    );
    if (!restore.ok && restore.status !== 404) {
      const body = await restore.text().catch(() => "");
      console.warn("restore logged-out rich menu failed:", restore.status, body.slice(0, 500));
    }
  }

  return { ok: true as const };
}

export type LineUserProfile = {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
};

/** Requires the user to be a friend of the LINE OA. */
export async function getLineUserProfile(lineUserId: string): Promise<LineUserProfile | null> {
  if (!isRealLineUserId(lineUserId)) return null;
  const token = await getLineChannelAccessToken();
  if (!token) return null;
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn("getLineUserProfile failed:", response.status, body.slice(0, 300));
      return null;
    }
    const data = (await response.json()) as {
      userId?: string;
      displayName?: string;
      pictureUrl?: string;
      statusMessage?: string;
    };
    if (!data.displayName) return null;
    return {
      userId: data.userId || lineUserId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl?.trim() || null,
      statusMessage: data.statusMessage?.trim() || null,
    };
  } catch (error) {
    console.warn("getLineUserProfile error:", error);
    return null;
  }
}

