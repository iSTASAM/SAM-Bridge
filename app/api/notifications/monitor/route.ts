import { NextRequest, NextResponse } from "next/server";
import { monitorLineNotifications } from "@/lib/line-notification-runner";
import { ensureNotificationMonitorLoop } from "@/lib/notification-monitor-loop";
import { monitorSlackNotifications } from "@/lib/notification-runner";

export const dynamic = "force-dynamic";

async function runMonitors() {
  ensureNotificationMonitorLoop();
  const slack = await monitorSlackNotifications();
  const line = await monitorLineNotifications();
  return NextResponse.json({
    ok: slack.errors.length === 0 && line.errors.length === 0,
    slack,
    line,
  });
}

function cronAuthorized(request: NextRequest) {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  // Optional Supabase pg_cron (or manual) caller. Not used by Vercel Cron.
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runMonitors();
}

/** Browser/settings poll + cron POST. Detection itself is cheap; auth is enforced on GET for scheduled jobs. */
export async function POST() {
  return runMonitors();
}
