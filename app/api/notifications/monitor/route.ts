import { NextRequest, NextResponse } from "next/server";
import { listNotificationRules, recordNotificationRun } from "@/lib/notification-configs";
import { monitorSlackNotification } from "@/lib/notification-runner";
import { monitorLineNotifications } from "@/lib/line-notification-runner";

export const dynamic = "force-dynamic";

async function runMonitors() {
  const results = [];
  for (const rule of listNotificationRules().filter((item) => item.enabled)) {
    try {
      const result = await monitorSlackNotification(rule);
      recordNotificationRun(rule.id, true);
      results.push({ id: rule.id, ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "MONITOR_FAILED";
      recordNotificationRun(rule.id, false, message);
      results.push({ id: rule.id, ok: false, error: message });
    }
  }
  const line = await monitorLineNotifications();
  return NextResponse.json({
    ok: results.every((item) => item.ok) && line.errors.length === 0,
    results,
    line,
  });
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runMonitors();
}

export async function POST() {
  return runMonitors();
}
