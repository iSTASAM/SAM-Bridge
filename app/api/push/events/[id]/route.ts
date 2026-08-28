import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { deletePushEvent, getPushEvent } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getPushEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const session = await getRequestSession();
  if (event.connectionId && !canAccessConnection(session, event.connectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await deletePushEvent(id))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
