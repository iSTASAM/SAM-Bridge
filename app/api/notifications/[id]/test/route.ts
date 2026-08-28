import { NextResponse } from "next/server";
import { getNotificationRule } from "@/lib/notification-configs";
import { testSlackNotification } from "@/lib/notification-runner";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const rule = getNotificationRule(id); if (!rule) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try { await testSlackNotification(rule); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "TEST_FAILED" }, { status: 502 }); }
}
