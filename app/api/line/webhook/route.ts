import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";
import { markLineFriendship } from "@/lib/line-users";

export const dynamic = "force-dynamic";

function signatureIsValid(body: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "LINE webhook" });
}

export async function POST(request: Request) {
  const settings = getLineWebhookSettings();
  if (!settings?.channelSecret) return NextResponse.json({ error: "LINE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!signatureIsValid(body, signature, settings.channelSecret)) {
    return NextResponse.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
  }
  const payload = JSON.parse(body) as { events?: Array<{ type?: string; source?: { userId?: string } }> };
  for (const event of payload.events ?? []) {
    const userId = event.source?.userId;
    if (userId && event.type === "follow") markLineFriendship(userId, "linked");
    if (userId && event.type === "unfollow") markLineFriendship(userId, "blocked");
  }
  return NextResponse.json({ ok: true });
}
