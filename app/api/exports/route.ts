import { NextResponse } from "next/server";
import {
  createExportConfig,
  listExportConfigs,
  publicExportConfig,
} from "@/lib/export-configs";
import { getSapConnection } from "@/lib/sap-connections";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ configs: (await listExportConfigs()).map(publicExportConfig) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXPORTS_LOAD_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.destinationType === "slack") {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    if (!isSlackWebhookUrl(endpoint)) {
      return NextResponse.json(
        { error: "INVALID_SLACK_WEBHOOK_URL" },
        { status: 400 },
      );
    }
  }
  if (body.destinationType === "sap-odata") {
    const sapConnectionId = typeof body.sapConnectionId === "string" ? body.sapConnectionId.trim() : "";
    if (!getSapConnection(sapConnectionId)?.lastTestOk) {
      return NextResponse.json({ error: "SAP_CONNECTION_REQUIRED" }, { status: 400 });
    }
  }
  try {
    return NextResponse.json(publicExportConfig(await createExportConfig(body)), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXPORTS_SAVE_FAILED";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
