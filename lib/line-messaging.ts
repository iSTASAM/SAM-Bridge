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

  // LINE may return 200 even when the user ID belongs to another provider,
  // the user blocked the OA, or the user is not a friend. Verify the result
  // instead of treating the HTTP response alone as success.
  let linked: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    linked = await getLinkedRichMenuId(lineUserId);
    if (linked === richMenuId) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if (linked !== richMenuId) {
    console.warn("linkLoggedInRichMenu was not confirmed", {
      lineUserId: `${lineUserId.slice(0, 8)}…`,
      richMenuId,
      linked,
    });
    return {
      ok: false as const,
      error: "LINK_NOT_CONFIRMED" as const,
      richMenuId,
      linked,
    };
  }

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

export async function pushLineMessages(
  lineUserId: string,
  messages: Array<Record<string, unknown>>,
) {
  if (!isLineMessagingUserId(lineUserId)) {
    return { ok: false as const, error: "INVALID_LINE_USER_ID" as const };
  }
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("pushLineMessages: no Messaging API channel access token");
    return { ok: false as const, error: "NO_CHANNEL_ACCESS_TOKEN" as const };
  }
  const response = await lineBotFetch(
    token,
    "https://api.line.me/v2/bot/message/push",
    "POST",
    JSON.stringify({ to: lineUserId, messages }),
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("pushLineMessages failed:", response.status, body.slice(0, 500));
    return { ok: false as const, error: "PUSH_FAILED" as const, status: response.status };
  }
  return { ok: true as const };
}

/** LINE-native typing/loading animation for one-on-one OA chats. */
export async function startLineLoadingAnimation(lineUserId: string, loadingSeconds = 60) {
  if (!isLineMessagingUserId(lineUserId)) {
    return { ok: false as const, error: "INVALID_LINE_USER_ID" as const };
  }
  const allowed = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const duration = allowed.includes(loadingSeconds) ? loadingSeconds : 60;
  const token = await getLineChannelAccessToken();
  if (!token) {
    console.warn("startLineLoadingAnimation: no Messaging API channel access token");
    return { ok: false as const, error: "NO_CHANNEL_ACCESS_TOKEN" as const };
  }
  const response = await lineBotFetch(
    token,
    "https://api.line.me/v2/bot/chat/loading/start",
    "POST",
    JSON.stringify({ chatId: lineUserId, loadingSeconds: duration }),
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("startLineLoadingAnimation failed:", response.status, body.slice(0, 500));
    return { ok: false as const, error: "LOADING_ANIMATION_FAILED" as const, status: response.status };
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

