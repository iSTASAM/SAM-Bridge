import { NextResponse } from "next/server";
import { getLineWebhookSettings } from "@/lib/line-webhook-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getLineWebhookSettings();
  return NextResponse.json({
    liffId: settings?.liffId ?? "",
    configured: Boolean(settings?.liffId && settings?.lineLoginChannelId),
  });
}
