import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getLineChannelSecret, getLineWebhookSettings } from "@/lib/line-webhook-settings";
import { markLineFriendship } from "@/lib/line-users";
import { lineLoginStatus } from "@/lib/line-logins";
import { linkLoggedInRichMenu, replyLineMessages, unlinkUserRichMenu } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
};

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

function liffOpenUrl(liffId: string) {
  return `https://liff.line.me/${encodeURIComponent(liffId)}`;
}

async function syncRichMenu(userId: string) {
  const status = await lineLoginStatus(userId);
  if (status === "in") {
    await linkLoggedInRichMenu(userId);
    return "in" as const;
  }
  if (status === "out") {
    await unlinkUserRichMenu(userId);
    return "out" as const;
  }
  return "unknown" as const;
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
  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") ?? "";
  const secret = await getLineChannelSecret();

  if (!secret) {
    return NextResponse.json({ error: "LINE_WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!signatureIsValid(body, signature, secret)) {
    return NextResponse.json({ error: "INVALID_LINE_SIGNATURE" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body.toString("utf8") || "{}") as { events?: LineEvent[] };
    const settings = await getLineWebhookSettings();
    const liffId = settings?.liffId ?? "";

    for (const event of payload.events ?? []) {
      const userId = event.source?.userId;
      if (!userId) continue;

      try {
        if (event.type === "follow") markLineFriendship(userId, "linked");
        if (event.type === "unfollow") markLineFriendship(userId, "blocked");
      } catch {
        // ignore
      }

      try {
        await syncRichMenu(userId);
      } catch (error) {
        console.warn("webhook rich menu sync failed:", error);
      }

      const text = event.message?.type === "text" ? event.message.text?.trim().toLowerCase() ?? "" : "";
      const wantsMenu = event.type === "message" && (text === "menu" || text === "เมนู");
      if (wantsMenu && event.replyToken && liffId) {
        const status = await lineLoginStatus(userId);
        const openUrl = liffOpenUrl(liffId);
        const loggedIn = status === "in";
        try {
          await replyLineMessages(event.replyToken, [
            {
              type: "template",
              altText: loggedIn ? "เปิด SAM Bridge" : "เข้าสู่ระบบ SAM Bridge",
              template: {
                type: "buttons",
                text: loggedIn
                  ? "แตะเพื่อเปิดสถานะการผลิต"
                  : "แตะเพื่อเข้าสู่ระบบ SAM Bridge",
                actions: [
                  {
                    type: "uri",
                    label: loggedIn ? "เปิดบอร์ด" : "เข้าสู่ระบบ",
                    uri: openUrl,
                  },
                ],
              },
            },
          ]);
        } catch (error) {
          console.warn("webhook menu reply failed:", error);
        }
      }
    }
  } catch {
    // ignore parse errors after valid signature
  }

  return NextResponse.json({ ok: true });
}
