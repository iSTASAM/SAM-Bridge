import { NextResponse } from "next/server";
import {
  getExportConfig,
  publicExportConfig,
  recordExportRun,
} from "@/lib/export-configs";
import { testSlackExport } from "@/lib/export-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = getExportConfig(id);
  if (!config) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const result = await testSlackExport(config);
    const updated = recordExportRun(id, true);
    return NextResponse.json({
      ok: true,
      ...result,
      config: updated ? publicExportConfig(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SLACK_TEST_FAILED";
    recordExportRun(id, false, message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
