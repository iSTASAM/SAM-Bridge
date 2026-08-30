import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import type { ProductionAiHistoryItem } from "@/lib/production-ai-chat";

type ClaimResult = { ok: true } | { ok: false; reason: "duplicate" | "rate_limited" | "unavailable" };
type MemoryRequest = { eventId: string; lineUserId: string; createdAt: number };
type MemoryMessage = ProductionAiHistoryItem & { createdAt: number };

const memoryRequests: MemoryRequest[] = [];
const memoryMessages = new Map<string, MemoryMessage[]>();
const HOUR_MS = 60 * 60 * 1_000;
const HISTORY_DAYS = 30;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const PER_MINUTE = positiveInt(process.env.LINE_AI_RATE_LIMIT_PER_MINUTE, 5);
const PER_HOUR = positiveInt(process.env.LINE_AI_RATE_LIMIT_PER_HOUR, 30);

function claimMemory(eventId: string, lineUserId: string): ClaimResult {
  const now = Date.now();
  for (let index = memoryRequests.length - 1; index >= 0; index -= 1) {
    if (memoryRequests[index].createdAt < now - HOUR_MS) memoryRequests.splice(index, 1);
  }
  if (memoryRequests.some((request) => request.eventId === eventId)) {
    return { ok: false, reason: "duplicate" };
  }
  const userRequests = memoryRequests.filter((request) => request.lineUserId === lineUserId);
  if (userRequests.filter((request) => request.createdAt >= now - 60_000).length >= PER_MINUTE || userRequests.length >= PER_HOUR) {
    return { ok: false, reason: "rate_limited" };
  }
  memoryRequests.push({ eventId, lineUserId, createdAt: now });
  return { ok: true };
}

export async function claimLineAiEvent(eventId: string, lineUserId: string): Promise<ClaimResult> {
  if (!supabaseConfigured()) return claimMemory(eventId, lineUserId);
  const supabase = getSupabaseAdmin();
  if (!supabase) return claimMemory(eventId, lineUserId);

  const { error: insertError } = await supabase.from("line_ai_requests").insert({
    event_id: eventId,
    line_user_id: lineUserId,
    status: "processing",
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, reason: "duplicate" };
    console.warn("LINE AI request storage unavailable; rejecting request:", insertError.message);
    return { ok: false, reason: "unavailable" };
  }

  const now = Date.now();
  const minuteStart = new Date(now - 60_000).toISOString();
  const hourStart = new Date(now - HOUR_MS).toISOString();
  const [minuteResult, hourResult] = await Promise.all([
    supabase
      .from("line_ai_requests")
      .select("event_id", { count: "exact", head: true })
      .eq("line_user_id", lineUserId)
      .gte("created_at", minuteStart),
    supabase
      .from("line_ai_requests")
      .select("event_id", { count: "exact", head: true })
      .eq("line_user_id", lineUserId)
      .gte("created_at", hourStart),
  ]);
  if (minuteResult.error || hourResult.error) {
    console.warn("LINE AI rate-limit count unavailable; rejecting request");
    await supabase.from("line_ai_requests").update({ status: "failed" }).eq("event_id", eventId);
    return { ok: false, reason: "unavailable" };
  }
  if ((minuteResult.count ?? 0) > PER_MINUTE || (hourResult.count ?? 0) > PER_HOUR) {
    await supabase.from("line_ai_requests").update({ status: "rate_limited" }).eq("event_id", eventId);
    return { ok: false, reason: "rate_limited" };
  }
  return { ok: true };
}

export async function finishLineAiEvent(eventId: string, status: "completed" | "failed") {
  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase
    .from("line_ai_requests")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) console.warn("LINE AI request status update failed:", error.message);
}

export async function getLineAiHistory(lineUserId: string): Promise<ProductionAiHistoryItem[]> {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from("line_ai_messages")
        .select("role, content, created_at")
        .eq("line_user_id", lineUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!error) {
        return (data ?? []).reverse().flatMap((row) => {
          const role = row.role === "user" || row.role === "assistant" ? row.role : null;
          return role && typeof row.content === "string" ? [{ role, text: row.content }] : [];
        });
      }
      console.warn("LINE AI history load unavailable; using process-local history:", error.message);
    }
  }
  return (memoryMessages.get(lineUserId) ?? []).slice(-8).map(({ role, text }) => ({ role, text }));
}

export async function appendLineAiHistory(
  lineUserId: string,
  role: "user" | "assistant",
  content: string,
) {
  const text = content.trim().slice(0, 20_000);
  if (!text) return;
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("line_ai_messages").insert({
        line_user_id: lineUserId,
        role,
        content: text,
      });
      if (!error) return;
      console.warn("LINE AI history save unavailable; using process-local history:", error.message);
    }
  }
  const current = memoryMessages.get(lineUserId) ?? [];
  current.push({ role, text, createdAt: Date.now() });
  memoryMessages.set(lineUserId, current.slice(-20));
}

export async function clearLineAiHistory(lineUserId: string) {
  memoryMessages.delete(lineUserId);
  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("line_ai_messages").delete().eq("line_user_id", lineUserId);
  if (error) throw new Error(`LINE_AI_HISTORY_CLEAR_FAILED: ${error.message}`);
}

export async function pruneLineAiData() {
  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const historyCutoff = new Date(Date.now() - HISTORY_DAYS * 24 * HOUR_MS).toISOString();
  const requestCutoff = new Date(Date.now() - 24 * HOUR_MS).toISOString();
  await Promise.all([
    supabase.from("line_ai_messages").delete().lt("created_at", historyCutoff),
    supabase.from("line_ai_requests").delete().lt("created_at", requestCutoff),
  ]);
}
