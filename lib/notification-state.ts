import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

const FILE = path.join(process.cwd(), "data", "notification-state.json");
type State = Record<string, Record<string, string | null>>;

export type NotificationStatusClaim = {
  claimed: boolean;
  previousStatus: string | null | undefined;
};

function readState(): State {
  if (!existsSync(FILE)) return {};
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as State;
  } catch {
    return {};
  }
}

function writeState(state: State) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function previousNotificationStatus(ruleId: string, lineId: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from("slack_notification_state")
        .select("status_uuid")
        .eq("rule_id", ruleId)
        .eq("line_uuid", lineId)
        .maybeSingle();
      if (error) throw new Error(`SLACK_STATE_LOAD_FAILED: ${error.message}`);
      return (data?.status_uuid as string | null | undefined) ?? undefined;
    }
  }
  return readState()[ruleId]?.[lineId];
}

export async function statusTransitions(ruleId: string, current: Record<string, string | null>) {
  const changed: string[] = [];
  for (const [lineId, statusUuid] of Object.entries(current)) {
    if ((await previousNotificationStatus(ruleId, lineId)) !== statusUuid) changed.push(lineId);
  }
  return changed;
}

export async function rememberNotificationLineStatus(ruleId: string, lineId: string, statusUuid: string | null) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { error } = await supabase.from("slack_notification_state").upsert(
      {
        rule_id: ruleId,
        line_uuid: lineId,
        status_uuid: statusUuid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "rule_id,line_uuid" },
    );
    if (error) throw new Error(`SLACK_STATE_SAVE_FAILED: ${error.message}`);
    return;
  }
  const state = readState();
  state[ruleId] = { ...(state[ruleId] ?? {}), [lineId]: statusUuid };
  writeState(state);
}

/**
 * Atomically claim a status transition before sending.
 * Returns the previous status so a failed delivery can release only its own claim.
 */
export async function claimNotificationLineStatus(
  ruleId: string,
  lineId: string,
  statusUuid: string,
): Promise<NotificationStatusClaim> {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { claimed: false, previousStatus: undefined };
    const now = new Date().toISOString();
    let previous = await previousNotificationStatus(ruleId, lineId);
    if (previous === statusUuid) return { claimed: false, previousStatus: previous };

    if (previous == null) {
      const { error } = await supabase.from("slack_notification_state").insert({
        rule_id: ruleId,
        line_uuid: lineId,
        status_uuid: statusUuid,
        updated_at: now,
      });
      if (!error) return { claimed: true, previousStatus: previous };
      if (error.code !== "23505") throw new Error(`SLACK_STATE_SAVE_FAILED: ${error.message}`);
      // Another invocation may have inserted the same transition, or a legacy
      // row may already exist with null status. Re-read before deciding.
      previous = await previousNotificationStatus(ruleId, lineId);
      if (previous === statusUuid) return { claimed: false, previousStatus: previous };
    }

    let query = supabase
      .from("slack_notification_state")
      .update({ status_uuid: statusUuid, updated_at: now })
      .eq("rule_id", ruleId)
      .eq("line_uuid", lineId)
      .select("rule_id");
    query = previous == null ? query.is("status_uuid", null) : query.eq("status_uuid", previous);
    const { data, error } = await query;
    if (error) throw new Error(`SLACK_STATE_SAVE_FAILED: ${error.message}`);
    return { claimed: (data?.length ?? 0) > 0, previousStatus: previous };
  }

  const state = readState();
  const previous = state[ruleId]?.[lineId];
  if (previous === statusUuid) return { claimed: false, previousStatus: previous };
  state[ruleId] = { ...(state[ruleId] ?? {}), [lineId]: statusUuid };
  writeState(state);
  return { claimed: true, previousStatus: previous };
}

/**
 * Releases a failed delivery claim without overwriting a newer observation.
 */
export async function releaseNotificationLineStatus(
  ruleId: string,
  lineId: string,
  claimedStatus: string,
  previousStatus: string | null | undefined,
) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const result = previousStatus === undefined
      ? await supabase
          .from("slack_notification_state")
          .delete()
          .eq("rule_id", ruleId)
          .eq("line_uuid", lineId)
          .eq("status_uuid", claimedStatus)
      : await supabase
          .from("slack_notification_state")
          .update({ status_uuid: previousStatus, updated_at: new Date().toISOString() })
          .eq("rule_id", ruleId)
          .eq("line_uuid", lineId)
          .eq("status_uuid", claimedStatus);
    if (result.error) throw new Error(`SLACK_STATE_RELEASE_FAILED: ${result.error.message}`);
    return;
  }

  const state = readState();
  if (state[ruleId]?.[lineId] !== claimedStatus) return;
  if (previousStatus === undefined) {
    delete state[ruleId][lineId];
    if (Object.keys(state[ruleId]).length === 0) delete state[ruleId];
  } else {
    state[ruleId][lineId] = previousStatus;
  }
  writeState(state);
}

export async function rememberNotificationState(ruleId: string, current: Record<string, string | null>) {
  await Promise.all(
    Object.entries(current).map(([lineId, statusUuid]) => rememberNotificationLineStatus(ruleId, lineId, statusUuid)),
  );
}

export async function deleteNotificationState(ruleId: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { error } = await supabase.from("slack_notification_state").delete().eq("rule_id", ruleId);
    if (error) throw new Error(`SLACK_STATE_DELETE_FAILED: ${error.message}`);
    return;
  }
  const state = readState();
  delete state[ruleId];
  writeState(state);
}
