import { NextResponse } from "next/server";
import {
  deleteNotificationRule,
  getNotificationRule,
  publicNotificationRule,
  updateNotificationRule,
} from "@/lib/notification-configs";
import { deleteNotificationState } from "@/lib/notification-state";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rule = await getNotificationRule(id);
  if (!rule) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ rule: publicNotificationRule(rule) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rule = await updateNotificationRule(id, await request.json());
    if (!rule) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ rule: publicNotificationRule(rule) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await deleteNotificationRule(id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await deleteNotificationState(id);
  return NextResponse.json({ ok: true });
}
