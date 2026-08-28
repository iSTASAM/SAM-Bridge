import { NextResponse } from "next/server";
import { createNotificationRule, listNotificationRules, publicNotificationRule } from "@/lib/notification-configs";

export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ rules: listNotificationRules().map(publicNotificationRule) }); }
export async function POST(request: Request) {
  try { const rule = createNotificationRule(await request.json()); return NextResponse.json({ rule: publicNotificationRule(rule) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 }); }
}
