import { NextResponse } from "next/server";
import { testSlackWebhookConnection } from "@/lib/notification-runner";
import {
  getSlackSettings,
  publicSlackSettings,
  saveSlackEventSettings,
  saveSlackSettings,
} from "@/lib/slack-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(publicSlackSettings(await getSlackSettings()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "save";

  try {
    if (action === "test") {
      await testSlackWebhookConnection();
      return NextResponse.json({ ok: true });
    }

    if (action === "events") {
      const saved = await saveSlackEventSettings({
        publicUrl: typeof body.publicUrl === "string" ? body.publicUrl : undefined,
        signingSecret: typeof body.signingSecret === "string" ? body.signingSecret : undefined,
      });
      return NextResponse.json(publicSlackSettings(saved));
    }

    const saved = await saveSlackSettings({
      publicUrl: typeof body.publicUrl === "string" ? body.publicUrl : "",
      incomingWebhook: typeof body.incomingWebhook === "string" ? body.incomingWebhook : "",
      channelId: typeof body.channelId === "string" ? body.channelId : "",
      botToken: typeof body.botToken === "string" ? body.botToken : "",
      signingSecret: typeof body.signingSecret === "string" ? body.signingSecret : "",
    });
    return NextResponse.json(publicSlackSettings(saved));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 });
  }
}
