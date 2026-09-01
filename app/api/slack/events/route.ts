import { createHmac, timingSafeEqual } from "crypto";
import { after, NextResponse } from "next/server";
import { findOrCreateConversation, recordChatMessage } from "@/lib/ai-chat-store";
import { listNotificationRules } from "@/lib/notification-configs";
import { ProductionAiError, runProductionAiChat, type ProductionAiHistoryItem } from "@/lib/production-ai-chat";
import { getSlackDestinationByChannelId } from "@/lib/slack-destinations";
import { getSlackSettings } from "@/lib/slack-settings";
import { slackApi } from "@/lib/slack-webhook";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type SlackEvent = {
  type?: string; user?: string; text?: string; channel?: string; ts?: string; thread_ts?: string;
  bot_id?: string; subtype?: string;
};
type SlackEnvelope = { type?: string; challenge?: string; event_id?: string; event?: SlackEvent };


function signatureIsValid(raw: string, timestamp: string, signature: string, secret: string) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function claimEvent(eventId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return "unavailable" as const;
  const { error } = await supabase.from("slack_event_receipts").insert({ event_id: eventId, status: "processing" });
  if (!error) return "claimed" as const;
  if (error.code === "23505") return "duplicate" as const;
  console.error("Slack event receipt failed:", error.message);
  return "unavailable" as const;
}

async function finishEvent(eventId: string, status: "completed" | "failed") {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("slack_event_receipts").update({ status, updated_at: new Date().toISOString() }).eq("event_id", eventId);
}

async function setThreadStatus(
  botToken: string,
  channel: string,
  threadTs: string | undefined,
  status: string,
  loadingMessages?: string[],
) {
  if (!threadTs) return;
  await slackApi(botToken, "assistant.threads.setStatus", {
    channel_id: channel,
    thread_ts: threadTs,
    status,
    ...(loadingMessages?.length ? { loading_messages: loadingMessages } : {}),
  }).catch(() => undefined);
}

async function postOrUpdateReply(
  botToken: string,
  channel: string,
  threadTs: string | undefined,
  placeholderTs: string | undefined,
  text: string,
) {
  if (placeholderTs) {
    const updated = await slackApi(botToken, "chat.update", {
      channel,
      ts: placeholderTs,
      text: text.slice(0, 3900),
    });
    if (updated.ok) return;
  }
  const sent = await slackApi(botToken, "chat.postMessage", {
    channel,
    thread_ts: threadTs,
    text: text.slice(0, 3900),
  });
  if (!sent.ok) throw new Error(`SLACK_${sent.error ?? "SEND_FAILED"}`);
}

async function getSlackConversationHistory(
  botToken: string,
  channel: string,
  threadTs: string | undefined,
  currentMessageTs: string | undefined,
): Promise<ProductionAiHistoryItem[]> {
  const history: ProductionAiHistoryItem[] = [];
  try {
    let result: any;
    if (threadTs) {
      result = await slackApi(botToken, "conversations.replies", {
        channel,
        ts: threadTs,
        limit: 20,
      });
    } else {
      result = await slackApi(botToken, "conversations.history", {
        channel,
        limit: 20,
      });
    }

    if (result?.ok && Array.isArray(result.messages)) {
      // Sort oldest to newest
      const messages = [...result.messages].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
      
      // Filter out the current message and future messages if any
      const previousMessages = currentMessageTs
        ? messages.filter((msg) => Number(msg.ts || 0) < Number(currentMessageTs))
        : messages.slice(0, -1);

      for (const msg of previousMessages) {
        if (msg.subtype && msg.subtype !== "bot_message") continue;
        if (!msg.text) continue;
        const text = msg.text.replace(/<@[A-Z0-9]+>/gi, "").trim();
        const role = (msg.bot_id || msg.app_id) ? "assistant" : "user";
        history.push({ role, text });
      }
    }
  } catch (err) {
    console.warn("Failed to fetch Slack conversation history:", err);
  }
  return history;
}

async function answerMention(
  eventId: string,
  event: SlackEvent,
  destination: { id: string; botToken: string; channelId: string },
) {
  const channel = event.channel || destination.channelId;
  const replyThreadTs = event.thread_ts || event.ts;

  try {
    await setThreadStatus(destination.botToken, channel, replyThreadTs, "กำลังคิด…", [
      "กำลังคิด…",
      "กำลังวิเคราะห์ข้อมูลการผลิต…",
      "กำลังพิมพ์คำตอบ…",
    ]);

    const history = await getSlackConversationHistory(
      destination.botToken,
      channel,
      event.thread_ts,
      event.ts,
    );

    const rules = (await listNotificationRules()).filter(
      (rule) => rule.enabled && rule.destinationId === destination.id,
    );
    const connectionIds = [...new Set(rules.map((rule) => rule.connectionId))];
    const customerIds = [...new Set(rules.map((rule) => rule.customerId).filter(Boolean))];
    const question = (event.text ?? "").replace(/<@[A-Z0-9]+>/gi, "").trim();
    let answer: string;
    if (!question) {
      answer = "กรุณาระบุคำถามหลัง @mention เช่น “สถานะเครื่องจักรตอนนี้เป็นอย่างไร”";
    } else if (connectionIds.length === 0) {
      answer = "ยังไม่ได้กำหนดเครื่องจักรสำหรับ Channel นี้ กรุณาให้ Admin สร้าง Notification Rule ใน Slack Alerts ก่อน";
    } else {
      const result = await runProductionAiChat({
        question,
        connectionIds,
        customerIds,
        history,
        channel: "slack",
        userId: event.user ?? null,
      });
      answer = result.answer;
    }

    await setThreadStatus(destination.botToken, channel, replyThreadTs, "กำลังพิมพ์…");
    await postOrUpdateReply(destination.botToken, channel, replyThreadTs, undefined, answer);
    await setThreadStatus(destination.botToken, channel, replyThreadTs, "");
    await finishEvent(eventId, "completed");

    if (question) {
      void findOrCreateConversation({
        channelType: "slack",
        channelId: `${channel}:${replyThreadTs}`,
        userId: event.user,
        title: question.slice(0, 50),
      }).then((convId) => {
        if (convId) {
          void recordChatMessage({ conversationId: convId, role: "user", content: question });
          void recordChatMessage({ conversationId: convId, role: "assistant", content: answer });
        }
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error("Slack mention response failed:", error instanceof Error ? error.message : error);
    const text = error instanceof ProductionAiError && error.code === "AI_NOT_CONFIGURED"
      ? "ยังไม่ได้กำหนด Default AI Model กรุณาติดต่อผู้ดูแลระบบ"
      : "SAM AI ไม่สามารถตอบคำถามนี้ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง";
    await postOrUpdateReply(destination.botToken, channel, replyThreadTs, undefined, text).catch(() => undefined);
    await setThreadStatus(destination.botToken, channel, replyThreadTs, "");
    await finishEvent(eventId, "failed");
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const settings = await getSlackSettings();
  if (!settings.signingSecret) return NextResponse.json({ error: "SLACK_NOT_CONFIGURED" }, { status: 503 });
  if (!signatureIsValid(
    raw,
    request.headers.get("x-slack-request-timestamp") ?? "",
    request.headers.get("x-slack-signature") ?? "",
    settings.signingSecret,
  )) return NextResponse.json({ error: "INVALID_SLACK_SIGNATURE" }, { status: 401 });

  let payload: SlackEnvelope;
  try { payload = JSON.parse(raw) as SlackEnvelope; }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (payload.type === "url_verification") return NextResponse.json({ challenge: payload.challenge ?? "" });

  const event = payload.event;
  if (
    payload.type !== "event_callback" ||
    event?.type !== "app_mention" ||
    event.bot_id ||
    event.subtype ||
    !event.channel
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const destination = await getSlackDestinationByChannelId(event.channel).catch((error) => {
    console.error("Slack destination lookup failed:", error instanceof Error ? error.message : error);
    return null;
  });
  if (!destination) {
    console.warn("Slack app_mention ignored: no destination for channel", event.channel);
    return NextResponse.json({ ok: true, ignored: true, reason: "unknown_channel" });
  }
  if (!destination.aiEnabled || !destination.botToken) {
    console.warn("Slack app_mention ignored: AI disabled for channel", event.channel);
    return NextResponse.json({ ok: true, ignored: true, reason: "ai_disabled" });
  }

  const eventId = payload.event_id?.trim() ?? "";
  if (!eventId) return NextResponse.json({ error: "MISSING_SLACK_EVENT_ID" }, { status: 400 });
  const claim = await claimEvent(eventId);
  if (claim === "duplicate") return NextResponse.json({ ok: true, duplicate: true });
  if (claim === "unavailable") {
    return NextResponse.json({ error: "SLACK_EVENT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  after(() => answerMention(eventId, event, destination));
  return NextResponse.json({ ok: true });
}
