import { NextResponse } from "next/server";
import {
  deleteExportConfig,
  getExportConfig,
  publicExportConfig,
  updateExportConfig,
} from "@/lib/export-configs";
import { getSapConnection } from "@/lib/sap-connections";
import { isSlackWebhookUrl } from "@/lib/slack-webhook";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = getExportConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicExportConfig(config));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const current = getExportConfig(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const destinationType =
    typeof body.destinationType === "string" ? body.destinationType : current.destinationType;
  if (destinationType === "slack") {
    const supplied = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    const endpoint = supplied || (current.destinationType === "slack" ? current.endpoint : "");
    if (!isSlackWebhookUrl(endpoint)) {
      return NextResponse.json(
        { error: "INVALID_SLACK_WEBHOOK_URL" },
        { status: 400 },
      );
    }
  }
  if (destinationType === "sap-odata") {
    const sapConnectionId =
      typeof body.sapConnectionId === "string"
        ? body.sapConnectionId.trim()
        : current.destinationType === "sap-odata"
          ? current.sapConnectionId
          : "";
    if (!getSapConnection(sapConnectionId)?.lastTestOk) {
      return NextResponse.json({ error: "SAP_CONNECTION_REQUIRED" }, { status: 400 });
    }
  }
  const config = updateExportConfig(id, body);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicExportConfig(config));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!deleteExportConfig(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
