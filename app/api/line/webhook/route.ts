import { createHash, createHmac, timingSafeEqual } from "crypto";
import { after, NextResponse } from "next/server";
import { getConnection } from "@/lib/ixacs-connections";
import {
  appendLineAiHistory,
  claimLineAiEvent,
  clearLineAiHistory,
  finishLineAiEvent,
  getLineAiHistory,
  pruneLineAiData,
} from "@/lib/line-ai-store";
import { getLineWebhookSettings, getLineChannelSecret } from "@/lib/line-webhook-settings";
import { getLineLoginForAuthorization, lineLoginStatus } from "@/lib/line-logins";
import {
  isLineMessagingUserId,
  linkLoggedInRichMenu,
  pushLineMessages,
  replyLineMessages,
  startLineLoadingAnimation,
  unlinkUserRichMenu,
} from "@/lib/line-messaging";
import { markLineFriendship } from "@/lib/line-users";
import { ProductionAiError, runProductionAiChat } from "@/lib/production-ai-chat";
import { buildLineAiMessages } from "@/lib/line-ai-messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineEvent = {
  type?: string;
  webhookEventId?: string;
  timestamp?: number;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { id?: string; type?: string; text?: string };
};

const MAX_QUESTION_LENGTH = 2_000;

function normalizeSecret(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function signatureIsValid(body: Buffer, signature: string, secret: string) {
  const normalizedSecret = normalizeSecret(secret);
  const normalizedSignature = signature.trim();
  if (!normalizedSignature || !normalizedSecret) return false;
  const expected = createHmac("sha256", normalizedSecret).update(body).digest("base64");
  const actualBuffer = Buffer.from(normalizedSignature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function liffOpenUrl(liffId: string) {
  return `https://liff.line.me/${encodeURIComponent(liffId)}`;
}

function eventId(event: LineEvent, userId: string) {
  const source = event.webhookEventId || event.message?.id || event.replyToken || `${event.timestamp ?? 0}:${userId}`;
  return createHash("sha256").update(source).digest("hex");
}

async function syncRichMenu(userId: string) {
  const status = await lineLoginStatus(userId);
  if (status === "in") {
    await linkLoggedInRichMenu(userId);
    return "in" as const;
  }
  if (status === "out") {
    await unlinkUserRichMenu(userId);
    return "out" as const;
  }
  return "unknown" as const;
}

function textMessage(text: string) {
  return { type: "text", text };
}

async function replyText(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  await replyLineMessages(replyToken, [textMessage(text)]);
}

function loginMessage(liffId: string) {
  return {
    type: "template",
    altText: "เข้าสู่ระบบ SAM Bridge",
    template: {
      type: "buttons",
      text: "กรุณาเข้าสู่ระบบก่อนใช้งาน SAM AI",
      actions: [{ type: "uri", label: "เข้าสู่ระบบ", uri: liffOpenUrl(liffId) }],
    },
  };
}

async function processAiMessage(input: {
  eventId: string;
  lineUserId: string;
  connectionId: string;
  customerId?: string;
  question: string;
}) {
  const loadingRefresh = setInterval(() => {
    void startLineLoadingAnimation(input.lineUserId, 60).catch(() => undefined);
  }, 50_000);
  try {
    const history = await getLineAiHistory(input.lineUserId);
    await appendLineAiHistory(input.lineUserId, "user", input.question);
    const result = await runProductionAiChat({
      question: input.question,
      connectionIds: [input.connectionId],
      customerIds: input.customerId ? [input.customerId] : undefined,
      history,
      channel: "line",
      userId: input.lineUserId,
    });
    await appendLineAiHistory(input.lineUserId, "assistant", result.answer);
    const sent = await pushLineMessages(input.lineUserId, buildLineAiMessages(result));
    await finishLineAiEvent(input.eventId, sent.ok ? "completed" : "failed");
  } catch (error) {
    console.error("LINE AI request failed:", error instanceof Error ? error.message : "unknown error");
    const message = error instanceof ProductionAiError && error.code === "AI_NOT_CONFIGURED"
      ? "ยังไม่ได้กำหนด Default AI Model กรุณาติดต่อผู้ดูแลระบบ"
      : error instanceof ProductionAiError && error.code === "PRODUCTION_DATA_UNAVAILABLE"
        ? "ไม่สามารถอ่านข้อมูลการผลิตที่ได้รับอนุญาตได้ในขณะนี้ กรุณาลองใหม่ภายหลัง"
        : "SAM AI ไม่สามารถประมวลผลคำถามนี้ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง";
    await pushLineMessages(input.lineUserId, [textMessage(message)]).catch(() => undefined);
    await finishLineAiEvent(input.eventId, "failed");
  } finally {
    clearInterval(loadingRefresh);
    await pruneLineAiData().catch(() => undefined);
  }
}

export async function GET() {
  const secret = await getLineChannelSecret();
  return NextResponse.json({ ok: true, service: "LINE webhook", configured: Boolean(secret) });
}

export async function POST(request: Request) {
  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") ?? "";
  const secret = await getLineChannelSecret();
  if (!secret) return NextResponse.json({ error: "LINE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  if (!signatureIsValid(body, signature, secret)) {
    return NextResponse.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(body.toString("utf8") || "{}") as { events?: LineEvent[] };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const settings = await getLineWebhookSettings();
  const liffId = settings?.liffId ?? "";

  for (const event of payload.events ?? []) {
    const userId = event.source?.userId?.trim() ?? "";
    if (!isLineMessagingUserId(userId)) continue;

    try {
      if (event.type === "follow") markLineFriendship(userId, "linked");
      if (event.type === "unfollow") markLineFriendship(userId, "blocked");
    } catch {
      // Friendship tracking is best-effort and must never reject a valid LINE webhook.
    }

    after(() => syncRichMenu(userId).catch((error) => {
      console.warn("webhook rich menu sync failed:", error);
    }));

    if (event.type !== "message" || event.message?.type !== "text") continue;
    const question = event.message.text?.trim() ?? "";
    if (!question) continue;
    const normalized = question.toLowerCase();

    if (normalized === "menu" || normalized === "เมนู") {
      if (!event.replyToken || !liffId) continue;
      const loggedIn = await lineLoginStatus(userId) === "in";
      await replyLineMessages(event.replyToken, [{
        type: "template",
        altText: loggedIn ? "เปิด SAM Bridge" : "เข้าสู่ระบบ SAM Bridge",
        template: {
          type: "buttons",
          text: loggedIn ? "แตะเพื่อเปิดสถานะการผลิต" : "แตะเพื่อเข้าสู่ระบบ SAM Bridge",
          actions: [{
            type: "uri",
            label: loggedIn ? "เปิดบอร์ด" : "เข้าสู่ระบบ",
            uri: liffOpenUrl(liffId),
          }],
        },
      }]);
      continue;
    }

    if (event.source?.type !== "user") {
      await replyText(event.replyToken, "เพื่อความปลอดภัย กรุณาสนทนากับ SAM AI ผ่านแชตส่วนตัวของ LINE OA");
      continue;
    }

    const login = await getLineLoginForAuthorization(userId);
    const connection = login?.loggedIn && login.connectionId ? await getConnection(login.connectionId) : null;
    const customerAllowed = Boolean(
      login &&
      connection &&
      (
        !login.customerId ||
        connection.customerId === login.customerId ||
        connection.customers.some((customer) => customer.id === login.customerId)
      ),
    );
    const identityMatches = Boolean(
      login &&
      connection &&
      connection.loginId.trim().toLowerCase() === login.loginId.trim().toLowerCase() &&
      customerAllowed,
    );
    if (!identityMatches) {
      if (event.replyToken && liffId) await replyLineMessages(event.replyToken, [loginMessage(liffId)]);
      else await replyText(event.replyToken, "กรุณาเข้าสู่ระบบ SAM Bridge ก่อนใช้งาน SAM AI");
      continue;
    }

    if (["/clear", "clear", "ล้างประวัติ"].includes(normalized)) {
      try {
        await clearLineAiHistory(userId);
        await replyText(event.replyToken, "ล้างประวัติการสนทนากับ SAM AI แล้ว");
      } catch {
        await replyText(event.replyToken, "ไม่สามารถล้างประวัติได้ในขณะนี้ กรุณาลองใหม่ภายหลัง");
      }
      continue;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      await replyText(event.replyToken, `คำถามยาวเกินไป กรุณาส่งไม่เกิน ${MAX_QUESTION_LENGTH.toLocaleString()} ตัวอักษร`);
      continue;
    }

    const requestId = eventId(event, userId);
    const claimed = await claimLineAiEvent(requestId, userId);
    if (!claimed.ok) {
      if (claimed.reason === "rate_limited") {
        await replyText(event.replyToken, "ส่งคำถามถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
      } else if (claimed.reason === "unavailable") {
        await replyText(event.replyToken, "ระบบความปลอดภัยของ SAM AI ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
      }
      continue;
    }

    await startLineLoadingAnimation(userId, 60).catch(() => undefined);
    after(() => processAiMessage({
      eventId: requestId,
      lineUserId: userId,
      connectionId: connection!.id,
      customerId: login?.customerId || connection!.customerId || undefined,
      question,
    }));
  }

  return NextResponse.json({ ok: true });
}
