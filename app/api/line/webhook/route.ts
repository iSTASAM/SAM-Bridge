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
  unlinkUserRichMenu,
} from "@/lib/line-messaging";
import { markLineFriendship } from "@/lib/line-users";
import { ProductionAiError, runProductionAiChat } from "@/lib/production-ai-chat";

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
const LINE_TEXT_LIMIT = 4_500;
const LINE_MESSAGE_LIMIT = 5;

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

function lineAnswerMessages(answer: string) {
  const suffix = "\n\n(คำตอบถูกตัดให้เหมาะกับข้อจำกัดของ LINE)";
  const maxTotal = LINE_TEXT_LIMIT * LINE_MESSAGE_LIMIT - suffix.length;
  const normalized = answer.trim();
  const text = normalized.length > maxTotal ? `${normalized.slice(0, maxTotal)}${suffix}` : normalized;
  const chunks: string[] = [];
  let remaining = text;
  while (remaining && chunks.length < LINE_MESSAGE_LIMIT) {
    if (remaining.length <= LINE_TEXT_LIMIT) {
      chunks.push(remaining);
      break;
    }
    const candidate = remaining.slice(0, LINE_TEXT_LIMIT);
    const newline = candidate.lastIndexOf("\n");
    const space = candidate.lastIndexOf(" ");
    const splitAt = Math.max(newline, space) >= LINE_TEXT_LIMIT * 0.6
      ? Math.max(newline, space)
      : LINE_TEXT_LIMIT;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks.filter(Boolean).map(textMessage);
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
  question: string;
}) {
  try {
    const history = await getLineAiHistory(input.lineUserId);
    await appendLineAiHistory(input.lineUserId, "user", input.question);
    const result = await runProductionAiChat({
      question: input.question,
      connectionIds: [input.connectionId],
      history,
    });
    await appendLineAiHistory(input.lineUserId, "assistant", result.answer);
    const sent = await pushLineMessages(input.lineUserId, lineAnswerMessages(result.answer));
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
    const identityMatches = Boolean(
      login &&
      connection &&
      connection.loginId.trim().toLowerCase() === login.loginId.trim().toLowerCase() &&
      (!login.customerId || connection.customerId === login.customerId),
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

    await replyText(event.replyToken, "รับคำถามแล้ว กำลังวิเคราะห์ข้อมูลที่คุณมีสิทธิ์เข้าถึง…");
    after(() => processAiMessage({
      eventId: requestId,
      lineUserId: userId,
      connectionId: connection!.id,
      question,
    }));
  }

  return NextResponse.json({ ok: true });
}
