import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import type { ProductionAiHistoryItem } from "@/lib/production-ai-chat";

export type AiConversation = {
  id: string;
  title: string;
  userId: string | null;
  channelType: "web" | "slack" | "line" | "custom";
  channelId: string | null;
  providerId: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function findOrCreateConversation(input: {
  conversationId?: string;
  userId?: string;
  channelType: "web" | "slack" | "line" | "custom";
  channelId?: string;
  title?: string;
  providerId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    if (input.conversationId) {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", input.conversationId)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    if (input.channelId && input.channelType !== "web") {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("channel_type", input.channelType)
        .eq("channel_id", input.channelId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    const title = input.title?.trim() || "New Chat";
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        title: title.slice(0, 100),
        user_id: input.userId ?? null,
        channel_type: input.channelType,
        channel_id: input.channelId ?? null,
        provider_id: input.providerId ?? null,
        model: input.model ?? null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.warn("Failed to create AI conversation in Supabase:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("AI conversation lookup/create error:", err);
    return null;
  }
}

export async function recordChatMessage(input: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseConfigured() || !input.conversationId || !input.content) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("ai_chat_messages").insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn("Failed to record AI chat message in Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Record AI chat message error:", err);
  }
}

export async function getConversationHistoryFromSupabase(
  conversationId: string,
  limit = 20,
): Promise<ProductionAiHistoryItem[]> {
  if (!supabaseConfigured() || !conversationId) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error || !Array.isArray(data)) return [];

    return data
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        text: msg.content,
      }));
  } catch {
    return [];
  }
}
