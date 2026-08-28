import { NextResponse } from "next/server";
import { listNotificationRules, recordNotificationRun } from "@/lib/notification-configs";
import { monitorSlackNotification } from "@/lib/notification-runner";
export const dynamic = "force-dynamic";
export async function POST() {
  const results = [];
  for (const rule of listNotificationRules().filter((item) => item.enabled)) {
    try { const result = await monitorSlackNotification(rule); recordNotificationRun(rule.id, true); results.push({ id: rule.id, ok: true, ...result }); }
    catch (error) { const message = error instanceof Error ? error.message : "MONITOR_FAILED"; recordNotificationRun(rule.id, false, message); results.push({ id: rule.id, ok: false, error: message }); }
  }
  return NextResponse.json({ ok: results.every((item) => item.ok), results });
}
