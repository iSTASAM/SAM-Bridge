import { NextResponse } from "next/server";
import { findOrCreateConversation, recordChatMessage } from "@/lib/ai-chat-store";
import {
  ProductionAiError,
  runProductionAiChat,
  type ProductionAiDateQuery,
  type ProductionAiHistoryItem,
} from "@/lib/production-ai-chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseHistory(value: unknown): ProductionAiHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { role?: unknown; text?: unknown };
    if ((row.role !== "user" && row.role !== "assistant") || typeof row.text !== "string") return [];
    return [{ role: row.role, text: row.text.slice(0, 2_000) }];
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    question?: unknown;
    connectionIds?: unknown;
    dateQuery?: ProductionAiDateQuery;
    history?: unknown;
    provider?: unknown;
    providerId?: unknown;
    model?: unknown;
    conversationId?: unknown;
    userId?: unknown;
  };
  const connectionIds = Array.isArray(body.connectionIds)
    ? body.connectionIds.filter((id): id is string => typeof id === "string")
    : [];
  const providerId = typeof body.providerId === "string"
    ? body.providerId
    : typeof body.provider === "string"
      ? body.provider
      : undefined;
  const question = typeof body.question === "string" ? body.question : "";

  try {
    const result = await runProductionAiChat({
      question,
      connectionIds,
      dateQuery: body.dateQuery,
      history: parseHistory(body.history),
      providerId,
      model: typeof body.model === "string" ? body.model : undefined,
      channel: "web",
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });

    if (question) {
      void findOrCreateConversation({
        conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
        userId: typeof body.userId === "string" ? body.userId : undefined,
        channelType: "web",
        title: question.slice(0, 50),
        providerId,
        model: typeof body.model === "string" ? body.model : undefined,
      }).then((convId) => {
        if (convId) {
          void recordChatMessage({ conversationId: convId, role: "user", content: question });
          void recordChatMessage({ conversationId: convId, role: "assistant", content: result.answer });
        }
      }).catch(() => undefined);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProductionAiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed", code: "AI_REQUEST_FAILED" },
      { status: 500 },
    );
  }
}
