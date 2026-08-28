import { NextResponse } from "next/server";
import { getLineWebhookSettings, saveLineWebhookSettings } from "@/lib/line-webhook-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getLineWebhookSettings();
  return NextResponse.json({
    configured: Boolean(settings),
    publicUrl: settings?.publicUrl ?? "",
    callbackUrl: settings ? `${settings.publicUrl}/api/line/webhook` : "",
    channelSecretConfigured: Boolean(settings?.channelSecret),
    liffId: settings?.liffId ?? "",
    lineLoginChannelId: settings?.lineLoginChannelId ?? "",
    updatedAt: settings?.updatedAt ?? null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { publicUrl?: unknown; channelSecret?: unknown; liffId?: unknown; lineLoginChannelId?: unknown };
  try {
    const saved = saveLineWebhookSettings(
      typeof body.publicUrl === "string" ? body.publicUrl : "",
      typeof body.channelSecret === "string" ? body.channelSecret : "",
      typeof body.liffId === "string" ? body.liffId : "",
      typeof body.lineLoginChannelId === "string" ? body.lineLoginChannelId : "",
    );
    return NextResponse.json({ configured: true, publicUrl: saved.publicUrl, callbackUrl: `${saved.publicUrl}/api/line/webhook`, channelSecretConfigured: true, liffId: saved.liffId, lineLoginChannelId: saved.lineLoginChannelId, updatedAt: saved.updatedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 });
  }
}
