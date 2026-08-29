import { NextResponse } from "next/server";
import {
  getLineWebhookSettingsMeta,
  saveLineWebhookSettings,
} from "@/lib/line-webhook-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const { settings, storage, supabaseConfigured } = await getLineWebhookSettingsMeta();
  return NextResponse.json({
    configured: Boolean(settings?.channelSecret || settings?.publicUrl),
    publicUrl: settings?.publicUrl ?? "",
    callbackUrl: settings?.publicUrl ? `${settings.publicUrl}/api/line/webhook` : "",
    channelSecretConfigured: Boolean(settings?.channelSecret),
    channelAccessTokenConfigured: Boolean(settings?.channelAccessToken),
    liffId: settings?.liffId ?? "",
    lineLoginChannelId: settings?.lineLoginChannelId ?? "",
    updatedAt: settings?.updatedAt ?? null,
    storage,
    supabaseConfigured,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    publicUrl?: unknown;
    channelSecret?: unknown;
    channelAccessToken?: unknown;
    liffId?: unknown;
    lineLoginChannelId?: unknown;
  };
  try {
    const saved = await saveLineWebhookSettings(
      typeof body.publicUrl === "string" ? body.publicUrl : "",
      typeof body.channelSecret === "string" ? body.channelSecret : "",
      typeof body.liffId === "string" ? body.liffId : "",
      typeof body.lineLoginChannelId === "string" ? body.lineLoginChannelId : "",
      typeof body.channelAccessToken === "string" ? body.channelAccessToken : "",
    );
    return NextResponse.json({
      configured: true,
      publicUrl: saved.publicUrl,
      callbackUrl: `${saved.publicUrl}/api/line/webhook`,
      channelSecretConfigured: true,
      channelAccessTokenConfigured: Boolean(saved.channelAccessToken),
      liffId: saved.liffId,
      lineLoginChannelId: saved.lineLoginChannelId,
      updatedAt: saved.updatedAt,
      storage: "supabase",
      supabaseConfigured: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SAVE_FAILED" },
      { status: 400 },
    );
  }
}
