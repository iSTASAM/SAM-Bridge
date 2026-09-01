import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type AiUsageFeature =
  | "general"
  | "maintenance"
  | "production"
  | "events"
  | "enrichment"
  | "chat"
  | "slack"
  | "line";

export type DailyHeatmapItem = {
  date: string;
  count: number;
  tokens: number;
  costThb: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type FeatureBreakdown = {
  key: string;
  labelTh: string;
  labelEn: string;
  labelJa: string;
  count: number;
  tokens: number;
  costThb: number;
  percent: number;
};

export type ModelBreakdown = {
  providerId: string;
  model: string;
  name: string;
  count: number;
  tokens: number;
  costThb: number;
  percent: number;
};

export type ProviderBreakdown = {
  id: string;
  name: string;
  count: number;
  tokens: number;
  costThb: number;
  percent: number;
};

export type ChannelBreakdown = {
  channel: "web" | "line" | "slack" | "unknown";
  labelTh: string;
  labelEn: string;
  labelJa: string;
  count: number;
  tokens: number;
  costThb: number;
  uniqueUsers: number;
  percent: number;
};

export type UserBreakdown = {
  userId: string;
  channel: "web" | "line" | "slack" | "unknown";
  count: number;
  tokens: number;
  costThb: number;
  percent: number;
};

export type AiUsageHeatmapResponse = {
  ok: boolean;
  days: number;
  source: "live" | "empty";
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCostThb: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    peakDailyRequests: number;
    avgLatencyMs: number;
    uniqueUsers: number;
    byChannel: {
      web: number;
      line: number;
      slack: number;
      unknown: number;
    };
  };
  daily: DailyHeatmapItem[];
  features: FeatureBreakdown[];
  models: ModelBreakdown[];
  providers: ProviderBreakdown[];
  channels: ChannelBreakdown[];
  users: UserBreakdown[];
};

const FEATURE_LABELS: Record<string, { th: string; en: string; ja: string }> = {
  production: { th: "Production Summary", en: "Production Summary", ja: "生産状況要約" },
  events: { th: "Event & Downtime", en: "Event & Downtime", ja: "イベント・ダウンタイム" },
  chat: { th: "Web Chat", en: "Web Chat", ja: "Web チャット" },
  maintenance: { th: "Maintenance Assistant", en: "Maintenance Assistant", ja: "保全アシスタント" },
  enrichment: { th: "Data Enrichment", en: "Data Enrichment", ja: "データエンリッチメント" },
  slack: { th: "Slack", en: "Slack", ja: "Slack" },
  line: { th: "LINE", en: "LINE", ja: "LINE" },
  general: { th: "General", en: "General", ja: "一般" },
};

const CHANNEL_LABELS: Record<string, { th: string; en: string; ja: string }> = {
  web: { th: "Web", en: "Web", ja: "Web" },
  line: { th: "LINE", en: "LINE", ja: "LINE" },
  slack: { th: "Slack", en: "Slack", ja: "Slack" },
  unknown: { th: "ไม่ระบุ", en: "Unknown", ja: "不明" },
};

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  custom: "Custom",
};

export function calculateLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (maxCount <= 4) {
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
  }
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function emptyDailySeries(days: number): DailyHeatmapItem[] {
  const result: DailyHeatmapItem[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push({
      date: d.toISOString().slice(0, 10),
      count: 0,
      tokens: 0,
      costThb: 0,
      level: 0,
    });
  }
  return result;
}

function asDateKey(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;
}

export async function logAiUsage(input: {
  providerId: string;
  model: string;
  feature?: AiUsageFeature;
  channel?: "web" | "line" | "slack" | "unknown";
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  statusCode?: number;
  errorMessage?: string | null;
  userId?: string | null;
  costThb?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const promptTokens = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(input.completionTokens ?? 0));
  const totalTokens = Math.max(0, Math.round(input.totalTokens ?? promptTokens + completionTokens));
  const channel = input.channel ?? "unknown";

  const row: Record<string, unknown> = {
    provider_id: input.providerId || "custom",
    model: input.model || "",
    feature: input.feature ?? "general",
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    latency_ms: Math.max(0, Math.round(input.latencyMs ?? 0)),
    status_code: input.statusCode ?? 200,
    error_message: input.errorMessage ?? null,
    user_id: input.userId ?? null,
    cost_usd: roundMoney(input.costThb ?? 0),
    metadata: {
      ...(input.metadata ?? {}),
      channel,
    },
  };

  // channel column exists after migration 024; keep metadata fallback if insert fails without it.
  row.channel = channel;

  let { error } = await supabase.from("ai_usage_logs").insert(row);
  if (error && /channel/i.test(error.message)) {
    delete row.channel;
    ({ error } = await supabase.from("ai_usage_logs").insert(row));
  }

  if (error) {
    console.warn("Failed to log AI usage:", error.message);
  }
}

export async function fetchAiUsageHeatmapData(days = 365): Promise<AiUsageHeatmapResponse> {
  const rangeDays = Math.min(365, Math.max(7, days));
  const heatmapDays = 365;
  let dailyData = emptyDailySeries(heatmapDays);
  let features: FeatureBreakdown[] = [];
  let models: ModelBreakdown[] = [];
  let providers: ProviderBreakdown[] = [];
  let channels: ChannelBreakdown[] = [];
  let users: UserBreakdown[] = [];
  let source: "live" | "empty" = "empty";
  let avgLatencyMs = 0;
  let totalCostThb = 0;
  let totalRequests = 0;
  let totalTokens = 0;

  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const [heatmapRes, modelRes, featureRes, channelRes, userRes] = await Promise.all([
        supabase.rpc("get_ai_usage_heatmap", { p_days: heatmapDays }),
        supabase.rpc("get_ai_usage_by_model", { p_days: rangeDays }),
        supabase.rpc("get_ai_usage_by_feature", { p_days: rangeDays }),
        supabase.rpc("get_ai_usage_by_channel", { p_days: rangeDays }),
        supabase.rpc("get_ai_usage_by_user", { p_days: rangeDays }),
      ]);

      if (!heatmapRes.error && Array.isArray(heatmapRes.data)) {
        source = "live";
        const rows = heatmapRes.data as Array<{
          usage_date: string;
          request_count?: number;
          total_tokens?: number;
          cost_usd?: number;
          avg_latency_ms?: number;
        }>;
        const maxVal = Math.max(1, ...rows.map((r) => Number(r.request_count || 0)));
        let latencySum = 0;
        let latencyDays = 0;
        dailyData = rows.map((r) => {
          const count = Number(r.request_count || 0);
          const tokens = Number(r.total_tokens || 0);
          const costThb = roundMoney(Number(r.cost_usd || 0));
          const latency = Number(r.avg_latency_ms || 0);
          if (count > 0 && latency > 0) {
            latencySum += latency;
            latencyDays += 1;
          }
          return {
            date: asDateKey(r.usage_date),
            count,
            tokens,
            costThb,
            level: calculateLevel(count, maxVal),
          };
        });
        avgLatencyMs = latencyDays ? Math.round(latencySum / latencyDays) : 0;
      } else if (heatmapRes.error) {
        console.warn("AI usage heatmap RPC failed:", heatmapRes.error.message);
      }

      if (!modelRes.error && Array.isArray(modelRes.data)) {
        const rows = modelRes.data as Array<{
          provider_id?: string;
          model?: string | null;
          request_count?: number;
          total_tokens?: number;
          cost_usd?: number;
        }>;
        const requestTotal = rows.reduce((sum, r) => sum + Number(r.request_count || 0), 0) || 1;
        const costTotal = rows.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0) || 1;
        models = rows.map((r) => {
          const providerId = r.provider_id || "custom";
          const model = (r.model || "").trim() || "unknown";
          const count = Number(r.request_count || 0);
          const tokens = Number(r.total_tokens || 0);
          const costThb = roundMoney(Number(r.cost_usd || 0));
          totalRequests += count;
          totalTokens += tokens;
          totalCostThb += costThb;
          return {
            providerId,
            model,
            name: model,
            count,
            tokens,
            costThb,
            percent: Math.round((costThb / costTotal) * 100) || Math.round((count / requestTotal) * 100),
          };
        });

        const byProvider = new Map<string, ProviderBreakdown>();
        for (const row of models) {
          const current = byProvider.get(row.providerId) ?? {
            id: row.providerId,
            name: PROVIDER_NAMES[row.providerId] ?? row.providerId,
            count: 0,
            tokens: 0,
            costThb: 0,
            percent: 0,
          };
          current.count += row.count;
          current.tokens += row.tokens;
          current.costThb = roundMoney(current.costThb + row.costThb);
          byProvider.set(row.providerId, current);
        }
        const providerList = [...byProvider.values()];
        const providerCostTotal = providerList.reduce((sum, p) => sum + p.costThb, 0) || 1;
        const providerReqTotal = providerList.reduce((sum, p) => sum + p.count, 0) || 1;
        providers = providerList
          .map((p) => ({
            ...p,
            percent:
              Math.round((p.costThb / providerCostTotal) * 100) ||
              Math.round((p.count / providerReqTotal) * 100),
          }))
          .sort((a, b) => b.costThb - a.costThb || b.count - a.count);
      } else if (modelRes.error && !/could not find the function|schema cache/i.test(modelRes.error.message)) {
        console.warn("AI usage model RPC failed:", modelRes.error.message);
      }

      if (!featureRes.error && Array.isArray(featureRes.data)) {
        const rows = featureRes.data as Array<{
          feature?: string;
          request_count?: number;
          total_tokens?: number;
          cost_usd?: number;
        }>;
        const requestTotal = rows.reduce((sum, r) => sum + Number(r.request_count || 0), 0) || 1;
        features = rows.map((r) => {
          const key = r.feature || "general";
          const labels = FEATURE_LABELS[key] ?? FEATURE_LABELS.general;
          const count = Number(r.request_count || 0);
          return {
            key,
            labelTh: labels.th,
            labelEn: labels.en,
            labelJa: labels.ja,
            count,
            tokens: Number(r.total_tokens || 0),
            costThb: roundMoney(Number(r.cost_usd || 0)),
            percent: Math.round((count / requestTotal) * 100),
          };
        });
      } else if (featureRes.error && !/could not find the function|schema cache/i.test(featureRes.error.message)) {
        console.warn("AI usage feature RPC failed:", featureRes.error.message);
      }

      if (!channelRes.error && Array.isArray(channelRes.data)) {
        const rows = channelRes.data as Array<{
          channel?: string;
          request_count?: number;
          total_tokens?: number;
          cost_usd?: number;
          unique_users?: number;
        }>;
        const requestTotal = rows.reduce((sum, r) => sum + Number(r.request_count || 0), 0) || 1;
        channels = rows.map((r) => {
          const channel = (r.channel || "unknown") as ChannelBreakdown["channel"];
          const labels = CHANNEL_LABELS[channel] ?? CHANNEL_LABELS.unknown;
          const count = Number(r.request_count || 0);
          return {
            channel,
            labelTh: labels.th,
            labelEn: labels.en,
            labelJa: labels.ja,
            count,
            tokens: Number(r.total_tokens || 0),
            costThb: roundMoney(Number(r.cost_usd || 0)),
            uniqueUsers: Number(r.unique_users || 0),
            percent: Math.round((count / requestTotal) * 100),
          };
        });
      }

      if (!userRes.error && Array.isArray(userRes.data)) {
        const rows = userRes.data as Array<{
          user_id?: string;
          channel?: string;
          request_count?: number;
          total_tokens?: number;
          cost_usd?: number;
        }>;
        const requestTotal = rows.reduce((sum, r) => sum + Number(r.request_count || 0), 0) || 1;
        users = rows.map((r) => {
          const count = Number(r.request_count || 0);
          return {
            userId: r.user_id || "(anonymous)",
            channel: (r.channel || "unknown") as UserBreakdown["channel"],
            count,
            tokens: Number(r.total_tokens || 0),
            costThb: roundMoney(Number(r.cost_usd || 0)),
            percent: Math.round((count / requestTotal) * 100),
          };
        });
      }

      // Fallback when 024 RPCs are missing: aggregate from raw logs for selected window.
      if ((!channels.length || !users.length) && source === "live") {
        const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase
          .from("ai_usage_logs")
          .select("provider_id, model, feature, total_tokens, cost_usd, created_at, user_id, channel, metadata")
          .gte("created_at", since)
          .limit(20_000);

        if (Array.isArray(logs) && logs.length) {
          if (!channels.length) {
            const map = new Map<string, ChannelBreakdown & { userSet: Set<string> }>();
            for (const row of logs) {
              const meta = (row.metadata ?? {}) as Record<string, unknown>;
              const channel = String(row.channel || meta.channel || "unknown") as ChannelBreakdown["channel"];
              const labels = CHANNEL_LABELS[channel] ?? CHANNEL_LABELS.unknown;
              const current = map.get(channel) ?? {
                channel,
                labelTh: labels.th,
                labelEn: labels.en,
                labelJa: labels.ja,
                count: 0,
                tokens: 0,
                costThb: 0,
                uniqueUsers: 0,
                percent: 0,
                userSet: new Set<string>(),
              };
              current.count += 1;
              current.tokens += Number(row.total_tokens || 0);
              current.costThb = roundMoney(current.costThb + Number(row.cost_usd || 0));
              if (row.user_id) current.userSet.add(String(row.user_id));
              map.set(channel, current);
            }
            const list = [...map.values()];
            const reqTotal = list.reduce((sum, c) => sum + c.count, 0) || 1;
            channels = list
              .map(({ userSet, ...rest }) => ({
                ...rest,
                uniqueUsers: userSet.size,
                percent: Math.round((rest.count / reqTotal) * 100),
              }))
              .sort((a, b) => b.count - a.count);
          }

          if (!users.length) {
            const map = new Map<string, UserBreakdown>();
            for (const row of logs) {
              const meta = (row.metadata ?? {}) as Record<string, unknown>;
              const channel = String(row.channel || meta.channel || "unknown") as UserBreakdown["channel"];
              const userId = String(row.user_id || "").trim() || "(anonymous)";
              const key = `${userId}::${channel}`;
              const current = map.get(key) ?? {
                userId,
                channel,
                count: 0,
                tokens: 0,
                costThb: 0,
                percent: 0,
              };
              current.count += 1;
              current.tokens += Number(row.total_tokens || 0);
              current.costThb = roundMoney(current.costThb + Number(row.cost_usd || 0));
              map.set(key, current);
            }
            const list = [...map.values()];
            const reqTotal = list.reduce((sum, u) => sum + u.count, 0) || 1;
            users = list
              .map((u) => ({ ...u, percent: Math.round((u.count / reqTotal) * 100) }))
              .sort((a, b) => b.costThb - a.costThb || b.count - a.count)
              .slice(0, 50);
          }
        }
      }

      // Fallback when 022 RPCs are missing: aggregate from raw logs for selected window.
      if ((!models.length || !features.length) && source === "live") {
        const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
        const { data: logs, error: logsError } = await supabase
          .from("ai_usage_logs")
          .select("provider_id, model, feature, total_tokens, cost_usd, created_at")
          .gte("created_at", since)
          .limit(20_000);

        if (!logsError && Array.isArray(logs) && logs.length) {
          if (!models.length) {
            totalRequests = 0;
            totalTokens = 0;
            totalCostThb = 0;
            const map = new Map<string, ModelBreakdown>();
            for (const row of logs) {
              const providerId = String(row.provider_id || "custom");
              const model = String(row.model || "").trim() || "unknown";
              const key = `${providerId}::${model}`;
              const current = map.get(key) ?? {
                providerId,
                model,
                name: model,
                count: 0,
                tokens: 0,
                costThb: 0,
                percent: 0,
              };
              current.count += 1;
              current.tokens += Number(row.total_tokens || 0);
              current.costThb = roundMoney(current.costThb + Number(row.cost_usd || 0));
              map.set(key, current);
            }
            const list = [...map.values()];
            for (const m of list) {
              totalRequests += m.count;
              totalTokens += m.tokens;
              totalCostThb += m.costThb;
            }
            const costTotal = totalCostThb || 1;
            models = list
              .map((m) => ({ ...m, percent: Math.round((m.costThb / costTotal) * 100) }))
              .sort((a, b) => b.costThb - a.costThb || b.count - a.count);

            const byProvider = new Map<string, ProviderBreakdown>();
            for (const row of models) {
              const current = byProvider.get(row.providerId) ?? {
                id: row.providerId,
                name: PROVIDER_NAMES[row.providerId] ?? row.providerId,
                count: 0,
                tokens: 0,
                costThb: 0,
                percent: 0,
              };
              current.count += row.count;
              current.tokens += row.tokens;
              current.costThb = roundMoney(current.costThb + row.costThb);
              byProvider.set(row.providerId, current);
            }
            const providerList = [...byProvider.values()];
            const providerCostTotal = providerList.reduce((sum, p) => sum + p.costThb, 0) || 1;
            providers = providerList
              .map((p) => ({ ...p, percent: Math.round((p.costThb / providerCostTotal) * 100) }))
              .sort((a, b) => b.costThb - a.costThb || b.count - a.count);
          }

          if (!features.length) {
            const map = new Map<string, FeatureBreakdown>();
            for (const row of logs) {
              const key = String(row.feature || "general");
              const labels = FEATURE_LABELS[key] ?? FEATURE_LABELS.general;
              const current = map.get(key) ?? {
                key,
                labelTh: labels.th,
                labelEn: labels.en,
                labelJa: labels.ja,
                count: 0,
                tokens: 0,
                costThb: 0,
                percent: 0,
              };
              current.count += 1;
              current.tokens += Number(row.total_tokens || 0);
              current.costThb = roundMoney(current.costThb + Number(row.cost_usd || 0));
              map.set(key, current);
            }
            const list = [...map.values()];
            const reqTotal = list.reduce((sum, f) => sum + f.count, 0) || 1;
            features = list
              .map((f) => ({ ...f, percent: Math.round((f.count / reqTotal) * 100) }))
              .sort((a, b) => b.count - a.count);
          }
        }
      }
    }
  }

  // Range summary from selected window of daily series when model RPC had no rows.
  const ranged = dailyData.slice(-rangeDays);
  let activeDays = 0;
  let peakDailyRequests = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let rangedRequests = 0;
  let rangedTokens = 0;
  let rangedCost = 0;

  for (const day of ranged) {
    rangedRequests += day.count;
    rangedTokens += day.tokens;
    rangedCost += day.costThb;
    if (day.count > 0) {
      activeDays++;
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      if (day.count > peakDailyRequests) peakDailyRequests = day.count;
    } else {
      tempStreak = 0;
    }
  }

  for (let i = ranged.length - 1; i >= 0; i--) {
    if (ranged[i].count > 0) currentStreak++;
    else if (i === ranged.length - 1) continue;
    else break;
  }

  if (!totalRequests) totalRequests = rangedRequests;
  if (!totalTokens) totalTokens = rangedTokens;
  if (!totalCostThb) totalCostThb = rangedCost;

  const byChannel = { web: 0, line: 0, slack: 0, unknown: 0 };
  for (const row of channels) {
    if (row.channel in byChannel) byChannel[row.channel] = row.count;
  }
  const uniqueUsers = new Set(users.filter((u) => u.userId !== "(anonymous)").map((u) => u.userId)).size;

  return {
    ok: true,
    days: rangeDays,
    source,
    summary: {
      totalRequests,
      totalTokens,
      totalCostThb: roundMoney(totalCostThb),
      activeDays,
      currentStreak,
      longestStreak,
      peakDailyRequests,
      avgLatencyMs,
      uniqueUsers,
      byChannel,
    },
    daily: dailyData,
    features,
    models,
    providers,
    channels,
    users,
  };
}
