import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export type LineLoginRecord = {
  lineUserId: string;
  connectionId: string;
  customerId: string;
  loginId: string;
  loggedIn: boolean;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
};

type DbRow = {
  line_user_id: string;
  connection_id: string | null;
  customer_id: string;
  login_id: string;
  logged_in: boolean;
  last_login_at: string | null;
  last_logout_at: string | null;
};

const FILE = path.join(process.cwd(), "data", "line-logins.json");

function isRealLineUserId(userId: string) {
  return Boolean(userId) && !userId.startsWith("web-preview:");
}

function rowToRecord(row: DbRow): LineLoginRecord | null {
  if (!row.line_user_id || !row.connection_id) return null;
  return {
    lineUserId: row.line_user_id,
    connectionId: row.connection_id,
    customerId: row.customer_id ?? "",
    loginId: row.login_id ?? "",
    loggedIn: Boolean(row.logged_in),
    lastLoginAt: row.last_login_at,
    lastLogoutAt: row.last_logout_at,
  };
}

function readFileStore(): Record<string, LineLoginRecord> {
  if (!existsSync(FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { logins?: Record<string, LineLoginRecord> };
    return parsed.logins ?? {};
  } catch {
    return {};
  }
}

function writeFileStore(logins: Record<string, LineLoginRecord>) {
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ logins }, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch {
    // Vercel ephemeral FS — skip.
  }
}

export async function listLineLogins(): Promise<LineLoginRecord[]> {
  if (supabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from("line_logins")
          .select("*")
          .order("last_login_at", { ascending: false });
        if (error) throw error;
        return ((data ?? []) as DbRow[])
          .map(rowToRecord)
          .filter((row): row is LineLoginRecord => row !== null && isRealLineUserId(row.lineUserId));
      }
    } catch (error) {
      console.warn("listLineLogins failed:", error);
    }
  }

  return Object.values(readFileStore()).filter((row) => isRealLineUserId(row.lineUserId));
}

export async function getLineLogin(lineUserId: string): Promise<LineLoginRecord | null> {
  if (!isRealLineUserId(lineUserId)) return null;

  if (supabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data, error } = await supabase
          .from("line_logins")
          .select("*")
          .eq("line_user_id", lineUserId)
          .maybeSingle();
        if (error) throw error;
        if (data) return rowToRecord(data as DbRow);
        return null;
      }
    } catch (error) {
      console.warn("getLineLogin failed:", error);
    }
  }

  return readFileStore()[lineUserId] ?? null;
}

/** Authorization checks fail closed when the configured durable store is unavailable. */
export async function getLineLoginForAuthorization(lineUserId: string): Promise<LineLoginRecord | null> {
  if (!isRealLineUserId(lineUserId)) return null;
  if (!supabaseConfigured()) return readFileStore()[lineUserId] ?? null;
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("line_logins")
      .select("*")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToRecord(data as DbRow) : null;
  } catch (error) {
    console.warn("LINE authorization lookup failed closed:", error);
    return null;
  }
}

export async function markLineLoggedIn(input: {
  lineUserId: string;
  connectionId: string;
  customerId: string;
  loginId: string;
}): Promise<void> {
  if (!isRealLineUserId(input.lineUserId)) return;
  const now = new Date().toISOString();

  if (supabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase.from("line_logins").upsert(
          {
            line_user_id: input.lineUserId,
            connection_id: input.connectionId,
            customer_id: input.customerId,
            login_id: input.loginId,
            logged_in: true,
            last_login_at: now,
          },
          { onConflict: "line_user_id" },
        );
        if (error) throw error;
        return;
      }
    } catch (error) {
      console.warn("markLineLoggedIn failed:", error);
    }
  }

  const logins = readFileStore();
  const previous = logins[input.lineUserId];
  logins[input.lineUserId] = {
    lineUserId: input.lineUserId,
    connectionId: input.connectionId,
    customerId: input.customerId,
    loginId: input.loginId,
    loggedIn: true,
    lastLoginAt: now,
    lastLogoutAt: previous?.lastLogoutAt ?? null,
  };
  writeFileStore(logins);
}

export async function markLineLoggedOut(lineUserId: string): Promise<void> {
  if (!isRealLineUserId(lineUserId)) return;
  const now = new Date().toISOString();

  if (supabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase
          .from("line_logins")
          .update({ logged_in: false, last_logout_at: now })
          .eq("line_user_id", lineUserId);
        if (error) throw error;
        return;
      }
    } catch (error) {
      console.warn("markLineLoggedOut failed:", error);
    }
  }

  const logins = readFileStore();
  const current = logins[lineUserId];
  if (!current) return;
  logins[lineUserId] = { ...current, loggedIn: false, lastLogoutAt: now };
  writeFileStore(logins);
}

/** Cookie may still be present after logout — trust the durable flag. */
export async function lineLoginStatus(lineUserId: string): Promise<"in" | "out" | "unknown"> {
  if (!isRealLineUserId(lineUserId)) return "unknown";
  const record = await getLineLogin(lineUserId);
  if (!record) return "unknown";
  return record.loggedIn ? "in" : "out";
}
