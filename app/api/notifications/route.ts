import { NextResponse } from "next/server";
import { createNotificationRule, listNotificationRules, publicNotificationRule } from "@/lib/notification-configs";
import { ensureNotificationMonitorLoop } from "@/lib/notification-monitor-loop";

export const dynamic = "force-dynamic";
export async function GET() {
  ensureNotificationMonitorLoop();
  return NextResponse.json({ rules: (await listNotificationRules()).map(publicNotificationRule) });
}
export async function POST(request: Request) {
  try {
    const rule = await createNotificationRule(await request.json());
    ensureNotificationMonitorLoop();
    return NextResponse.json({ rule: publicNotificationRule(rule) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 });
  }
}
