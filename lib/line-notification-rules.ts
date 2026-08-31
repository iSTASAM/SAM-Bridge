import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type LineNotificationRule = {
  id: string;
  lineUserId: string;
  connectionId: string;
  lineUuid: string;
  lineName: string;
  groupName: string;
  statusUuid: string;
  statusNameTh: string;
  statusNameEn: string;
  statusNameJa: string;
  statusBackgroundColor: string | null;
  statusTextColor: string | null;
  durationMinutes: number;
  enabled: boolean;
  observedStatusUuid: string | null;
  statusStartedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RuleRow = {
  id: string;
  line_user_id: string;
  connection_id: string;
  line_uuid: string;
  line_name: string;
  group_name: string;
  status_uuid: string;
  status_name_th: string;
  status_name_en: string;
  status_name_ja: string;
  status_background_color: string | null;
  status_text_color?: string | null;
  duration_minutes: number;
  enabled: boolean;
  observed_status_uuid: string | null;
  status_started_at: string | null;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewLineNotificationRule = Pick<
  LineNotificationRule,
  | "lineUserId"
  | "connectionId"
  | "lineUuid"
  | "lineName"
  | "groupName"
  | "statusUuid"
  | "statusNameTh"
  | "statusNameEn"
  | "statusNameJa"
  | "statusBackgroundColor"
  | "statusTextColor"
  | "durationMinutes"
>;

const FILE = path.join(process.cwd(), "data", "line-notification-rules.json");

type SupabaseOperationResult = {
  error: { message: string } | null;
};

function retryableSupabaseError(message: string) {
  return /jwt issued at future|fetch failed|network|timeout|econnreset|\b50[234]\b/i.test(message);
}

async function withSupabaseRetry<T extends SupabaseOperationResult>(
  operation: () => PromiseLike<T>,
  label: string,
) {
  const delays = [250, 750];
  let result = await operation();
  for (let attempt = 0; result.error && retryableSupabaseError(result.error.message) && attempt < delays.length; attempt += 1) {
    console.warn("LINE notification Supabase operation retry", {
      label,
      attempt: attempt + 2,
      error: result.error.message,
    });
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    result = await operation();
  }
  return result;
}

function rowToRule(row: RuleRow): LineNotificationRule {
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    connectionId: row.connection_id,
    lineUuid: row.line_uuid,
    lineName: row.line_name,
    groupName: row.group_name,
    statusUuid: row.status_uuid,
    statusNameTh: row.status_name_th,
    statusNameEn: row.status_name_en,
    statusNameJa: row.status_name_ja,
    statusBackgroundColor: row.status_background_color,
    statusTextColor: row.status_text_color ?? null,
    durationMinutes: row.duration_minutes,
    enabled: row.enabled,
    observedStatusUuid: row.observed_status_uuid,
    statusStartedAt: row.status_started_at,
    lastNotifiedAt: row.last_notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ruleToRow(rule: LineNotificationRule): RuleRow {
  return {
    id: rule.id,
    line_user_id: rule.lineUserId,
    connection_id: rule.connectionId,
    line_uuid: rule.lineUuid,
    line_name: rule.lineName,
    group_name: rule.groupName,
    status_uuid: rule.statusUuid,
    status_name_th: rule.statusNameTh,
    status_name_en: rule.statusNameEn,
    status_name_ja: rule.statusNameJa,
    status_background_color: rule.statusBackgroundColor,
    status_text_color: rule.statusTextColor,
    duration_minutes: rule.durationMinutes,
    enabled: rule.enabled,
    observed_status_uuid: rule.observedStatusUuid,
    status_started_at: rule.statusStartedAt,
    last_notified_at: rule.lastNotifiedAt,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

function readFileRules(): Record<string, LineNotificationRule> {
  if (!existsSync(FILE)) return {};
  try {
    return (JSON.parse(readFileSync(FILE, "utf8")) as { rules?: Record<string, LineNotificationRule> }).rules ?? {};
  } catch {
    return {};
  }
}

function writeFileRules(rules: Record<string, LineNotificationRule>) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ rules }, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function listLineNotificationRules(lineUserId?: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await withSupabaseRetry(
        () => {
          let retryQuery = supabase.from("line_notification_rules").select("*").order("updated_at", { ascending: false });
          if (lineUserId) retryQuery = retryQuery.eq("line_user_id", lineUserId);
          return retryQuery;
        },
        "list-rules",
      );
      if (error) throw new Error(`LINE_NOTIFICATION_RULES_LOAD_FAILED: ${error.message}`);
      return ((data ?? []) as RuleRow[]).map(rowToRule);
    }
  }
  return Object.values(readFileRules())
    .filter((rule) => !lineUserId || rule.lineUserId === lineUserId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createLineNotificationRule(input: NewLineNotificationRule) {
  const durationMinutes = Math.round(input.durationMinutes);
  if (!input.lineUserId || !input.connectionId || !input.lineUuid || !input.statusUuid) throw new Error("INVALID_RULE");
  if (durationMinutes < 0 || durationMinutes > 1440) throw new Error("INVALID_DURATION");
  const now = new Date().toISOString();
  const existing = (await listLineNotificationRules(input.lineUserId)).find(
    (item) => item.lineUuid === input.lineUuid && item.statusUuid === input.statusUuid,
  );
  const rule: LineNotificationRule = {
    ...input,
    id: existing?.id ?? randomUUID(),
    durationMinutes,
    statusTextColor: input.statusTextColor ?? null,
    enabled: true,
    // Always reset watch state so saving/re-saving a rule can fire again.
    observedStatusUuid: null,
    statusStartedAt: null,
    lastNotifiedAt: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const row = ruleToRow(rule);
      let { data, error } = await withSupabaseRetry(
        () => supabase
          .from("line_notification_rules")
          .upsert(row, { onConflict: "line_user_id,line_uuid,status_uuid" })
          .select("*")
          .single(),
        "create-rule",
      );
      if (error && /status_text_color/i.test(error.message)) {
        const rest = { ...row };
        delete rest.status_text_color;
        ({ data, error } = await withSupabaseRetry(
          () => supabase
            .from("line_notification_rules")
            .upsert(rest, { onConflict: "line_user_id,line_uuid,status_uuid" })
            .select("*")
            .single(),
          "create-rule-legacy-schema",
        ));
      }
      if (error) throw new Error(`LINE_NOTIFICATION_RULE_CREATE_FAILED: ${error.message}`);
      // Force-clear notification latch even if upsert ignored nulls.
      const saved = rowToRule(data as RuleRow);
      if (saved.lastNotifiedAt || saved.observedStatusUuid) {
        const cleared = await withSupabaseRetry(
          () => supabase
            .from("line_notification_rules")
            .update({
              observed_status_uuid: null,
              status_started_at: null,
              last_notified_at: null,
              updated_at: now,
            })
            .eq("id", saved.id),
          "clear-rule-state-after-create",
        );
        if (cleared.error) throw new Error(`LINE_NOTIFICATION_RULE_CREATE_FAILED: ${cleared.error.message}`);
        return { ...saved, observedStatusUuid: null, statusStartedAt: null, lastNotifiedAt: null, updatedAt: now };
      }
      return saved;
    }
  }

  const rules = readFileRules();
  rules[rule.id] = rule;
  writeFileRules(rules);
  return rule;
}

export type LineNotificationRulePatch = {
  durationMinutes?: number;
  enabled?: boolean;
  lineUuid?: string;
  lineName?: string;
  groupName?: string;
  statusUuid?: string;
  statusNameTh?: string;
  statusNameEn?: string;
  statusNameJa?: string;
  statusBackgroundColor?: string | null;
  statusTextColor?: string | null;
};

export async function getLineNotificationRule(id: string) {
  return (await listLineNotificationRules()).find((rule) => rule.id === id) ?? null;
}

export async function updateLineNotificationRule(
  id: string,
  lineUserId: string,
  input: LineNotificationRulePatch,
) {
  const current = (await listLineNotificationRules(lineUserId)).find((rule) => rule.id === id);
  if (!current) return null;
  const durationMinutes = input.durationMinutes === undefined ? current.durationMinutes : Math.round(input.durationMinutes);
  if (durationMinutes < 0 || durationMinutes > 1440) throw new Error("INVALID_DURATION");
  const targetChanged =
    (input.lineUuid !== undefined && input.lineUuid !== current.lineUuid) ||
    (input.statusUuid !== undefined && input.statusUuid !== current.statusUuid) ||
    input.statusUuid !== undefined;
  const next: LineNotificationRule = {
    ...current,
    durationMinutes,
    enabled: input.enabled ?? current.enabled,
    lineUuid: input.lineUuid ?? current.lineUuid,
    lineName: input.lineName ?? current.lineName,
    groupName: input.groupName ?? current.groupName,
    statusUuid: input.statusUuid ?? current.statusUuid,
    statusNameTh: input.statusNameTh ?? current.statusNameTh,
    statusNameEn: input.statusNameEn ?? current.statusNameEn,
    statusNameJa: input.statusNameJa ?? current.statusNameJa,
    statusBackgroundColor: input.statusBackgroundColor !== undefined ? input.statusBackgroundColor : current.statusBackgroundColor,
    statusTextColor: input.statusTextColor !== undefined ? input.statusTextColor : current.statusTextColor ?? null,
    observedStatusUuid: targetChanged ? null : current.observedStatusUuid,
    statusStartedAt: targetChanged ? null : current.statusStartedAt,
    lastNotifiedAt: targetChanged ? null : current.lastNotifiedAt,
    updatedAt: new Date().toISOString(),
  };

  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const patch: Record<string, unknown> = {
        duration_minutes: durationMinutes,
        enabled: next.enabled,
        line_uuid: next.lineUuid,
        line_name: next.lineName,
        group_name: next.groupName,
        status_uuid: next.statusUuid,
        status_name_th: next.statusNameTh,
        status_name_en: next.statusNameEn,
        status_name_ja: next.statusNameJa,
        status_background_color: next.statusBackgroundColor,
        status_text_color: next.statusTextColor,
        observed_status_uuid: next.observedStatusUuid,
        status_started_at: next.statusStartedAt,
        last_notified_at: next.lastNotifiedAt,
        updated_at: next.updatedAt,
      };
      let { data, error } = await withSupabaseRetry(
        () => supabase
          .from("line_notification_rules")
          .update(patch)
          .eq("id", id)
          .eq("line_user_id", lineUserId)
          .select("*")
          .maybeSingle(),
        "update-rule",
      );
      if (error && /status_text_color/i.test(error.message)) {
        delete patch.status_text_color;
        ({ data, error } = await withSupabaseRetry(
          () => supabase
            .from("line_notification_rules")
            .update(patch)
            .eq("id", id)
            .eq("line_user_id", lineUserId)
            .select("*")
            .maybeSingle(),
          "update-rule-legacy-schema",
        ));
      }
      if (error) throw new Error(`LINE_NOTIFICATION_RULE_UPDATE_FAILED: ${error.message}`);
      return data ? rowToRule(data as RuleRow) : null;
    }
  }

  const rules = readFileRules();
  const clash = Object.values(rules).find(
    (item) =>
      item.id !== id &&
      item.lineUserId === lineUserId &&
      item.lineUuid === next.lineUuid &&
      item.statusUuid === next.statusUuid,
  );
  if (clash) throw new Error("RULE_EXISTS");
  rules[id] = next;
  writeFileRules(rules);
  return next;
}

export async function deleteLineNotificationRule(id: string, lineUserId: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error, count } = await withSupabaseRetry(
        () => supabase
          .from("line_notification_rules")
          .delete({ count: "exact" })
          .eq("id", id)
          .eq("line_user_id", lineUserId),
        "delete-rule",
      );
      if (error) throw new Error(`LINE_NOTIFICATION_RULE_DELETE_FAILED: ${error.message}`);
      return Boolean(count);
    }
  }
  const rules = readFileRules();
  if (!rules[id] || rules[id].lineUserId !== lineUserId) return false;
  delete rules[id];
  writeFileRules(rules);
  return true;
}

export async function rememberLineNotificationObservation(
  rule: LineNotificationRule,
  statusUuid: string | null,
  observedAt: string,
) {
  const changed = rule.observedStatusUuid !== statusUuid;
  const nextStartedAt = changed ? observedAt : rule.statusStartedAt ?? observedAt;
  const nextNotifiedAt = changed ? null : rule.lastNotifiedAt;

  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await withSupabaseRetry(
        () => supabase
          .from("line_notification_rules")
          .update({
            observed_status_uuid: statusUuid,
            status_started_at: nextStartedAt,
            last_notified_at: nextNotifiedAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rule.id),
        "remember-observation",
      );
      if (error) throw new Error(`LINE_NOTIFICATION_STATE_UPDATE_FAILED: ${error.message}`);
    }
  } else {
    const rules = readFileRules();
    if (rules[rule.id]) {
      rules[rule.id] = {
        ...rules[rule.id],
        observedStatusUuid: statusUuid,
        statusStartedAt: nextStartedAt,
        lastNotifiedAt: nextNotifiedAt,
      };
      writeFileRules(rules);
    }
  }

  return { changed, statusStartedAt: nextStartedAt, lastNotifiedAt: nextNotifiedAt };
}

export async function markLineNotificationSent(ruleId: string, sentAt: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await withSupabaseRetry(
        () => supabase
          .from("line_notification_rules")
          .update({ last_notified_at: sentAt, updated_at: sentAt })
          .eq("id", ruleId),
        "mark-sent",
      );
      if (error) throw new Error(`LINE_NOTIFICATION_SENT_UPDATE_FAILED: ${error.message}`);
      return;
    }
  }
  const rules = readFileRules();
  if (!rules[ruleId]) return;
  rules[ruleId] = { ...rules[ruleId], lastNotifiedAt: sentAt, updatedAt: sentAt };
  writeFileRules(rules);
}
