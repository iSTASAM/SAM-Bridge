import { NextResponse } from "next/server";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";
import { lineWebPreviewEnabled } from "@/lib/line-web-preview";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getLineWebhookSettings();
  const webPreview = lineWebPreviewEnabled();
  return NextResponse.json({
    liffId: settings?.liffId ?? "",
    configured: Boolean(settings?.liffId && settings?.lineLoginChannelId),
    webPreview,
  });
}
