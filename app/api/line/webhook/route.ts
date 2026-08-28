import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getLineChannelSecret } from "@/lib/line-webhook-settings";
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
  const secret = await getLineChannelSecret();
  return NextResponse.json({
    ok: true,
    service: "LINE webhook",
    configured: Boolean(secret),
  });
}

export async function POST(request: Request) {
  // Read body first so signature uses exact bytes LINE signed.
  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") ?? "";
  const secret = await getLineChannelSecret();

  if (!secret) {
    return NextResponse.json({ error: "LINE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!signatureIsValid(body, signature, secret)) {
    return NextResponse.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
  }

  // Acknowledge immediately-critical path is done; bookkeeping is best-effort.
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
        // ignore
      }
    }
  } catch {
    // ignore parse errors after valid signature
  }

  return NextResponse.json({ ok: true });
}
