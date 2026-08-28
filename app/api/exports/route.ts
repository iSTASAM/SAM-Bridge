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
  return NextResponse.json({ configs: listExportConfigs().map(publicExportConfig) });
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
  return NextResponse.json(publicExportConfig(createExportConfig(body)), { status: 201 });
}
