import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";
import { markLineFriendship } from "@/lib/line-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeSecret(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function signatureIsValid(body: Buffer, signature: string, secret: string) {
  const normalizedSecret = normalizeSecret(secret);
  const normalizedSignature = signature.trim();
  if (!normalizedSignature || !normalizedSecret) return false;
  const expected = createHmac("sha256", normalizedSecret).update(body).digest("base64");
  const actualBuffer = Buffer.from(normalizedSignature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET() {
  const settings = await getLineWebhookSettings();
  return NextResponse.json({
    ok: true,
    service: "LINE webhook",
    configured: Boolean(settings?.channelSecret),
  });
}

export async function POST(request: Request) {
  const settings = await getLineWebhookSettings();
  if (!settings?.channelSecret) {
    return NextResponse.json({ error: "LINE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!signatureIsValid(body, signature, settings.channelSecret)) {
    return NextResponse.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body.toString("utf8") || "{}") as {
      events?: Array<{ type?: string; source?: { userId?: string } }>;
    };
    for (const event of payload.events ?? []) {
      const userId = event.source?.userId;
      if (!userId) continue;
      try {
        if (event.type === "follow") markLineFriendship(userId, "linked");
        if (event.type === "unfollow") markLineFriendship(userId, "blocked");
      } catch {
        // Friendship bookkeeping must not fail LINE webhook delivery/verify.
      }
    }
  } catch {
    // LINE Verify may send a body we can still acknowledge after signature check.
  }

  return NextResponse.json({ ok: true });
}
