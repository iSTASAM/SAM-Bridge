import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { issueApiKey } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

function expiryFromChoice(value: string) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (key: string) => (typeof body?.[key] === "string" ? (body[key] as string) : "");
  const connectionId = text("connectionId");
  const session = await getRequestSession();
  if (!canAccessConnection(session, connectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const issued = await issueApiKey({
    connectionId,
    groupUuid: text("groupUuid"),
    groupName: text("groupName"),
    lineUuid: text("lineUuid"),
    lineName: text("lineName"),
    name: text("name"),
    environment: text("environment") === "test" ? "test" : "live",
    expiresAt: expiryFromChoice(text("expiration")),
  });
  if (!issued) {
    return NextResponse.json({ error: "A valid company and line are required" }, { status: 400 });
  }
  return NextResponse.json(issued);
}
