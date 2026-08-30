import { NextResponse } from "next/server";
import {
  getExportConfig,
  publicExportConfig,
  recordExportRun,
} from "@/lib/export-configs";
import { runSlackExport } from "@/lib/export-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = await getExportConfig(id);
  if (!config) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const result = await runSlackExport(config);
    const updated = await recordExportRun(id, true);
    return NextResponse.json({
      ok: true,
      rowCount: result.rowCount,
      sourceRowCount: result.sourceRowCount,
      unchangedCount: result.unchangedCount,
      messageCount: result.messageCount,
      collectedAt: result.collectedAt,
      config: updated ? publicExportConfig(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXPORT_FAILED";
    await recordExportRun(id, false, message);
    const badRequest = [
      "SLACK_ONLY",
      "INVALID_SLACK_WEBHOOK_URL",
      "CONNECTION_NOT_FOUND",
      "NO_PRODUCTION_LINES",
      "ALERT_RULES_REQUIRED",
    ].includes(message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: badRequest ? 400 : 502 },
    );
  }
}
