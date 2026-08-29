import { getLineChannelAccessToken as getStoredChannelAccessToken } from "@/lib/line-webhook-settings";

/**
 * LINE Messaging API helpers (per-user rich menu).
 * Logged-out users keep the OA default rich menu (login).
 * After iXacs login we link the logged-in rich menu; logout unlinks it.
 */

const LOGGED_IN_RICH_MENU_ID =
  process.env.LINE_RICHMENU_LOGGED_IN?.trim() || "richmenu-ab29249ac133a6fa9f2b9393f9a82d95";
const LOGGED_OUT_RICH_MENU_ID = process.env.LINE_RICHMENU_LOGGED_OUT?.trim() || "";

export async function getLineChannelAccessToken(): Promise<string | null> {
  // Messaging API token only — never issue from LINE Login channel id.
  try {
    const stored = await getStoredChannelAccessToken();
    if (stored) return stored;
  } catch (error) {
    console.warn("LINE channel access token load failed:", error);
  }
  return null;
}

export function lineLoggedInRichMenuId() {
  return LOGGED_IN_RICH_MENU_ID;
}

export function lineLoggedOutRichMenuId() {
  return LOGGED_OUT_RICH_MENU_ID;
}

export function isLineMessagingUserId(userId: string) {
  return /^U[0-9a-f]{32}$/i.test(userId.trim());
}

function isRealLineUserId(userId: string) {
  return Boolean(userId) && !userId.startsWith("web-preview:");
}

async function lineBotFetch(token: string, url: string, method: "GET" | "POST" | "DELETE", body?: string) {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

export async function getLinkedRichMenuId(lineUserId: string): Promise<string | null> {
  if (!isRealLineUserId(lineUserId)) return null;
  const token = await getLineChannelAccessToken();
  if (!token) return null;
  const response = await lineBotFetch(
    token,
    `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu`,
    "GET",
  );
  if (!response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as { richMenuId?: string };
  return data.richMenuId?.trim() || null;
}

export async function linkLoggedInRichMenu(lineUserId: string) {
  if (!isRealLineUserId(lineUserId)) return { ok: false as const, skipped: true as const };
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("linkLoggedInRichMenu: no Messaging API channel access token in /settings/notifications/line-webhook");
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
    console.warn("linkLoggedInRichMenu failed:", response.status, body.slice(0, 500), {
      lineUserId: `${lineUserId.slice(0, 8)}…`,
      richMenuId,
    });
    return { ok: false as const, error: "LINK_FAILED" as const, status: response.status };
  }
  const linked = await getLinkedRichMenuId(lineUserId);
  console.log("linkLoggedInRichMenu ok", { richMenuId, linked });
  return { ok: true as const, richMenuId, linked };
}

export async function replyLineMessages(
  replyToken: string,
  messages: Array<Record<string, unknown>>,
) {
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("replyLineMessages: no Messaging API channel access token");
    return { ok: false as const, error: "NO_CHANNEL_ACCESS_TOKEN" as const };
  }
  const response = await lineBotFetch(
    token,
    "https://api.line.me/v2/bot/message/reply",
    "POST",
    JSON.stringify({ replyToken, messages }),
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("replyLineMessages failed:", response.status, body.slice(0, 500));
    return { ok: false as const, error: "REPLY_FAILED" as const, status: response.status };
  }
  return { ok: true as const };
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

